import type { CompanionPlannerRequest } from "@/types/companionPlanner";

type PlannerAISignals = NonNullable<
  CompanionPlannerRequest["plannerContext"]["aiSignals"]
>;

type PlannerAISignalsInput = Partial<Record<keyof PlannerAISignals, unknown>>
  | null
  | undefined;

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const asFiniteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const asStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const normalized = value
    .map((entry) => asNonEmptyString(entry))
    .filter((entry): entry is string => Boolean(entry));

  return normalized.length > 0 ? normalized : undefined;
};

const asSuggestedWorkload = (
  value: unknown,
): PlannerAISignals["suggestedWorkload"] | undefined =>
  value === "light" || value === "normal" || value === "heavy"
    ? value
    : undefined;

export const buildPlannerAISignals = (
  value: PlannerAISignalsInput,
): PlannerAISignals | undefined => {
  if (!value) return undefined;

  const aiSignals: PlannerAISignals = {};
  const preferredDifficulty = asNonEmptyString(value.preferredDifficulty);
  const preferredHabitFrequency = asNonEmptyString(
    value.preferredHabitFrequency,
  );
  const preferredEpicDuration = asFiniteNumber(value.preferredEpicDuration);
  const commonContexts = asStringArray(value.commonContexts);
  const suggestedWorkload = asSuggestedWorkload(value.suggestedWorkload);

  if (preferredDifficulty) {
    aiSignals.preferredDifficulty = preferredDifficulty;
  }

  if (preferredHabitFrequency) {
    aiSignals.preferredHabitFrequency = preferredHabitFrequency;
  }

  if (preferredEpicDuration !== undefined) {
    aiSignals.preferredEpicDuration = preferredEpicDuration;
  }

  if (commonContexts) {
    aiSignals.commonContexts = commonContexts;
  }

  if (suggestedWorkload) {
    aiSignals.suggestedWorkload = suggestedWorkload;
  }

  return Object.keys(aiSignals).length > 0 ? aiSignals : undefined;
};
