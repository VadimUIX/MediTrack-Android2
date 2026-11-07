import { FormGlyph, ProfileGlyph } from "@/components/meditrack/glyphs";
import { Btn, Empty, Modal, useLang, useT } from "@/components/meditrack/ui";
import { useNav } from "@/components/meditrack/nav";
import { addDays, atDateTime, todayISO } from "@/lib/meditrack/dates";
import { assessPrn, buildDay, takenKind, tally, type BuiltSlot } from "@/lib/meditrack/engine";
import { countdown, dayCaption, doseText, formatLong, instructionLabel, statusLabel } from "@/lib/meditrack/format";
import type { Key } from "@/lib/meditrack/i18n";
import { activeProfile, useMedi } from "@/lib/meditrack/store";
import { SKIP_REASONS, uid, type Medication, type SkipReason } from "@/lib/meditrack/types";
import { Bell, ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export function Today() {
  const tr = useT();
  const lang = useLang();
  const { screen, setTop } = useNav();
  const date = screen.name === "today" && screen.date ? screen.date : todayISO();
  const [now, setNow] = useState(() => new Date());
  const [sheet, setSheet] = useState<BuiltSlot | null>(null);
  const [oneOff, setOneOff] = useState(false);
  const [prnMedication, setPrnMedication] = useState<Medication | null>(null);
  const [shift, setShift] = useState(false);
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [hideDemo, setHideDemo] = useState(() => sessionStorage.getItem("mt-demo-hide") === "1");

  const data = useMedi();
  const profile = activeProfile(data);
  const privacySeen = data.privacySeen;

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const slots = useMemo(
    () =>
      buildDay({
        date,
        now,
        profile,
        medications: data.medications,
        logs: data.logs,
        overrides: data.overrides,
      }),
    [date, now, profile, data.medications, data.logs, data.overrides],
  );

  const minuteKey = Math.floor(now.getTime() / 60000);
  void minuteKey;

  const score = tally(slots);
  const prnMeds = data.medications.filter((med) => med.profileId === profile.id && med.status === "active" && (med.intakeMode === "prn" || med.intakeMode === "combined"));
  const today = todayISO(now);
  const future = date > today;
  const hero =
    slots.find((s) => s.view === "due" || s.view === "missed" || s.view === "snoozed") ??
    slots.find((s) => s.view === "upcoming");
  const finished = slots.length > 0 && !hero;
  const groups = groupSlots(slots);
  const hasDemo = data.medications.some((m) => m.id.startsWith("demo-"));

  function goDay(next: string) {
    setTop({ name: "today", date: next === today ? undefined : next });
  }

  function markTaken(slot: BuiltSlot) {
    if (future) return;
    const status = takenKind(date, slot.time, new Date(), slot.medication.schedule.windowMin);
    const prev = slot.log;
    data.markDose({ medicationId: slot.medication.id, date, time: slot.baseTime, status });
    toast(tr("marked"), {
      action: {
        label: tr("undo"),
        onClick: () => {
          if (!prev) data.clearDose(slot.medication.id, date, slot.baseTime);
          else data.markDose({ medicationId: prev.medicationId, date: prev.date, time: prev.time, status: prev.status, skipReason: prev.skipReason, note: prev.note, snoozeUntil: prev.snoozeUntil });
        },
      },
    });
  }

  const pct = score.scheduled ? Math.round((score.taken / score.scheduled) * 100) : 0;

  return (
    <div className="grid gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">{tr("brandFull")}</p>
          <h1 className="font-display text-3xl leading-tight">{formatLong(date, lang)}</h1>
        </div>
        <button type="button" className="profile-chip" onClick={() => setProfilesOpen(true)} aria-haspopup="dialog">
          <span className={`swatch-dot swatch-${profile.swatch}`} aria-hidden />
          <ProfileGlyph icon={profile.icon} className="size-5" />
          <span className="max-w-24 truncate">{profile.name}</span>
        </button>
      </header>

      {!privacySeen ? (
        <div className="card border-primary">
          <p className="font-semibold">{tr("localOnly")}</p>
          <p className="mt-1 text-muted">{tr("privacyBanner")}</p>
          <Btn className="mt-3" variant="soft" onClick={() => data.setPrivacySeen(true)}>
            {tr("gotIt")}
          </Btn>
        </div>
      ) : null}

      {hasDemo && !hideDemo ? (
        <div className="card">
          <p>{tr("demoBanner")}</p>
          <Btn
            className="mt-3"
            variant="ghost"
            onClick={() => {
              sessionStorage.setItem("mt-demo-hide", "1");
              setHideDemo(true);
            }}
          >
            {tr("gotIt")}
          </Btn>
        </div>
      ) : null}

      {profile.away && date >= profile.away.from && date <= profile.away.to ? (
        <p className="card text-muted">{tr("awayBanner", { from: profile.away.from, to: profile.away.to })}</p>
      ) : null}

      <section className="card">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold">{score.scheduled ? tr("progress", { taken: score.taken, total: score.scheduled }) : tr("noPlan")}</p>
          <span className="tabular-nums text-muted">{score.scheduled ? `${pct}%` : ""}</span>
        </div>
        <div className="meter mt-3" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </div>
      </section>

      {hero ? (
        <section className={`hero ${hero.view === "missed" ? "hero-miss" : ""}`}>
          <p className="text-sm font-semibold uppercase tracking-wide">
            {hero.view === "due" || hero.view === "snoozed" ? tr("nowDose") : hero.view === "missed" ? tr("missedHero") : tr("nextDose")}
          </p>
          <p className="font-display text-4xl leading-none tabular-nums">{hero.time}</p>
          <p className="text-xl">{hero.medication.name}</p>
          <p className="text-muted">{doseText(hero.medication, lang)}</p>
          {hero.view === "upcoming" || hero.view === "due" ? (
            <p className="tabular-nums">{countdown(atDateTime(date, hero.time).getTime() - now.getTime(), lang)}</p>
          ) : (
            <p>{statusLabel(lang, hero.view)}</p>
          )}
          {!future && hero.view !== "away" ? (
            <Btn className="mt-2" onClick={() => markTaken(hero)}>
              {tr("takenBtn")}
            </Btn>
          ) : null}
        </section>
      ) : null}

      {finished ? (
        <section className="hero">
          <p className="font-display text-3xl">{tr("allDone")}</p>
          <p>{tr("allDoneHint")}</p>
        </section>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <button type="button" className="icon-btn" aria-label={tr("prevDay")} onClick={() => goDay(addDays(date, -1))}>
          <ChevronLeft />
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => goDay(today)}>
          {dayCaption(date, lang, today)}
        </button>
        <button type="button" className="icon-btn" aria-label={tr("nextDay")} onClick={() => goDay(addDays(date, 1))}>
          <ChevronRight />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={tr("refresh")}
          onClick={() => {
            data.completeExpired();
            setNow(new Date());
          }}
        >
          <RefreshCw />
        </button>
      </div>

      {future ? <p className="text-muted">{tr("futureLock")}</p> : null}

      {slots.length === 0 && prnMeds.length === 0 ? <Empty title={tr("noPlan")} body={tr("noPlanHint")} /> : null}

      <ol className="timeline">
        {groups.map(([time, items]) => (
          <li key={time}>
            <p className="font-display text-2xl tabular-nums">{time}</p>
            <div className="grid gap-2">
              {items.map((slot) => (
                <SlotCard key={`${slot.medication.id}-${slot.baseTime}`} slot={slot} future={future} onOpen={() => setSheet(slot)} onTaken={() => markTaken(slot)} />
              ))}
            </div>
          </li>
        ))}
      </ol>

      {!future && date === today && prnMeds.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="font-display text-2xl">{tr("prnTodayTitle")}</h2>
          {prnMeds.map((med) => {
            const assessment = assessPrn({ medication: med, logs: data.logs, profileId: profile.id, now });
            return (
              <article key={med.id} className="card grid gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{med.name}</p>
                    <p className="text-sm text-muted">{doseText(med, lang)}</p>
                    <p className="mt-1 text-sm text-muted">{tr("prnTodayTotal", { total: assessment.dailyTotal, unit: med.doseUnit })}</p>
                    {assessment.lastTakenAt ? <p className="text-sm text-muted">{tr("prnLastTaken", { time: assessment.lastTakenAt.toLocaleTimeString(lang === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" }) })}</p> : null}
                  </div>
                  <Btn onClick={() => setPrnMedication(med)}>{tr("prnRecord")}</Btn>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Btn variant="soft" onClick={() => setOneOff(true)}>
          <Plus className="size-5" />
          {tr("oneOff")}
        </Btn>
        <Btn variant="ghost" onClick={() => setShift(true)}>
          {tr("shiftDay")}
        </Btn>
      </div>

      {sheet ? <DoseSheet slot={sheet} date={date} future={future} onClose={() => setSheet(null)} onTaken={() => { markTaken(sheet); setSheet(null); }} /> : null}
      {oneOff ? <OneOff date={date} future={future} onClose={() => setOneOff(false)} /> : null}
      {prnMedication ? <PrnDoseModal medication={prnMedication} profileId={profile.id} logs={data.logs} onClose={() => setPrnMedication(null)} /> : null}
      {shift ? <Shift date={date} onClose={() => setShift(false)} /> : null}
      {profilesOpen ? <ProfileSwitch onClose={() => setProfilesOpen(false)} /> : null}
    </div>
  );
}

function groupSlots(slots: BuiltSlot[]): [string, BuiltSlot[]][] {
  const map = new Map<string, BuiltSlot[]>();
  for (const slot of slots) {
    const list = map.get(slot.time) ?? [];
    list.push(slot);
    map.set(slot.time, list);
  }
  return [...map.entries()];
}

function SlotCard({ slot, future, onOpen, onTaken }: { slot: BuiltSlot; future: boolean; onOpen: () => void; onTaken: () => void }) {
  const tr = useT();
  const lang = useLang();
  const med = slot.medication;
  const low = med.refillRemind && med.stock <= med.refillThreshold;
  const done = slot.view === "taken_on_time" || slot.view === "taken_late" || slot.view === "skipped";
  return (
    <article className={`dose ${done ? "dose-done" : ""} ${slot.view === "due" ? "dose-due" : ""}`}>
      <span className={`dose-bar swatch-${med.swatch}`} aria-hidden />
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
        <span className="flex items-center gap-2">
          <FormGlyph form={med.form} className="size-5 shrink-0 text-muted" />
          <span className="truncate text-lg font-semibold">{med.name}</span>
          {med.critical ? <Bell className="size-4 text-clay" aria-label={tr("criticalBadge")} /> : null}
        </span>
        <span className="mt-0.5 block text-muted">{doseText(med, lang)}</span>
        {med.instructions[0] ? <span className="mt-0.5 block text-sm text-muted">{instructionLabel(lang, med.instructions[0])}</span> : null}
        <span className={`status status-${slot.view}`}>{statusLabel(lang, slot.view)}</span>
        {low ? <span className="mt-1 block text-sm text-clay">{tr("lowStock", { n: med.stock })}</span> : null}
      </button>
      {!future && slot.view !== "away" && !done ? (
        <Btn onClick={onTaken}>{tr("takenBtn")}</Btn>
      ) : null}
    </article>
  );
}

function DoseSheet({ slot, date, future, onClose, onTaken }: { slot: BuiltSlot; date: string; future: boolean; onClose: () => void; onTaken: () => void }) {
  const tr = useT();
  const lang = useLang();
  const data = useMedi();
  const [reason, setReason] = useState<SkipReason>("forgot");
  const [note, setNote] = useState(slot.log?.note ?? "");
  const [moveTo, setMoveTo] = useState(slot.time);
  const [mode, setMode] = useState<"skip" | "miss" | "move" | null>(null);

  function commit(status: "skipped" | "missed" | "snoozed", extra?: { snoozeUntil?: string }) {
    data.markDose({
      medicationId: slot.medication.id,
      date,
      time: slot.baseTime,
      status,
      skipReason: status === "snoozed" ? undefined : reason,
      note: note.trim() || undefined,
      snoozeUntil: extra?.snoozeUntil,
    });
    toast(tr("marked"));
    onClose();
  }

  return (
    <Modal title={slot.medication.name} onClose={onClose} closeLabel={tr("close")}>
      <p className="text-muted">{doseText(slot.medication, lang)} · {slot.time}</p>
      <p className="mt-1">{statusLabel(lang, slot.view)}</p>
      {slot.medication.instructions.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {slot.medication.instructions.map((id) => (
            <li key={id} className="chip">{instructionLabel(lang, id)}</li>
          ))}
        </ul>
      ) : null}
      {slot.medication.notes ? <p className="mt-3 whitespace-pre-wrap">{slot.medication.notes}</p> : null}
      {!future ? (
        <div className="mt-4 grid gap-2">
          <Btn onClick={onTaken}>{tr("takenBtn")}</Btn>
          <div className="grid grid-cols-3 gap-2">
            {[5, 10, 15, 30, 60].map((m) => (
              <Btn key={m} variant="soft" onClick={() => commit("snoozed", { snoozeUntil: new Date(Date.now() + m * 60000).toISOString() })}>
                {tr("minutes", { n: m })}
              </Btn>
            ))}
          </div>
          <p className="text-sm text-muted">{tr("snooze")}</p>
          <Btn variant="ghost" onClick={() => setMode("skip")}>{tr("wontTake")}</Btn>
          <Btn variant="ghost" onClick={() => setMode("miss")}>{tr("confirmMiss")}</Btn>
          <Btn variant="ghost" onClick={() => setMode("move")}>{tr("move")}</Btn>
          <Btn variant="ghost" onClick={() => { data.cancelSlot(slot.medication.id, date, slot.baseTime); toast(tr("moved")); onClose(); }}>{tr("cancelToday")}</Btn>
          {slot.log ? (
            <Btn variant="quiet" onClick={() => { data.clearDose(slot.medication.id, date, slot.baseTime); toast(tr("undone")); onClose(); }}>{tr("undo")}</Btn>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-muted">{tr("futureLock")}</p>
      )}
      {mode === "skip" || mode === "miss" ? (
        <div className="mt-4 grid gap-2">
          <p className="font-semibold">{tr("chooseReason")}</p>
          <div className="flex flex-wrap gap-2">
            {SKIP_REASONS.map((id) => (
              <button key={id} type="button" className={reason === id ? "chip chip-on" : "chip"} onClick={() => setReason(id)}>
                {tr(`reason_${id}` as Key)}
              </button>
            ))}
          </div>
          <label className="grid gap-1">
            <span className="label">{tr("note")}</span>
            <input className="field" value={note} placeholder={tr("notePh")} onChange={(e) => setNote(e.target.value)} />
          </label>
          <Btn variant={mode === "skip" ? "clay" : "bad"} onClick={() => commit(mode === "skip" ? "skipped" : "missed")}>{tr("confirm")}</Btn>
        </div>
      ) : null}
      {mode === "move" ? (
        <div className="mt-4 grid gap-2">
          <label className="grid gap-1">
            <span className="label">{tr("newTime")}</span>
            <input className="field" type="time" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} />
          </label>
          <Btn onClick={() => { data.moveSlot(slot.medication.id, date, slot.baseTime, moveTo); toast(tr("moved")); onClose(); }}>{tr("apply")}</Btn>
        </div>
      ) : null}
    </Modal>
  );
}

function OneOff({ date, future, onClose }: { date: string; future: boolean; onClose: () => void }) {
  const tr = useT();
  const data = useMedi();
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [time, setTime] = useState("12:00");

  function save(take: boolean) {
    const trimmed = name.trim();
    if (!trimmed) {
      toast(tr("errName"));
      return;
    }
    const now = new Date().toISOString();
    const med: Medication = {
      id: uid(),
      profileId: data.activeProfileId,
      name: trimmed,
      form: "tablet",
      doseAmount: 1,
      doseUnit: "шт",
      unitsPerDose: 1,
      doseLabel: label.trim(),
      packSize: 0,
      stock: 0,
      refillThreshold: 0,
      refillRemind: false,
      startDate: date,
      endDate: date,
      indefinite: false,
      status: "active",
      notes: "",
      instructions: [],
      swatch: "slate",
      related: [],
      schedule: { times: [time], dayRule: { kind: "once", date }, windowMin: 60 },
      critical: false,
      createdAt: now,
      updatedAt: now,
    };
    data.upsertMedication(med);
    if (take && !future) {
      const status = takenKind(date, time, new Date(), 60);
      data.markDose({ medicationId: med.id, date, time, status, profileId: data.activeProfileId });
    }
    toast(tr("saved"));
    onClose();
  }

  return (
    <Modal title={tr("oneOffTitle")} onClose={onClose} closeLabel={tr("close")}>
      <div className="grid gap-3">
        <label className="grid gap-1">
          <span className="label">{tr("fieldName")}</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="label">{tr("fieldDoseLabel")}</span>
          <input className="field" value={label} placeholder={tr("doseLabelPh")} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="label">{tr("fieldTimes")}</span>
          <input className="field" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <Btn onClick={() => save(false)}>{tr("planIt")}</Btn>
        {!future ? <Btn variant="soft" onClick={() => save(true)}>{tr("alreadyTaken")}</Btn> : null}
      </div>
    </Modal>
  );
}


function PrnDoseModal({ medication, profileId, logs, onClose }: { medication: Medication; profileId: string; logs: ReturnType<typeof useMedi.getState>["logs"]; onClose: () => void }) {
  const tr = useT();
  const lang = useLang();
  const data = useMedi();
  const [amount, setAmount] = useState(String(medication.doseAmount));
  const [note, setNote] = useState("");
  const now = new Date();
  const assessment = assessPrn({ medication, logs, profileId, now });
  const dose = Number(amount.replace(",", "."));
  const warnings: string[] = [];
  if (assessment.intervalBlocked && assessment.nextAllowedAt) {
    warnings.push(tr("prnIntervalWarning", { time: assessment.nextAllowedAt.toLocaleTimeString(lang === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" }) }));
  }
  if (medication.prn?.maxDoseAmount != null && dose > medication.prn.maxDoseAmount) {
    warnings.push(tr("prnSingleWarning", { limit: medication.prn.maxDoseAmount, unit: medication.doseUnit }));
  }
  if (medication.prn?.maxDailyDoseAmount != null && assessment.dailyTotal + dose > medication.prn.maxDailyDoseAmount) {
    warnings.push(tr("prnDailyWarning", { total: assessment.dailyTotal + dose, limit: medication.prn.maxDailyDoseAmount, unit: medication.doseUnit }));
  }
  function save() {
    if (!(dose > 0) || !Number.isFinite(dose)) {
      toast.error(tr("errDose"));
      return;
    }
    const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    data.recordPrnDose({ medicationId: medication.id, profileId, date: todayISO(now), time, doseAmount: dose, note: note.trim() || undefined });
    toast(tr("marked"));
    onClose();
  }
  return (
    <Modal title={medication.name} onClose={onClose} closeLabel={tr("close")}>
      <div className="grid gap-3">
        <p className="text-muted">{doseText(medication, lang)}</p>
        <label className="grid gap-1">
          <span className="label">{tr("prnDoseAmount")} · {medication.doseUnit}</span>
          <input className="field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="label">{tr("prnReasonNote")}</span>
          <textarea className="field min-h-20" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {warnings.length > 0 ? (
          <div className="rounded-2xl border border-clay bg-clay/10 p-3 text-sm text-clay">
            {warnings.map((warning) => <p key={warning}>{warning}</p>)}
            <p className="mt-2">{tr("prnLimitOverrideHint")}</p>
          </div>
        ) : null}
        <Btn block onClick={save}>{tr("prnRecord")}</Btn>
      </div>
    </Modal>
  );
}

function Shift({ date, onClose }: { date: string; onClose: () => void }) {
  const tr = useT();
  const shiftDay = useMedi((s) => s.shiftDay);
  return (
    <Modal title={tr("shiftDay")} onClose={onClose} closeLabel={tr("close")}>
      <p className="mb-3 text-muted">{tr("shiftHint")}</p>
      <div className="grid gap-2">
        {[
          [0, tr("shift0")],
          [-30, tr("minus30")],
          [30, tr("plus30")],
          [60, tr("plus60")],
        ].map(([mins, label]) => (
          <Btn key={String(mins)} variant={mins === 0 ? "ghost" : "soft"} onClick={() => { shiftDay(date, Number(mins)); toast(tr("saved")); onClose(); }}>
            {label}
          </Btn>
        ))}
      </div>
    </Modal>
  );
}

function ProfileSwitch({ onClose }: { onClose: () => void }) {
  const tr = useT();
  const profiles = useMedi((s) => s.profiles);
  const active = useMedi((s) => s.activeProfileId);
  const setActive = useMedi((s) => s.setActiveProfile);
  const { go } = useNav();
  return (
    <Modal title={tr("profileSwitch")} onClose={onClose} closeLabel={tr("close")}>
      <div className="grid gap-2">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            className={p.id === active ? "choice choice-on" : "choice"}
            onClick={() => {
              setActive(p.id);
              onClose();
            }}
          >
            <span className={`swatch-dot swatch-${p.swatch}`} aria-hidden />
            <ProfileGlyph icon={p.icon} className="size-5" />
            <span className="font-semibold">{p.name}</span>
            {p.isPrimary ? <span className="text-sm text-muted">{tr("primary")}</span> : null}
          </button>
        ))}
        <Btn variant="ghost" onClick={() => { onClose(); go({ name: "profiles" }); }}>{tr("profiles")}</Btn>
      </div>
    </Modal>
  );
}
