import { ProfileGlyph } from "@/components/meditrack/glyphs";
import { PrivacyDocument, TermsModal } from "@/components/meditrack/Legal";
import { useNav } from "@/components/meditrack/nav";
import { Btn, Field, Modal, PinPad, useLang, useT } from "@/components/meditrack/ui";
import { beep, armAudio } from "@/components/meditrack/sound";
import { decryptJson, downloadText, encryptJson, hashPin, registerBiometric, verifyBiometric } from "@/lib/meditrack/crypto";
import { todayISO } from "@/lib/meditrack/dates";
import { isBackup, isCourseFile, useMedi } from "@/lib/meditrack/store";
import { PROFILE_ICONS, SWATCHES, uid, type Profile, type ProfileIcon, type Swatch } from "@/lib/meditrack/types";
import { swatchLabel } from "@/lib/meditrack/format";
import type { Key } from "@/lib/meditrack/i18n";
import { ChevronRight, Fingerprint, LockKeyhole, Moon, Shield, Sun, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getExactAlarmPermission, getNotifPermission, isNative, requestExactAlarmPermission, requestNotifPermission, showNotification, type NotifPerm } from "@/lib/native-notify";

export function More() {
  const tr = useT();
  const { go } = useNav();
  const items = [
    ["report", tr("reportTitle")],
    ["profiles", tr("profiles")],
    ["backup", tr("backup")],
    ["settings", tr("settings")],
    ["privacy", tr("privacy")],
    ["about", tr("about")],
  ] as const;
  return (
    <div className="grid gap-4">
      <h1 className="font-display text-3xl">{tr("moreTitle")}</h1>
      <p className="text-muted">{tr("noInternetNeeded")}</p>
      <div className="grid gap-2">
        {items.map(([name, label]) => (
          <button key={name} type="button" className="choice" onClick={() => go({ name })}>
            <span className="flex-1 text-left text-lg font-semibold">{label}</span>
            <ChevronRight className="size-5 text-muted" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function Profiles() {
  const tr = useT();
  const { go } = useNav();
  const profiles = useMedi((s) => s.profiles);
  const active = useMedi((s) => s.activeProfileId);
  const setActive = useMedi((s) => s.setActiveProfile);
  return (
    <div className="grid gap-4">
      <h1 className="font-display text-3xl">{tr("profiles")}</h1>
      <p className="text-muted">{tr("profilesLead")}</p>
      <ul className="grid gap-2">
        {profiles.map((p) => (
          <li key={p.id}>
            <button type="button" className={p.id === active ? "choice choice-on" : "choice"} onClick={() => { setActive(p.id); go({ name: "profile", id: p.id }); }}>
              <span className={`swatch-dot swatch-${p.swatch}`} />
              <ProfileGlyph icon={p.icon} className="size-5" />
              <span className="flex-1 text-left font-semibold">{p.name}</span>
              {p.isPrimary ? <span className="text-sm text-muted">{tr("primary")}</span> : null}
            </button>
          </li>
        ))}
      </ul>
      <Btn onClick={() => go({ name: "profile" })}>{tr("addProfile")}</Btn>
    </div>
  );
}

export function ProfileForm({ id }: { id?: string }) {
  const tr = useT();
  const lang = useLang();
  const { back } = useNav();
  const existing = useMedi((s) => s.profiles.find((p) => p.id === id));
  const profiles = useMedi((s) => s.profiles);
  const upsert = useMedi((s) => s.upsertProfile);
  const remove = useMedi((s) => s.deleteProfile);
  const setAway = useMedi((s) => s.setAway);
  const [name, setName] = useState(existing?.name ?? "");
  const [icon, setIcon] = useState<ProfileIcon>(existing?.icon ?? "user");
  const [swatch, setSwatch] = useState<Swatch>(existing?.swatch ?? "sage");
  const [primary, setPrimary] = useState(existing?.isPrimary ?? profiles.length === 0);
  const [from, setFrom] = useState(existing?.away?.from ?? todayISO());
  const [to, setTo] = useState(existing?.away?.to ?? todayISO());
  const [ask, setAsk] = useState(false);

  function save() {
    if (!name.trim()) {
      toast(tr("errProfile"));
      return;
    }
    const profile: Profile = {
      id: existing?.id ?? uid(),
      name: name.trim(),
      icon,
      swatch,
      isPrimary: primary || profiles.length === 0,
      away: existing?.away ?? null,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    upsert(profile);
    toast(tr("saved"));
    back();
  }

  return (
    <div className="grid gap-4">
      <h1 className="font-display text-3xl">{existing ? existing.name : tr("addProfile")}</h1>
      <Field label={tr("profileName")}>
        <input className="field" value={name} placeholder={tr("namePh")} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        {([tr("suggestMe"), tr("suggestSpouse"), tr("suggestMom"), tr("suggestChild")] as const).map((label) => (
          <button key={label} type="button" className="chip" onClick={() => setName(label)}>{label}</button>
        ))}
      </div>
      <div>
        <p className="label">{tr("icon")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PROFILE_ICONS.map((idIcon) => (
            <button key={idIcon} type="button" className={icon === idIcon ? "chip chip-on" : "chip"} aria-pressed={icon === idIcon} onClick={() => setIcon(idIcon)}>
              <ProfileGlyph icon={idIcon} className="size-4" />
              {tr(`icon_${idIcon}` as Key)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="label">{tr("color")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SWATCHES.map((s) => (
            <button key={s} type="button" className={swatch === s ? "chip chip-on" : "chip"} onClick={() => setSwatch(s)}>
              <span className={`swatch-dot swatch-${s}`} />
              {swatchLabel(lang, s)}
            </button>
          ))}
        </div>
      </div>
      <label className="choice">
        <input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} />
        <span>{tr("makePrimary")}</span>
      </label>
      <Btn onClick={save}>{tr("save")}</Btn>
      {existing ? (
        <section className="grid gap-3">
          <h2 className="font-display text-2xl">{tr("awayTitle")}</h2>
          <p className="text-muted">{tr("awayHint")}</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label={tr("awayFrom")}>
              <input className="field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label={tr("awayTo")}>
              <input className="field" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          <Btn variant="soft" onClick={() => { setAway(existing.id, from <= to ? { from, to } : { from: to, to: from }); toast(tr("saved")); }}>{tr("apply")}</Btn>
          {existing.away ? <Btn variant="ghost" onClick={() => { setAway(existing.id, null); toast(tr("saved")); }}>{tr("awayClear")}</Btn> : null}
        </section>
      ) : null}
      {existing && profiles.length > 1 ? <Btn variant="bad" onClick={() => setAsk(true)}>{tr("deleteProfile")}</Btn> : null}
      {existing && profiles.length < 2 ? <p className="text-muted">{tr("lastProfile")}</p> : null}
      {ask && existing ? (
        <Modal title={tr("deleteProfile")} onClose={() => setAsk(false)} closeLabel={tr("close")}>
          <p>{tr("deleteProfileBody")}</p>
          <div className="mt-4 grid gap-2">
            <Btn variant="bad" onClick={() => { remove(existing.id); toast(tr("deleted")); setAsk(false); back(); }}>{tr("yesDelete")}</Btn>
            <Btn variant="ghost" onClick={() => setAsk(false)}>{tr("cancel")}</Btn>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export function Settings() {
  const tr = useT();
  const [showTerms, setShowTerms] = useState(false);
  const lang = useMedi((s) => s.lang);
  const theme = useMedi((s) => s.theme);
  const scale = useMedi((s) => s.textScale);
  const notif = useMedi((s) => s.notif);
  const setLang = useMedi((s) => s.setLang);
  const setTheme = useMedi((s) => s.setTheme);
  const setScale = useMedi((s) => s.setTextScale);
  const setNotif = useMedi((s) => s.setNotif);
  const pinHash = useMedi((s) => s.pinHash);
  const pinSalt = useMedi((s) => s.pinSalt);
  const credentialId = useMedi((s) => s.credentialId);
  const setPin = useMedi((s) => s.setPin);
  const clearPin = useMedi((s) => s.clearPin);
  const setCredential = useMedi((s) => s.setCredential);
  const removeDemos = useMedi((s) => s.removeDemos);
  const resetData = useMedi((s) => s.resetData);
  const hasDemo = useMedi((s) => s.medications.some((m) => m.id.startsWith("demo-")));
  const [perm, setPerm] = useState<NotifPerm>("unknown");
  const [exactPerm, setExactPerm] = useState<NotifPerm>("unknown");
  const [pinMode, setPinMode] = useState<"off" | "new" | "repeat" | "current">("off");
  const [pin, setPinValue] = useState("");
  const [first, setFirst] = useState("");
  const [wipe, setWipe] = useState(0);
  const [bioOk, setBioOk] = useState(false);

  useEffect(() => {
    const refreshPermissions = () => {
      void getNotifPermission().then(setPerm);
      void getExactAlarmPermission().then(setExactPerm);
    };
    refreshPermissions();
    const onResume = () => { if (document.visibilityState === "visible") refreshPermissions(); };
    window.addEventListener("focus", onResume);
    document.addEventListener("visibilitychange", onResume);
    setBioOk(typeof window !== "undefined" && !!window.PublicKeyCredential);
    return () => {
      window.removeEventListener("focus", onResume);
      document.removeEventListener("visibilitychange", onResume);
    };
  }, []);

  async function savePin(value: string) {
    if (pinMode === "new") {
      if (value.length < 4) {
        toast(tr("pinShort"));
        return;
      }
      setFirst(value);
      setPinValue("");
      setPinMode("repeat");
      return;
    }
    if (pinMode === "repeat") {
      if (value !== first) {
        toast(tr("pinMismatch"));
        setPinValue("");
        return;
      }
      const hashed = await hashPin(value);
      setPin(hashed.hash, hashed.salt);
      toast(tr("saved"));
      setPinMode("off");
      setPinValue("");
      return;
    }
    if (pinMode === "current" && pinHash && pinSalt) {
      const hashed = await hashPin(value, pinSalt);
      if (hashed.hash !== pinHash) {
        toast(tr("pinWrong"));
        setPinValue("");
        return;
      }
      clearPin();
      toast(tr("saved"));
      setPinMode("off");
      setPinValue("");
    }
  }

  async function askNotif() {
    const result = await requestNotifPermission();
    setPerm(result);
    if (result === "granted") window.dispatchEvent(new Event("focus"));
    toast(tr("permissionAsked"));
  }

  async function askExactAlarm() {
    const result = await requestExactAlarmPermission();
    setExactPerm(result);
    if (result === "granted") window.dispatchEvent(new Event("focus"));
  }

  return (
    <div className="grid gap-5">
      <h1 className="font-display text-3xl">{tr("settings")}</h1>
      <p className="text-muted">{tr("settingsLead")}</p>
      <section className="grid gap-2">
        <h2 className="font-display text-2xl">{tr("theme")}</h2>
        <div className="grid grid-cols-3 gap-2">
          <Btn variant={theme === "light" ? "primary" : "ghost"} onClick={() => setTheme("light")}><Sun className="size-4" />{tr("themeLight")}</Btn>
          <Btn variant={theme === "dark" ? "primary" : "ghost"} onClick={() => setTheme("dark")}><Moon className="size-4" />{tr("themeDark")}</Btn>
          <Btn variant={theme === "system" ? "primary" : "ghost"} onClick={() => setTheme("system")}><Monitor className="size-4" />{tr("themeSystem")}</Btn>
        </div>
      </section>
      <section className="grid gap-2">
        <h2 className="font-display text-2xl">{tr("textSize")}</h2>
        <div className="grid grid-cols-3 gap-2">
          <Btn variant={scale === "md" ? "primary" : "ghost"} onClick={() => setScale("md")}>{tr("textMd")}</Btn>
          <Btn variant={scale === "lg" ? "primary" : "ghost"} onClick={() => setScale("lg")}>{tr("textLg")}</Btn>
          <Btn variant={scale === "xl" ? "primary" : "ghost"} onClick={() => setScale("xl")}>{tr("textXl")}</Btn>
        </div>
      </section>
      <section className="grid gap-2">
        <h2 className="font-display text-2xl">{tr("language")}</h2>
        <div className="grid grid-cols-2 gap-2">
          <Btn variant={lang === "ru" ? "primary" : "ghost"} onClick={() => setLang("ru")}>{tr("langRu")}</Btn>
          <Btn variant={lang === "en" ? "primary" : "ghost"} onClick={() => setLang("en")}>{tr("langEn")}</Btn>
        </div>
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">{tr("notif")}</h2>
        <label className="choice"><input type="checkbox" checked={notif.enabled} onChange={(e) => setNotif({ enabled: e.target.checked })} /><span>{tr("notifEnable")}</span></label>
        <label className="choice"><input type="checkbox" checked={notif.sound} onChange={(e) => setNotif({ sound: e.target.checked })} /><span>{tr("notifSound")}</span></label>
        <label className="choice"><input type="checkbox" checked={notif.vibrate} onChange={(e) => setNotif({ vibrate: e.target.checked })} /><span>{tr("notifVibrate")}</span></label>
        <Field label={tr("repeatEvery")}>
          <select className="field" value={notif.repeatMin} onChange={(e) => setNotif({ repeatMin: Number(e.target.value) as 5 | 10 | 15 | 30 })}>
            {[5, 10, 15, 30].map((n) => <option key={n} value={n}>{tr("minutes", { n })}</option>)}
          </select>
        </Field>
        <Field label={tr("snoozeAfter")}>
          <select className="field" value={notif.snoozeMin ?? 15} onChange={(e) => setNotif({ snoozeMin: Number(e.target.value) as 5 | 10 | 15 | 30 })}>
            {[5, 10, 15, 30].map((n) => <option key={n} value={n}>{tr("minutes", { n })}</option>)}
          </select>
        </Field>
        <p className="text-sm text-muted">{tr("snoozeHint")}</p>
        <Field label={tr("repeatTimes")}>
          <select className="field" value={notif.repeatCount} onChange={(e) => setNotif({ repeatCount: Number(e.target.value) })}>
            {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <label className="choice"><input type="checkbox" checked={notif.quietEnabled} onChange={(e) => setNotif({ quietEnabled: e.target.checked })} /><span>{tr("quiet")}</span></label>
        <div className="grid grid-cols-2 gap-2">
          <Field label={tr("quietFrom")}><input className="field" type="time" value={notif.quietFrom} onChange={(e) => setNotif({ quietFrom: e.target.value })} /></Field>
          <Field label={tr("quietTo")}><input className="field" type="time" value={notif.quietTo} onChange={(e) => setNotif({ quietTo: e.target.value })} /></Field>
        </div>
        <p className="text-muted">{tr("notifWebNote")}</p>
        <p className="text-sm text-muted">
          {perm === "granted" ? tr("notifGranted") : perm === "denied" ? tr("notifDenied") : tr("notifDefault")}
        </p>
        <Btn variant="soft" onClick={() => void askNotif()}>{tr("allowNotif")}</Btn>
        {isNative() ? (
          <>
            <p className="text-sm text-muted">{exactPerm === "granted" ? tr("exactAlarmGranted") : exactPerm === "denied" ? tr("exactAlarmDenied") : tr("exactAlarmUnknown")}</p>
            {exactPerm !== "granted" ? <Btn variant="soft" onClick={() => void askExactAlarm()}>{tr("allowExactAlarm")}</Btn> : null}
          </>
        ) : null}
        <div className="card grid gap-2">
          <h3 className="font-semibold">{tr("notifReliabilityTitle")}</h3>
          <p className="text-sm text-muted">{tr("setupLockScreenHint")}</p>
          {isNative() ? <p className="text-sm text-muted">{tr("setupXiaomiHint")}</p> : null}
        </div>
        <Btn variant="ghost" onClick={() => { if (isNative()) void showNotification(tr("remindTitle"), tr("testSent"), "meditrack-test-sound", notif.sound, notif.vibrate); else { armAudio(); if (notif.sound) beep(); if (notif.vibrate) navigator.vibrate?.(80); } toast(tr("testSent")); }}>{tr("testNotif")}</Btn>
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl"><LockKeyhole className="mr-2 inline size-5" />{tr("pin")}</h2>
        <p className="text-muted">{tr("pinHint")}</p>
        <p>{pinHash ? tr("pinIsOn") : tr("pinIsOff")}</p>
        {!pinHash ? <Btn onClick={() => { setPinMode("new"); setPinValue(""); }}>{tr("pinSet")}</Btn> : (
          <div className="grid gap-2">
            <Btn variant="ghost" onClick={() => { setPinMode("new"); setPinValue(""); }}>{tr("pinChange")}</Btn>
            <Btn variant="ghost" onClick={() => { setPinMode("current"); setPinValue(""); }}>{tr("pinRemove")}</Btn>
          </div>
        )}
        {pinMode !== "off" ? (
          <div className="card">
            <p className="mb-2 font-semibold">{pinMode === "repeat" ? tr("pinRepeat") : pinMode === "current" ? tr("pinCurrent") : tr("pinNew")}</p>
            <PinPad value={pin} onChange={setPinValue} />
            <Btn className="mt-3" block disabled={pin.length < 4} onClick={() => void savePin(pin)}>{tr("save")}</Btn>
          </div>
        ) : null}
        <h2 className="font-display text-2xl"><Fingerprint className="mr-2 inline size-5" />{tr("biometric")}</h2>
        <p className="text-muted">{tr("bioHint")}</p>
        {bioOk && pinHash ? (
          credentialId ? (
            <Btn variant="ghost" onClick={() => { setCredential(null); toast(tr("saved")); }}>{tr("biometricOff")}</Btn>
          ) : (
            <Btn variant="soft" onClick={() => { void registerBiometric().then((id) => { setCredential(id); toast(tr("saved")); }).catch(() => toast(tr("biometricFail"))); }}>{tr("biometricOn")}</Btn>
          )
        ) : (
          <p className="text-muted">{tr("biometricNo")}</p>
        )}
      </section>
      <section className="grid gap-2">
        <h2 className="font-display text-2xl">Правовая информация</h2>
        <button type="button" className="choice" onClick={() => setShowTerms(true)}>
          <span className="flex-1 text-left font-semibold">Условия использования и отказ от ответственности</span>
          <ChevronRight className="size-5 text-muted" />
        </button>
        <p className="text-sm text-muted">Правила использования MediTrack, ограничения напоминаний и важная медицинская информация.</p>
      </section>
      <section className="grid gap-2">
        <h2 className="font-display text-2xl">{tr("clearData")}</h2>
        <p className="text-muted">{tr("clearDataHint")}</p>
        {hasDemo ? <Btn variant="ghost" onClick={() => { removeDemos(); toast(tr("examplesRemoved")); }}>{tr("removeDemos")}</Btn> : null}
        {hasDemo ? <p className="text-sm text-muted">{tr("demosHint")}</p> : null}
        <Btn variant="bad" onClick={() => setWipe(1)}>{tr("clearData")}</Btn>
      </section>
      {showTerms ? <TermsModal onClose={() => setShowTerms(false)} /> : null}
      {wipe > 0 ? (
        <Modal title={tr("clearData")} onClose={() => setWipe(0)} closeLabel={tr("close")}>
          <p>{wipe === 1 ? tr("clearConfirm") : tr("clearConfirm2")}</p>
          <div className="mt-4 grid gap-2">
            <Btn variant="bad" onClick={() => { if (wipe === 1) setWipe(2); else { resetData(); setWipe(0); toast(tr("wiped")); } }}>{wipe === 1 ? tr("continue") : tr("yesDelete")}</Btn>
            <Btn variant="ghost" onClick={() => setWipe(0)}>{tr("cancel")}</Btn>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export function Backup() {
  const tr = useT();
  const snapshot = useMedi((s) => s.snapshot);
  const replaceAll = useMedi((s) => s.replaceAll);
  const addCourse = useMedi((s) => s.addSharedCourse);
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [encRaw, setEncRaw] = useState<string | null>(null);
  const [pending, setPending] = useState<unknown>(null);
  const [askPlain, setAskPlain] = useState(false);

  async function exportEnc() {
    if (pass.trim().length < 4) {
      toast(tr("needPass"));
      return;
    }
    setBusy(true);
    try {
      const text = await encryptJson(snapshot(), pass);
      downloadText(`dnevnik-${todayISO()}.meditrack.json`, text, "application/json");
      toast(tr("saved"));
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      toast(tr("badFile"));
      return;
    }
    const obj = parsed as { format?: string };
    if (obj && obj.format === "meditrack-enc-v1") {
      setEncRaw(text);
      return;
    }
    if (isBackup(parsed)) {
      setPending(parsed);
      return;
    }
    if (isCourseFile(parsed)) {
      addCourse(parsed.medication);
      toast(tr("courseImported"));
      return;
    }
    toast(tr("badFile"));
  }

  async function unlock() {
    if (!encRaw) return;
    setBusy(true);
    try {
      const data = await decryptJson(encRaw, pass);
      if (!isBackup(data)) {
        toast(tr("badFile"));
        return;
      }
      setEncRaw(null);
      setPending(data);
    } catch {
      toast(tr("wrongPassword"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <h1 className="font-display text-3xl">{tr("backup")}</h1>
      <p>{tr("backupLead")}</p>
      <p className="text-muted">{tr("backupBody")}</p>
      <Field label={tr("passphrase")}>
        <input className="field" type={show ? "text" : "password"} value={pass} placeholder={tr("passphrasePh")} autoComplete="off" onChange={(e) => setPass(e.target.value)} />
      </Field>
      <Btn variant="ghost" onClick={() => setShow((v) => !v)}>{show ? tr("hidePass") : tr("showPass")}</Btn>
      <Btn disabled={busy} onClick={() => void exportEnc()}>{busy ? tr("working") : tr("exportEnc")}</Btn>
      <Btn variant="ghost" onClick={() => setAskPlain(true)}>{tr("exportPlain")}</Btn>
      <label className="btn btn-soft btn-block">
        {tr("importFile")}
        <input className="sr-only" type="file" accept="application/json,.json" onChange={(e) => void onFile(e.target.files?.[0])} />
      </label>
      {encRaw ? (
        <div className="card grid gap-2">
          <p>{tr("passNeed")}</p>
          <Btn disabled={busy} onClick={() => void unlock()}>{tr("continue")}</Btn>
        </div>
      ) : null}
      {askPlain ? (
        <Modal title={tr("exportPlain")} onClose={() => setAskPlain(false)} closeLabel={tr("close")}>
          <p>{tr("plainWarn")}</p>
          <div className="mt-4 grid gap-2">
            <Btn variant="clay" onClick={() => { downloadText(`dnevnik-${todayISO()}.json`, JSON.stringify(snapshot(), null, 2), "application/json"); setAskPlain(false); }}>{tr("continue")}</Btn>
            <Btn variant="ghost" onClick={() => setAskPlain(false)}>{tr("cancel")}</Btn>
          </div>
        </Modal>
      ) : null}
      {pending && isBackup(pending) ? (
        <Modal title={tr("importFile")} onClose={() => setPending(null)} closeLabel={tr("close")}>
          <p>{tr("confirmReplace")}</p>
          <div className="mt-4 grid gap-2">
            <Btn variant="clay" onClick={() => { replaceAll(pending); setPending(null); toast(tr("imported")); }}>{tr("replaceYes")}</Btn>
            <Btn variant="ghost" onClick={() => setPending(null)}>{tr("cancel")}</Btn>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export function Privacy() {
  const tr = useT();
  return (
    <div className="grid gap-4">
      <h1 className="font-display text-3xl"><Shield className="mr-2 inline size-7" />{tr("privacyTitle")}</h1>
      <PrivacyDocument />
    </div>
  );
}

export function About() {
  const tr = useT();
  const lang = useLang();
  const ru = lang === "ru";
  const sections = ru ? [
    {
      title: "1. Первое знакомство и навигация",
      content: [
        ["Главные разделы", "В нижней панели находятся три основных раздела: «Сегодня», «Препараты» и «Ещё». «Сегодня» показывает план на выбранную дату, «Препараты» содержит список курсов, а в «Ещё» собраны история, отчёт, профили, резервная копия, настройки, конфиденциальность и эта инструкция."],
        ["Переходы между экранами", "Нажмите на карточку или название, чтобы открыть подробности. На внутренних экранах используйте стрелку «Назад» вверху или системный жест возврата от края экрана. Возврат ведёт на предыдущий экран, а не удаляет введённые данные."],
        ["Профиль в верхней части экрана", "Имя и значок рядом с датой показывают, для кого сейчас открыт дневник. Нажмите на этот элемент, чтобы переключиться на другого человека. Перед отметкой приёма или редактированием курса всегда проверяйте активный профиль."]
      ]
    },
    {
      title: "2. Профили: несколько человек в одном дневнике",
      content: [
        ["Создание профиля", "Откройте «Ещё» → «Профили семьи» → «Новый профиль». Укажите имя, выберите значок и цвет. При необходимости включите «Сделать главным». Главный профиль выбирается как основной, но переключаться между профилями можно в любой момент."],
        ["Раздельные данные", "У каждого профиля собственные препараты, расписание, отметки приёма и история. Записи разных людей не смешиваются. Новый препарат добавляется именно в тот профиль, который активен в момент создания."],
        ["Пауза на время отсутствия", "В настройках профиля можно указать период командировки или пребывания в больнице. На эти даты дневник не ожидает приёмов и не должен напоминать о них. Это техническая пауза расписания, а не медицинское изменение курса. После окончания периода обычный план продолжится."],
        ["Удаление профиля", "Удаление профиля удаляет также его курсы и историю. Остальные профили сохраняются. Последний оставшийся профиль удалить нельзя. Перед удалением нужные сведения лучше экспортировать в резервную копию."]
      ]
    },
    {
      title: "3. Добавление и настройка препарата",
      content: [
        ["Создать запись", "Откройте «Препараты» и нажмите «Добавить». Заполняйте карточку по назначению врача или инструкции к препарату. Название можно ввести вручную; если доступна подсказка из каталога ГРЛС, выберите подходящую запись и проверьте, что совпадают торговое название, МНН и лекарственная форма."],
        ["Форма, дозировка и количество", "Выберите форму выпуска: таблетка, капсула, капли, инъекция, спрей, мазь, порошок или другое. Укажите дозировку и единицу измерения, а также количество единиц на один приём. Например, если назначено две таблетки за один раз, количество единиц на приём должно отражать именно это назначение. Не пересчитывайте дозу самостоятельно."],
        ["Даты курса и статус", "Укажите дату начала и дату окончания. Если окончание не определено, используйте режим бессрочного курса. Статус определяет, участвует ли препарат в текущем плане: активный отображается в расписании, приостановленный временно не планируется, завершённый и архивный хранятся отдельно."],
        ["Время и схема приёма", "Добавьте каждое назначенное время. Затем выберите правило дней: ежедневно, по будням, по выходным, выбранные дни недели, через заданное число дней, циклический режим «дни приёма / дни перерыва» или однократный приём на конкретную дату. Для циклов и интервалов важна дата начала/опорная дата: от неё рассчитывается чередование."],
        ["Окно приёма", "Окно задаёт допустимое отклонение от указанного времени, в пределах которого дневник считает приём своевременным. Это параметр учёта и статистики, а не разрешение менять назначение. Установите его согласно принятому порядку наблюдения и не используйте для самостоятельного изменения режима лечения."],
        ["Инструкции и комментарии", "В карточке можно отметить напоминания вроде «до еды», «после еды», «во время еды», «натощак», «не разжёвывать», «запить водой», «перед сном» или «под язык». В поле комментария сохраните пояснения врача. Эти поля служат личной памяткой и не заменяют официальную инструкцию."],
        ["Связанные препараты, остаток и фото", "При необходимости добавьте заметки о препаратах, которые принимаются вместе или которых следует избегать согласно назначению врача. Укажите размер упаковки, текущий остаток и порог, при котором нужен сигнал о пополнении. Можно прикрепить фотографию упаковки. Фото помогает визуально опознать запись, но не подтверждает подлинность или состав лекарства."],
        ["Важный препарат", "Для помеченного важным препарата напоминания не подавляются настройкой тихих часов. Используйте отметку только осознанно. Она не повышает медицинскую эффективность препарата и не меняет назначенную дозу."],
        ["Редактирование, пауза и архив", "Нажмите на запись в списке, чтобы открыть её для изменения. Активный курс можно приостановить, а приостановленный возобновить. Завершённые и архивные записи доступны на соответствующей вкладке. Для нескольких записей можно включить режим выбора и завершить или архивировать выбранные курсы сразу."]
      ]
    },
    {
      title: "4. Экран «Сегодня»: план и отметки приёма",
      content: [
        ["План на день", "На главном экране показаны дата, активный профиль, общий прогресс и список запланированных приёмов по времени. Карточка ближайшего события выделяется отдельно. Переключайте даты стрелками в блоке календаря; кнопка с текущей датой возвращает к сегодняшнему плану."],
        ["Отметить приём", "Когда препарат принят, нажмите «Принято» на карточке или откройте карточку приёма и выберите соответствующее действие. Дневник сохранит отметку и определит, был ли приём вовремя или с опозданием. После отметки доступна возможность отменить последнее действие, если вы нажали случайно."],
        ["Пропуск и причина", "Если приём не состоялся, откройте его карточку и укажите пропуск. Если приложение предлагает выбрать причину, отметьте подходящую: забыли, побочный эффект, закончился запас, плохое самочувствие, указание врача или другая причина. Причина помогает анализировать историю, но не является медицинской оценкой."],
        ["Отложить напоминание", "Если нужно ненадолго отложить сигнал, используйте действие «Отложить» в карточке приёма или уведомлении, если оно доступно. Будет запланировано повторное напоминание. Отсрочка не переносит автоматически все последующие приёмы и не должна использоваться для изменения назначения."],
        ["Разовый приём", "Кнопка разового приёма позволяет добавить событие только на выбранную дату, не создавая постоянный курс. Проверьте название, время и количество перед сохранением. Такой приём не следует путать с регулярным расписанием."],
        ["Изменить время на один день", "Функция переноса/сдвига дня предназначена для разовой корректировки расписания на выбранную дату. Она не переписывает базовую схему курса. Перед применением проверьте исходное и новое время."],
        ["Будущие и прошедшие даты", "Будущие даты можно просматривать для планирования, но отметки о фактически принятом препарате ставятся за текущий или прошедший день в соответствии с доступными действиями. Просмотр другой даты не переключает активный профиль."]
      ]
    },
    {
      title: "5. Напоминания и разрешения Android",
      content: [
        ["Включить напоминания", "Откройте «Ещё» → «Настройки» → «Напоминания». Включите показ уведомлений, затем разрешите уведомления в системном запросе Android. Если разрешение было запрещено ранее, откройте настройки приложения в Android и включите уведомления вручную."],
        ["Точные будильники", "На Android для более точного времени может требоваться отдельное разрешение «Будильники и напоминания» / «Точные будильники». В разделе настроек MediTrack отображается состояние доступа и кнопка перехода к его выдаче. Если доступ запрещён, система может задерживать сигналы."],
        ["Звук, вибрация и повторы", "Выберите, нужен ли звук и вибрация, через какой интервал повторять сигнал и сколько повторов делать. Повторы ограничены временным окном приёма. Если приём отмечен, дальнейшие напоминания для него не должны продолжаться после обновления расписания."],
        ["Тихие часы", "Включите тихие часы и задайте время начала и окончания. Для обычных препаратов уведомления в этот период не планируются. Пометка «Важный препарат» позволяет конкретному курсу обходить тихие часы."],
        ["Если уведомления не приходят", "Проверьте, что курс активен, дата и время приёма заданы верно, напоминания включены, системное разрешение выдано, а точные будильники разрешены. Проверьте также звук канала уведомлений и режим «Не беспокоить». На Xiaomi/HyperOS при необходимости разрешите приложению автозапуск и работу в фоне, а для проверки временно отключите ограничения экономии батареи."],
        ["Закрытие и принудительная остановка", "Обычное закрытие экрана или удаление приложения из списка недавних задач не равнозначно команде «Остановить» в системных настройках. Принудительная остановка Android блокирует работу приложения и его сигналы до следующего ручного запуска. После перезагрузки устройства откройте MediTrack хотя бы один раз, чтобы приложение восстановило актуальное расписание."],
        ["Проверка", "Кнопка «Проверить звук» отправляет тестовое уведомление или воспроизводит тестовый сигнал. Она проверяет канал уведомлений, но сама по себе не доказывает, что все будущие напоминания запланированы правильно. Для практической проверки создайте тестовый приём на ближайшее время и убедитесь, что уведомление появляется."]
      ]
    },
    {
      title: "6. История и отчёт для врача",
      content: [
        ["История приёмов", "В разделе «Ещё» → «История» выберите даты начала и окончания, препарат и статус. История показывает запланированные события за выбранный период и сохранённые отметки: своевременно, с опозданием, пропущено, отказ, отложено и другие состояния."],
        ["Как читать статусы", "«Вовремя» означает, что отметка попала в установленное окно. «С опозданием» означает, что отметка сделана позже этого окна. «Пропущено» фиксирует не состоявшийся приём; «Отказ» фиксирует сознательно отмеченный отказ. Будущие и ещё не наступившие события не следует трактовать как пропуски."],
        ["Отчёт", "В разделе «Отчёт» выберите профиль и период. Сводка показывает процент соблюдения расписания, таблицу по препаратам, пропуски и поле комментария к визиту. Добавьте краткие вопросы или пояснения, которые хотите обсудить с врачом."],
        ["Сохранить и отправить PDF", "Нажмите «Сохранить PDF». Приложение сформирует файл и откроет системное меню Android «Поделиться». Выберите подходящее приложение, например почту или мессенджер, либо доступный способ сохранения файла. Перед отправкой проверьте, что выбран правильный профиль и период."],
        ["CSV и ограничения отчёта", "Если в истории доступно скачивание CSV, используйте его для табличного анализа. Отчёт отражает только те сведения, которые были внесены в дневник. Он не подтверждает фактический приём, не устанавливает диагноз и не заменяет медицинскую документацию."]
      ]
    },
    {
      title: "7. Резервная копия и восстановление",
      content: [
        ["Создать копию", "Откройте «Ещё» → «Резервная копия». Для зашифрованной копии задайте пароль и скачайте файл. Запомните пароль отдельно: без него открыть зашифрованный файл нельзя, а восстановить забытый пароль невозможно."],
        ["Незашифрованная копия", "Можно скачать копию без шифрования. Такой файл содержит личные и медицинские сведения в читаемом виде. Храните его в защищённом месте и не отправляйте посторонним."],
        ["Восстановить данные", "Выберите файл резервной копии. Если он зашифрован, введите пароль. Перед подтверждением внимательно прочитайте предупреждение: восстановление заменяет текущие данные на устройстве содержимым файла. Если нужно добавить только один курс, используйте импорт отдельного файла курса, если он подготовлен."],
        ["Где хранить файл", "Сохраните копию в надёжном месте, доступном только вам. Полезно иметь вторую копию отдельно от телефона. Не храните пароль рядом с файлом и периодически создавайте новую копию после важных изменений."]
      ]
    },
    {
      title: "8. Настройки, защита и конфиденциальность",
      content: [
        ["Внешний вид", "В настройках можно выбрать светлую, тёмную или системную тему, увеличить размер текста и переключить язык интерфейса. Эти параметры меняют отображение приложения, но не влияют на расписание и записи."],
        ["PIN-код и биометрия", "Можно установить PIN-код для открытия дневника. Придумайте код, который не забудете, и не сообщайте его другим. Если устройство поддерживает биометрическую проверку, её можно включить дополнительно. Биометрия зависит от возможностей и настроек самого телефона."],
        ["Если забыли PIN", "Восстановить забытый PIN средствами дневника нельзя. Предусмотренный сценарий сброса блокировки удаляет локальные данные приложения. Поэтому до включения PIN особенно важно иметь актуальную резервную копию и помнить пароль от неё."],
        ["Локальное хранение", "Данные дневника хранятся на устройстве. Приложение не отправляет их врачу автоматически и не синхронизирует с облаком. Передача отчёта или резервной копии происходит только по вашему действию через системное меню Android."],
        ["Удаление данных", "Команда очистки удаляет профили, курсы и историю с устройства. Это действие нельзя отменить. Сначала экспортируйте резервную копию, если сведения могут понадобиться."]
      ]
    },
    {
      title: "9. Важные ограничения и безопасное использование",
      content: [
        ["Дневник не назначает лечение", "MediTrack помогает вести записи и напоминать о внесённом расписании. Приложение не назначает препараты, не рассчитывает индивидуальную дозу и не оценивает совместимость лекарств. Все названия, дозировки, время и правила приёма сверяйте с назначением врача и официальной инструкцией."],
        ["Не меняйте назначение по подсказке приложения", "Изменение времени, перенос события, тихие часы и отметка важности являются функциями учёта. Они не означают, что можно самостоятельно менять дозу, отменять курс, удваивать пропущенную дозу или компенсировать пропуск. При сомнениях обратитесь к врачу или фармацевту."],
        ["Проверяйте введённые данные", "Ошибочное время, единица измерения, профиль или дата могут привести к неверному расписанию и отчёту. После создания курса внимательно просмотрите его карточку и ближайший план на экране «Сегодня»."],
        ["Уведомление не гарантирует приём", "Полученное уведомление не означает, что препарат принят. Отметку нужно внести вручную. И наоборот, отсутствие уведомления не является подтверждением отмены приёма. Проверяйте план в приложении."]
      ]
    }
  ] : [
    { title: "1. Getting started and navigation", content: [
      ["Main sections", "The bottom navigation contains Today, Medicines and More. Today shows the plan for a selected date; Medicines contains treatment courses; More contains history, reports, profiles, backup, settings, privacy and this guide."],
      ["Moving between screens", "Tap a card or name to open details. On inner screens, use the Back arrow or the Android edge-back gesture. Returning to a previous screen does not delete your entries."],
      ["Active profile", "The name and icon near the date show whose journal is open. Tap them to switch profiles. Always check the active profile before recording a dose or editing a course."]
    ]},
    { title: "2. Profiles and family members", content: [
      ["Create a profile", "Go to More → Family profiles → New profile. Enter a name and choose an icon and colour. You can mark one profile as primary."],
      ["Separate records", "Each profile has its own medicines, schedule, dose log and history. A new course is added to the currently active profile."],
      ["Away period", "A profile can be paused for a trip or hospital stay over selected dates. This suppresses expected doses and reminders for that period; it is not a medical change to the treatment."],
      ["Delete a profile", "Deleting a profile also deletes its courses and history. Other profiles remain. Export a backup first if you may need those records."]
    ]},
    { title: "3. Adding and configuring a medicine", content: [
      ["Create a record", "Open Medicines and tap Add. Enter the name manually or choose a matching GRLS catalogue suggestion when available. Check the trade name, active ingredient and dosage form."],
      ["Form and dose", "Choose the dosage form, strength, unit and number of units per dose. Enter the prescribed regimen exactly as provided by the clinician. Do not calculate or change a dose yourself."],
      ["Course dates and status", "Set the start and end dates, or choose an indefinite course. Active courses appear in the plan; paused courses are temporarily excluded; completed and archived records remain separate."],
      ["Times and schedule", "Add every prescribed time and select a rule: daily, weekdays, weekends, selected weekdays, interval, repeating on/off cycle, or a single date. Interval and cycle rules use an anchor date to calculate alternation."],
      ["Dose window", "The window determines how much deviation is counted as on time in the journal. It is a tracking setting, not permission to alter the prescription."],
      ["Instructions and notes", "You can record reminders such as before food, after food, with food, empty stomach, do not chew, take with water, bedtime or sublingual. Notes can store clinician instructions."],
      ["Related medicines, stock and photo", "Record medicines to take with or avoid according to professional advice. Set pack size, current stock and a refill threshold. You can attach a package photo for visual reference."],
      ["Important medicine", "Important courses ignore quiet hours. Use this flag deliberately; it does not change the prescribed dose."],
      ["Edit, pause and archive", "Open a medicine to edit it. Active courses can be paused and paused courses resumed. You can select several courses to complete or archive them together."]
    ]},
    { title: "4. Today: schedule and dose records", content: [
      ["Daily plan", "Today shows the date, active profile, progress and scheduled doses. Use the date arrows to browse other days; tap the date button to return to today."],
      ["Mark a dose as taken", "Tap Taken on a dose card or open its details and choose the relevant action. The journal records whether it was on time or late. The latest action can be undone if selected by mistake."],
      ["Missed doses", "Open a dose and record that it was missed. If prompted, select a reason such as forgotten, side effect, out of stock, feeling unwell, clinician instruction or other."],
      ["Snooze", "Use Snooze on a dose or notification when available to schedule another reminder. Snoozing does not automatically move later doses or change the prescription."],
      ["One-time dose", "The one-time action adds an event for the selected date without creating a recurring course. Check its name, time and amount before saving."],
      ["Move a dose for one day", "The shift action adjusts the schedule for the selected date only; it does not rewrite the course's regular schedule."],
      ["Other dates", "Future dates can be viewed for planning. Viewing another date does not change the active profile."]
    ]},
    { title: "5. Reminders and Android permissions", content: [
      ["Enable reminders", "Go to More → Settings → Reminders. Enable notifications and grant Android notification permission. If previously denied, enable it in Android app settings."],
      ["Exact alarms", "Precise timing may require Android's Alarms & reminders / exact alarms access. The MediTrack settings page shows its status and provides an access button."],
      ["Sound, vibration and repeats", "Choose sound and vibration, the repeat interval and the number of repeats. Repeats are limited by the dose window."],
      ["Quiet hours", "Enable quiet hours and set their start and end. Ordinary courses are not scheduled during this period. Important courses can bypass quiet hours."],
      ["If reminders do not arrive", "Check that the course is active, its date and time are correct, notifications are enabled, and notification and exact-alarm permissions are granted. Check Do Not Disturb and notification-channel sound. On Xiaomi/HyperOS, review background and battery restrictions if needed."],
      ["Closing versus force stop", "Swiping the app away is not the same as Force stop in Android settings. A force-stopped app cannot deliver its alarms until manually opened again. After a device reboot, open MediTrack once so it can refresh its schedule."],
      ["Test", "Test sound checks the notification channel, but does not prove all future alarms are scheduled. For a practical test, create a dose a few minutes ahead and verify its notification."]
    ]},
    { title: "6. History and clinician report", content: [
      ["Dose history", "In More → History, select a date range, medicine and status to filter records."],
      ["Statuses", "On time means the dose was recorded within its configured window; Late means after that window. Missed and Skipped are recorded outcomes. Future events are not missed doses."],
      ["Report", "Choose a profile and period. The report shows adherence, per-medicine figures, missed doses and a note for the visit."],
      ["Save and share PDF", "Tap Save PDF. MediTrack creates a file and opens Android's system share sheet. Choose an email or messenger app, or a save destination. Check the profile and period before sharing."],
      ["CSV and report limits", "CSV can be used for spreadsheet analysis when available. Reports contain only information entered in the journal and are not medical conclusions."]
    ]},
    { title: "7. Backup and restore", content: [
      ["Create a backup", "Open More → Backup. Set a passphrase for an encrypted backup and download the file. The passphrase cannot be recovered if forgotten."],
      ["Unencrypted backup", "An unencrypted file contains readable personal and medical information. Keep it private and secure."],
      ["Restore", "Select the backup file and enter its passphrase if encrypted. Restoring replaces the current device data with the backup contents. Read the confirmation carefully."],
      ["Storage", "Keep a copy somewhere safe, preferably a second copy separate from the phone. Store the passphrase separately."]
    ]},
    { title: "8. Settings, protection and privacy", content: [
      ["Appearance", "Choose light, dark or system theme, text size and interface language. These settings do not change the schedule."],
      ["PIN and biometrics", "You can protect the journal with a PIN and enable device biometrics when supported. Do not share your PIN."],
      ["Forgotten PIN", "The PIN cannot be recovered. The reset flow removes local app data. Keep a current backup before enabling the lock."],
      ["Local storage", "Journal data stays on the device. It is not automatically sent to a clinician or synced to a cloud service. Sharing happens only when you choose to export or send a file."],
      ["Erase data", "Erasing removes profiles, courses and history from the device and cannot be undone. Export a backup first if needed."]
    ]},
    { title: "9. Important limitations and safe use", content: [
      ["Not a treatment tool", "MediTrack records a schedule and provides reminders. It does not prescribe medicines, calculate an individual dose or assess drug interactions. Follow the clinician's prescription and official medicine information."],
      ["Do not change treatment based on app features", "Snoozing, shifting a reminder, quiet hours and the important flag are tracking features. They do not authorize changing a dose, stopping treatment or doubling a missed dose."],
      ["Check your entries", "An incorrect time, unit, profile or date can produce an incorrect schedule or report. Review the course and the Today screen after saving."],
      ["A notification is not proof", "A notification does not confirm that a medicine was taken. Record the dose manually. No notification does not mean the dose was cancelled."]
    ]}
  ];

  return (
    <div className="grid gap-4">
      <h1 className="font-display text-3xl">{tr("brandFull")}</h1>
      <p className="text-muted">{tr("version")}</p>
      <section className="grid gap-2">
        <h2 className="font-display text-2xl">{ru ? "Инструкция по использованию" : "User guide"}</h2>
        <p className="text-muted">{ru ? "Подробная справка по разделам приложения. Нажмите на заголовок, чтобы раскрыть нужную тему." : "A detailed guide to the app. Tap a heading to expand a topic."}</p>
        {sections.map((section, index) => (
          <details key={section.title} className="help-accordion card" open={index === 0}>
            <summary className="font-semibold">{section.title}</summary>
            <div className="mt-3 grid gap-3">
              {section.content.map(([heading, body]) => (
                <div key={heading}>
                  <h3 className="font-semibold">{heading}</h3>
                  <p className="mt-1 text-muted">{body}</p>
                </div>
              ))}
            </div>
          </details>
        ))}
      </section>
      <section className="grid gap-2 border-t border-line pt-4">
        <h2 className="font-display text-2xl">{ru ? "О приложении" : "About this app"}</h2>
        <p>{tr("about1")}</p>
        <p>{tr("about2")}</p>
        <p>{tr("about3")}</p>
        <p className="font-semibold">{tr("notMedical")}</p>
      </section>
    </div>
  );
}

export function Lock() {
  const tr = useT();
  const pinHash = useMedi((s) => s.pinHash);
  const pinSalt = useMedi((s) => s.pinSalt);
  const credentialId = useMedi((s) => s.credentialId);
  const setUnlocked = useMedi((s) => s.setUnlocked);
  const resetData = useMedi((s) => s.resetData);
  const [pin, setPin] = useState("");
  const [bad, setBad] = useState(false);
  const [ask, setAsk] = useState(false);

  async function submit(value: string) {
    if (!pinHash || !pinSalt || value.length < 4) return;
    const hashed = await hashPin(value, pinSalt);
    if (hashed.hash === pinHash) {
      setUnlocked(true);
      return;
    }
    setBad(true);
    setPin("");
  }

  return (
    <div className="grid min-h-dvh content-center gap-4 px-4 py-8">
      <p className="text-center font-display text-4xl">{tr("brand")}</p>
      <h1 className="text-center font-display text-2xl">{tr("lockTitle")}</h1>
      <p className="text-center text-muted">{bad ? tr("wrongPin") : tr("lockHint")}</p>
      <PinPad value={pin} onChange={(v) => { setBad(false); setPin(v); }} />
      <Btn block disabled={pin.length < 4} onClick={() => void submit(pin)}>{tr("open")}</Btn>
      {credentialId ? (
        <Btn variant="soft" onClick={() => { void verifyBiometric(credentialId).then((ok) => (ok ? setUnlocked(true) : toast(tr("biometricFail")))).catch(() => toast(tr("biometricFail"))); }}>
          <Fingerprint className="size-5" /> {tr("useBiometric")}
        </Btn>
      ) : null}
      <button type="button" className="text-sm text-muted underline" onClick={() => setAsk(true)}>{tr("forgotPin")}</button>
      {ask ? (
        <Modal title={tr("clearData")} onClose={() => setAsk(false)} closeLabel={tr("close")}>
          <p>{tr("forgotPin")}</p>
          <div className="mt-4 grid gap-2">
            <Btn variant="bad" onClick={() => { resetData(); setAsk(false); }}>{tr("eraseUnlock")}</Btn>
            <Btn variant="ghost" onClick={() => setAsk(false)}>{tr("cancel")}</Btn>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
