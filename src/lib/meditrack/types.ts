export type Lang = "ru" | "en";
export type ThemeMode = "light" | "dark" | "system";
export type TextScale = "md" | "lg" | "xl";

export type MedForm =
  | "tablet"
  | "capsule"
  | "drops"
  | "injection"
  | "spray"
  | "ointment"
  | "powder"
  | "other";

export type CourseStatus = "active" | "paused" | "completed" | "archived";

export type DoseStatus = "taken_on_time" | "taken_late" | "missed" | "snoozed" | "skipped";

export type SlotViewStatus = DoseStatus | "upcoming" | "due" | "away";

export type SkipReason =
  | "forgot"
  | "side_effect"
  | "no_stock"
  | "felt_bad"
  | "doctor"
  | "other";

export type DayRule =
  | { kind: "daily" }
  | { kind: "weekdays" }
  | { kind: "weekends" }
  | { kind: "days"; days: number[] }
  | { kind: "interval"; every: number; anchor: string }
  | { kind: "cycle"; onDays: number; offDays: number; anchor: string }
  | { kind: "once"; date: string };

export type Schedule = {
  times: string[];
  dayRule: DayRule;
  windowMin: number;
};

export type InstructionId =
  | "before_food"
  | "after_food"
  | "with_food"
  | "empty_stomach"
  | "dont_chew"
  | "water"
  | "bedtime"
  | "sublingual";

export type Swatch = "sage" | "clay" | "amber" | "sea" | "plum" | "slate";

export type ProfileIcon = "user" | "heart" | "baby" | "flower" | "smile" | "users";

export type Profile = {
  id: string;
  name: string;
  icon: ProfileIcon;
  swatch: Swatch;
  isPrimary: boolean;
  away: { from: string; to: string } | null;
  createdAt: string;
};

export type GrlsReference = {
  registrationNumber: string;
  inn: string;
  dosageForms: string;
  status: string;
  expiryDate: string;
};

export type RelatedMed = { name: string; relation: "with" | "avoid" };

export type Medication = {
  id: string;
  profileId: string;
  name: string;
  form: MedForm;
  doseAmount: number;
  doseUnit: string;
  unitsPerDose: number;
  doseLabel: string;
  packSize: number;
  stock: number;
  refillThreshold: number;
  refillRemind: boolean;
  startDate: string;
  endDate: string | null;
  indefinite: boolean;
  status: CourseStatus;
  photoDataUrl?: string;
  grls?: GrlsReference;
  notes: string;
  instructions: InstructionId[];
  swatch: Swatch;
  related: RelatedMed[];
  schedule: Schedule;
  critical: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DoseLog = {
  id: string;
  profileId: string;
  medicationId: string;
  date: string;
  time: string;
  status: DoseStatus;
  actedAt?: string;
  snoozeUntil?: string;
  skipReason?: SkipReason;
  note?: string;
};

export type ScheduleOverride = {
  id: string;
  profileId: string;
  medicationId: string;
  date: string;
  kind: "cancel" | "shift" | "move";
  minutes?: number;
  fromTime?: string;
  toTime?: string;
};

export type NotifSettings = {
  enabled: boolean;
  sound: boolean;
  vibrate: boolean;
  repeatMin: 5 | 10 | 15 | 30;
  repeatCount: number;
  quietEnabled: boolean;
  quietFrom: string;
  quietTo: string;
};

export type Screen =
  | { name: "today"; date?: string }
  | { name: "meds" }
  | { name: "med"; id?: string }
  | { name: "history" }
  | { name: "more" }
  | { name: "profiles" }
  | { name: "profile"; id?: string }
  | { name: "settings" }
  | { name: "backup" }
  | { name: "privacy" }
  | { name: "about" }
  | { name: "report" };

export type BackupPayload = {
  version: 1;
  exportedAt: string;
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
};

export const SWATCHES: Swatch[] = ["sage", "clay", "amber", "sea", "plum", "slate"];

export const SWATCH_HEX: Record<Swatch, string> = {
  sage: "#1b6b45",
  clay: "#9a3412",
  amber: "#92600a",
  sea: "#0f5f73",
  plum: "#6d3a6a",
  slate: "#3d4a55",
};

export const FORMS: MedForm[] = [
  "tablet",
  "capsule",
  "drops",
  "injection",
  "spray",
  "ointment",
  "powder",
  "other",
];

export const INSTRUCTIONS: InstructionId[] = [
  "before_food",
  "after_food",
  "with_food",
  "empty_stomach",
  "dont_chew",
  "water",
  "bedtime",
  "sublingual",
];

export const SKIP_REASONS: SkipReason[] = [
  "forgot",
  "side_effect",
  "no_stock",
  "felt_bad",
  "doctor",
  "other",
];

export const PROFILE_ICONS: ProfileIcon[] = ["user", "heart", "baby", "flower", "smile", "users"];

export const DOSE_UNITS = ["мг", "мкг", "г", "мл", "МЕ", "капли", "шт", "%"];

export function uid(): string {
  return crypto.randomUUID();
}

export function doseKey(medicationId: string, date: string, time: string): string {
  return `${medicationId}|${date}|${time}`;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
