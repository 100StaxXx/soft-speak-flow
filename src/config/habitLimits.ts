export const HABIT_LIMITS_BY_TIER = {
  beginner: 2,
  intermediate: 2,
  advanced: 3,
} as const;

export const DEFAULT_HABIT_LIMIT = 2;

export type DifficultyTier = keyof typeof HABIT_LIMITS_BY_TIER;

export function getHabitLimitForTier(tier: DifficultyTier | string | undefined): number {
  if (tier && tier in HABIT_LIMITS_BY_TIER) {
    return HABIT_LIMITS_BY_TIER[tier as DifficultyTier];
  }
  return DEFAULT_HABIT_LIMIT;
}
