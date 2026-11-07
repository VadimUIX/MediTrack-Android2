import { Capacitor, registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { buildDay } from "@/lib/meditrack/engine";
import { addDays, atDateTime, hashStr, inQuiet, todayISO } from "@/lib/meditrack/dates";
import { doseText } from "@/lib/meditrack/format";
import type { NotifSettings, Profile, Medication, DoseLog, ScheduleOverride } from "@/lib/meditrack/types";

export type NotifPerm = "granted" | "denied" | "default" | "unknown";

type NativeDoseNotification = {
  id: number;
  at: number;
  doseKey: string;
  title: string;
  body: string;
  channelId: string;
  medicationId: string;
  profileId: string;
  date: string;
  time: string;
  scheduledTime: string;
};

export type NativeDoseAction = {
  eventId: string;
  actionId: "taken" | "snooze";
  medicationId: string;
  profileId: string;
  date: string;
  time: string;
  scheduledTime: string;
  actedAt: number;
  snoozeUntil?: number;
};

interface DoseNotificationsPlugin {
  schedule(options: {
    notifications: NativeDoseNotification[];
    snoozeMin: number;
    takenLabel: string;
    snoozeLabel: string;
  }): Promise<{ scheduled: number; exactAlarmPermission: boolean }>;
  getPendingActions(): Promise<{ actions: NativeDoseAction[] }>;
  acknowledgeActions(options: { eventIds: string[] }): Promise<void>;
  checkExactAlarmPermission(): Promise<{ granted: boolean }>;
  openExactAlarmSettings(): Promise<void>;
}

const DoseNotifications = registerPlugin<DoseNotificationsPlugin>("DoseNotifications");

export function isNative(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

export async function getNotifPermission(): Promise<NotifPerm> {
  if (isNative()) {
    try {
      const r = await LocalNotifications.checkPermissions();
      return r.display === "granted" ? "granted" : r.display === "denied" ? "denied" : "default";
    } catch {
      return "unknown";
    }
  }
  if (typeof Notification !== "undefined") return Notification.permission;
  return "unknown";
}

export async function requestNotifPermission(): Promise<NotifPerm> {
  if (isNative()) {
    try {
      const r = await LocalNotifications.requestPermissions();
      return r.display === "granted" ? "granted" : "denied";
    } catch {
      return "unknown";
    }
  }
  if (typeof Notification !== "undefined") return Notification.requestPermission();
  return "unknown";
}

function hashId(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % 2147483647 || 1;
}

export async function showNotification(title: string, body: string, key: string, sound = true, vibrate = true): Promise<void> {
  if (isNative()) {
    try {
      await LocalNotifications.schedule({
        notifications: [{ id: hashId(key + Date.now()), title, body, channelId: sound ? (vibrate ? "meditrack_dose_sound_vibrate_v3" : "meditrack_dose_sound_v3") : (vibrate ? "meditrack_dose_vibrate_v3" : "meditrack_dose_silent_v3") }],
      });
    } catch {
      /* ignore */
    }
    return;
  }
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      const note = new Notification(title, { body, tag: key });
      note.onclick = () => window.focus();
    } catch {
      /* unsupported */
    }
  }
}

type DoseNotificationState = {
  profiles: Profile[];
  medications: Medication[];
  logs: DoseLog[];
  overrides: ScheduleOverride[];
  notif: NotifSettings;
  lang: "ru" | "en";
  title: string;
  takenLabel: string;
  snoozeLabel: string;
  body: (args: { profile: Profile; medication: Medication; time: string }) => string;
};

let scheduleQueue: Promise<void> = Promise.resolve();

async function performNotificationSync(state: DoseNotificationState): Promise<void> {
  if (!isNative()) return;

  if (!state.notif.enabled) {
    await DoseNotifications.schedule({
      notifications: [],
      snoozeMin: state.notif.snoozeMin ?? 15,
      takenLabel: state.takenLabel,
      snoozeLabel: state.snoozeLabel,
    });
    return;
  }

  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") {
    await DoseNotifications.schedule({
      notifications: [],
      snoozeMin: state.notif.snoozeMin ?? 15,
      takenLabel: state.takenLabel,
      snoozeLabel: state.snoozeLabel,
    });
    return;
  }

  const now = new Date();
  const scheduled: NativeDoseNotification[] = [];
  const usedIds = new Set<number>();
  const channelId = state.notif.sound
    ? (state.notif.vibrate ? "meditrack_dose_sound_vibrate_v3" : "meditrack_dose_sound_v3")
    : (state.notif.vibrate ? "meditrack_dose_vibrate_v3" : "meditrack_dose_silent_v3");

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = addDays(todayISO(now), dayOffset);
    for (const profile of state.profiles) {
      const slots = buildDay({ date, now, profile, medications: state.medications, logs: state.logs, overrides: state.overrides });
      for (const slot of slots) {
        if (slot.view === "away" || slot.view === "taken_on_time" || slot.view === "taken_late" || slot.view === "skipped") continue;
        const medication = slot.medication;
        const doseKey = `${medication.id}|${date}|${slot.baseTime}`;
        const baseKey = `${profile.id}|${medication.id}|${date}|${slot.baseTime}`;
        const quietAt = (at: Date) => state.notif.quietEnabled && !medication.critical && inQuiet(at, state.notif.quietFrom, state.notif.quietTo);
        const doseBody = state.body({ profile, medication, time: slot.time });
        const doseAt = atDateTime(date, slot.time);
        const lastAllowed = doseAt.getTime() + (medication.schedule.windowMin + state.notif.repeatCount * state.notif.repeatMin) * 60000;

        if (slot.view === "snoozed" && slot.log?.snoozeUntil) {
          const snoozeAt = new Date(slot.log.snoozeUntil);
          if (snoozeAt.getTime() > now.getTime() && snoozeAt.getTime() <= doseAt.getTime() + 24 * 60 * 60000 && !quietAt(snoozeAt)) {
            const id = hashId(baseKey + "|snooze");
            if (!usedIds.has(id)) {
              usedIds.add(id);
              scheduled.push({
                id, at: snoozeAt.getTime(), doseKey, title: state.title, body: doseBody, channelId,
                medicationId: medication.id, profileId: profile.id, date, time: slot.baseTime, scheduledTime: slot.time,
              });
            }
          }
          continue;
        }

        const firstAt = Math.max(doseAt.getTime(), now.getTime() + 2000);
        if (firstAt > lastAllowed) continue;
        for (let repeat = 0; repeat <= state.notif.repeatCount; repeat++) {
          const fireAt = firstAt + repeat * state.notif.repeatMin * 60000;
          if (fireAt > lastAllowed) break;
          const at = new Date(fireAt);
          if (quietAt(at)) continue;
          const id = hashId(baseKey + "|repeat|" + repeat);
          if (usedIds.has(id)) continue;
          usedIds.add(id);
          scheduled.push({
            id, at: fireAt, doseKey, title: state.title, body: doseBody, channelId,
            medicationId: medication.id, profileId: profile.id, date, time: slot.baseTime, scheduledTime: slot.time,
          });
        }
      }
    }
  }

  scheduled.sort((a, b) => a.at - b.at);
  await DoseNotifications.schedule({
    notifications: scheduled,
    snoozeMin: state.notif.snoozeMin ?? 15,
    takenLabel: state.takenLabel,
    snoozeLabel: state.snoozeLabel,
  });
}

export function syncDoseNotifications(state: DoseNotificationState): Promise<void> {
  scheduleQueue = scheduleQueue.then(() => performNotificationSync(state)).catch((error) => {
    console.error("MediTrack native notification scheduling failed", error);
  });
  return scheduleQueue;
}

export async function getPendingDoseActions(): Promise<NativeDoseAction[]> {
  if (!isNative()) return [];
  try {
    const result = await DoseNotifications.getPendingActions();
    return Array.isArray(result.actions) ? result.actions : [];
  } catch (error) {
    console.error("MediTrack could not read pending notification actions", error);
    return [];
  }
}

export async function acknowledgeDoseActions(eventIds: string[]): Promise<void> {
  if (!isNative() || !eventIds.length) return;
  await DoseNotifications.acknowledgeActions({ eventIds });
}

export async function getExactAlarmPermission(): Promise<NotifPerm> {
  if (!isNative()) return "granted";
  try {
    const result = await DoseNotifications.checkExactAlarmPermission();
    return result.granted ? "granted" : "denied";
  } catch {
    return "unknown";
  }
}

export async function requestExactAlarmPermission(): Promise<NotifPerm> {
  if (!isNative()) return "granted";
  try {
    await DoseNotifications.openExactAlarmSettings();
    return await getExactAlarmPermission();
  } catch {
    return "unknown";
  }
}
