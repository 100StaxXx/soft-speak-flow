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
  EASY: 8,
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
  HABIT_COMPLETE: 8,
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
 * Type-safe difficulty type
 */
export type Difficulty = 'easy' | 'medium' | 'hard';
