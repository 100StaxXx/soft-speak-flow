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
  EASY: 12,
  MEDIUM: 16,
  HARD: 22,
} as const;

/**
 * Habit XP Rewards (Recurring daily activities)
 *
 * Buffed to be nearly as valuable as quests since habits drive real behavior change.
 * Done daily, these become the core XP engine.
 */
export const HABIT_XP_REWARDS = {
  EASY: 8,
  MEDIUM: 12,
  HARD: 18,
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
  ALL_HABITS_COMPLETE: 12,
  /** Completing a challenge day */
  CHALLENGE_COMPLETE: 25,
  /** Completing a full weekly challenge */
  WEEKLY_CHALLENGE: 60,
  /** Listening to 80%+ of pep talk (requires real engagement) */
  PEP_TALK_LISTEN: 8,
  /** Morning check-in completion (quick tap, low effort) */
  CHECK_IN: 4,
  /** Evening reflection completion */
  EVENING_REFLECTION: 4,
  /** Viewing weekly recap */
  WEEKLY_RECAP_VIEWED: 5,
  /** Reaching a streak milestone */
  STREAK_MILESTONE: 15,
  /** Returning after inactivity to re-engage with the companion */
  WELCOME_BACK_BONUS: 25,
} as const;

/**
 * Astral Encounter XP Rewards (Boss Battles)
 * 
 * Rebalanced for flatter curve: Common boosted, Legendary reduced.
 * Triggers: Quest milestone (every 2-4 quests), Epic checkpoint, Weekly
 */
export const ENCOUNTER_XP_REWARDS = {
  /** Common tier (quest milestones) */
  COMMON: 35,
  /** Uncommon tier (quest milestones) */
  UNCOMMON: 45,
  /** Rare tier (epic checkpoints) */
  RARE: 55,
  /** Epic tier (epic checkpoints) */
  EPIC: 75,
  /** Legendary tier (weekly encounters) */
  LEGENDARY: 100,
} as const;

/**
 * Astral Encounter Result Multipliers
 * 
 * Applied to base XP based on performance accuracy.
 */
export const ENCOUNTER_RESULT_MULTIPLIERS = {
  /** 90%+ accuracy */
  PERFECT: 1.5,
  /** 70-89% accuracy */
  GOOD: 1.0,
  /** 50-69% accuracy */
  PARTIAL: 0.5,
  /** <50% accuracy */
  FAIL: 0,
} as const;

/**
 * Control Method Bonuses
 * 
 * Bonus multipliers for using more challenging control schemes.
 */
export const CONTROL_BONUSES = {
  /** 25% XP bonus for using tilt/gyroscope controls */
  TILT_CONTROL: 1.25,
} as const;

/**
 * Epic XP Rewards
 * 
 * Formula: targetDays * XP_PER_DAY
 */
export const EPIC_XP_REWARDS = {
  /** XP earned per day of epic duration */
  XP_PER_DAY: 10,
} as const;

/**
 * Calendar Power-Up XP Bonuses
 * 
 * Bonus XP for strategic scheduling behaviors.
 */
export const CALENDAR_BONUS_XP = {
  /** Per morning task (before 9am) */
  MORNING_WARRIOR: 10,
  /** Per deep work block (90+ min) */
  DEEP_WORK: 20,
} as const;

/**
 * Focus Session XP Rewards
 * 
 * Simplified for single Pomodoro mode with daily cap.
 */
export const FOCUS_XP_REWARDS = {
  /** Standard Pomodoro session (25 minutes) */
  SESSION_COMPLETE: 20,
  /** Perfect focus (no distractions) bonus */
  PERFECT_FOCUS_BONUS: 5,
  /** Maximum XP-earning sessions per day */
  DAILY_SESSION_CAP: 4,
  /** XP when cap reached (reduced but still rewarding) */
  CAPPED_SESSION_XP: 3,
} as const;

/**
 * Subtask XP Rewards
 * 
 * Rewards for subtask completion and parent task progress.
 */
export const SUBTASK_XP_REWARDS = {
  /** Completing a single subtask */
  SUBTASK_COMPLETE: 3,
  /** Bonus when all subtasks of a task are completed */
  ALL_SUBTASKS_BONUS: 10,
} as const;

/**
 * Priority System XP Rewards
 * 
 * Bonuses for completing prioritized tasks.
 */
export const PRIORITY_XP_REWARDS = {
  /** Completing a Top 3 daily task */
  TOP_THREE_COMPLETE: 15,
  /** Completing all 3 Top 3 tasks in a day */
  ALL_TOP_THREE_BONUS: 30,
  /** Completing an urgent-important (Quadrant 1) task */
  URGENT_IMPORTANT: 10,
  /** Completing a not-urgent-important (Quadrant 2) task */
  NOT_URGENT_IMPORTANT: 12,
} as const;

/**
 * Inbox & Capture XP Rewards
 * 
 * Rewards for using quick capture and processing inbox.
 */
export const INBOX_XP_REWARDS = {
  /** Processing an inbox item into a task */
  PROCESS_INBOX: 2,
  /** Achieving inbox zero */
  INBOX_ZERO: 10,
  /** Using voice capture */
  VOICE_CAPTURE: 3,
} as const;

/**
 * Productivity & Analytics XP Rewards
 * 
 * Rewards for maintaining productivity and completing reviews.
 */
export const PRODUCTIVITY_XP_REWARDS = {
  /** Completing weekly review ritual */
  WEEKLY_REVIEW: 25,
  /** Completing end-of-day review */
  DAILY_REVIEW: 8,
  /** Achieving productivity score > 80 */
  HIGH_PRODUCTIVITY_DAY: 20,
  /** Perfect day (all planned tasks completed) */
  PERFECT_DAY: 35,
} as const;

/**
 * Context & Scheduling XP Rewards
 * 
 * Bonuses for smart scheduling behaviors.
 */
export const SCHEDULING_XP_REWARDS = {
  /** Completing task in its scheduled time block */
  ON_TIME_COMPLETION: 5,
  /** Completing task in its context location */
  CONTEXT_MATCH: 3,
} as const;

/**
 * Milestone XP Rewards
 * 
 * Rewards for completing epic milestones.
 */
export const MILESTONE_XP_REWARDS = {
  /** Regular milestone completion */
  REGULAR: 20,
  /** Postcard/celebration milestone completion */
  POSTCARD: 35,
  /** Phase completion bonus (all milestones in phase done) */
  PHASE_COMPLETE: 45,
  /** Epic completion (all milestones done) */
  EPIC_COMPLETE: 120,
} as const;

export const MAIN_QUEST_XP_MULTIPLIER = 1.5;
export const DAILY_XP_CAP = 220;
export const POST_CAP_REPEATABLE_MULTIPLIER = 0.2;

/**
 * Type-safe difficulty type
 */
export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Helper: Get quest XP by difficulty string
 */
export function getQuestXP(difficulty: Difficulty): number {
  const map: Record<Difficulty, number> = {
    easy: QUEST_XP_REWARDS.EASY,
    medium: QUEST_XP_REWARDS.MEDIUM,
    hard: QUEST_XP_REWARDS.HARD,
  };
  return map[difficulty];
}

/**
 * Helper: Get habit XP by difficulty string
 */
export function getHabitXP(difficulty: Difficulty): number {
  const map: Record<Difficulty, number> = {
    easy: HABIT_XP_REWARDS.EASY,
    medium: HABIT_XP_REWARDS.MEDIUM,
    hard: HABIT_XP_REWARDS.HARD,
  };
  return map[difficulty];
}

/**
 * Quest XP Multiplier based on quest position (diminishing returns)
 * 
 * Quests 1-4: 100% XP
 * Quest 5: 75% XP
 * Quest 6: 50% XP
 * Quests 7-8: 25% XP
 * Quests 9-10+: 10% XP
 */
export function getQuestXPMultiplier(questPosition: number): number {
  if (questPosition <= 4) return 1.0;
  if (questPosition === 5) return 0.75;
  if (questPosition === 6) return 0.5;
  if (questPosition <= 8) return 0.25;
  if (questPosition <= 10) return 0.1;
  return 0.1;
}

/**
 * Get effective quest XP with position-based multiplier applied
 */
export function getEffectiveQuestXP(difficulty: Difficulty, questPosition: number): number {
  const baseXP = getQuestXP(difficulty);
  const multiplier = getQuestXPMultiplier(questPosition);
  return Math.round(baseXP * multiplier);
}
