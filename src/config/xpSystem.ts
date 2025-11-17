/**
 * XP System Configuration & Reference
 * 
 * All XP rewards are centralized in useXPRewards hook.
 * Use the hook helpers instead of hard-coding XP values.
 * 
 * XP VALUES (Difficulty-Based System):
 * - Easy Habit: 5 XP
 * - Medium Habit: 10 XP
 * - Hard Habit: 20 XP
 * - All Habits Complete (daily bonus): 10 XP
 * - Check-in: 5 XP
 * - Pep Talk Listened (80%+): 3 XP
 * - Daily Missions: 5-20 XP (varies by mission)
 * - Streak Milestone: 15 XP
 * 
 * EVOLUTION THRESHOLDS:
 * - Stage 0 (Egg): 0 XP
 * - Stage 1 (Sparkling Egg): 10 XP (Tutorial-optimized)
 * - Stage 2 (Hatchling): 60 XP
 * - Stage 3 (Guardian): 120 XP
 * - Stage 4 (Ascended): 250 XP
 * - Stage 5 (Mythic): 500 XP
 * - Stage 6 (Titan): 1200 XP
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
