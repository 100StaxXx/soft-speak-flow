import { useMemo } from "react";
import { useProfile } from "./useProfile";

export const useStreakMultiplier = () => {
  const { profile } = useProfile();
  
  return useMemo(() => {
    const currentStreak = profile?.current_habit_streak ?? 0;
    const longestStreak = profile?.longest_habit_streak ?? 0;
    
    // Calculate multiplier
    let multiplier = 1.0;
    if (currentStreak >= 60) {
      multiplier = 1.75;
    } else if (currentStreak >= 30) {
      multiplier = 1.5;
    } else if (currentStreak >= 7) {
      multiplier = 1.25;
    }

    // Calculate next milestone
    let nextMilestone;
    if (currentStreak < 7) {
      nextMilestone = { days: 7, multiplier: 1.25, daysRemaining: 7 - currentStreak };
    } else if (currentStreak < 30) {
      nextMilestone = { days: 30, multiplier: 1.5, daysRemaining: 30 - currentStreak };
    } else if (currentStreak < 60) {
      nextMilestone = { days: 60, multiplier: 1.75, daysRemaining: 60 - currentStreak };
    } else {
      nextMilestone = { days: 60, multiplier: 1.75, daysRemaining: 0 };
    }

    return {
      currentStreak,
      longestStreak,
      multiplier,
      nextMilestone,
    };
  }, [profile?.current_habit_streak, profile?.longest_habit_streak]);
};
