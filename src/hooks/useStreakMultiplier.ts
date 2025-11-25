import { useProfile } from "./useProfile";

export const useStreakMultiplier = () => {
  const { profile } = useProfile();
  
  const getStreakMultiplier = (): number => {
    const streak = profile?.current_habit_streak ?? 0;
    
    if (streak >= 30) return 2.0; // 2x XP at 30+ days (capped to prevent burnout)
    if (streak >= 7) return 1.5;  // 1.5x XP at 7-29 days
    return 1.0; // 1x XP for 0-6 days
  };

  const getNextMilestone = () => {
    const streak = profile?.current_habit_streak ?? 0;
    
    if (streak < 7) {
      return { days: 7, multiplier: 1.5, daysRemaining: 7 - streak };
    }
    if (streak < 30) {
      return { days: 30, multiplier: 2, daysRemaining: 30 - streak };
    }
    return { days: 30, multiplier: 2, daysRemaining: 0 };
  };

  return {
    currentStreak: profile?.current_habit_streak ?? 0,
    longestStreak: profile?.longest_habit_streak ?? 0,
    multiplier: getStreakMultiplier(),
    nextMilestone: getNextMilestone(),
  };
};
