import { format } from "date-fns";
import { enUS, ru } from "date-fns/locale";
import { addDays, atDateTime, todayISO, weekday } from "@/lib/meditrack/dates";
import type { BuiltSlot } from "@/lib/meditrack/engine";
import { hasKey, t, type Key } from "@/lib/meditrack/i18n";
import type { InstructionId, Lang, MedForm, Medication, SkipReason, SlotViewStatus, Swatch } from "@/lib/meditrack/types";

export function cap(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}

export function formatLong(date: string, lang: Lang): string {
  return cap(format(atDateTime(date, "12:00"), "EEEE, d MMMM", { locale: lang === "ru" ? ru : enUS }));
}

export function formatShort(date: string, lang: Lang): string {
  return format(atDateTime(date, "12:00"), "d MMM", { locale: lang === "ru" ? ru : enUS });
}

export function dayCaption(date: string, lang: Lang, today = todayISO()): string {
  if (date === today) return t(lang, "navToday");
  if (date === addDays(today, -1)) return t(lang, "yesterday");
  if (date === addDays(today, 1)) return t(lang, "tomorrow");
  return cap(format(atDateTime(date, "12:00"), "d MMMM", { locale: lang === "ru" ? ru : enUS }));
}

export function unitLabel(lang: Lang, unit: string): string {
  const key = `unit_${unit}`;
  if (hasKey(key)) return t(lang, key);
  return unit;
}

export function formLabel(lang: Lang, form: MedForm): string {
  return t(lang, `form_${form}` as Key);
}

export function instructionLabel(lang: Lang, id: InstructionId): string {
  return t(lang, `inst_${id}` as Key);
}

export function reasonLabel(lang: Lang, id: SkipReason): string {
  return t(lang, `reason_${id}` as Key);
}

export function statusLabel(lang: Lang, id: SlotViewStatus | Medication["status"]): string {
  if (id === "active" || id === "paused" || id === "completed" || id === "archived") return t(lang, `course_${id}` as Key);
  return t(lang, `st_${id}` as Key);
}

export function swatchLabel(lang: Lang, id: Swatch): string {
  return t(lang, `swatch_${id}` as Key);
}

export function doseText(med: Medication, lang: Lang): string {
  if (med.doseLabel.trim()) return med.doseLabel.trim();
  return `${med.unitsPerDose} × ${med.doseAmount} ${unitLabel(lang, med.doseUnit)}`;
}

export function scheduleLine(med: Medication, lang: Lang): string {
  if (med.intakeMode === "prn") return t(lang, "modePrn");
  const rule = med.schedule.dayRule;
  let when = "";
  switch (rule.kind) {
    case "daily":
      when = t(lang, "rule_daily");
      break;
    case "weekdays":
      when = t(lang, "rule_weekdays");
      break;
    case "weekends":
      when = t(lang, "rule_weekends");
      break;
    case "days":
      when = rule.days
        .slice()
        .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
        .map((d) => t(lang, `wd${d}` as Key))
        .join(", ");
      break;
    case "interval":
      when = t(lang, "rule_interval", { n: rule.every });
      break;
    case "cycle":
      when = t(lang, "rule_cycle", { on: rule.onDays, off: rule.offDays });
      break;
    case "once":
      when = `${t(lang, "rule_once")} ${formatShort(rule.date, lang)}`;
      break;
    default:
      when = "";
  }
  const mode = med.intakeMode === "combined" ? `${t(lang, "modeCombined")} · ` : "";
  return `${mode}${when} · ${med.schedule.times.join(", ")} · ${t(lang, "windowLabel", { n: med.schedule.windowMin })}`;
}

export function countdown(ms: number, lang: Lang): string {
  if (ms <= 30_000) return t(lang, "nowDose");
  const min = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h <= 0) return t(lang, "countdownMin", { m });
  return t(lang, "countdownIn", { h, m });
}

export function weekdayOrder(): number[] {
  return [1, 2, 3, 4, 5, 6, 0];
}

export function slotDose(slot: BuiltSlot, lang: Lang): string {
  return doseText(slot.medication, lang);
}

export function mondayOf(date: string): string {
  const wd = weekday(date);
  const delta = wd === 0 ? -6 : 1 - wd;
  return addDays(date, delta);
}
