import { useNav } from "@/components/meditrack/nav";
import { Btn, Empty, useLang, useT } from "@/components/meditrack/ui";
import { downloadText } from "@/lib/meditrack/crypto";
import { addDays, eachDate, todayISO } from "@/lib/meditrack/dates";
import { buildDay, heatLevel, tally, type BuiltSlot, type Heat } from "@/lib/meditrack/engine";
import { dayCaption, doseText, formatLong, formatShort, mondayOf, reasonLabel, statusLabel } from "@/lib/meditrack/format";
import type { Key } from "@/lib/meditrack/i18n";
import { activeProfile, useMedi } from "@/lib/meditrack/store";
import type { SkipReason, SlotViewStatus } from "@/lib/meditrack/types";
import { useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Span = 7 | 30 | 90 | "custom";

export function Stats() {
  const tr = useT();
  const lang = useLang();
  const { go } = useNav();
  const data = useMedi();
  const profile = activeProfile(data);
  const today = todayISO();
  const [span, setSpan] = useState<Span>(30);
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);

  const range = span === "custom" ? { from, to: to < from ? from : to } : { from: addDays(today, -(span - 1)), to: today };
  const days = useMemo(() => eachDate(range.from, range.to), [range.from, range.to]);
  const built = useMemo(() => {
    return days.map((date) => ({
      date,
      slots: buildDay({
        date,
        now: new Date(),
        profile,
        medications: data.medications,
        logs: data.logs,
        overrides: data.overrides,
      }),
    }));
  }, [days, profile, data.medications, data.logs, data.overrides]);

  const all = built.flatMap((d) => d.slots);
  const sum = tally(all);
  const byMed = problemMeds(all);
  const byHour = problemHours(all);
  const reasons = reasonCounts(all);
  const chart = built.slice(-14).map((d) => {
    const t = tally(d.slots);
    const denom = t.taken + t.missed + t.skipped + t.pending;
    return { label: formatShort(d.date, lang), pct: denom ? Math.round((t.taken / denom) * 100) : 0 };
  });
  const heatStart = mondayOf(addDays(range.to, -83));
  const heatDays = eachDate(heatStart, range.to).slice(-84);

  function csv() {
    const header = [tr("csvDate"), tr("csvTime"), tr("csvProfile"), tr("csvMed"), tr("csvDose"), tr("csvStatus"), tr("csvReason"), tr("csvNote")];
    const rows = all.map((s) => [
      s.date,
      s.time,
      profile.name,
      s.medication.name,
      doseText(s.medication, lang),
      statusLabel(lang, s.view),
      s.log?.skipReason ? reasonLabel(lang, s.log.skipReason) : "",
      s.log?.note ?? "",
    ]);
    const body = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
    downloadText(`dnevnik-${range.from}-${range.to}.csv`, `\uFEFF${body}`, "text/csv;charset=utf-8");
  }

  return (
    <div className="grid gap-4">
      <h1 className="font-display text-3xl">{tr("statsTitle")}</h1>
      <p className="text-muted">{tr("youAre", { name: profile.name })}</p>
      <div className="segment">
        {([
          [7, tr("period7")],
          [30, tr("period30")],
          [90, tr("period90")],
          ["custom", tr("periodCustom")],
        ] as const).map(([id, label]) => (
          <button key={String(id)} type="button" className={span === id ? "segment-on" : ""} onClick={() => setSpan(id)}>
            {label}
          </button>
        ))}
      </div>
      {span === "custom" ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1">
            <span className="label">{tr("from")}</span>
            <input className="field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="label">{tr("to")}</span>
            <input className="field" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      ) : null}
      <section className="hero">
        <p className="text-sm font-semibold uppercase tracking-wide">{tr("adherence")}</p>
        <p className="font-display text-6xl tabular-nums leading-none">{sum.percent === null ? "—" : `${sum.percent}%`}</p>
        <p>{sum.percent === null ? tr("noPct") : tr("progress", { taken: sum.taken, total: sum.taken + sum.missed + sum.skipped })}</p>
      </section>
      <div className="grid grid-cols-2 gap-2">
        <Stat n={sum.onTime} label={tr("onTimeWord")} />
        <Stat n={sum.late} label={tr("lateWord")} />
        <Stat n={sum.missed} label={tr("missedWord")} />
        <Stat n={sum.skipped} label={tr("skippedWord")} />
      </div>
      <section className="card">
        <h2 className="font-display text-2xl">{tr("heatmap")}</h2>
        <div className="mt-3 grid grid-cols-7 gap-1">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <span key={d} className="text-center text-sm text-muted">{tr(`wd${d}` as Key)}</span>
          ))}
          {heatDays.map((date) => {
            const inside = date >= range.from && date <= range.to;
            const slots = inside ? built.find((d) => d.date === date)?.slots ?? buildQuiet(date, data, profile) : [];
            const level: Heat = inside ? heatLevel(tally(slots)) : "none";
            return (
              <button
                key={date}
                type="button"
                className={`heat heat-${level}`}
                aria-label={`${date} ${tr(heatLegendKey(level))}`}
                onClick={() => go({ name: "today", date })}
              />
            );
          })}
        </div>
        <ul className="mt-3 flex flex-wrap gap-2 text-sm text-muted">
          <li><i className="heat heat-good" /> {tr("legendGood")}</li>
          <li><i className="heat heat-ok" /> {tr("legendOk")}</li>
          <li><i className="heat heat-mid" /> {tr("legendMid")}</li>
          <li><i className="heat heat-bad" /> {tr("legendBad")}</li>
          <li><i className="heat heat-wait" /> {tr("legendWait")}</li>
        </ul>
      </section>
      <section className="card">
        <h2 className="font-display text-2xl">{tr("chartTitle")}</h2>
        <div className="mt-3 h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 12 }} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={{ fill: "var(--muted)", fontSize: 12 }} width={32} />
              <Tooltip cursor={{ fill: "var(--primary-soft)" }} contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" }} />
              <Bar dataKey="pct" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="card">
        <h2 className="font-display text-2xl">{tr("problemMeds")}</h2>
        {byMed.length === 0 ? <p className="mt-2 text-muted">{tr("noProblems")}</p> : (
          <ul className="mt-2 grid gap-2">
            {byMed.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3">
                <span>{row.name}</span>
                <span className="text-muted">{tr("missRate", { n: row.rate })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2 className="font-display text-2xl">{tr("problemTimes")}</h2>
        {byHour.length === 0 ? <p className="mt-2 text-muted">{tr("noProblems")}</p> : (
          <ul className="mt-2 grid gap-2">
            {byHour.map((row) => (
              <li key={row.hour} className="flex items-center justify-between gap-3">
                <span className="tabular-nums">{tr("perHour", { h: String(row.hour).padStart(2, "0") })}</span>
                <span className="text-muted">{tr("missRate", { n: row.rate })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2 className="font-display text-2xl">{tr("reasonsBreakdown")}</h2>
        {reasons.length === 0 ? <p className="mt-2 text-muted">{tr("noReasons")}</p> : (
          <ul className="mt-2 grid gap-2">
            {reasons.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3">
                <span>{reasonLabel(lang, row.id)}</span>
                <span className="tabular-nums text-muted">{row.n}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="grid gap-2">
        <Btn onClick={() => go({ name: "history" })}>{tr("openHistory")}</Btn>
        <Btn variant="soft" onClick={() => go({ name: "report" })}>{tr("makeReport")}</Btn>
        <Btn variant="ghost" onClick={csv}>{tr("exportCsv")}</Btn>
      </div>
    </div>
  );
}

function heatLegendKey(level: Heat): Key {
  const keys: Record<Heat, Key> = {
    good: "legendGood",
    ok: "legendOk",
    mid: "legendMid",
    bad: "legendBad",
    wait: "legendWait",
    none: "legendNone",
  };
  return keys[level];
}
function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="card">
      <p className="font-display text-3xl tabular-nums">{n}</p>
      <p className="text-muted">{label}</p>
    </div>
  );
}

function problemMeds(slots: BuiltSlot[]) {
  const map = new Map<string, { name: string; bad: number; done: number }>();
  for (const s of slots) {
    if (s.view === "away" || s.view === "upcoming" || s.view === "due" || s.view === "snoozed") continue;
    const row = map.get(s.medication.id) ?? { name: s.medication.name, bad: 0, done: 0 };
    row.done += 1;
    if (s.view === "missed" || s.view === "skipped") row.bad += 1;
    map.set(s.medication.id, row);
  }
  return [...map.entries()]
    .map(([id, row]) => ({ id, name: row.name, rate: row.done ? Math.round((row.bad / row.done) * 100) : 0 }))
    .filter((r) => r.rate > 0)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 4);
}

function problemHours(slots: BuiltSlot[]) {
  const map = new Map<number, { bad: number; done: number }>();
  for (const s of slots) {
    if (s.view === "away" || s.view === "upcoming" || s.view === "due" || s.view === "snoozed") continue;
    const hour = Number(s.time.slice(0, 2));
    const row = map.get(hour) ?? { bad: 0, done: 0 };
    row.done += 1;
    if (s.view === "missed" || s.view === "skipped") row.bad += 1;
    map.set(hour, row);
  }
  return [...map.entries()]
    .map(([hour, row]) => ({ hour, rate: row.done ? Math.round((row.bad / row.done) * 100) : 0 }))
    .filter((r) => r.rate > 0)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3);
}

function reasonCounts(slots: BuiltSlot[]) {
  const map = new Map<SkipReason, number>();
  for (const s of slots) {
    if (!s.log?.skipReason) continue;
    map.set(s.log.skipReason, (map.get(s.log.skipReason) ?? 0) + 1);
  }
  return [...map.entries()].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n);
}

function csvCell(v: string): string {
  return `"${v.replaceAll('"', '""')}"`;
}

function buildQuiet(date: string, data: ReturnType<typeof useMedi.getState>, profile: ReturnType<typeof activeProfile>): BuiltSlot[] {
  return buildDay({ date, now: new Date(), profile, medications: data.medications, logs: data.logs, overrides: data.overrides });
}

const VIEWS: SlotViewStatus[] = ["taken_on_time", "taken_late", "missed", "skipped", "snoozed", "due", "upcoming", "away"];

export function History() {
  const tr = useT();
  const lang = useLang();
  const data = useMedi();
  const profile = activeProfile(data);
  const today = todayISO();
  const [from, setFrom] = useState(addDays(today, -13));
  const [to, setTo] = useState(today);
  const [medId, setMedId] = useState("all");
  const [status, setStatus] = useState<SlotViewStatus | "all">("all");
  const meds = data.medications.filter((m) => m.profileId === profile.id);
  const rows = useMemo(() => {
    const dates = eachDate(from, to < from ? from : to);
    return dates.flatMap((date) =>
      buildDay({ date, now: new Date(), profile, medications: data.medications, logs: data.logs, overrides: data.overrides }),
    );
  }, [from, to, profile, data.medications, data.logs, data.overrides]);
  const shown = rows.filter((s) => (medId === "all" || s.medication.id === medId) && (status === "all" || s.view === status)).slice().reverse();

  return (
    <div className="grid gap-4">
      <h1 className="font-display text-3xl">{tr("historyTitle")}</h1>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1">
          <span className="label">{tr("from")}</span>
          <input className="field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="label">{tr("to")}</span>
          <input className="field" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <label className="grid gap-1">
        <span className="label">{tr("filterMed")}</span>
        <select className="field" value={medId} onChange={(e) => setMedId(e.target.value)}>
          <option value="all">{tr("allMeds")}</option>
          {meds.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="label">{tr("filterStatus")}</span>
        <select className="field" value={status} onChange={(e) => setStatus(e.target.value as SlotViewStatus | "all")}>
          <option value="all">{tr("allStatuses")}</option>
          {VIEWS.map((v) => (
            <option key={v} value={v}>{statusLabel(lang, v)}</option>
          ))}
        </select>
      </label>
      {shown.length === 0 ? <Empty title={tr("emptyHistory")} /> : (
        <ul className="grid gap-2">
          {shown.map((s) => (
            <li key={`${s.medication.id}-${s.date}-${s.baseTime}`} className="card">
              <p className="text-sm text-muted">{dayCaption(s.date, lang)} · {s.time}</p>
              <p className="text-lg font-semibold">{s.medication.name}</p>
              <p className="text-muted">{doseText(s.medication, lang)}</p>
              <p className={`status status-${s.view}`}>{statusLabel(lang, s.view)}</p>
              {s.log?.skipReason ? <p className="text-sm">{reasonLabel(lang, s.log.skipReason)}</p> : null}
              {s.log?.note ? <p className="text-sm text-muted">{s.log.note}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Report() {
  const tr = useT();
  const lang = useLang();
  const data = useMedi();
  const profile = activeProfile(data);
  const today = todayISO();
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);
  const [comment, setComment] = useState("");
  const end = to < from ? from : to;
  const days = eachDate(from, end);
  const slots = days.flatMap((date) => buildDay({ date, now: new Date(), profile, medications: data.medications, logs: data.logs, overrides: data.overrides }));
  const sum = tally(slots);
  const meds = [...new Map(slots.map((s) => [s.medication.id, s.medication])).values()];
  const misses = slots.filter((s) => s.view === "missed" || s.view === "skipped").slice(0, 40);

  return (
    <div className="grid gap-4">
      <div className="no-print grid gap-3">
        <h1 className="font-display text-3xl">{tr("reportTitle")}</h1>
        <p className="text-muted">{tr("printHint")}</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1">
            <span className="label">{tr("from")}</span>
            <input className="field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="label">{tr("to")}</span>
            <input className="field" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <label className="grid gap-1">
          <span className="label">{tr("reportComment")}</span>
          <textarea className="field min-h-24" value={comment} placeholder={tr("reportCommentPh")} onChange={(e) => setComment(e.target.value)} />
        </label>
        <Btn onClick={() => window.print()}>{tr("printPdf")}</Btn>
      </div>
      <article className="report">
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">{tr("brandFull")}</p>
        <h2 className="font-display text-3xl">{tr("reportTitle")}</h2>
        <p>{tr("reportFor")}: {profile.name}</p>
        <p>{formatLong(from, lang)} — {formatLong(end, lang)}</p>
        <p className="text-muted">{tr("generated")}: {formatLong(today, lang)}</p>
        <p className="mt-3 font-display text-4xl tabular-nums">{sum.percent === null ? "—" : `${sum.percent}%`}</p>
        <p>{tr("adherence")}</p>
        <h3 className="mt-4 font-display text-2xl">{tr("reportTable")}</h3>
        <table className="report-table">
          <thead>
            <tr>
              <th>{tr("csvMed")}</th>
              <th>{tr("csvDose")}</th>
              <th>{tr("adherence")}</th>
            </tr>
          </thead>
          <tbody>
            {meds.map((m) => {
              const part = tally(slots.filter((s) => s.medication.id === m.id));
              return (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{doseText(m, lang)}</td>
                  <td>{part.percent === null ? "—" : `${part.percent}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <h3 className="mt-4 font-display text-2xl">{tr("reportMisses")}</h3>
        {misses.length === 0 ? <p>{tr("noneMisses")}</p> : (
          <ul>
            {misses.map((s) => (
              <li key={`${s.medication.id}-${s.date}-${s.baseTime}`}>{s.date} {s.time} — {s.medication.name} ({statusLabel(lang, s.view)})</li>
            ))}
          </ul>
        )}
        {comment.trim() ? (
          <>
            <h3 className="mt-4 font-display text-2xl">{tr("reportComment")}</h3>
            <p className="whitespace-pre-wrap">{comment}</p>
          </>
        ) : null}
        <p className="mt-4 text-sm text-muted">{tr("reportDisclaimer")}</p>
      </article>
    </div>
  );
}
