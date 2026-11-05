import { beep } from "@/components/meditrack/sound";
import { Btn, useLang, useT } from "@/components/meditrack/ui";
import { atDateTime, inQuiet, todayISO } from "@/lib/meditrack/dates";
import { buildDay, takenKind, type BuiltSlot } from "@/lib/meditrack/engine";
import { doseText } from "@/lib/meditrack/format";
import { useMedi } from "@/lib/meditrack/store";
import { showNotification } from "@/lib/native-notify";
import { useEffect, useState } from "react";

const STORE = "meditrack-reminder-fires";

type Fire = { n: number; at: number };

function readFires(): Record<string, Fire> {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as Record<string, Fire>) : {};
  } catch {
    return {};
  }
}

function writeFires(map: Record<string, Fire>) {
  const entries = Object.entries(map).slice(-200);
  localStorage.setItem(STORE, JSON.stringify(Object.fromEntries(entries)));
}

export function Reminders() {
  const tr = useT();
  const lang = useLang();
  const profiles = useMedi((s) => s.profiles);
  const medications = useMedi((s) => s.medications);
  const logs = useMedi((s) => s.logs);
  const overrides = useMedi((s) => s.overrides);
  const notif = useMedi((s) => s.notif);
  const markDose = useMedi((s) => s.markDose);
  const [banners, setBanners] = useState<BuiltSlot[]>([]);

  useEffect(() => {
    const tick = () => {
      if (!notif.enabled) {
        setBanners([]);
        return;
      }
      const now = new Date();
      const today = todayISO(now);
      const quiet = notif.quietEnabled && inQuiet(now, notif.quietFrom, notif.quietTo);
      const fires = readFires();
      const due: BuiltSlot[] = [];
      for (const profile of profiles) {
        const slots = buildDay({ date: today, now, profile, medications, logs, overrides });
        for (const slot of slots) {
          if (slot.view !== "due" && slot.view !== "missed" && slot.view !== "snoozed") continue;
          if (slot.view === "snoozed") continue;
          if (quiet && !slot.medication.critical) continue;
          const scheduled = atDateTime(today, slot.time).getTime();
          const limit = scheduled + (slot.medication.schedule.windowMin + notif.repeatCount * notif.repeatMin) * 60000;
          if (now.getTime() > limit) continue;
          const key = `${slot.medication.id}|${today}|${slot.baseTime}|${slot.log?.snoozeUntil ?? ""}`;
          const rec = fires[key] ?? { n: 0, at: 0 };
          const wait = notif.repeatMin * 60000;
          const canFire = rec.n <= notif.repeatCount && (!rec.at || now.getTime() - rec.at >= wait);
          if (canFire) {
            fires[key] = { n: rec.n + 1, at: now.getTime() };
            if (notif.sound) beep();
            if (notif.vibrate && typeof navigator !== "undefined") navigator.vibrate?.(120);
            void showNotification(
              tr("remindTitle"),
              tr("notifBody", { name: `${profile.name}: ${slot.medication.name}`, dose: doseText(slot.medication, lang), time: slot.time }),
              key,
            );
          }
          if ((fires[key]?.n ?? rec.n) <= notif.repeatCount + 1) due.push(slot);
        }
      }
      writeFires(fires);
      setBanners(due.slice(0, 2));
    };
    tick();
    const id = window.setInterval(tick, 20000);
    return () => window.clearInterval(id);
  }, [profiles, medications, logs, overrides, notif, tr, lang]);

  if (!banners.length) return null;

  return (
    <div className="reminders" aria-live="polite">
      {banners.map((slot) => (
        <div key={`${slot.medication.id}-${slot.baseTime}`} className="card">
          <p className="text-sm font-semibold text-primary">{tr("remindTitle")}</p>
          <p className="text-lg font-semibold">{slot.medication.name}</p>
          <p className="text-muted">{slot.time} · {doseText(slot.medication, lang)}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Btn
              onClick={() =>
                markDose({
                  medicationId: slot.medication.id,
                  date: slot.date,
                  time: slot.baseTime,
                  status: takenKind(slot.date, slot.time, new Date(), slot.medication.schedule.windowMin),
                })
              }
            >
              {tr("takenBtn")}
            </Btn>
            <Btn
              variant="soft"
              onClick={() =>
                markDose({
                  medicationId: slot.medication.id,
                  date: slot.date,
                  time: slot.baseTime,
                  status: "snoozed",
                  snoozeUntil: new Date(Date.now() + 10 * 60000).toISOString(),
                })
              }
            >
              {tr("snooze")}
            </Btn>
          </div>
        </div>
      ))}
    </div>
  );
}
