export type JourneyRitualFrequency =
  | "daily"
  | "5x_week"
  | "3x_week"
  | "weekly"
  | "monthly"
  | "custom";

export type JourneyRitualCustomPeriod = "week" | "month";

export interface JourneyRitual {
  id: string;
  title: string;
  description: string;
  frequency: JourneyRitualFrequency;
  customDays?: number[];
  customMonthDays?: number[];
  customPeriod?: JourneyRitualCustomPeriod;
  difficulty: "easy" | "medium" | "hard";
  estimatedMinutes?: number;
  preferredTime?: string | null;
}

interface JourneyRitualInput {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  frequency?: unknown;
  customDays?: unknown;
  customMonthDays?: unknown;
  customPeriod?: unknown;
  difficulty?: unknown;
  estimatedMinutes?: unknown;
  preferredTime?: unknown;
}

export const DEFAULT_RITUAL_TIME_SLOTS = ["08:00", "10:00", "14:00", "17:00", "19:00", "20:30"];

function normalizeNumberList(values: unknown, min: number, max: number): number[] {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
        .map((value) => Math.trunc(value))
        .filter((value) => value >= min && value <= max),
    ),
  ).sort((left, right) => left - right);
}

function inferCustomPeriod(
  value: unknown,
  frequency: JourneyRitualFrequency,
  customMonthDays: number[],
): JourneyRitualCustomPeriod | undefined {
  if (value === "week" || value === "month") {
    return value;
  }

  if (frequency === "monthly") return "month";
  if (frequency === "weekly") return "week";
  if (frequency === "custom") {
    return customMonthDays.length > 0 ? "month" : "week";
  }

  return undefined;
}

function normalizePreferredTime(value: unknown, fallbackTime: string): string {
  if (typeof value !== "string") return fallbackTime;

  const trimmed = value.trim();
  const match = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  if (!match) return fallbackTime;

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function normalizeFrequency(value: unknown): JourneyRitualFrequency {
  if (typeof value !== "string") return "daily";

  const lower = value.toLowerCase().trim().replace(/\s+/g, "_");

  if (["daily", "everyday", "every_day", "7x_week", "7x"].includes(lower)) return "daily";
  if (["5x_week", "5x", "weekdays", "five_times", "5_times"].includes(lower)) return "5x_week";
  if (["3x_week", "3x", "three_times", "3_times", "thrice"].includes(lower)) return "3x_week";
  if (["weekly", "every_week"].includes(lower)) return "weekly";
  if (["monthly", "month", "every_month"].includes(lower)) return "monthly";
  if (["biweekly", "twice", "2x", "2x_week", "once", "1x", "custom", "twice_daily"].includes(lower)) return "custom";

  return "daily";
}

export function normalizeJourneyRitual(
  ritual: JourneyRitualInput,
  defaultId: string,
  normalizeDifficulty: (value: unknown) => "easy" | "medium" | "hard",
  fallbackTime = DEFAULT_RITUAL_TIME_SLOTS[0],
): JourneyRitual {
  const frequency = normalizeFrequency(ritual.frequency);
  let customDays = normalizeNumberList(ritual.customDays, 0, 6);
  let customMonthDays = normalizeNumberList(ritual.customMonthDays, 1, 31);
  let customPeriod = inferCustomPeriod(ritual.customPeriod, frequency, customMonthDays);

  switch (frequency) {
    case "daily":
      customDays = [];
      customMonthDays = [];
      customPeriod = undefined;
      break;
    case "5x_week":
      customDays = customDays.length > 0 ? customDays : [0, 1, 2, 3, 4];
      customMonthDays = [];
      customPeriod = undefined;
      break;
    case "3x_week":
      customDays = customDays.length > 0 ? customDays : [0, 2, 4];
      customMonthDays = [];
      customPeriod = undefined;
      break;
    case "weekly":
      customDays = customDays.length > 0 ? [customDays[0]] : [0];
      customMonthDays = [];
      customPeriod = "week";
      break;
    case "monthly":
      customDays = [];
      customMonthDays = customMonthDays.length > 0 ? customMonthDays : [1];
      customPeriod = "month";
      break;
    case "custom":
      if (customPeriod === "month") {
        customDays = [];
        customMonthDays = customMonthDays.length > 0 ? customMonthDays : [1];
      } else {
        customDays = customDays.length > 0 ? customDays : [0];
        customMonthDays = [];
        customPeriod = "week";
      }
      break;
  }

  const normalizedRitual: JourneyRitual = {
    id: typeof ritual.id === "string" && ritual.id.length > 0 ? ritual.id : defaultId,
    title: typeof ritual.title === "string" ? ritual.title : "",
    description: typeof ritual.description === "string" ? ritual.description : "",
    frequency,
    difficulty: normalizeDifficulty(ritual.difficulty),
    preferredTime: normalizePreferredTime(ritual.preferredTime, fallbackTime),
  };

  if (customDays.length > 0) {
    normalizedRitual.customDays = customDays;
  }

  if (customMonthDays.length > 0) {
    normalizedRitual.customMonthDays = customMonthDays;
  }

  if (customPeriod) {
    normalizedRitual.customPeriod = customPeriod;
  }

  if (typeof ritual.estimatedMinutes === "number" && Number.isFinite(ritual.estimatedMinutes)) {
    normalizedRitual.estimatedMinutes = ritual.estimatedMinutes;
  }

  return normalizedRitual;
}
