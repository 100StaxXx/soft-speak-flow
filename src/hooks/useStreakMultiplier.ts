import { useProfile } from "./useProfile";

export const useStreakMultiplier = () => {
  const { profile } = useProfile();
  
  const getStreakMultiplier = (): number => {
    const streak = profile?.current_habit_streak ?? 0;
    
    if (streak >= 30) return 3; // 3x XP at 30+ days
    if (streak >= 7) return 2;  // 2x XP at 7-29 days
    return 1; // 1x XP for 0-6 days
  };

  const getNextMilestone = () => {
    const streak = profile?.current_habit_streak ?? 0;
    
    if (streak < 7) {
      return { days: 7, multiplier: 2, daysRemaining: 7 - streak };
    }
    if (streak < 30) {
      return { days: 30, multiplier: 3, daysRemaining: 30 - streak };
    }
    return { days: 30, multiplier: 3, daysRemaining: 0 };
  };

  return {
    currentStreak: profile?.current_habit_streak ?? 0,
    longestStreak: profile?.longest_habit_streak ?? 0,
    multiplier: getStreakMultiplier(),
    nextMilestone: getNextMilestone(),
  };
};
