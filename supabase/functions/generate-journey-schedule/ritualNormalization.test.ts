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
    },
    "fallback-id",
    normalizeDifficulty,
  );

  assert(ritual.frequency === "monthly", "Expected monthly frequency to survive normalization");
  assert(JSON.stringify(ritual.customMonthDays) === JSON.stringify([1]), "Expected monthly day to be preserved");
  assert(ritual.customPeriod === "month", "Expected monthly rituals to carry month period metadata");
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
