import { ProfileGlyph } from "@/components/meditrack/glyphs";
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
import { getNotifPermission, isNative, requestNotifPermission, showNotification, type NotifPerm } from "@/lib/native-notify";

export function More() {
  const tr = useT();
  const { go } = useNav();
  const items = [
    ["history", tr("historyTitle")],
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
  const [pinMode, setPinMode] = useState<"off" | "new" | "repeat" | "current">("off");
  const [pin, setPinValue] = useState("");
  const [first, setFirst] = useState("");
  const [wipe, setWipe] = useState(0);
  const [bioOk, setBioOk] = useState(false);

  useEffect(() => {
    void getNotifPermission().then(setPerm);
    setBioOk(typeof window !== "undefined" && !!window.PublicKeyCredential);
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
    toast(tr("permissionAsked"));
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
        <Btn variant="ghost" onClick={() => { if (isNative()) void showNotification(tr("remindTitle"), tr("testSent"), "meditrack-test-sound"); else { armAudio(); if (notif.sound) beep(); if (notif.vibrate) navigator.vibrate?.(80); } toast(tr("testSent")); }}>{tr("testNotif")}</Btn>
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
        <h2 className="font-display text-2xl">{tr("clearData")}</h2>
        <p className="text-muted">{tr("clearDataHint")}</p>
        {hasDemo ? <Btn variant="ghost" onClick={() => { removeDemos(); toast(tr("examplesRemoved")); }}>{tr("removeDemos")}</Btn> : null}
        {hasDemo ? <p className="text-sm text-muted">{tr("demosHint")}</p> : null}
        <Btn variant="bad" onClick={() => setWipe(1)}>{tr("clearData")}</Btn>
      </section>
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
      <p>{tr("privacy1")}</p>
      <p>{tr("privacy2")}</p>
      <p>{tr("privacy3")}</p>
      <p>{tr("privacy4")}</p>
    </div>
  );
}

export function About() {
  const tr = useT();
  return (
    <div className="grid gap-4">
      <h1 className="font-display text-3xl">{tr("brandFull")}</h1>
      <p className="text-muted">{tr("version")}</p>
      <p>{tr("about1")}</p>
      <p>{tr("about2")}</p>
      <p>{tr("about3")}</p>
      <p className="font-semibold">{tr("notMedical")}</p>
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
