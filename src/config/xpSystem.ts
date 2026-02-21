/**
 * XP System Configuration & Reference
 *
 * All XP rewards are centralized in @/config/xpRewards.ts
 * Import from there instead of hard-coding XP values.
 *
 * XP VALUES:
 *
 * QUESTS (One-time missions, max 4/day):
 * - Easy Quest: 12 XP
 * - Medium Quest: 16 XP
 * - Hard Quest: 22 XP
 * - Main Quest Multiplier: 1.5x
 *
 * HABITS (Recurring daily activities, max 2 active):
 * - Easy Habit: 10 XP
 * - Medium Habit: 14 XP
 * - Hard Habit: 20 XP
 * - All Habits Complete (daily bonus): 20 XP
 *
 * SYSTEM ACTIVITIES:
 * - Check-in: 4 XP
 * - Pep Talk Listened (80%+): 8 XP
 * - Challenge Day Complete: 25 XP
 * - Weekly Challenge Complete: 60 XP
 * - Streak Milestone: 15 XP
 * - Welcome Back Bonus: 25 XP
 *
 * ASTRAL ENCOUNTERS (Boss Battles):
 * Trigger Frequency:
 * - Quest Milestone: Every 2-4 quests (Common/Uncommon)
 * - Epic Checkpoint: 25/50/75/100% progress (Rare/Epic)
 * - Weekly: Once per 7 days (Legendary)
 * 
 * Base XP by Tier:
 * - Common: 35 XP base (52 XP perfect)
 * - Uncommon: 45 XP base (67 XP perfect)
 * - Rare: 55 XP base (82 XP perfect)
 * - Epic: 75 XP base (112 XP perfect)
 * - Legendary: 100 XP base (150 XP perfect)
 * 
 * Performance Multipliers:
 * - Perfect (90%+): 1.5x XP
 * - Good (70-89%): 1.0x XP
 * - Partial (50-69%): 0.5x XP
 * - Fail (<50%): 0x XP
 *
 * EPICS:
 * - XP Reward: targetDays × 10 XP per day
 * - Example: 30-day Epic = 300 XP on completion
 *
 * CALENDAR POWER-UPS:
 * - Morning Warrior (before 9am): +10 XP per task
 * - Deep Work Block (90+ min): +20 XP per task
 *
 * STREAK MULTIPLIER:
 * - 0-6 day streak: 1.0x XP
 * - 7-29 day streak: 1.25x XP
 * - 30-59 day streak: 1.5x XP
 * - 60+ day streak: 1.75x XP
 *
 * REPEATABLE XP CAP (applies to quests, habits, focus sessions):
 * - Full XP up to: 260 repeatable XP/day
 * - Post-cap multiplier: 0.35x
 * 
 * EVOLUTION THRESHOLDS (21-Stage System):
 * - Stage 0 (Egg): 0 XP
 * - Stage 1 (Hatchling): 10 XP (first quest!)
 * - Stage 2 (Sproutling): 100 XP
 * - Stage 3 (Cub): 250 XP
 * - Stage 4 (Juvenile): 450 XP
 * - Stage 5 (Apprentice): 800 XP
 * - Stage 6 (Scout): 1,300 XP
 * - Stage 7 (Fledgling): 2,000 XP
 * - Stage 8 (Warrior): 2,900 XP
 * - Stage 9 (Guardian): 4,000 XP
 * - Stage 10 (Champion): 5,400 XP
 * - Stage 11 (Ascended): 7,100 XP
 * - Stage 12 (Vanguard): 9,100 XP
 * - Stage 13 (Titan): 11,400 XP
 * - Stage 14 (Mythic): 14,000 XP
 * - Stage 15 (Prime): 17,000 XP
 * - Stage 16 (Regal): 20,400 XP
 * - Stage 17 (Eternal): 24,200 XP
 * - Stage 18 (Transcendent): 28,400 XP
 * - Stage 19 (Apex): 33,000 XP
 * - Stage 20 (Ultimate): 38,000 XP
 *
 * USAGE EXAMPLE:
 * ```tsx
 * import { useXPRewards } from "@/hooks/useXPRewards";
 * 
 * const MyComponent = () => {
 *   const { 
 *     awardHabitCompletion, 
 *     awardCheckInComplete,
 *     XP_REWARDS 
 *   } = useXPRewards();
 *   
 *   const handleComplete = () => {
 *     awardHabitCompletion();
 *     toast({ title: `+${XP_REWARDS.HABIT_COMPLETE} XP!` });
 *   };
 * };
 * ```
 * 
 * AVAILABLE HELPERS:
 * - awardHabitCompletion() - When user completes a habit
 * - awardAllHabitsComplete() - When user completes all daily habits
 * - awardCheckInComplete() - When user completes morning check-in
 * - awardPepTalkListened() - When user listens to 80%+ of pep talk
 * - awardChallengeCompletion() - When user completes a challenge day
 * - awardWeeklyChallengeCompletion() - When user completes full weekly challenge
 * - awardStreakMilestone(milestone) - When user hits streak milestones
 * - awardReflectionComplete() - When user completes reflection
 * - awardQuoteShared() - When user shares a quote
 */

// 21-Stage Evolution System: Early stages fast, late stages exponential
export const EVOLUTION_THRESHOLDS: Record<number, number> = {
  0: 0,        // Egg
  1: 10,       // Hatchling (first quest completes this!)
  2: 100,      // Sproutling
  3: 250,      // Cub
  4: 450,      // Juvenile
  5: 800,      // Apprentice
  6: 1300,     // Scout
  7: 2000,     // Fledgling
  8: 2900,     // Warrior
  9: 4000,     // Guardian
  10: 5400,    // Champion
  11: 7100,    // Ascended
  12: 9100,    // Vanguard
  13: 11400,   // Titan
  14: 14000,   // Mythic
  15: 17000,   // Prime
  16: 20400,   // Regal
  17: 24200,   // Eternal
  18: 28400,   // Transcendent
  19: 33000,   // Apex
  20: 38000,   // Ultimate
};

/**
 * User Level System: Scaling progression curve
 * 
 * Early levels are quick to hook users, later levels take weeks/months.
 * - Level 10: ~2 weeks of vigorous daily use (~175 XP/day)
 * - Level 14: ~2 months of near-perfect daily use (~250 XP/day)
 * - Level 20: 6+ months of dedication (legendary achievement)
 */
export const LEVEL_THRESHOLDS: Record<number, number> = {
  1: 0,       // Start
  2: 50,      // ~1 day
  3: 150,     // ~1 day
  4: 300,     // ~1 day
  5: 500,     // 1-2 days
  6: 800,     // 2 days
  7: 1200,    // 2-3 days
  8: 1750,    // 3 days
  9: 2500,    // 4-5 days
  10: 3500,   // ~2 weeks total (milestone!)
  11: 5000,   // 8-9 days
  12: 7000,   // 11-12 days
  13: 10000,  // 17-20 days
  14: 14000,  // ~2 months total (elite!)
  15: 19000,  // 28-30 days
  16: 25000,  // 35+ days
  17: 32000,  // 40+ days
  18: 40000,  // 45+ days
  19: 50000,  // 55+ days
  20: 65000,  // 85+ days (legendary)
};

/** Get total XP required for a specific level */
export function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level >= 20) return LEVEL_THRESHOLDS[20];
  return LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[20];
}

/** Get XP needed to progress from current level to next */
export function getXPToNextLevel(currentLevel: number): number {
  const current = getXPForLevel(currentLevel);
  const next = getXPForLevel(Math.min(currentLevel + 1, 20));
  return next - current;
}

export const XP_SYSTEM_DOCS = {
  note: "See useXPRewards hook for implementation",
} as const;
