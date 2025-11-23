/**
 * XP System Configuration & Reference
 *
 * All XP rewards are centralized in @/config/xpRewards.ts
 * Import from there instead of hard-coding XP values.
 *
 * XP VALUES:
 *
 * QUESTS (One-time missions, max 3/day):
 * - Easy Quest: 5 XP
 * - Medium Quest: 15 XP
 * - Hard Quest: 25 XP
 * - Main Quest Multiplier: 2x
 *
 * HABITS (Recurring daily activities, max 2 active):
 * - Easy Habit: 5 XP
 * - Medium Habit: 10 XP
 * - Hard Habit: 20 XP
 * - All Habits Complete (daily bonus): 10 XP
 *
 * SYSTEM ACTIVITIES:
 * - Check-in: 5 XP
 * - Pep Talk Listened (80%+): 3 XP
 * - Streak Milestone: 15 XP
 * 
 * EVOLUTION THRESHOLDS (21-Stage System):
 * - Stage 0 (Egg): 0 XP
 * - Stage 1 (Hatchling): 10 XP (first quest!)
 * - Stage 2 (Sproutling): 120 XP
 * - Stage 3 (Cub): 250 XP
 * - Stage 4 (Juvenile): 500 XP
 * - Stage 5 (Apprentice): 1200 XP
 * - Stage 6 (Scout): 2500 XP
 * - Stage 7 (Fledgling): 5000 XP
 * - Stage 8 (Warrior): 10000 XP
 * - Stage 9 (Guardian): 20000 XP
 * - Stage 10 (Champion): 35000 XP
 * - Stage 11 (Ascended): 50000 XP
 * - Stage 12 (Vanguard): 75000 XP
 * - Stage 13 (Titan): 100000 XP
 * - Stage 14 (Mythic): 150000 XP
 * - Stage 15 (Prime): 200000 XP
 * - Stage 16 (Regal): 300000 XP
 * - Stage 17 (Eternal): 450000 XP
 * - Stage 18 (Transcendent): 650000 XP
 * - Stage 19 (Apex): 1000000 XP
 * - Stage 20 (Ultimate): 1500000 XP
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
  0: 0,       // Egg
  1: 10,      // Hatchling (first quest completes this!)
  2: 120,     // Sproutling
  3: 250,     // Cub
  4: 500,     // Juvenile
  5: 1200,    // Apprentice
  6: 2500,    // Scout
  7: 5000,    // Fledgling
  8: 10000,   // Warrior
  9: 20000,   // Guardian
  10: 35000,  // Champion
  11: 50000,  // Ascended
  12: 75000,  // Vanguard
  13: 100000, // Titan
  14: 150000, // Mythic
  15: 200000, // Prime
  16: 300000, // Regal
  17: 450000, // Eternal
  18: 650000, // Transcendent
  19: 1000000, // Apex
  20: 1500000, // Ultimate
};

export const XP_SYSTEM_DOCS = {
  note: "See useXPRewards hook for implementation",
} as const;
