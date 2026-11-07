import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { todayISO } from "@/lib/meditrack/dates";
import { isTakenStatus } from "@/lib/meditrack/engine";
import { createSeed } from "@/lib/meditrack/seed";
import type {
  BackupPayload,
  CourseStatus,
  DoseLog,
  DoseStatus,
  Lang,
  Medication,
  NotifSettings,
  Profile,
  ScheduleOverride,
  SkipReason,
  TextScale,
  ThemeMode,
} from "@/lib/meditrack/types";
import { round2, uid } from "@/lib/meditrack/types";

export type MediState = {
  profiles: Profile[];
  medications: Medication[];
  logs: DoseLog[];
  overrides: ScheduleOverride[];
  activeProfileId: string;
  lang: Lang;
  theme: ThemeMode;
  textScale: TextScale;
  notif: NotifSettings;
  pinHash: string | null;
  pinSalt: string | null;
  credentialId: string | null;
  privacySeen: boolean;
  unlocked: boolean;
  setLang: (lang: Lang) => void;
  setTheme: (theme: ThemeMode) => void;
  setTextScale: (textScale: TextScale) => void;
  setNotif: (patch: Partial<NotifSettings>) => void;
  setPrivacySeen: (v: boolean) => void;
  setUnlocked: (v: boolean) => void;
  setActiveProfile: (id: string) => void;
  upsertProfile: (profile: Profile) => void;
  deleteProfile: (id: string) => void;
  setAway: (id: string, away: Profile["away"]) => void;
  upsertMedication: (med: Medication) => void;
  deleteMedication: (id: string) => void;
  duplicateMedication: (id: string, suffix: string) => void;
  setMedicationStatus: (id: string, status: CourseStatus) => void;
  bulkStatus: (ids: string[], status: CourseStatus) => void;
  markDose: (entry: {
    medicationId: string;
    date: string;
    time: string;
    status: DoseStatus;
    snoozeUntil?: string;
    actedAt?: string;
    skipReason?: SkipReason;
    note?: string;
    profileId?: string;
  }) => void;
  clearDose: (medicationId: string, date: string, time: string) => void;
  moveSlot: (medicationId: string, date: string, fromTime: string, toTime: string) => void;
  cancelSlot: (medicationId: string, date: string, fromTime: string) => void;
  restoreSlot: (medicationId: string, date: string, fromTime: string) => void;
  shiftDay: (date: string, minutes: number) => void;
  setPin: (hash: string, salt: string) => void;
  clearPin: () => void;
  setCredential: (id: string | null) => void;
  snapshot: () => BackupPayload;
  replaceAll: (data: BackupPayload) => void;
  addSharedCourse: (med: Medication) => void;
  removeDemos: () => void;
  resetData: () => void;
  completeExpired: () => void;
};

const seed = createSeed();

const defaultNotif: NotifSettings = {
  enabled: true,
  sound: true,
  vibrate: true,
  repeatMin: 10,
  snoozeMin: 15,
  repeatCount: 3,
  quietEnabled: false,
  quietFrom: "22:30",
  quietTo: "07:30",
};

function memoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
}

export const useMedi = create<MediState>()(
  persist(
    (set, get) => ({
      profiles: seed.profiles,
      medications: seed.medications,
      logs: seed.logs,
      overrides: [],
      activeProfileId: seed.activeProfileId,
      lang: "ru",
      theme: "system",
      textScale: "lg",
      notif: defaultNotif,
      pinHash: null,
      pinSalt: null,
      credentialId: null,
      privacySeen: false,
      unlocked: true,
      setLang: (lang) => set({ lang }),
      setTheme: (theme) => set({ theme }),
      setTextScale: (textScale) => set({ textScale }),
      setNotif: (patch) => set({ notif: { ...get().notif, ...patch } }),
      setPrivacySeen: (privacySeen) => set({ privacySeen }),
      setUnlocked: (unlocked) => set({ unlocked }),
      setActiveProfile: (activeProfileId) => set({ activeProfileId }),
      upsertProfile: (profile) =>
        set((s) => {
          const exists = s.profiles.some((p) => p.id === profile.id);
          let profiles = exists ? s.profiles.map((p) => (p.id === profile.id ? profile : p)) : [...s.profiles, profile];
          if (profile.isPrimary) profiles = profiles.map((p) => ({ ...p, isPrimary: p.id === profile.id }));
          return { profiles };
        }),
      deleteProfile: (id) =>
        set((s) => {
          if (s.profiles.length < 2) return s;
          const profiles = s.profiles.filter((p) => p.id !== id);
          if (!profiles.some((p) => p.isPrimary)) profiles[0] = { ...profiles[0], isPrimary: true };
          const activeProfileId = s.activeProfileId === id ? profiles[0].id : s.activeProfileId;
          return {
            profiles,
            activeProfileId,
            medications: s.medications.filter((m) => m.profileId !== id),
            logs: s.logs.filter((l) => l.profileId !== id),
            overrides: s.overrides.filter((o) => o.profileId !== id),
          };
        }),
      setAway: (id, away) => set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, away } : p)) })),
      upsertMedication: (med) =>
        set((s) => {
          const exists = s.medications.some((m) => m.id === med.id);
          return {
            medications: exists ? s.medications.map((m) => (m.id === med.id ? med : m)) : [med, ...s.medications],
          };
        }),
      deleteMedication: (id) =>
        set((s) => ({
          medications: s.medications.filter((m) => m.id !== id),
          logs: s.logs.filter((l) => l.medicationId !== id),
          overrides: s.overrides.filter((o) => o.medicationId !== id),
        })),
      duplicateMedication: (id, suffix) =>
        set((s) => {
          const med = s.medications.find((m) => m.id === id);
          if (!med) return s;
          const now = new Date().toISOString();
          const copy: Medication = {
            ...med,
            id: uid(),
            name: `${med.name} (${suffix})`,
            status: "active",
            createdAt: now,
            updatedAt: now,
          };
          return { medications: [copy, ...s.medications] };
        }),
      setMedicationStatus: (id, status) =>
        set((s) => ({
          medications: s.medications.map((m) =>
            m.id === id ? { ...m, status, updatedAt: new Date().toISOString() } : m,
          ),
        })),
      bulkStatus: (ids, status) =>
        set((s) => ({
          medications: s.medications.map((m) =>
            ids.includes(m.id) ? { ...m, status, updatedAt: new Date().toISOString() } : m,
          ),
        })),
      markDose: (entry) =>
        set((s) => {
          const profileId = entry.profileId ?? s.medications.find((m) => m.id === entry.medicationId)?.profileId ?? s.activeProfileId;
          const idx = s.logs.findIndex((l) => l.medicationId === entry.medicationId && l.date === entry.date && l.time === entry.time);
          const prev = idx >= 0 ? s.logs[idx] : undefined;
          const med = s.medications.find((m) => m.id === entry.medicationId);
          let medications = s.medications;
          if (med && isTakenStatus(prev?.status) !== isTakenStatus(entry.status)) {
            const delta = (isTakenStatus(entry.status) ? -1 : 1) * med.unitsPerDose;
            medications = medications.map((m) =>
              m.id === med.id ? { ...m, stock: round2(Math.max(0, m.stock + delta)), updatedAt: new Date().toISOString() } : m,
            );
          }
          const log: DoseLog = {
            id: prev?.id ?? uid(),
            profileId,
            medicationId: entry.medicationId,
            date: entry.date,
            time: entry.time,
            status: entry.status,
            actedAt: entry.actedAt ?? new Date().toISOString(),
            snoozeUntil: entry.snoozeUntil,
            skipReason: entry.skipReason,
            note: entry.note,
          };
          const logs = prev ? s.logs.map((l) => (l.id === prev.id ? log : l)) : [...s.logs, log];
          return { logs, medications };
        }),
      clearDose: (medicationId, date, time) =>
        set((s) => {
          const prev = s.logs.find((l) => l.medicationId === medicationId && l.date === date && l.time === time);
          if (!prev) return s;
          const med = s.medications.find((m) => m.id === medicationId);
          let medications = s.medications;
          if (med && isTakenStatus(prev.status)) {
            medications = medications.map((m) =>
              m.id === med.id ? { ...m, stock: round2(m.stock + med.unitsPerDose), updatedAt: new Date().toISOString() } : m,
            );
          }
          return { logs: s.logs.filter((l) => l.id !== prev.id), medications };
        }),
      moveSlot: (medicationId, date, fromTime, toTime) =>
        set((s) => {
          const profileId = s.medications.find((m) => m.id === medicationId)?.profileId ?? s.activeProfileId;
          const overrides = s.overrides.filter((o) => !(o.medicationId === medicationId && o.date === date && o.kind === "move" && o.fromTime === fromTime));
          overrides.push({ id: uid(), profileId, medicationId, date, kind: "move", fromTime, toTime });
          return { overrides };
        }),
      cancelSlot: (medicationId, date, fromTime) =>
        set((s) => {
          const profileId = s.medications.find((m) => m.id === medicationId)?.profileId ?? s.activeProfileId;
          const overrides = s.overrides.filter(
            (o) => !(o.medicationId === medicationId && o.date === date && o.kind === "cancel" && o.fromTime === fromTime),
          );
          overrides.push({ id: uid(), profileId, medicationId, date, kind: "cancel", fromTime });
          return { overrides };
        }),
      restoreSlot: (medicationId, date, fromTime) =>
        set((s) => ({
          overrides: s.overrides.filter(
            (o) =>
              !(
                o.medicationId === medicationId &&
                o.date === date &&
                (o.kind === "cancel" || o.kind === "move") &&
                o.fromTime === fromTime
              ),
          ),
        })),
      shiftDay: (date, minutes) =>
        set((s) => {
          const ids = s.medications.filter((m) => m.profileId === s.activeProfileId && m.status === "active").map((m) => m.id);
          let overrides = s.overrides.filter((o) => !(o.date === date && o.kind === "shift" && ids.includes(o.medicationId)));
          if (minutes !== 0) {
            overrides = [
              ...overrides,
              ...ids.map((medicationId) => ({
                id: uid(),
                profileId: s.activeProfileId,
                medicationId,
                date,
                kind: "shift" as const,
                minutes,
              })),
            ];
          }
          return { overrides };
        }),
      setPin: (pinHash, pinSalt) => set({ pinHash, pinSalt, unlocked: true }),
      clearPin: () => set({ pinHash: null, pinSalt: null, credentialId: null, unlocked: true }),
      setCredential: (credentialId) => set({ credentialId }),
      snapshot: () => {
        const s = get();
        return {
          version: 1,
          exportedAt: new Date().toISOString(),
          profiles: s.profiles,
          medications: s.medications,
          logs: s.logs,
          overrides: s.overrides,
          activeProfileId: s.activeProfileId,
          lang: s.lang,
          theme: s.theme,
          textScale: s.textScale,
          notif: { ...s.notif, snoozeMin: s.notif.snoozeMin ?? 15 },
          pinHash: s.pinHash,
          pinSalt: s.pinSalt,
          credentialId: s.credentialId,
          privacySeen: s.privacySeen,
        };
      },
      replaceAll: (data) =>
        set({
          profiles: data.profiles,
          medications: data.medications,
          logs: data.logs,
          overrides: data.overrides,
          activeProfileId: data.activeProfileId,
          lang: data.lang,
          theme: data.theme,
          textScale: data.textScale,
          notif: { ...data.notif, snoozeMin: data.notif.snoozeMin ?? 15 },
          pinHash: data.pinHash,
          pinSalt: data.pinSalt,
          credentialId: data.credentialId,
          privacySeen: data.privacySeen,
          unlocked: !data.pinHash,
        }),
      addSharedCourse: (med) =>
        set((s) => {
          const now = new Date().toISOString();
          const copy: Medication = { ...med, id: uid(), profileId: s.activeProfileId, createdAt: now, updatedAt: now, status: "active" };
          return { medications: [copy, ...s.medications] };
        }),
      removeDemos: () =>
        set((s) => ({
          medications: s.medications.filter((m) => !m.id.startsWith("demo-")),
          logs: s.logs.filter((l) => !l.medicationId.startsWith("demo-") && !l.id.startsWith("demo-")),
          overrides: s.overrides.filter((o) => !o.medicationId.startsWith("demo-")),
        })),
      resetData: () => {
        const id = uid();
        const now = new Date().toISOString();
        set({
          profiles: [{ id, name: "Я", icon: "user", swatch: "sage", isPrimary: true, away: null, createdAt: now }],
          medications: [],
          logs: [],
          overrides: [],
          activeProfileId: id,
          pinHash: null,
          pinSalt: null,
          credentialId: null,
          unlocked: true,
          privacySeen: true,
        });
      },
      completeExpired: () =>
        set((s) => {
          const today = todayISO();
          let changed = false;
          const medications = s.medications.map((m) => {
            if (m.status === "active" && !m.indefinite && m.endDate && m.endDate < today) {
              changed = true;
              return { ...m, status: "completed" as const, updatedAt: new Date().toISOString() };
            }
            return m;
          });
          return changed ? { medications } : s;
        }),
    }),
    {
      name: "meditrack-v1",
      storage: createJSONStorage(() => (typeof window === "undefined" ? memoryStorage() : localStorage)),
      partialize: (s) => ({
        profiles: s.profiles,
        medications: s.medications,
        logs: s.logs,
        overrides: s.overrides,
        activeProfileId: s.activeProfileId,
        lang: s.lang,
        theme: s.theme,
        textScale: s.textScale,
        notif: s.notif,
        pinHash: s.pinHash,
        pinSalt: s.pinSalt,
        credentialId: s.credentialId,
        privacySeen: s.privacySeen,
      }),
    },
  ),
);

export function activeProfile(s: Pick<MediState, "profiles" | "activeProfileId">): Profile {
  return s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0];
}

export function isBackup(data: unknown): data is BackupPayload {
  if (!data || typeof data !== "object") return false;
  const d = data as BackupPayload;
  return d.version === 1 && Array.isArray(d.profiles) && Array.isArray(d.medications) && Array.isArray(d.logs) && d.profiles.length > 0;
}

export function isCourseFile(data: unknown): data is { format: "meditrack-course-v1"; medication: Medication } {
  if (!data || typeof data !== "object") return false;
  const d = data as { format?: string; medication?: Medication };
  return d.format === "meditrack-course-v1" && !!d.medication && typeof d.medication.name === "string" && !!d.medication.schedule;
}
