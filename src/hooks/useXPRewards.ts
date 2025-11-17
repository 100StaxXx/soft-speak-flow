import { useCompanion, XP_REWARDS } from "@/hooks/useCompanion";
import { useXPToast } from "@/contexts/XPContext";

/**
 * Centralized XP reward system
 * Use these helpers instead of hard-coding XP values across components
 */
export const useXPRewards = () => {
  const { companion, awardXP } = useCompanion();
  const { showXPToast } = useXPToast();

  const awardHabitCompletion = () => {
    if (!companion) return;
    showXPToast(XP_REWARDS.HABIT_COMPLETE, "Habit Completed!");
    awardXP.mutate({
      eventType: "habit_complete",
      xpAmount: XP_REWARDS.HABIT_COMPLETE,
    });
  };

  const awardAllHabitsComplete = () => {
    if (!companion) return;
    showXPToast(XP_REWARDS.ALL_HABITS_COMPLETE, "All Habits Complete!");
    awardXP.mutate({
      eventType: "all_habits_complete",
      xpAmount: XP_REWARDS.ALL_HABITS_COMPLETE,
    });
  };

  const awardChallengeCompletion = () => {
    if (!companion) return;
    showXPToast(XP_REWARDS.CHALLENGE_COMPLETE, "Challenge Complete!");
    awardXP.mutate({
      eventType: "challenge_complete",
      xpAmount: XP_REWARDS.CHALLENGE_COMPLETE,
    });
  };

  const awardWeeklyChallengeCompletion = () => {
    if (!companion) return;
    showXPToast(XP_REWARDS.WEEKLY_CHALLENGE, "Weekly Challenge Done!");
    awardXP.mutate({
      eventType: "weekly_challenge",
      xpAmount: XP_REWARDS.WEEKLY_CHALLENGE,
    });
  };

  const awardPepTalkListened = () => {
    if (!companion) return;
    showXPToast(XP_REWARDS.PEP_TALK_LISTEN, "Pep Talk Listened!");
    awardXP.mutate({
      eventType: "pep_talk_listen",
      xpAmount: XP_REWARDS.PEP_TALK_LISTEN,
    });
  };

  const awardCheckInComplete = () => {
    if (!companion) return;
    showXPToast(XP_REWARDS.CHECK_IN, "Check-In Complete!");
    awardXP.mutate({
      eventType: "check_in",
      xpAmount: XP_REWARDS.CHECK_IN,
    });
  };

  const awardStreakMilestone = (milestone: number) => {
    if (!companion) return;
    showXPToast(XP_REWARDS.STREAK_MILESTONE, `${milestone} Day Streak!`);
    awardXP.mutate({
      eventType: "streak_milestone",
      xpAmount: XP_REWARDS.STREAK_MILESTONE,
      metadata: { milestone },
    });
  };

  const awardReflectionComplete = () => {
    if (!companion) return;
    showXPToast(XP_REWARDS.CHECK_IN, "Reflection Saved!");
    awardXP.mutate({
      eventType: "reflection",
      xpAmount: XP_REWARDS.CHECK_IN,
    });
  };

  const awardQuoteShared = () => {
    if (!companion) return;
    showXPToast(XP_REWARDS.PEP_TALK_LISTEN, "Quote Shared!");
    awardXP.mutate({
      eventType: "quote_shared",
      xpAmount: XP_REWARDS.PEP_TALK_LISTEN,
    });
  };

  const awardCustomXP = async (xpAmount: number, eventType: string, displayReason?: string) => {
    if (!companion) return;
    if (displayReason) {
      showXPToast(xpAmount, displayReason);
    }
    awardXP.mutate({
      eventType,
      xpAmount,
    });
  };

  return {
    // Primary XP awards matching your spec
    awardHabitCompletion,
    awardAllHabitsComplete,
    awardChallengeCompletion,
    awardWeeklyChallengeCompletion,
    awardPepTalkListened,
    awardCheckInComplete,
    
    // Additional XP awards
    awardStreakMilestone,
    awardReflectionComplete,
    awardQuoteShared,
    awardCustomXP,
    
    // Legacy aliases (for backward compatibility)
    awardCheckIn: awardCheckInComplete,
    awardChallengeComplete: awardChallengeCompletion,
    awardWeeklyChallenge: awardWeeklyChallengeCompletion,
    awardPepTalkListen: awardPepTalkListened,
    
    // XP constants for display
    XP_REWARDS,
  };
};