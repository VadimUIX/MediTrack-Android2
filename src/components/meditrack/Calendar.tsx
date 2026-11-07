import { Btn, Empty, useLang, useT } from "@/components/meditrack/ui";
import { addDays, todayISO, weekday } from "@/lib/meditrack/dates";
import { buildDay, heatLevel, tally, type BuiltSlot } from "@/lib/meditrack/engine";
import { doseText, formatLong, statusLabel } from "@/lib/meditrack/format";
import { activeProfile, useMedi } from "@/lib/meditrack/store";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

const WEEKDAYS = ["wd1", "wd2", "wd3", "wd4", "wd5", "wd6", "wd0"] as const;
function monthStart(date: string) { return date.slice(0, 7) + "-01"; }
function shiftMonth(date: string, amount: number) {
  const [year, month] = date.split("-").map(Number);
  return todayISO(new Date(year, month - 1 + amount, 1));
}

export function Calendar() {
  const tr = useT();
  const lang = useLang();
  const data = useMedi();
  const profile = activeProfile(data);
  const today = todayISO();
  const [month, setMonth] = useState(monthStart(today));
  const [selected, setSelected] = useState(today);
  const now = new Date();
  const dates = useMemo(() => {
    const first = monthStart(month);
    const start = addDays(first, -((weekday(first) + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);
  const byDate = useMemo(() => {
    const map = new Map<string, BuiltSlot[]>();
    for (const date of dates) map.set(date, buildDay({
      date, now, profile, medications: data.medications, logs: data.logs, overrides: data.overrides,
      includeInactive: date <= today,
    }));
    return map;
  }, [dates, today, profile, data.medications, data.logs, data.overrides]);
  const selectedSlots = byDate.get(selected) ?? [];
  const monthName = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)
    .toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { month: "long", year: "numeric" });
  return (
    <div className="grid gap-4">
      <div><h1 className="font-display text-3xl">{tr("calendarTitle")}</h1><p className="mt-1 text-muted">{tr("calendarLead")}</p></div>
      <section className="card grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="icon-btn" aria-label={tr("prevMonth")} onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft /></button>
          <h2 className="font-display text-xl capitalize">{monthName}</h2>
          <button type="button" className="icon-btn" aria-label={tr("nextMonth")} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight /></button>
        </div>
        <div className="calendar-grid">
          {WEEKDAYS.map((key) => <span key={key} className="calendar-weekday">{tr(key)}</span>)}
          {dates.map((date) => {
            const inMonth = date.slice(0, 7) === month.slice(0, 7);
            const level = heatLevel(tally(byDate.get(date) ?? []));
            return <button key={date} type="button"
              className={`calendar-day ${inMonth ? "" : "calendar-day-out"} ${date === today ? "calendar-day-today" : ""} ${date === selected ? "calendar-day-selected" : ""}`}
              aria-pressed={date === selected}
              onClick={() => { setSelected(date); if (!inMonth) setMonth(monthStart(date)); }}>
              {Number(date.slice(8, 10))}<i className={`calendar-dot calendar-dot-${level}`} aria-hidden />
            </button>;
          })}
        </div>
        <div className="calendar-legend">
          <span><i className="calendar-dot-good" />{tr("calendarAllTaken")}</span>
          <span><i className="calendar-dot-mid" />{tr("calendarPartial")}</span>
          <span><i className="calendar-dot-bad" />{tr("calendarMissed")}</span>
          <span><i className="calendar-dot-wait" />{tr("calendarPending")}</span>
          <span><i className="calendar-dot-none" />{tr("calendarNoPlan")}</span>
        </div>
      </section>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl">{tr("calendarSelected", { date: formatLong(selected, lang) })}</h2>
        <Btn variant="ghost" onClick={() => { setSelected(today); setMonth(monthStart(today)); }}>{tr("calendarToday")}</Btn>
      </div>
      {selectedSlots.length === 0 ? <Empty title={tr("calendarNoDoses")} /> : (
        <ul className="grid gap-2">
          {selectedSlots.map((slot) => <li key={`${slot.medication.id}-${slot.date}-${slot.baseTime}`} className="card">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0">
              <p className="text-sm text-muted tabular-nums">{slot.time}</p><p className="text-lg font-semibold">{slot.medication.name}</p>
              <p className="text-muted">{doseText(slot.medication, lang)}</p>
            </div><span className={`status status-${slot.view}`}>{statusLabel(lang, slot.view)}</span></div>
            {slot.log?.actedAt ? <p className="mt-2 text-sm text-muted">{tr("actualTime", { time: new Date(slot.log.actedAt).toLocaleTimeString(lang === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" }) })}</p> : null}
            {slot.log?.note ? <p className="mt-1 text-sm text-muted">{slot.log.note}</p> : null}
          </li>)}
        </ul>
      )}
    </div>
  );
}
