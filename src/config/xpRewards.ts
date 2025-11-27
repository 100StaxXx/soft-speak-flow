/**
 * Centralized XP Reward System
 *
 * This file defines ALL XP rewards in the application.
 * DO NOT hardcode XP values elsewhere - import from here instead.
 */

/**
 * Daily Quest XP Rewards (One-time missions)
 *
 * Balanced to feel punchy without overshadowing habits.
 * Main Quest receives 1.5x multiplier.
 */
export const QUEST_XP_REWARDS = {
  EASY: 8,
  MEDIUM: 16,
  HARD: 28,
} as const;

/**
 * Habit XP Rewards (Recurring daily activities)
 *
 * Buffed to be nearly as valuable as quests since habits drive real behavior change.
 * Done daily, these become the core XP engine.
 */
export const HABIT_XP_REWARDS = {
  EASY: 7,
  MEDIUM: 14,
  HARD: 24,
} as const;

/**
 * System XP Rewards (Activities, milestones, bonuses)
 * 
 * Rebalanced to reward engagement over low-effort taps.
 */
export const SYSTEM_XP_REWARDS = {
  /** Completing a habit (base - multiplied by difficulty) */
  HABIT_COMPLETE: 7,
  /** Completing ALL daily habits */
  ALL_HABITS_COMPLETE: 15,
  /** Completing a challenge day */
  CHALLENGE_COMPLETE: 25,
  /** Completing a full weekly challenge */
  WEEKLY_CHALLENGE: 60,
  /** Listening to 80%+ of pep talk (requires real engagement) */
  PEP_TALK_LISTEN: 8,
  /** Morning check-in completion (quick tap, low effort) */
  CHECK_IN: 3,
  /** Reaching a streak milestone */
  STREAK_MILESTONE: 15,
} as const;

/**
 * Helper: Get quest XP by difficulty string
 */
export function getQuestXP(difficulty: 'easy' | 'medium' | 'hard'): number {
  const map: Record<typeof difficulty, number> = {
    easy: QUEST_XP_REWARDS.EASY,
    medium: QUEST_XP_REWARDS.MEDIUM,
    hard: QUEST_XP_REWARDS.HARD,
  };
  return map[difficulty];
}

/**
 * Helper: Get habit XP by difficulty string
 */
export function getHabitXP(difficulty: 'easy' | 'medium' | 'hard'): number {
  const map: Record<typeof difficulty, number> = {
    easy: HABIT_XP_REWARDS.EASY,
    medium: HABIT_XP_REWARDS.MEDIUM,
    hard: HABIT_XP_REWARDS.HARD,
  };
  return map[difficulty];
}

/**
 * Quest XP Multiplier based on quest position (diminishing returns)
 * 
 * Quests 1-3: 100% XP
 * Quest 4: 75% XP
 * Quest 5: 50% XP
 * Quest 6: 35% XP
 * Quest 7: 25% XP
 * Quest 8: 15% XP
 * Quests 9-10: 10% XP
 * Quests 11+: 5% XP
 */
export function getQuestXPMultiplier(questPosition: number): number {
  if (questPosition <= 3) return 1.0;
  if (questPosition === 4) return 0.75;
  if (questPosition === 5) return 0.5;
  if (questPosition === 6) return 0.35;
  if (questPosition === 7) return 0.25;
  if (questPosition === 8) return 0.15;
  if (questPosition <= 10) return 0.1;
  return 0.05; // 11+
}

/**
 * Get effective quest XP with position-based multiplier applied
 */
export function getEffectiveQuestXP(difficulty: Difficulty, questPosition: number): number {
  const baseXP = getQuestXP(difficulty);
  const multiplier = getQuestXPMultiplier(questPosition);
  return Math.round(baseXP * multiplier);
}

/**
 * Type-safe difficulty type
 */
export type Difficulty = 'easy' | 'medium' | 'hard';
