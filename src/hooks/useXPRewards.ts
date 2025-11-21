import { useCompanion, XP_REWARDS } from "@/hooks/useCompanion";
import { useXPToast } from "@/contexts/XPContext";
import { useCompanionAttributes } from "@/hooks/useCompanionAttributes";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Centralized XP reward system
 * Use these helpers instead of hard-coding XP values across components
 */
export const useXPRewards = () => {
  const { user } = useAuth();
  const { companion, awardXP } = useCompanion();
  const { showXPToast } = useXPToast();
  const {
    updateBodyFromActivity,
    updateMindFromHabit,
    updateSoulFromReflection,
    updateSoulFromStreak,
  } = useCompanionAttributes();

  // Fetch current habit streak for resilience updates
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('current_habit_streak')
        .eq('id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const awardHabitCompletion = async () => {
    if (!companion) return;
    
    try {
      showXPToast(XP_REWARDS.HABIT_COMPLETE, "Habit Completed!");
      awardXP.mutate({
        eventType: "habit_complete",
        xpAmount: XP_REWARDS.HABIT_COMPLETE,
      });
      
      // Update companion attributes sequentially to avoid race conditions
      await updateMindFromHabit(companion.id);
      await updateBodyFromActivity(companion.id);
    } catch (error) {
      console.error('Error awarding habit completion:', error);
    }
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

  const awardCheckInComplete = async () => {
    if (!companion || awardXP.isPending) return;

    try {
      showXPToast(XP_REWARDS.CHECK_IN, "Check-In Complete!");
      awardXP.mutate({
        eventType: "check_in",
        xpAmount: XP_REWARDS.CHECK_IN,
      });
      
      // Update companion attributes sequentially
      await updateSoulFromReflection(companion.id);
      await updateBodyFromActivity(companion.id);
    } catch (error) {
      console.error('Error awarding check-in:', error);
    }
  };

  const awardStreakMilestone = async (milestone: number) => {
    if (!companion) return;
    
    try {
      showXPToast(XP_REWARDS.STREAK_MILESTONE, `${milestone} Day Streak!`);
      awardXP.mutate({
        eventType: "streak_milestone",
        xpAmount: XP_REWARDS.STREAK_MILESTONE,
        metadata: { milestone },
      });
      
      // Update companion soul
      await updateSoulFromStreak({
        companionId: companion.id,
        streakDays: milestone,
      });
    } catch (error) {
      console.error('Error awarding streak milestone:', error);
    }
  };

  const awardReflectionComplete = async () => {
    if (!companion) return;
    
    try {
      showXPToast(XP_REWARDS.CHECK_IN, "Reflection Saved!");
      awardXP.mutate({
        eventType: "reflection",
        xpAmount: XP_REWARDS.CHECK_IN,
      });
      
      // Update companion soul
      await updateSoulFromReflection(companion.id);
    } catch (error) {
      console.error('Error awarding reflection:', error);
    }
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
    if (!companion) {
      console.warn('Attempted to award XP without companion');
      return;
    }
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
