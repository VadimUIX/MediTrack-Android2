import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { buildDay } from "@/lib/meditrack/engine";
import { addDays, atDateTime, hashStr, inQuiet, todayISO } from "@/lib/meditrack/dates";
import { doseText } from "@/lib/meditrack/format";
import type { NotifSettings, Profile, Medication, DoseLog, ScheduleOverride } from "@/lib/meditrack/types";

export type NotifPerm = "granted" | "denied" | "default" | "unknown";

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


const SCHEDULED_IDS_KEY = "meditrack-native-dose-notification-ids";
let scheduleQueue: Promise<void> = Promise.resolve();

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

function notificationId(key: string): number {
  return (hashStr(key) % 2147483646) + 1;
}

async function performNotificationSync(state: DoseNotificationState): Promise<void> {
  if (!isNative()) return;

  let oldIds: number[] = [];
  try {
    const raw = localStorage.getItem(SCHEDULED_IDS_KEY);
    oldIds = raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    oldIds = [];
  }

  if (oldIds.length) {
    try {
      const pending = await LocalNotifications.getPending();
      const pendingIds = new Set(pending.notifications.map((item) => item.id));
      const toCancel = oldIds.filter((id) => pendingIds.has(id)).map((id) => ({ id }));
      if (toCancel.length) await LocalNotifications.cancel({ notifications: toCancel });
    } catch {
      // Continue with a fresh schedule; old alarms retain their original expiry.
    }
  }
  localStorage.removeItem(SCHEDULED_IDS_KEY);
  if (!state.notif.enabled) return;

  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") return;

  await LocalNotifications.registerActionTypes({
    types: [{
      id: "meditrack-dose-actions-v1",
      actions: [
        { id: "taken", title: state.takenLabel },
        { id: "snooze", title: state.snoozeLabel },
      ],
    }],
  });

  const now = new Date();
  const scheduled: Array<{ id: number; title: string; body: string; schedule: { at: Date }; channelId: string; actionTypeId: string; extra: { source: string; medicationId: string; profileId: string; date: string; time: string } }> = [];
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
        const baseKey = `${profile.id}|${medication.id}|${date}|${slot.baseTime}`;
        const quietAt = (at: Date) => state.notif.quietEnabled && !medication.critical && inQuiet(at, state.notif.quietFrom, state.notif.quietTo);
        const doseBody = state.body({ profile, medication, time: slot.time });
        const doseAt = atDateTime(date, slot.time);
        const lastAllowed = doseAt.getTime() + (medication.schedule.windowMin + state.notif.repeatCount * state.notif.repeatMin) * 60000;

        if (slot.view === "snoozed" && slot.log?.snoozeUntil) {
          const snoozeAt = new Date(slot.log.snoozeUntil);
          if (snoozeAt.getTime() > now.getTime() && snoozeAt.getTime() <= doseAt.getTime() + 24 * 60 * 60000 && !quietAt(snoozeAt)) {
            const id = notificationId(baseKey + "|snooze");
            if (!usedIds.has(id)) {
              usedIds.add(id);
              scheduled.push({ id, title: state.title, body: doseBody, schedule: { at: snoozeAt }, channelId, actionTypeId: "meditrack-dose-actions-v1", extra: { source: "meditrack-dose", medicationId: medication.id, profileId: profile.id, date, time: slot.baseTime } });
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
          const id = notificationId(baseKey + "|repeat|" + repeat);
          if (usedIds.has(id)) continue;
          usedIds.add(id);
          scheduled.push({ id, title: state.title, body: doseBody, schedule: { at }, channelId, actionTypeId: "meditrack-dose-actions-v1", extra: { source: "meditrack-dose", medicationId: medication.id, profileId: profile.id, date, time: slot.baseTime } });
        }
      }
    }
  }

  scheduled.sort((a, b) => a.schedule.at.getTime() - b.schedule.at.getTime());
  const newIds: number[] = [];
  for (let start = 0; start < scheduled.length; start += 50) {
    const result = await LocalNotifications.schedule({ notifications: scheduled.slice(start, start + 50) });
    newIds.push(...result.notifications.map((item) => item.id));
    localStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(newIds));
  }
}

export function syncDoseNotifications(state: DoseNotificationState): Promise<void> {
  scheduleQueue = scheduleQueue.then(() => performNotificationSync(state)).catch((error) => {
    console.error("MediTrack notification scheduling failed", error);
  });
  return scheduleQueue;
}

export async function getExactAlarmPermission(): Promise<NotifPerm> {
  if (!isNative()) return "granted";
  try {
    const result = await LocalNotifications.checkExactNotificationSetting();
    return result.exact_alarm === "granted" ? "granted" : "denied";
  } catch {
    return "unknown";
  }
}

export async function requestExactAlarmPermission(): Promise<NotifPerm> {
  if (!isNative()) return "granted";
  try {
    const result = await LocalNotifications.changeExactNotificationSetting();
    return result.exact_alarm === "granted" ? "granted" : "denied";
  } catch {
    return "unknown";
  }
}
