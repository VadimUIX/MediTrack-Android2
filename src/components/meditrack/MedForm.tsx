import { CATALOG } from "@/lib/meditrack/catalog";
import { compressImage } from "@/lib/meditrack/crypto";
import { todayISO } from "@/lib/meditrack/dates";
import { formLabel, instructionLabel, statusLabel, swatchLabel } from "@/lib/meditrack/format";
import { useMedi } from "@/lib/meditrack/store";
import {
  DOSE_UNITS,
  FORMS,
  INSTRUCTIONS,
  SWATCHES,
  uid,
  type CourseStatus,
  type DayRule,
  type InstructionId,
  type MedForm,
  type Medication,
  type RelatedMed,
  type Swatch,
} from "@/lib/meditrack/types";
import { Btn, Field, Modal, useLang, useT } from "@/components/meditrack/ui";
import { useNav } from "@/components/meditrack/nav";
import { weekdayOrder } from "@/lib/meditrack/format";
import type { Key } from "@/lib/meditrack/i18n";
import { useState } from "react";
import { toast } from "sonner";

type Kind = DayRule["kind"];

type Draft = {
  name: string;
  form: MedForm;
  doseAmount: string;
  doseUnit: string;
  unitsPerDose: string;
  doseLabel: string;
  packSize: string;
  stock: string;
  refillThreshold: string;
  refillRemind: boolean;
  startDate: string;
  endDate: string;
  indefinite: boolean;
  status: CourseStatus;
  notes: string;
  instructions: InstructionId[];
  swatch: Swatch;
  related: RelatedMed[];
  times: string[];
  dayKind: Kind;
  days: number[];
  every: string;
  onDays: string;
  offDays: string;
  onceDate: string;
  anchor: string;
  windowMin: number;
  critical: boolean;
  photoDataUrl?: string;
};

function num(v: string): number {
  return Number(v.replace(",", "."));
}

function fromMed(m: Medication | undefined, today: string): Draft {
  const rule = m?.schedule.dayRule;
  return {
    name: m?.name ?? "",
    form: m?.form ?? "tablet",
    doseAmount: String(m?.doseAmount ?? 1),
    doseUnit: m?.doseUnit ?? "мг",
    unitsPerDose: String(m?.unitsPerDose ?? 1),
    doseLabel: m?.doseLabel ?? "",
    packSize: String(m?.packSize ?? 30),
    stock: String(m?.stock ?? 30),
    refillThreshold: String(m?.refillThreshold ?? 7),
    refillRemind: m?.refillRemind ?? true,
    startDate: m?.startDate ?? today,
    endDate: m?.endDate ?? today,
    indefinite: m?.indefinite ?? true,
    status: m?.status ?? "active",
    notes: m?.notes ?? "",
    instructions: m?.instructions ?? [],
    swatch: m?.swatch ?? "sage",
    related: m?.related ?? [],
    times: m?.schedule.times?.length ? [...m.schedule.times] : ["08:00"],
    dayKind: rule?.kind ?? "daily",
    days: rule?.kind === "days" ? [...rule.days] : [1, 2, 3, 4, 5],
    every: rule?.kind === "interval" ? String(rule.every) : "2",
    onDays: rule?.kind === "cycle" ? String(rule.onDays) : "5",
    offDays: rule?.kind === "cycle" ? String(rule.offDays) : "2",
    onceDate: rule?.kind === "once" ? rule.date : today,
    anchor: rule && (rule.kind === "interval" || rule.kind === "cycle") ? rule.anchor : m?.startDate ?? today,
    windowMin: m?.schedule.windowMin ?? 30,
    critical: m?.critical ?? false,
    photoDataUrl: m?.photoDataUrl,
  };
}

export function MedForm({ id }: { id?: string }) {
  const tr = useT();
  const lang = useLang();
  const { back } = useNav();
  const existing = useMedi((s) => s.medications.find((m) => m.id === id));
  const profileId = useMedi((s) => s.activeProfileId);
  const upsert = useMedi((s) => s.upsertMedication);
  const remove = useMedi((s) => s.deleteMedication);
  const duplicate = useMedi((s) => s.duplicateMedication);
  const setStatus = useMedi((s) => s.setMedicationStatus);
  const [draft, setDraft] = useState<Draft>(() => fromMed(existing, todayISO()));
  const [errors, setErrors] = useState<string[]>([]);
  const [askDelete, setAskDelete] = useState(false);

  function patch(p: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  function applyPreset(kind: "daily" | "twice" | "q8" | "weekdays" | "alt" | "every3" | "cycle" | "once") {
    if (kind === "daily") patch({ dayKind: "daily", times: ["08:00"] });
    if (kind === "twice") patch({ dayKind: "daily", times: ["08:00", "20:00"] });
    if (kind === "q8") patch({ dayKind: "daily", times: ["06:00", "14:00", "22:00"] });
    if (kind === "weekdays") patch({ dayKind: "weekdays", times: draft.times.length ? draft.times : ["08:00"] });
    if (kind === "alt") patch({ dayKind: "interval", every: "2", anchor: draft.startDate });
    if (kind === "every3") patch({ dayKind: "interval", every: "3", anchor: draft.startDate });
    if (kind === "cycle") patch({ dayKind: "cycle", onDays: "5", offDays: "2", anchor: draft.startDate });
    if (kind === "once") patch({ dayKind: "once", onceDate: draft.startDate, times: [draft.times[0] ?? "08:00"] });
  }

  function toggleDay(day: number) {
    patch({ days: draft.days.includes(day) ? draft.days.filter((d) => d !== day) : [...draft.days, day], dayKind: "days" });
  }

  function toggleInst(idInst: InstructionId) {
    patch({
      instructions: draft.instructions.includes(idInst)
        ? draft.instructions.filter((x) => x !== idInst)
        : [...draft.instructions, idInst],
    });
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    if (file.size > 8_000_000) {
      toast(tr("badFile"));
      return;
    }
    try {
      patch({ photoDataUrl: await compressImage(file) });
    } catch {
      toast(tr("badFile"));
    }
  }

  function save() {
    const nextErrors: string[] = [];
    const amount = num(draft.doseAmount);
    const units = num(draft.unitsPerDose);
    const times = [...new Set(draft.times.filter(Boolean))].sort();
    if (!draft.name.trim()) nextErrors.push(tr("errName"));
    if (!(amount > 0) || !(units > 0)) nextErrors.push(tr("errDose"));
    if (!times.length) nextErrors.push(tr("errTimes"));
    if (!draft.indefinite && draft.endDate < draft.startDate) nextErrors.push(tr("errDates"));
    if (draft.dayKind === "days" && draft.days.length === 0) nextErrors.push(tr("errDays"));
    if (draft.dayKind === "once" && !draft.onceDate) nextErrors.push(tr("errOnce"));
    setErrors(nextErrors);
    if (nextErrors.length) return;

    let dayRule: DayRule;
    if (draft.dayKind === "daily") dayRule = { kind: "daily" };
    else if (draft.dayKind === "weekdays") dayRule = { kind: "weekdays" };
    else if (draft.dayKind === "weekends") dayRule = { kind: "weekends" };
    else if (draft.dayKind === "days") dayRule = { kind: "days", days: draft.days };
    else if (draft.dayKind === "interval") dayRule = { kind: "interval", every: Math.max(1, Math.round(num(draft.every) || 1)), anchor: draft.anchor || draft.startDate };
    else if (draft.dayKind === "cycle") dayRule = { kind: "cycle", onDays: Math.max(1, Math.round(num(draft.onDays) || 1)), offDays: Math.max(0, Math.round(num(draft.offDays) || 0)), anchor: draft.anchor || draft.startDate };
    else dayRule = { kind: "once", date: draft.onceDate };

    const now = new Date().toISOString();
    const med: Medication = {
      id: existing?.id ?? uid(),
      profileId: existing?.profileId ?? profileId,
      name: draft.name.trim(),
      form: draft.form,
      doseAmount: amount,
      doseUnit: draft.doseUnit,
      unitsPerDose: units,
      doseLabel: draft.doseLabel.trim(),
      packSize: Math.max(0, num(draft.packSize) || 0),
      stock: Math.max(0, num(draft.stock) || 0),
      refillThreshold: Math.max(0, num(draft.refillThreshold) || 0),
      refillRemind: draft.refillRemind,
      startDate: draft.startDate,
      endDate: draft.indefinite ? null : draft.endDate,
      indefinite: draft.indefinite,
      status: draft.status,
      photoDataUrl: draft.photoDataUrl,
      notes: draft.notes,
      instructions: draft.instructions,
      swatch: draft.swatch,
      related: draft.related.filter((r) => r.name.trim()),
      schedule: { times, dayRule, windowMin: draft.windowMin },
      critical: draft.critical,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    upsert(med);
    toast(tr("saved"));
    back();
  }

  function share() {
    if (!existing) return;
    const blob = JSON.stringify({ format: "meditrack-course-v1", medication: existing }, null, 2);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([blob], { type: "application/json" }));
    a.download = `${existing.name}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="grid gap-4">
      <h1 className="font-display text-3xl">{existing ? tr("formEdit") : tr("formNew")}</h1>
      {errors.length > 0 ? (
        <div className="card" role="alert">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      ) : null}
      <Field label={tr("fieldName")}>
        <input className="field" list="med-catalog" value={draft.name} onChange={(e) => patch({ name: e.target.value })} required />
        <datalist id="med-catalog">
          {CATALOG.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </Field>
      <Field label={tr("fieldForm")}>
        <select className="field" value={draft.form} onChange={(e) => patch({ form: e.target.value as MedForm })}>
          {FORMS.map((f) => (
            <option key={f} value={f}>{formLabel(lang, f)}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={tr("fieldDose")}>
          <input className="field" inputMode="decimal" value={draft.doseAmount} onChange={(e) => patch({ doseAmount: e.target.value })} />
        </Field>
        <Field label={tr("fieldUnit")}>
          <select className="field" value={draft.doseUnit} onChange={(e) => patch({ doseUnit: e.target.value })}>
            {DOSE_UNITS.map((u) => (
              <option key={u} value={u}>{tr(`unit_${u}` as Key)}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={tr("fieldCount")} hint={tr("doseLabelPh")}>
        <input className="field" inputMode="decimal" value={draft.unitsPerDose} onChange={(e) => patch({ unitsPerDose: e.target.value })} />
      </Field>
      <Field label={tr("fieldDoseLabel")}>
        <input className="field" value={draft.doseLabel} placeholder={tr("doseLabelPh")} onChange={(e) => patch({ doseLabel: e.target.value })} />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label={tr("fieldPack")}>
          <input className="field" inputMode="decimal" value={draft.packSize} onChange={(e) => patch({ packSize: e.target.value })} />
        </Field>
        <Field label={tr("fieldStock")}>
          <input className="field" inputMode="decimal" value={draft.stock} onChange={(e) => patch({ stock: e.target.value })} />
        </Field>
        <Field label={tr("fieldThreshold")}>
          <input className="field" inputMode="decimal" value={draft.refillThreshold} onChange={(e) => patch({ refillThreshold: e.target.value })} />
        </Field>
      </div>
      <label className="choice">
        <input type="checkbox" checked={draft.refillRemind} onChange={(e) => patch({ refillRemind: e.target.checked })} />
        <span>{tr("fieldRefill")}</span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Field label={tr("fieldStart")}>
          <input className="field" type="date" value={draft.startDate} onChange={(e) => patch({ startDate: e.target.value, anchor: draft.anchor || e.target.value })} />
        </Field>
        <Field label={tr("fieldEnd")}>
          <input className="field" type="date" disabled={draft.indefinite} value={draft.endDate} onChange={(e) => patch({ endDate: e.target.value })} />
        </Field>
      </div>
      <label className="choice">
        <input type="checkbox" checked={draft.indefinite} onChange={(e) => patch({ indefinite: e.target.checked })} />
        <span>{tr("fieldForever")}</span>
      </label>
      <Field label={tr("fieldStatus")}>
        <select className="field" value={draft.status} onChange={(e) => patch({ status: e.target.value as CourseStatus })}>
          {(["active", "paused", "completed", "archived"] as const).map((s) => (
            <option key={s} value={s}>{statusLabel(lang, s)}</option>
          ))}
        </select>
      </Field>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">{tr("schedule")}</h2>
        <p className="label">{tr("presets")}</p>
        <div className="flex flex-wrap gap-2">
          {([
            ["daily", "presetDaily"],
            ["twice", "presetTwice"],
            ["q8", "presetQ8h"],
            ["weekdays", "presetWeekdays"],
            ["alt", "presetAlt"],
            ["every3", "presetEvery3"],
            ["cycle", "presetCycle"],
            ["once", "presetOnce"],
          ] as const).map(([idPreset, key]) => (
            <button key={idPreset} type="button" className="chip" onClick={() => applyPreset(idPreset)}>{tr(key)}</button>
          ))}
        </div>
        <Field label={tr("fieldDays")}>
          <select className="field" value={draft.dayKind} onChange={(e) => patch({ dayKind: e.target.value as Kind, anchor: draft.startDate })}>
            {(["daily", "weekdays", "weekends", "days", "interval", "cycle", "once"] as const).map((k) => (
              <option key={k} value={k}>{tr(`rule_${k}` as Key, k === "interval" ? { n: draft.every } : k === "cycle" ? { on: draft.onDays, off: draft.offDays } : undefined)}</option>
            ))}
          </select>
        </Field>
        {draft.dayKind === "days" ? (
          <div className="flex flex-wrap gap-2">
            {weekdayOrder().map((d) => (
              <button key={d} type="button" className={draft.days.includes(d) ? "chip chip-on" : "chip"} onClick={() => toggleDay(d)} aria-pressed={draft.days.includes(d)}>
                {tr(`wd${d}` as Key)}
              </button>
            ))}
          </div>
        ) : null}
        {draft.dayKind === "interval" ? (
          <Field label={tr("everyN")}>
            <input className="field" inputMode="numeric" value={draft.every} onChange={(e) => patch({ every: e.target.value })} />
          </Field>
        ) : null}
        {draft.dayKind === "cycle" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("daysOn")}>
              <input className="field" inputMode="numeric" value={draft.onDays} onChange={(e) => patch({ onDays: e.target.value })} />
            </Field>
            <Field label={tr("daysOff")}>
              <input className="field" inputMode="numeric" value={draft.offDays} onChange={(e) => patch({ offDays: e.target.value })} />
            </Field>
          </div>
        ) : null}
        {draft.dayKind === "once" ? (
          <Field label={tr("onceDate")}>
            <input className="field" type="date" value={draft.onceDate} onChange={(e) => patch({ onceDate: e.target.value })} />
          </Field>
        ) : null}
        <div className="grid gap-2">
          <span className="label">{tr("fieldTimes")}</span>
          {draft.times.map((time, i) => (
            <div key={`${time}-${i}`} className="flex gap-2">
              <input className="field" type="time" value={time} onChange={(e) => patch({ times: draft.times.map((t, idx) => (idx === i ? e.target.value : t)) })} />
              {draft.times.length > 1 ? (
                <Btn variant="ghost" aria-label={tr("removeTime")} onClick={() => patch({ times: draft.times.filter((_, idx) => idx !== i) })}>×</Btn>
              ) : null}
            </div>
          ))}
          <Btn variant="soft" onClick={() => patch({ times: [...draft.times, "12:00"] })}>{tr("addTime")}</Btn>
        </div>
        <div>
          <p className="label">{tr("fieldWindow")}</p>
          <p className="mb-2 text-sm text-muted">{tr("windowHint")}</p>
          <div className="flex flex-wrap gap-2">
            {[0, 15, 30, 60, 90, 120].map((n) => (
              <button key={n} type="button" className={draft.windowMin === n ? "chip chip-on" : "chip"} onClick={() => patch({ windowMin: n })}>
                {n === 0 ? tr("window0") : tr("windowLabel", { n })}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="grid gap-2">
        <h2 className="font-display text-2xl">{tr("fieldInstructions")}</h2>
        <div className="flex flex-wrap gap-2">
          {INSTRUCTIONS.map((idInst) => (
            <button key={idInst} type="button" className={draft.instructions.includes(idInst) ? "chip chip-on" : "chip"} aria-pressed={draft.instructions.includes(idInst)} onClick={() => toggleInst(idInst)}>
              {instructionLabel(lang, idInst)}
            </button>
          ))}
        </div>
      </section>
      <Field label={tr("fieldNotes")} hint={tr("notesPh")}>
        <textarea className="field min-h-28" value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} />
      </Field>
      <div>
        <p className="label">{tr("color")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SWATCHES.map((s) => (
            <button key={s} type="button" className={draft.swatch === s ? "chip chip-on" : "chip"} aria-pressed={draft.swatch === s} onClick={() => patch({ swatch: s })}>
              <span className={`swatch-dot swatch-${s}`} aria-hidden />
              {swatchLabel(lang, s)}
            </button>
          ))}
        </div>
      </div>
      <label className="choice">
        <input type="checkbox" checked={draft.critical} onChange={(e) => patch({ critical: e.target.checked })} />
        <span>
          <span className="block font-semibold">{tr("fieldCritical")}</span>
          <span className="text-sm text-muted">{tr("criticalHint")}</span>
        </span>
      </label>
      <section className="grid gap-2">
        <h2 className="font-display text-2xl">{tr("fieldRelated")}</h2>
        {draft.related.map((rel, i) => (
          <div key={i} className="grid gap-2">
            <input className="field" value={rel.name} placeholder={tr("relatedPh")} onChange={(e) => patch({ related: draft.related.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)) })} />
            <div className="flex gap-2">
              <select className="field" value={rel.relation} onChange={(e) => patch({ related: draft.related.map((r, idx) => (idx === i ? { ...r, relation: e.target.value as RelatedMed["relation"] } : r)) })}>
                <option value="with">{tr("relWith")}</option>
                <option value="avoid">{tr("relAvoid")}</option>
              </select>
              <Btn variant="ghost" onClick={() => patch({ related: draft.related.filter((_, idx) => idx !== i) })}>{tr("delete")}</Btn>
            </div>
          </div>
        ))}
        <Btn variant="soft" onClick={() => patch({ related: [...draft.related, { name: "", relation: "with" }] })}>{tr("addRelated")}</Btn>
      </section>
      <Field label={tr("fieldPhoto")}>
        <input className="field" type="file" accept="image/*" onChange={(e) => void onPhoto(e.target.files?.[0])} />
      </Field>
      {draft.photoDataUrl ? (
        <div className="grid gap-2">
          <img src={draft.photoDataUrl} alt={tr("photoAlt")} className="max-h-48 w-full rounded-2xl object-cover" />
          <Btn variant="ghost" onClick={() => patch({ photoDataUrl: undefined })}>{tr("removePhoto")}</Btn>
        </div>
      ) : null}
      <Btn block onClick={save}>{tr("save")}</Btn>
      {existing ? (
        <div className="grid gap-2">
          {existing.status === "active" ? <Btn variant="ghost" onClick={() => { setStatus(existing.id, "paused"); toast(tr("saved")); back(); }}>{tr("pause")}</Btn> : null}
          {existing.status === "paused" ? <Btn variant="soft" onClick={() => { setStatus(existing.id, "active"); toast(tr("saved")); back(); }}>{tr("resume")}</Btn> : null}
          <Btn variant="ghost" onClick={() => { duplicate(existing.id, tr("dupSuffix")); toast(tr("saved")); back(); }}>{tr("duplicate")}</Btn>
          <Btn variant="ghost" onClick={() => { setStatus(existing.id, "archived"); toast(tr("saved")); back(); }}>{tr("archive")}</Btn>
          <Btn variant="ghost" onClick={share}>{tr("shareCourse")}</Btn>
          <Btn variant="bad" onClick={() => setAskDelete(true)}>{tr("deleteCourse")}</Btn>
        </div>
      ) : null}
      {askDelete && existing ? (
        <Modal title={tr("deleteCourse")} onClose={() => setAskDelete(false)} closeLabel={tr("close")}>
          <p>{tr("deleteCourseBody")}</p>
          <div className="mt-4 grid gap-2">
            <Btn variant="bad" onClick={() => { remove(existing.id); toast(tr("deleted")); setAskDelete(false); back(); }}>{tr("yesDelete")}</Btn>
            <Btn variant="ghost" onClick={() => setAskDelete(false)}>{tr("cancel")}</Btn>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
