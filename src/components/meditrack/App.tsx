import { LocalNotifications } from "@capacitor/local-notifications";
import { History, Report } from "@/components/meditrack/HistoryReport";
import { About, Backup, Lock, More, Privacy, ProfileForm, Profiles, Settings } from "@/components/meditrack/More";
import { MedForm } from "@/components/meditrack/MedForm";
import { Meds } from "@/components/meditrack/Meds";
import { Reminders } from "@/components/meditrack/Reminders";
import { Today } from "@/components/meditrack/Today";
import { Calendar } from "@/components/meditrack/Calendar";
import { NavProvider, tabOf, useNav } from "@/components/meditrack/nav";
import { Btn, useT } from "@/components/meditrack/ui";
import { armAudio } from "@/components/meditrack/sound";
import { getExactAlarmPermission, getNotifPermission, isNative, requestExactAlarmPermission, requestNotifPermission, type NotifPerm } from "@/lib/native-notify";
import { takenKind } from "@/lib/meditrack/engine";
import { useMedi } from "@/lib/meditrack/store";
import { CalendarDays, ChevronLeft, History as HistoryIcon, Menu, Pill, House } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Toaster } from "sonner";

export function App() {
  const [ready, setReady] = useState(false);
  const once = useRef(false);

  useEffect(() => {
    const finish = () => {
      if (once.current) return;
      once.current = true;
      const state = useMedi.getState();
      if (state.pinHash) useMedi.setState({ unlocked: false });
      state.completeExpired();
      setReady(true);
    };
    if (useMedi.persist.hasHydrated()) finish();
    return useMedi.persist.onFinishHydration(finish);
  }, []);

  useEffect(() => {
    const arm = () => armAudio();
    window.addEventListener("pointerdown", arm, { once: true });
    return () => window.removeEventListener("pointerdown", arm);
  }, []);
  useEffect(() => {
    if (!isNative()) return;
    let removeListener: (() => void) | undefined;
    let cancelled = false;
    const pending: Array<{ actionId: string; notification: { extra?: unknown } }> = [];
    const applyAction = (event: { actionId: string; notification: { extra?: unknown } }) => {
      const extra = event.notification.extra as {
        source?: string;
        medicationId?: string;
        profileId?: string;
        date?: string;
        time?: string;
        scheduledTime?: string;
      } | undefined;
      if (extra?.source !== "meditrack-dose" || !extra.medicationId || !extra.date || !extra.time) return;
      const state = useMedi.getState();
      const medication = state.medications.find((item) => item.id === extra.medicationId);
      if (!medication) return;
      if (event.actionId === "taken") {
        const now = new Date();
        state.markDose({
          medicationId: medication.id,
          profileId: extra.profileId,
          date: extra.date,
          time: extra.time,
          status: takenKind(extra.date, extra.scheduledTime ?? extra.time, now, medication.schedule.windowMin),
        });
      } else if (event.actionId === "snooze") {
        const snoozeMin = state.notif.snoozeMin ?? 15;
        state.markDose({
          medicationId: medication.id,
          profileId: extra.profileId,
          date: extra.date,
          time: extra.time,
          status: "snoozed",
          snoozeUntil: new Date(Date.now() + snoozeMin * 60000).toISOString(),
        });
      }
    };
    const unsubscribeHydration = useMedi.persist.onFinishHydration(() => {
      while (pending.length > 0) {
        const event = pending.shift();
        if (event) applyAction(event);
      }
    });
    void LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
      if (useMedi.persist.hasHydrated()) applyAction(event);
      else pending.push(event);
    }).then((handle) => {
      if (cancelled) void handle.remove();
      else removeListener = () => { void handle.remove(); };
    });
    return () => {
      cancelled = true;
      unsubscribeHydration();
      removeListener?.();
    };
  }, []);

  if (!ready) return <Splash />;
  return (
    <NavProvider>
      <Shell />
    </NavProvider>
  );
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-white px-6 text-ink">
      <div className="flex flex-col items-center text-center">
        <img src="/meditrack-icon.jpg" alt="MediTrack" className="mb-5 size-28 object-contain" />
        <p className="font-display text-4xl">MediTrack</p>
      </div>
    </div>
  );
}

function Shell() {
  const pinHash = useMedi((s) => s.pinHash);
  const unlocked = useMedi((s) => s.unlocked);
  const theme = useMedi((s) => s.theme);
  const scale = useMedi((s) => s.textScale);
  const lang = useMedi((s) => s.lang);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", dark);
      root.dataset.scale = scale;
      root.lang = lang;
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, scale, lang]);

  if (pinHash && !unlocked) return <Lock />;
  return <Frame />;
}

function Frame() {
  const tr = useT();
  const { screen, back, reset } = useNav();
  const rooted = screen.name === "today" || screen.name === "calendar" || screen.name === "meds" || screen.name === "history" || screen.name === "more";
  const tab = tabOf(screen);
  const titles: Record<string, string> = {
    med: tr(screen.name === "med" && screen.id ? "formEdit" : "formNew"),
    history: tr("historyTitle"),
    calendar: tr("calendarTitle"),
    report: tr("reportTitle"),
    profiles: tr("profiles"),
    profile: tr("profiles"),
    settings: tr("settings"),
    backup: tr("backup"),
    privacy: tr("privacy"),
    about: tr("about"),
  };

  return (
    <div className="sheet">
      <div className="spine" aria-hidden />
      {!rooted ? (
        <div className="no-print flex items-center gap-2 px-4 pt-4">
          <button type="button" className="icon-btn" onClick={back} aria-label={tr("back")}>
            <ChevronLeft />
          </button>
          <p className="font-display text-2xl">{titles[screen.name] ?? tr("brand")}</p>
        </div>
      ) : null}
      <main className="flex-1 px-4 py-4">
        {screen.name === "today" ? <Today /> : null}
        {screen.name === "calendar" ? <Calendar /> : null}
        {screen.name === "meds" ? <Meds /> : null}
        {screen.name === "med" ? <MedForm id={screen.id} /> : null}
        {screen.name === "history" ? <History /> : null}
        {screen.name === "report" ? <Report /> : null}
        {screen.name === "more" ? <More /> : null}
        {screen.name === "profiles" ? <Profiles /> : null}
        {screen.name === "profile" ? <ProfileForm id={screen.id} /> : null}
        {screen.name === "settings" ? <Settings /> : null}
        {screen.name === "backup" ? <Backup /> : null}
        {screen.name === "privacy" ? <Privacy /> : null}
        {screen.name === "about" ? <About /> : null}
        <Reminders />
      </main>
      <nav className="tabbar no-print" aria-label={tr("moreTitle")}>
        <Tab icon={<House />} label={tr("navToday")} on={tab === "today"} onClick={() => reset({ name: "today" })} />
        <Tab icon={<CalendarDays />} label={tr("navCalendar")} on={tab === "calendar"} onClick={() => reset({ name: "calendar" })} />
        <Tab icon={<Pill />} label={tr("navMeds")} on={tab === "meds"} onClick={() => reset({ name: "meds" })} />
        <Tab icon={<HistoryIcon />} label={tr("navHistory")} on={tab === "history"} onClick={() => reset({ name: "history" })} />
        <Tab icon={<Menu />} label={tr("navMore")} on={tab === "more"} onClick={() => reset({ name: "more" })} />
      </nav>
      <NotificationSetup />
      <Toaster position="top-center" toastOptions={{ className: "font-sans", style: { background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)" } }} />
    </div>
  );
}

function Tab({ icon, label, on, onClick }: { icon: ReactNode; label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={on ? "tab tab-on" : "tab"} aria-current={on ? "page" : undefined} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}


const NOTIFICATION_SETUP_KEY = "meditrack-notification-setup-v1";

function NotificationSetup() {
  const tr = useT();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<"notifications" | "exact" | "blocked">("notifications");
  const [permission, setPermission] = useState<NotifPerm>("unknown");
  const [exactPermission, setExactPermission] = useState<NotifPerm>("unknown");
  const [busy, setBusy] = useState(false);

  async function refreshPermissions() {
    const [notification, exact] = await Promise.all([getNotifPermission(), getExactAlarmPermission()]);
    setPermission(notification);
    setExactPermission(exact);
    if (notification === "granted" && exact === "granted") {
      localStorage.setItem(NOTIFICATION_SETUP_KEY, "complete");
      setVisible(false);
    } else if (notification === "granted") {
      setStep("exact");
    }
  }

  useEffect(() => {
    if (!isNative() || localStorage.getItem(NOTIFICATION_SETUP_KEY)) return;
    let alive = true;
    void Promise.all([getNotifPermission(), getExactAlarmPermission()]).then(([notification, exact]) => {
      if (!alive) return;
      setPermission(notification);
      setExactPermission(exact);
      if (notification === "granted" && exact === "granted") {
        localStorage.setItem(NOTIFICATION_SETUP_KEY, "complete");
      } else {
        setStep(notification === "granted" ? "exact" : "notifications");
        setVisible(true);
      }
    });
    const onResume = () => {
      if (document.visibilityState === "visible") void refreshPermissions();
    };
    window.addEventListener("focus", onResume);
    document.addEventListener("visibilitychange", onResume);
    return () => {
      alive = false;
      window.removeEventListener("focus", onResume);
      document.removeEventListener("visibilitychange", onResume);
    };
  }, []);

  async function allowNotifications() {
    setBusy(true);
    try {
      const result = await requestNotifPermission();
      setPermission(result);
      setStep(result === "granted" ? "exact" : "blocked");
      if (result === "granted") {
        window.dispatchEvent(new Event("focus"));
        const exact = await getExactAlarmPermission();
        setExactPermission(exact);
        if (exact === "granted") {
          localStorage.setItem(NOTIFICATION_SETUP_KEY, "complete");
          setVisible(false);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function allowExactAlarms() {
    setBusy(true);
    try {
      const result = await requestExactAlarmPermission();
      setExactPermission(result);
      if (result === "granted") {
        localStorage.setItem(NOTIFICATION_SETUP_KEY, "complete");
        setVisible(false);
      }
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    localStorage.setItem(NOTIFICATION_SETUP_KEY, "dismissed");
    setVisible(false);
  }

  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-3 pb-3 sm:items-center">
      <section role="dialog" aria-modal="true" aria-labelledby="notification-setup-title" className="w-full max-w-lg rounded-3xl border border-line bg-surface p-5 shadow-2xl">
        <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <span className="text-2xl" aria-hidden>🔔</span>
        </div>
        <h2 id="notification-setup-title" className="font-display text-2xl">{tr("setupNotifTitle")}</h2>
        <p className="mt-2 text-muted">{tr("setupNotifLead")}</p>
        <div className="mt-4 grid gap-3">
          <div className="card grid gap-1">
            <p className="font-semibold">{tr("setupNotifStep1")}</p>
            <p className="text-sm text-muted">{tr("setupNotifStep1Hint")}</p>
            <p className="text-sm">{permission === "granted" ? tr("notifGranted") : permission === "denied" ? tr("notifDenied") : tr("notifDefault")}</p>
          </div>
          {step === "notifications" || step === "blocked" ? (
            <Btn block disabled={busy} onClick={() => void allowNotifications()}>{busy ? tr("working") : tr("allowNotif")}</Btn>
          ) : null}
          {step === "exact" ? (
            <>
              <div className="card grid gap-1">
                <p className="font-semibold">{tr("setupExactTitle")}</p>
                <p className="text-sm text-muted">{tr("setupExactHint")}</p>
                <p className="text-sm">{exactPermission === "granted" ? tr("exactAlarmGranted") : tr("exactAlarmDenied")}</p>
              </div>
              <Btn block disabled={busy} onClick={() => void allowExactAlarms()}>{busy ? tr("working") : tr("allowExactAlarm")}</Btn>
              <Btn variant="ghost" block disabled={busy} onClick={() => void refreshPermissions()}>{tr("checkAgain")}</Btn>
            </>
          ) : null}
          <div className="rounded-2xl bg-primary-soft p-3 text-sm text-muted">
            <p>{tr("setupLockScreenHint")}</p>
            <p className="mt-2">{tr("setupXiaomiHint")}</p>
          </div>
          <Btn variant="ghost" block disabled={busy} onClick={dismiss}>{tr("setupLater")}</Btn>
        </div>
      </section>
    </div>
  );
}
