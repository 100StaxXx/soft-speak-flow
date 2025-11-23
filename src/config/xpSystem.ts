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
 * EVOLUTION THRESHOLDS (Stage 1 removed, all shifted down):
 * - Stage 0 (Egg): 0 XP
 * - Stage 1 (Hatchling): 10 XP (first quest!)
 * - Stage 2 (Guardian): 120 XP
 * - Stage 3 (Ascended): 250 XP
 * - Stage 4 (Mythic): 500 XP
 * - Stage 5 (Titan): 1200 XP
 * ... continues to Stage 20 (Ultimate)
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
  0: 0,      // Egg
  1: 10,     // Hatchling (first quest completes this!)
  2: 120,    // Guardian (was stage 3)
  3: 250,    // Ascended (was stage 4)
  4: 500,    // Mythic (was stage 5)
  5: 1200,   // Titan (was stage 6)
  6: 2500,   // (was stage 7)
  7: 5000,   // (was stage 8)
  8: 10000,  // (was stage 9)
  9: 20000,  // (was stage 10)
  10: 35000, // (was stage 11)
  11: 50000, // (was stage 12)
  12: 75000, // (was stage 13)
  13: 100000, // (was stage 14)
  14: 150000, // (was stage 15)
  15: 200000, // (was stage 16)
  16: 300000, // (was stage 17)
  17: 450000, // (was stage 18)
  18: 650000, // (was stage 19)
  19: 1000000, // (was stage 20)
  20: 1500000, // NEW Ultimate stage
};

export const XP_SYSTEM_DOCS = {
  note: "See useXPRewards hook for implementation",
} as const;
