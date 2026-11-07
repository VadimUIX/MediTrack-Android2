import assert from "node:assert/strict";
import test from "node:test";
import { assessPrn, buildDay, ruleMatches, tally } from "./engine.ts";
import type { Medication, Profile } from "./types.ts";

const profile: Profile = {
  id: "p",
  name: "Я",
  icon: "user",
  swatch: "sage",
  isPrimary: true,
  away: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function course(partial: Partial<Medication> & Pick<Medication, "id" | "schedule">): Medication {
  return {
    profileId: "p",
    name: partial.id,
    form: "tablet",
    doseAmount: 1,
    doseUnit: "мг",
    unitsPerDose: 1,
    doseLabel: "",
    packSize: 10,
    stock: 10,
    refillThreshold: 2,
    refillRemind: false,
    startDate: "2026-01-01",
    endDate: null,
    indefinite: true,
    status: "active",
    notes: "",
    instructions: [],
    swatch: "sage",
    related: [],
    critical: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

test("day rules", () => {
  assert.equal(ruleMatches({ kind: "daily" }, "2026-11-05"), true);
  assert.equal(ruleMatches({ kind: "weekdays" }, "2026-11-05"), true);
  assert.equal(ruleMatches({ kind: "weekdays" }, "2026-11-07"), false);
  assert.equal(ruleMatches({ kind: "days", days: [0] }, "2026-11-08"), true);
  assert.equal(ruleMatches({ kind: "interval", every: 3, anchor: "2026-11-01" }, "2026-11-04"), true);
  assert.equal(ruleMatches({ kind: "interval", every: 3, anchor: "2026-11-01" }, "2026-11-05"), false);
  assert.equal(ruleMatches({ kind: "cycle", onDays: 5, offDays: 2, anchor: "2026-11-01" }, "2026-11-05"), true);
  assert.equal(ruleMatches({ kind: "cycle", onDays: 5, offDays: 2, anchor: "2026-11-01" }, "2026-11-06"), false);
  assert.equal(ruleMatches({ kind: "once", date: "2026-11-05" }, "2026-11-05"), true);
  assert.equal(ruleMatches({ kind: "once", date: "2026-11-05" }, "2026-11-06"), false);
});

test("slots, window, overrides and tally", () => {
  const meds = [
    course({ id: "a", schedule: { times: ["08:00", "20:00"], dayRule: { kind: "daily" }, windowMin: 30 } }),
    course({
      id: "b",
      status: "paused",
      schedule: { times: ["09:00"], dayRule: { kind: "daily" }, windowMin: 15 },
    }),
  ];
  const morning = buildDay({
    date: "2026-11-05",
    now: new Date(2026, 10, 5, 8, 10),
    profile,
    medications: meds,
    logs: [],
    overrides: [],
  });
  assert.deepEqual(
    morning.map((s) => [s.medication.id, s.time, s.view]),
    [
      ["a", "08:00", "due"],
      ["a", "20:00", "upcoming"],
    ],
  );
  const missed = buildDay({
    date: "2026-11-05",
    now: new Date(2026, 10, 5, 12, 0),
    profile,
    medications: meds,
    logs: [{ id: "l", profileId: "p", medicationId: "a", date: "2026-11-05", time: "08:00", status: "taken_late" }],
    overrides: [{ id: "o", profileId: "p", medicationId: "a", date: "2026-11-05", kind: "cancel", fromTime: "20:00" }],
  });
  assert.equal(missed.length, 1);
  assert.equal(missed[0].view, "taken_late");
  const moved = buildDay({
    date: "2026-11-05",
    now: new Date(2026, 10, 5, 7, 0),
    profile,
    medications: meds,
    logs: [],
    overrides: [{ id: "m", profileId: "p", medicationId: "a", date: "2026-11-05", kind: "move", fromTime: "08:00", toTime: "09:15" }],
  });
  assert.equal(moved[0].time, "09:15");
  assert.equal(moved[0].baseTime, "08:00");
  const away = buildDay({
    date: "2026-11-05",
    now: new Date(2026, 10, 5, 12, 0),
    profile: { ...profile, away: { from: "2026-11-04", to: "2026-11-06" } },
    medications: meds,
    logs: [],
    overrides: [],
  });
  assert.ok(away.every((s) => s.view === "away"));
  const t = tally(missed);
  assert.equal(t.taken, 1);
  assert.equal(t.percent, 100);
});


test("PRN-only medicines do not create scheduled slots", () => {
  const prn = course({
    id: "prn",
    intakeMode: "prn",
    schedule: { times: [], dayRule: { kind: "daily" }, windowMin: 30 },
  });
  const slots = buildDay({
    date: "2026-11-05",
    now: new Date(2026, 10, 5, 10, 0),
    profile,
    medications: [prn],
    logs: [],
    overrides: [],
  });
  assert.equal(slots.length, 0);
});

test("PRN assessment calculates interval and daily amount from PRN logs only", () => {
  const prn = course({
    id: "prn",
    intakeMode: "prn",
    prn: { minIntervalMinutes: 240, maxDoseAmount: 500, maxDailyDoseAmount: 1000 },
    doseAmount: 500,
    doseUnit: "мг",
  });
  const logs = [
    {
      id: "prn-log",
      profileId: "p",
      medicationId: "prn",
      date: "2026-11-05",
      time: "08:00",
      status: "taken_on_time" as const,
      actedAt: new Date(2026, 10, 5, 8, 0).toISOString(),
      kind: "prn" as const,
      doseAmount: 500,
      doseUnit: "мг",
    },
    {
      id: "scheduled-log",
      profileId: "p",
      medicationId: "prn",
      date: "2026-11-05",
      time: "09:00",
      status: "taken_on_time" as const,
      kind: "scheduled" as const,
      doseAmount: 500,
    },
  ];
  const assessment = assessPrn({
    medication: prn,
    logs,
    profileId: "p",
    now: new Date(2026, 10, 5, 10, 0),
  });
  assert.equal(assessment.dailyTotal, 500);
  assert.equal(assessment.intervalBlocked, true);
  assert.equal(assessment.dailyLimitReached, false);
  assert.equal(assessment.nextAllowedAt?.getTime(), new Date(2026, 10, 5, 12, 0).getTime());
});
