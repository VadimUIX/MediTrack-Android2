import { addDays, hashStr, todayISO } from "@/lib/meditrack/dates";
import { buildDay } from "@/lib/meditrack/engine";
import type { DoseLog, Medication, Profile, SkipReason } from "@/lib/meditrack/types";

const REASONS: SkipReason[] = ["forgot", "side_effect", "no_stock", "felt_bad", "doctor", "other"];

function med(partial: Medication): Medication {
  return partial;
}

export function createSeed(now = new Date()): {
  profiles: Profile[];
  medications: Medication[];
  logs: DoseLog[];
  activeProfileId: string;
} {
  const today = todayISO(now);
  const start = addDays(today, -56);
  const stamp = now.toISOString();
  const me: Profile = {
    id: "demo-me",
    name: "Я",
    icon: "user",
    swatch: "sage",
    isPrimary: true,
    away: null,
    createdAt: stamp,
  };
  const mom: Profile = {
    id: "demo-mom",
    name: "Мама",
    icon: "heart",
    swatch: "clay",
    isPrimary: false,
    away: null,
    createdAt: stamp,
  };

  const medications: Medication[] = [
    med({
      id: "demo-lisin",
      profileId: me.id,
      name: "Лизиноприл",
      form: "tablet",
      doseAmount: 10,
      doseUnit: "мг",
      unitsPerDose: 1,
      doseLabel: "1 таблетка",
      packSize: 30,
      stock: 18,
      refillThreshold: 7,
      refillRemind: true,
      startDate: start,
      endDate: null,
      indefinite: true,
      status: "active",
      notes: "Утром. Контроль давления — по дневнику, без самовольной смены дозы.",
      instructions: ["water"],
      swatch: "sage",
      related: [{ name: "Калий в больших дозах", relation: "avoid" }],
      schedule: { times: ["08:00"], dayRule: { kind: "daily" }, windowMin: 30 },
      critical: true,
      createdAt: stamp,
      updatedAt: stamp,
    }),
    med({
      id: "demo-met",
      profileId: me.id,
      name: "Метформин",
      form: "tablet",
      doseAmount: 500,
      doseUnit: "мг",
      unitsPerDose: 1,
      doseLabel: "1 таблетка",
      packSize: 60,
      stock: 8,
      refillThreshold: 10,
      refillRemind: true,
      startDate: start,
      endDate: null,
      indefinite: true,
      status: "active",
      notes: "Во время еды.",
      instructions: ["with_food"],
      swatch: "sea",
      related: [],
      schedule: { times: ["08:30", "20:00"], dayRule: { kind: "daily" }, windowMin: 45 },
      critical: false,
      createdAt: stamp,
      updatedAt: stamp,
    }),
    med({
      id: "demo-omep",
      profileId: me.id,
      name: "Омепразол",
      form: "capsule",
      doseAmount: 20,
      doseUnit: "мг",
      unitsPerDose: 1,
      doseLabel: "1 капсула",
      packSize: 28,
      stock: 16,
      refillThreshold: 5,
      refillRemind: true,
      startDate: start,
      endDate: null,
      indefinite: true,
      status: "active",
      notes: "Не разжёвывать.",
      instructions: ["before_food", "dont_chew"],
      swatch: "amber",
      related: [],
      schedule: { times: ["14:00"], dayRule: { kind: "daily" }, windowMin: 30 },
      critical: false,
      createdAt: stamp,
      updatedAt: stamp,
    }),
    med({
      id: "demo-ator",
      profileId: me.id,
      name: "Аторвастатин",
      form: "tablet",
      doseAmount: 20,
      doseUnit: "мг",
      unitsPerDose: 1,
      doseLabel: "1 таблетка",
      packSize: 30,
      stock: 22,
      refillThreshold: 6,
      refillRemind: true,
      startDate: start,
      endDate: null,
      indefinite: true,
      status: "active",
      notes: "",
      instructions: ["bedtime"],
      swatch: "plum",
      related: [],
      schedule: { times: ["21:30"], dayRule: { kind: "daily" }, windowMin: 60 },
      critical: false,
      createdAt: stamp,
      updatedAt: stamp,
    }),
    med({
      id: "demo-vitd",
      profileId: me.id,
      name: "Витамин D",
      form: "capsule",
      doseAmount: 2000,
      doseUnit: "МЕ",
      unitsPerDose: 1,
      doseLabel: "1 капсула",
      packSize: 60,
      stock: 40,
      refillThreshold: 8,
      refillRemind: false,
      startDate: start,
      endDate: null,
      indefinite: true,
      status: "active",
      notes: "",
      instructions: ["with_food"],
      swatch: "amber",
      related: [],
      schedule: { times: ["10:00"], dayRule: { kind: "days", days: [0] }, windowMin: 180 },
      critical: false,
      createdAt: stamp,
      updatedAt: stamp,
    }),
    med({
      id: "demo-mag",
      profileId: me.id,
      name: "Магний",
      form: "tablet",
      doseAmount: 400,
      doseUnit: "мг",
      unitsPerDose: 1,
      doseLabel: "1 таблетка",
      packSize: 30,
      stock: 20,
      refillThreshold: 5,
      refillRemind: false,
      startDate: addDays(today, -20),
      endDate: null,
      indefinite: true,
      status: "paused",
      notes: "Пауза на время, курс не удалён.",
      instructions: ["after_food"],
      swatch: "slate",
      related: [],
      schedule: { times: ["21:00"], dayRule: { kind: "daily" }, windowMin: 60 },
      critical: false,
      createdAt: stamp,
      updatedAt: stamp,
    }),
    med({
      id: "demo-amox",
      profileId: me.id,
      name: "Амоксициллин",
      form: "capsule",
      doseAmount: 500,
      doseUnit: "мг",
      unitsPerDose: 1,
      doseLabel: "1 капсула",
      packSize: 16,
      stock: 0,
      refillThreshold: 0,
      refillRemind: false,
      startDate: addDays(today, -24),
      endDate: addDays(today, -10),
      indefinite: false,
      status: "completed",
      notes: "Короткий курс завершён.",
      instructions: ["after_food"],
      swatch: "clay",
      related: [],
      schedule: { times: ["08:00", "20:00"], dayRule: { kind: "daily" }, windowMin: 30 },
      critical: false,
      createdAt: stamp,
      updatedAt: stamp,
    }),
    med({
      id: "demo-bis",
      profileId: mom.id,
      name: "Бисопролол",
      form: "tablet",
      doseAmount: 5,
      doseUnit: "мг",
      unitsPerDose: 1,
      doseLabel: "1 таблетка",
      packSize: 30,
      stock: 14,
      refillThreshold: 5,
      refillRemind: true,
      startDate: start,
      endDate: null,
      indefinite: true,
      status: "active",
      notes: "",
      instructions: ["water"],
      swatch: "clay",
      related: [],
      schedule: { times: ["08:00"], dayRule: { kind: "daily" }, windowMin: 30 },
      critical: true,
      createdAt: stamp,
      updatedAt: stamp,
    }),
    med({
      id: "demo-asp",
      profileId: mom.id,
      name: "Ацетилсалициловая кислота",
      form: "tablet",
      doseAmount: 75,
      doseUnit: "мг",
      unitsPerDose: 1,
      doseLabel: "1 таблетка",
      packSize: 30,
      stock: 19,
      refillThreshold: 6,
      refillRemind: true,
      startDate: start,
      endDate: null,
      indefinite: true,
      status: "active",
      notes: "После еды.",
      instructions: ["after_food"],
      swatch: "sea",
      related: [],
      schedule: { times: ["19:00"], dayRule: { kind: "daily" }, windowMin: 45 },
      critical: false,
      createdAt: stamp,
      updatedAt: stamp,
    }),
  ];

  const profiles = [me, mom];
  const logs: DoseLog[] = [];
  const yesterday = addDays(today, -1);

  for (const profile of profiles) {
    for (let date = start; date <= yesterday; date = addDays(date, 1)) {
      const slots = buildDay({ date, now, profile, medications, logs: [], overrides: [] });
      for (const slot of slots) {
        const r = (hashStr(`${slot.medication.id}|${date}|${slot.baseTime}`) % 1000) / 1000;
        if (r < 0.78) {
          logs.push(log(profile.id, slot.medication.id, date, slot.baseTime, "taken_on_time"));
        } else if (r < 0.9) {
          logs.push(log(profile.id, slot.medication.id, date, slot.baseTime, "taken_late"));
        } else if (r < 0.96) {
          logs.push(log(profile.id, slot.medication.id, date, slot.baseTime, "missed", REASONS[hashStr(date + slot.baseTime) % REASONS.length]));
        } else {
          logs.push(log(profile.id, slot.medication.id, date, slot.baseTime, "skipped", REASONS[hashStr(slot.medication.id + date) % REASONS.length]));
        }
      }
    }
    const todaySlots = buildDay({ date: today, now, profile, medications, logs: [], overrides: [] });
    const past = todaySlots.filter((s) => s.view === "missed" || s.view === "due");
    past.forEach((slot, index) => {
      if (slot.view === "due") return;
      if (index === 1) {
        logs.push(log(profile.id, slot.medication.id, today, slot.baseTime, "missed", "forgot"));
        return;
      }
      logs.push(log(profile.id, slot.medication.id, today, slot.baseTime, "taken_on_time"));
    });
  }

  return { profiles, medications, logs, activeProfileId: me.id };
}

function log(
  profileId: string,
  medicationId: string,
  date: string,
  time: string,
  status: DoseLog["status"],
  skipReason?: SkipReason,
): DoseLog {
  return {
    id: `demo-log-${medicationId}-${date}-${time}`,
    profileId,
    medicationId,
    date,
    time,
    status,
    actedAt: `${date}T${time}:00`,
    skipReason: status === "missed" || status === "skipped" ? skipReason : undefined,
  };
}
