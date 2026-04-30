import { normalizeFrequency, normalizeJourneyRitual } from "./ritualNormalization.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const normalizeDifficulty = (value: unknown): "easy" | "medium" | "hard" => {
  if (value === "easy" || value === "hard") {
    return value;
  }

  return "medium";
};

Deno.test("normalizeFrequency preserves monthly cadence", () => {
  assert(normalizeFrequency("monthly") === "monthly", "Expected monthly cadence to be preserved");
});

Deno.test("normalizeJourneyRitual preserves explicit monthly day selections", () => {
  const ritual = normalizeJourneyRitual(
    {
      id: "ritual-1",
      title: "Monthly Review and Adjust",
      description: "Review analytics and adjust the plan.",
      frequency: "monthly",
      customMonthDays: [1],
      difficulty: "medium",
      estimatedMinutes: 30,
      preferredTime: "19:00",
    },
    "fallback-id",
    normalizeDifficulty,
  );

  assert(ritual.frequency === "monthly", "Expected monthly frequency to survive normalization");
  assert(JSON.stringify(ritual.customMonthDays) === JSON.stringify([1]), "Expected monthly day to be preserved");
  assert(ritual.customPeriod === "month", "Expected monthly rituals to carry month period metadata");
  assert(ritual.estimatedMinutes === 30, "Expected estimated minutes to be preserved");
  assert(ritual.preferredTime === "19:00", "Expected preferred time to be preserved");
});

Deno.test("normalizeJourneyRitual defaults monthly cadence to day one when omitted", () => {
  const ritual = normalizeJourneyRitual(
    {
      title: "Monthly Review and Adjust",
      description: "Review analytics and adjust the plan.",
      frequency: "monthly",
      difficulty: "medium",
    },
    "fallback-id",
    normalizeDifficulty,
  );

  assert(ritual.frequency === "monthly", "Expected monthly frequency to survive normalization");
  assert(JSON.stringify(ritual.customMonthDays) === JSON.stringify([1]), "Expected missing month day to default to day one");
  assert(ritual.customPeriod === "month", "Expected monthly rituals to be treated as month-based");
});

Deno.test("normalizeJourneyRitual pads compact preferred times", () => {
  const ritual = normalizeJourneyRitual(
    {
      title: "Morning Review",
      description: "Review the plan.",
      frequency: "daily",
      difficulty: "easy",
      preferredTime: "8:05",
    },
    "fallback-id",
    normalizeDifficulty,
  );

  assert(ritual.preferredTime === "08:05", "Expected compact hour to be padded");
});

Deno.test("normalizeJourneyRitual preserves snake_case timing fields", () => {
  const ritual = normalizeJourneyRitual(
    {
      id: "ritual-1",
      title: "Review",
      description: "Check the plan",
      frequency: "daily",
      difficulty: "easy",
      preferred_time: "7:30",
      estimated_minutes: 25,
    },
    "fallback-id",
    normalizeDifficulty,
    "14:00",
  );

  assert(ritual.preferredTime === "07:30", "Expected snake_case preferred time to be preserved");
  assert(ritual.estimatedMinutes === 25, "Expected snake_case estimated minutes to be preserved");
});

Deno.test("normalizeJourneyRitual falls back when preferred time is invalid or omitted", () => {
  const invalidTime = normalizeJourneyRitual(
    {
      title: "Deep Work",
      description: "Work on the main goal.",
      frequency: "daily",
      difficulty: "medium",
      preferredTime: "tomorrow morning",
    },
    "fallback-id",
    normalizeDifficulty,
    "14:00",
  );

  const missingTime = normalizeJourneyRitual(
    {
      title: "Evening Review",
      description: "Close open loops.",
      frequency: "daily",
      difficulty: "medium",
    },
    "fallback-id",
    normalizeDifficulty,
    "17:00",
  );

  assert(invalidTime.preferredTime === "14:00", "Expected invalid preferred time to use fallback");
  assert(missingTime.preferredTime === "17:00", "Expected missing preferred time to use fallback");
});

Deno.test("normalizeJourneyRitual omits invalid estimated minutes", () => {
  const invalidDurations = [Number.NaN, -30, 0, 30.5, 1441, "30", undefined];

  for (const estimatedMinutes of invalidDurations) {
    const ritual = normalizeJourneyRitual(
      {
        title: "Invalid Duration",
        description: "Duration should be ignored.",
        frequency: "daily",
        difficulty: "medium",
        estimatedMinutes,
      },
      "fallback-id",
      normalizeDifficulty,
    );

    assert(ritual.estimatedMinutes === undefined, `Expected ${String(estimatedMinutes)} to be omitted`);
  }
});
