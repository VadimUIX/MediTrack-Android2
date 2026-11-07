import { atDateTime, diffDays, fmtMin, parseTime, weekday } from "./dates.ts";
import type {
  DayRule,
  DoseLog,
  DoseStatus,
  Medication,
  Profile,
  ScheduleOverride,
  SlotViewStatus,
} from "./types.ts";

export type BuiltSlot = {
  medication: Medication;
  date: string;
  baseTime: string;
  time: string;
  view: SlotViewStatus;
  log?: DoseLog;
};

export function ruleMatches(rule: DayRule, date: string): boolean {
  const wd = weekday(date);
  switch (rule.kind) {
    case "daily":
      return true;
    case "weekdays":
      return wd >= 1 && wd <= 5;
    case "weekends":
      return wd === 0 || wd === 6;
    case "days":
      return rule.days.includes(wd);
    case "interval": {
      const every = Math.max(1, rule.every);
      const delta = diffDays(rule.anchor, date);
      return delta >= 0 && delta % every === 0;
    }
    case "cycle": {
      const on = Math.max(1, rule.onDays);
      const off = Math.max(0, rule.offDays);
      const span = on + off;
      const delta = diffDays(rule.anchor, date);
      return delta >= 0 && delta % span < on;
    }
    case "once":
      return rule.date === date;
    default:
      return false;
  }
}

function resolveTime(base: string, ov: ScheduleOverride[]): { time: string; cancelled: boolean } {
  if (ov.some((o) => o.kind === "cancel" && (!o.fromTime || o.fromTime === base))) {
    return { time: base, cancelled: true };
  }
  const move = ov.find((o) => o.kind === "move" && o.fromTime === base && o.toTime);
  if (move?.toTime) return { time: move.toTime, cancelled: false };
  let mins = parseTime(base);
  for (const o of ov) {
    if (o.kind === "shift" && typeof o.minutes === "number") mins += o.minutes;
  }
  return { time: fmtMin(mins), cancelled: false };
}

function computeView(args: {
  date: string;
  time: string;
  now: Date;
  windowMin: number;
  log?: DoseLog;
  away: boolean;
}): SlotViewStatus {
  const { log, now, away } = args;
  if (log && log.status !== "snoozed") return log.status;
  if (log?.status === "snoozed") {
    if (log.snoozeUntil && new Date(log.snoozeUntil).getTime() > now.getTime()) return "snoozed";
  }
  if (away) return "away";
  const scheduled = atDateTime(args.date, args.time);
  const diffMin = (now.getTime() - scheduled.getTime()) / 60000;
  const windowMin = Math.max(0, args.windowMin);
  if (diffMin < -windowMin) return "upcoming";
  if (diffMin <= windowMin) return "due";
  return "missed";
}

export function takenKind(date: string, time: string, now: Date, windowMin: number): Extract<DoseStatus, "taken_on_time" | "taken_late"> {
  const scheduled = atDateTime(date, time);
  const diffMin = (now.getTime() - scheduled.getTime()) / 60000;
  const w = Math.max(0, windowMin);
  if (diffMin > w) return "taken_late";
  return "taken_on_time";
}

export function buildDay(args: {
  date: string;
  now: Date;
  profile: Profile;
  medications: Medication[];
  logs: DoseLog[];
  overrides: ScheduleOverride[];
  includeInactive?: boolean;
}): BuiltSlot[] {
  const away = !!(args.profile.away && args.date >= args.profile.away.from && args.date <= args.profile.away.to);
  const slots: BuiltSlot[] = [];
  for (const med of args.medications) {
    if (med.profileId !== args.profile.id) continue;
    if (!args.includeInactive && med.status !== "active") continue;
    if (args.date < med.startDate) continue;
    if (!med.indefinite && med.endDate && args.date > med.endDate) continue;
    if (!ruleMatches(med.schedule.dayRule, args.date)) continue;
    const ov = args.overrides.filter((o) => o.medicationId === med.id && o.date === args.date);
    for (const baseTime of med.schedule.times) {
      const resolved = resolveTime(baseTime, ov);
      if (resolved.cancelled) continue;
      const log = args.logs.find((l) => l.medicationId === med.id && l.date === args.date && l.time === baseTime);
      const view = computeView({
        date: args.date,
        time: resolved.time,
        now: args.now,
        windowMin: med.schedule.windowMin,
        log,
        away,
      });
      slots.push({ medication: med, date: args.date, baseTime, time: resolved.time, view, log });
    }
  }
  slots.sort((a, b) => a.time.localeCompare(b.time) || a.medication.name.localeCompare(b.medication.name, "ru"));
  return slots;
}

export type Tally = {
  scheduled: number;
  taken: number;
  onTime: number;
  late: number;
  missed: number;
  skipped: number;
  pending: number;
  away: number;
  percent: number | null;
};

export function tally(slots: BuiltSlot[]): Tally {
  const t: Tally = {
    scheduled: 0,
    taken: 0,
    onTime: 0,
    late: 0,
    missed: 0,
    skipped: 0,
    pending: 0,
    away: 0,
    percent: null,
  };
  for (const s of slots) {
    switch (s.view) {
      case "taken_on_time":
        t.onTime++;
        t.taken++;
        break;
      case "taken_late":
        t.late++;
        t.taken++;
        break;
      case "missed":
        t.missed++;
        break;
      case "skipped":
        t.skipped++;
        break;
      case "away":
        t.away++;
        break;
      default:
        t.pending++;
    }
  }
  t.scheduled = slots.length - t.away;
  const done = t.taken + t.missed + t.skipped;
  t.percent = done > 0 ? Math.round((t.taken / done) * 100) : null;
  return t;
}

export type Heat = "none" | "wait" | "bad" | "mid" | "ok" | "good";

export function heatLevel(t: Tally): Heat {
  const done = t.taken + t.missed + t.skipped;
  const all = done + t.pending;
  if (t.scheduled === 0 || all === 0) return "none";
  if (done === 0 && t.pending > 0) return "wait";
  const pct = t.taken / done;
  if (pct >= 0.999) return "good";
  if (pct >= 0.8) return "ok";
  if (pct >= 0.5) return "mid";
  return "bad";
}

export function isTakenStatus(status?: DoseStatus): boolean {
  return status === "taken_on_time" || status === "taken_late";
}
