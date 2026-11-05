import { History, Report } from "@/components/meditrack/HistoryReport";
import { About, Backup, Lock, More, Privacy, ProfileForm, Profiles, Settings } from "@/components/meditrack/More";
import { MedForm } from "@/components/meditrack/MedForm";
import { Meds } from "@/components/meditrack/Meds";
import { Reminders } from "@/components/meditrack/Reminders";
import { Today } from "@/components/meditrack/Today";
import { NavProvider, tabOf, useNav } from "@/components/meditrack/nav";
import { useT } from "@/components/meditrack/ui";
import { armAudio } from "@/components/meditrack/sound";
import { useMedi } from "@/lib/meditrack/store";
import { CalendarDays, ChevronLeft, Menu, Pill } from "lucide-react";
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

  if (!ready) return <Splash />;
  return (
    <NavProvider>
      <Shell />
    </NavProvider>
  );
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-6 text-ink">
      <div className="flex flex-col items-center text-center">
        <img src="/meditrack-icon.svg" alt="" className="mb-5 size-28" />
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
  const rooted = screen.name === "today" || screen.name === "meds" || screen.name === "more";
  const tab = tabOf(screen);
  const titles: Record<string, string> = {
    med: tr(screen.name === "med" && screen.id ? "formEdit" : "formNew"),
    history: tr("historyTitle"),
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
        <Tab icon={<CalendarDays />} label={tr("navToday")} on={tab === "today"} onClick={() => reset({ name: "today" })} />
        <Tab icon={<Pill />} label={tr("navMeds")} on={tab === "meds"} onClick={() => reset({ name: "meds" })} />
        <Tab icon={<Menu />} label={tr("navMore")} on={tab === "more"} onClick={() => reset({ name: "more" })} />
      </nav>
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
