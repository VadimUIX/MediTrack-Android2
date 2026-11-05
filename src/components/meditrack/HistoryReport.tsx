import { Btn, Empty, useLang, useT } from "@/components/meditrack/ui";
import { addDays, eachDate, todayISO } from "@/lib/meditrack/dates";
import { buildDay, tally, type BuiltSlot } from "@/lib/meditrack/engine";
import { dayCaption, doseText, formatLong, reasonLabel, statusLabel } from "@/lib/meditrack/format";
import { activeProfile, useMedi } from "@/lib/meditrack/store";
import type { SkipReason, SlotViewStatus } from "@/lib/meditrack/types";
import { useMemo, useState } from "react";

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
