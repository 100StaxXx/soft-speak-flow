import { useCompanion, XP_REWARDS } from "@/hooks/useCompanion";
import { useEffect } from "react";

// Hook to award XP for various events
export const useXPRewards = () => {
  const { companion, awardXP } = useCompanion();

  const awardHabitCompletion = () => {
    if (!companion) return;
    awardXP.mutate({
      eventType: "habit_complete",
      xpAmount: XP_REWARDS.HABIT_COMPLETE,
    });
  };

  const awardAllHabitsComplete = () => {
    if (!companion) return;
    awardXP.mutate({
      eventType: "all_habits_complete",
      xpAmount: XP_REWARDS.ALL_HABITS_COMPLETE,
    });
  };

  const awardChallengeComplete = () => {
    if (!companion) return;
    awardXP.mutate({
      eventType: "challenge_complete",
      xpAmount: XP_REWARDS.CHALLENGE_COMPLETE,
    });
  };

  const awardWeeklyChallenge = () => {
    if (!companion) return;
    awardXP.mutate({
      eventType: "weekly_challenge",
      xpAmount: XP_REWARDS.WEEKLY_CHALLENGE,
    });
  };

  const awardPepTalkListen = () => {
    if (!companion) return;
    awardXP.mutate({
      eventType: "pep_talk_listen",
      xpAmount: XP_REWARDS.PEP_TALK_LISTEN,
    });
  };

  const awardCheckIn = () => {
    if (!companion) return;
    awardXP.mutate({
      eventType: "check_in",
      xpAmount: XP_REWARDS.CHECK_IN,
    });
  };

  const awardStreakMilestone = () => {
    if (!companion) return;
    awardXP.mutate({
      eventType: "streak_milestone",
      xpAmount: XP_REWARDS.STREAK_MILESTONE,
    });
  };

  return {
    awardHabitCompletion,
    awardAllHabitsComplete,
    awardChallengeComplete,
    awardWeeklyChallenge,
    awardPepTalkListen,
    awardCheckIn,
    awardStreakMilestone,
  };
};