/**
 * XP System Configuration & Reference
 *
 * All XP rewards are centralized in @/config/xpRewards.ts
 * Import from there instead of hard-coding XP values.
 *
 * XP VALUES (Rebalanced 2025-11-25):
 *
 * QUESTS (One-time missions, max 4/day):
 * - Easy Quest: 8 XP
 * - Medium Quest: 16 XP
 * - Hard Quest: 28 XP
 * - Main Quest Multiplier: 1.5x
 *
 * HABITS (Recurring daily activities, max 2 active):
 * - Easy Habit: 8 XP
 * - Medium Habit: 14 XP
 * - Hard Habit: 24 XP
 * - All Habits Complete (daily bonus): 15 XP
 *
 * SYSTEM ACTIVITIES:
 * - Check-in: 3 XP (quick tap)
 * - Pep Talk Listened (80%+): 8 XP (requires engagement)
 * - Streak Milestone: 15 XP
 * - Challenge Day: 25 XP
 * - Weekly Challenge: 60 XP
 * 
 * STREAK MULTIPLIERS:
 * - 0-6 days: 1.0x XP
 * - 7-29 days: 1.5x XP
 * - 30+ days: 2.0x XP (capped to prevent burnout)
 * 
 * GUILD BONUS:
 * - +10% XP on quests when in active guild
 * 
 * EVOLUTION THRESHOLDS (21-Stage System, Rebalanced 2025-11-25):
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
 * Timeline: ~8-10 months to reach Ultimate with consistent play (~150 XP/day)
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

// 21-Stage Evolution System: Rebalanced for achievable progression (2025-11-25)
// Stage 20 now reachable in 8-10 months with consistent play
// Database table evolution_thresholds is the source of truth
export const EVOLUTION_THRESHOLDS: Record<number, number> = {
  0: 0,       // Egg
  1: 10,      // Hatchling (first quest completes this!)
  2: 100,     // Sproutling
  3: 250,     // Cub
  4: 450,     // Juvenile
  5: 800,     // Apprentice
  6: 1300,    // Scout
  7: 2000,    // Fledgling
  8: 2900,    // Warrior
  9: 4000,    // Guardian
  10: 5400,   // Champion
  11: 7100,   // Ascended
  12: 9100,   // Vanguard
  13: 11400,  // Titan
  14: 14000,  // Mythic
  15: 17000,  // Prime
  16: 20400,  // Regal
  17: 24200,  // Eternal
  18: 28400,  // Transcendent
  19: 33000,  // Apex
  20: 38000,  // Ultimate
};

export const XP_SYSTEM_DOCS = {
  note: "See useXPRewards hook for implementation",
} as const;
