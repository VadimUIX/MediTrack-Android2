import { FormGlyph } from "@/components/meditrack/glyphs";
import { useNav } from "@/components/meditrack/nav";
import { Btn, Empty, useLang, useT } from "@/components/meditrack/ui";
import { doseText, scheduleLine, statusLabel } from "@/lib/meditrack/format";
import { useMedi } from "@/lib/meditrack/store";
import type { CourseStatus } from "@/lib/meditrack/types";
import { Archive, Check, Pause, Pencil, Play, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Tab = "active" | "paused" | "done";

export function Meds() {
  const tr = useT();
  const lang = useLang();
  const { go } = useNav();
  const meds = useMedi((s) => s.medications);
  const profileId = useMedi((s) => s.activeProfileId);
  const setStatus = useMedi((s) => s.setMedicationStatus);
  const bulk = useMedi((s) => s.bulkStatus);
  const [tab, setTab] = useState<Tab>("active");
  const [q, setQ] = useState("");
  const [pick, setPick] = useState(false);
  const [ids, setIds] = useState<string[]>([]);

  const list = useMemo(() => {
    const query = q.trim().toLocaleLowerCase();
    return meds
      .filter((m) => m.profileId === profileId)
      .filter((m) => {
        if (tab === "active") return m.status === "active";
        if (tab === "paused") return m.status === "paused";
        return m.status === "completed" || m.status === "archived";
      })
      .filter((m) => !query || m.name.toLocaleLowerCase().includes(query))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [meds, profileId, tab, q, lang]);

  const low = meds.filter((m) => m.profileId === profileId && m.status === "active" && m.refillRemind && m.stock <= m.refillThreshold);

  function toggle(id: string) {
    setIds((curr) => (curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]));
  }

  function runBulk(status: CourseStatus) {
    bulk(ids, status);
    toast(tr("saved"));
    setIds([]);
    setPick(false);
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl">{tr("navMeds")}</h1>
        <Btn onClick={() => go({ name: "med" })}>
          <Plus className="size-5" />
          {tr("add")}
        </Btn>
      </div>
      <label className="relative">
        <span className="sr-only">{tr("search")}</span>
        <Search className="pointer-events-none absolute top-3 left-3 size-5 text-muted" />
        <input className="field field-search" value={q} placeholder={tr("searchPh")} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="segment" role="tablist">
        {([
          ["active", tr("activeTab")],
          ["paused", tr("pausedTab")],
          ["done", tr("doneTab")],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "segment-on" : ""} onClick={() => { setTab(id); setIds([]); }}>
            {label}
          </button>
        ))}
      </div>
      {low.length > 0 && tab === "active" ? (
        <div className="card">
          <p className="font-semibold">{tr("refillBadge")}</p>
          <ul className="mt-2 grid gap-1">
            {low.map((m) => (
              <li key={m.id}>{m.name}: {tr("lowStock", { n: m.stock })}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex justify-end">
        <Btn variant="ghost" onClick={() => { setPick((v) => !v); setIds([]); }}>
          {pick ? tr("cancelSelect") : tr("select")}
        </Btn>
      </div>
      {list.length === 0 ? (
        <Empty title={tr("emptyMeds")} body={tab === "active" ? tr("emptyActive") : tab === "paused" ? tr("emptyPaused") : tr("emptyDone")} />
      ) : (
        <ul className="grid gap-2">
          {list.map((m) => {
            const on = ids.includes(m.id);
            return (
              <li key={m.id} className="card">
                <div className="flex items-start gap-3">
                  {pick ? (
                    <button type="button" className={on ? "check check-on" : "check"} aria-pressed={on} onClick={() => toggle(m.id)} aria-label={m.name}>
                      {on ? <Check className="size-4" /> : null}
                    </button>
                  ) : (
                    <span className={`grid size-12 place-items-center rounded-2xl swatch-soft-${m.swatch}`}>
                      <FormGlyph form={m.form} className="size-6" />
                    </span>
                  )}
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => (pick ? toggle(m.id) : go({ name: "med", id: m.id }))}>
                    <span className="block truncate text-lg font-semibold">{m.name}</span>
                    <span className="block text-muted">{doseText(m, lang)}</span>
                    <span className="mt-1 block text-sm text-muted">{scheduleLine(m, lang)}</span>
                    <span className="mt-1 block text-sm">{tr("stock", { n: m.stock })} · {statusLabel(lang, m.status)}</span>
                  </button>
                </div>
                {!pick ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.status === "active" ? (
                      <Btn variant="ghost" onClick={() => { setStatus(m.id, "paused"); toast(tr("saved")); }}>
                        <Pause className="size-4" /> {tr("pause")}
                      </Btn>
                    ) : m.status === "paused" ? (
                      <Btn variant="soft" onClick={() => { setStatus(m.id, "active"); toast(tr("saved")); }}>
                        <Play className="size-4" /> {tr("resume")}
                      </Btn>
                    ) : null}
                    <Btn variant="ghost" onClick={() => go({ name: "med", id: m.id })}>
                      <Pencil className="size-4" /> {tr("edit")}
                    </Btn>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {pick ? (
        <div className="sticky bottom-2 grid gap-2">
          <p className="text-center font-semibold">{tr("selectedN", { n: ids.length })}</p>
          <div className="grid grid-cols-2 gap-2">
            <Btn disabled={!ids.length} onClick={() => runBulk("completed")}>{tr("finishSelected")}</Btn>
            <Btn variant="ghost" disabled={!ids.length} onClick={() => runBulk("archived")}>
              <Archive className="size-4" /> {tr("archiveSelected")}
            </Btn>
          </div>
        </div>
      ) : null}
    </div>
  );
}
