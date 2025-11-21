/**
 * Centralized XP Reward System
 *
 * This file defines ALL XP rewards in the application.
 * DO NOT hardcode XP values elsewhere - import from here instead.
 */

/**
 * Daily Quest XP Rewards (One-time missions)
 *
 * Note: These values are HIGHER than habit rewards because quests
 * are one-time actions (max 3/day) vs. recurring habits (max 2 daily).
 */
export const QUEST_XP_REWARDS = {
  EASY: 5,
  MEDIUM: 15,
  HARD: 25,
} as const;

/**
 * Habit XP Rewards (Recurring daily activities)
 *
 * Note: These values are LOWER than quest rewards because habits
 * are recurring (can earn every single day) vs. one-time quests.
 */
export const HABIT_XP_REWARDS = {
  EASY: 5,
  MEDIUM: 10,
  HARD: 20,
} as const;

/**
 * System XP Rewards (Activities, milestones, bonuses)
 */
export const SYSTEM_XP_REWARDS = {
  /** Completing a habit (base - multiplied by difficulty) */
  HABIT_COMPLETE: 5,
  /** Completing ALL daily habits */
  ALL_HABITS_COMPLETE: 10,
  /** Completing a challenge day */
  CHALLENGE_COMPLETE: 20,
  /** Completing a full weekly challenge */
  WEEKLY_CHALLENGE: 50,
  /** Listening to 80%+ of pep talk */
  PEP_TALK_LISTEN: 3,
  /** Morning check-in completion */
  CHECK_IN: 5,
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
