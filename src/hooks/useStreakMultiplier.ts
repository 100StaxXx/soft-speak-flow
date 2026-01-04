import { useMemo } from "react";
import { useProfile } from "./useProfile";

export const useStreakMultiplier = () => {
  const { profile } = useProfile();
  
  return useMemo(() => {
    const currentStreak = profile?.current_habit_streak ?? 0;
    const longestStreak = profile?.longest_habit_streak ?? 0;
    
    // Calculate multiplier
    let multiplier = 1.0;
    if (currentStreak >= 30) {
      multiplier = 2.0; // 2x XP at 30+ days (capped to prevent burnout)
    } else if (currentStreak >= 7) {
      multiplier = 1.5; // 1.5x XP at 7-29 days
    }

    // Calculate next milestone
    let nextMilestone;
    if (currentStreak < 7) {
      nextMilestone = { days: 7, multiplier: 1.5, daysRemaining: 7 - currentStreak };
    } else if (currentStreak < 30) {
      nextMilestone = { days: 30, multiplier: 2, daysRemaining: 30 - currentStreak };
    } else {
      nextMilestone = { days: 30, multiplier: 2, daysRemaining: 0 };
    }

    return {
      currentStreak,
      longestStreak,
      multiplier,
      nextMilestone,
    };
  }, [profile?.current_habit_streak, profile?.longest_habit_streak]);
};
