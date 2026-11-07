import { Btn, Empty, useLang, useT } from "@/components/meditrack/ui";
import { addDays, eachDate, todayISO } from "@/lib/meditrack/dates";
import { buildDay, tally } from "@/lib/meditrack/engine";
import { dayCaption, doseText, formatLong, reasonLabel, statusLabel } from "@/lib/meditrack/format";
import { activeProfile, useMedi } from "@/lib/meditrack/store";
import type { SlotViewStatus } from "@/lib/meditrack/types";
import { registerPlugin } from "@capacitor/core";
import { toast } from "sonner";
import { useMemo, useState } from "react";

type PdfLine = { text: string; style?: "title" | "heading" | "body" | "muted" | "tableHeader" | "tableRow" };
const PdfExport = registerPlugin<{ createAndShare(options: { fileName: string; lines: PdfLine[] }): Promise<{ uri: string }> }>("PdfExport");

const VIEWS: SlotViewStatus[] = ["taken_on_time", "taken_late", "missed", "skipped", "snoozed"];

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
  const [query, setQuery] = useState("");
  const meds = data.medications.filter((m) => m.profileId === profile.id);
  const rows = useMemo(() => {
    const dates = eachDate(from, to < from ? from : to);
    return dates.flatMap((date) =>
      buildDay({ date, now: new Date(), profile, medications: data.medications, logs: data.logs, overrides: data.overrides, includeInactive: date <= today }),
    );
  }, [from, to, today, profile, data.medications, data.logs, data.overrides]);
  const shown = rows
    .filter((s) => s.date < today || !!s.log || s.view === "missed")
    .filter((s) => (medId === "all" || s.medication.id === medId) && (status === "all" || s.view === status))
    .filter((s) => !query.trim() || s.medication.name.toLocaleLowerCase(lang === "ru" ? "ru-RU" : "en-US").includes(query.trim().toLocaleLowerCase(lang === "ru" ? "ru-RU" : "en-US")))
    .slice()
    .reverse();

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-3xl">{tr("historyTitle")}</h1>
        <p className="mt-1 text-muted">{tr("historyLead")}</p>
      </div>
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
      <label className="relative grid gap-1">
        <span className="label">{tr("search")}</span>
        <input className="field" value={query} placeholder={tr("searchPh")} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <label className="grid gap-1">
        <span className="label">{tr("filterMed")}</span>
        <select className="field" value={medId} onChange={(e) => setMedId(e.target.value)}>
          <option value="all">{tr("allMeds")}</option>
          {meds.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="label">{tr("filterStatus")}</span>
        <select className="field" value={status} onChange={(e) => setStatus(e.target.value as SlotViewStatus | "all")}>
          <option value="all">{tr("allStatuses")}</option>
          {VIEWS.map((v) => <option key={v} value={v}>{statusLabel(lang, v)}</option>)}
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
              {s.log?.actedAt ? <p className="mt-1 text-sm text-muted">{tr("actualTime", { time: new Date(s.log.actedAt).toLocaleTimeString(lang === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" }) })}</p> : null}
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
  const [exporting, setExporting] = useState(false);

  const exportPdf = async () => {
    setExporting(true);
    const lines: PdfLine[] = [
      { text: tr("brandFull"), style: "muted" },
      { text: tr("reportTitle"), style: "title" },
      { text: `${tr("reportFor")}: ${profile.name}`, style: "body" },
      { text: `${formatLong(from, lang)} — ${formatLong(end, lang)}`, style: "body" },
      { text: `${tr("generated")}: ${formatLong(today, lang)}`, style: "muted" },
      { text: `${tr("adherence")}: ${sum.percent === null ? "—" : `${sum.percent}%`}`, style: "heading" },
      { text: tr("reportTable"), style: "heading" },
      { text: `${tr("csvMed")}  |  ${tr("csvDose")}  |  ${tr("adherence")}`, style: "tableHeader" },
      ...meds.map((m) => {
        const part = tally(slots.filter((s) => s.medication.id === m.id));
        return { text: `${m.name}  |  ${doseText(m, lang)}  |  ${part.percent === null ? "—" : `${part.percent}%`}`, style: "tableRow" as const };
      }),
      { text: tr("reportMisses"), style: "heading" },
      ...(misses.length === 0
        ? [{ text: tr("noneMisses"), style: "body" as const }]
        : misses.map((s) => ({
            text: `${s.date} ${s.time} — ${s.medication.name} (${statusLabel(lang, s.view)})${s.log?.skipReason ? ` · ${reasonLabel(lang, s.log.skipReason)}` : ""}${s.log?.note ? ` · ${s.log.note}` : ""}`,
            style: "body" as const,
          }))),
      ...(comment.trim() ? [{ text: tr("reportComment"), style: "heading" as const }, { text: comment.trim(), style: "body" as const }] : []),
      { text: tr("reportDisclaimer"), style: "muted" },
    ];

    try {
      await PdfExport.createAndShare({ fileName: `MediTrack-report-${from}-${end}.pdf`, lines });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("pdfError"));
    } finally {
      setExporting(false);
    }
  };

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
        <Btn onClick={exportPdf} disabled={exporting}>{exporting ? tr("working") : tr("printPdf")}</Btn>
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
