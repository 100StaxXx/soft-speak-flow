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
 * - Stage 1 (Hatchling): 5 XP (first quest!)
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

export const XP_SYSTEM_DOCS = {
  note: "See useXPRewards hook for implementation",
} as const;
