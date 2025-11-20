import { useCompanion, XP_REWARDS } from "@/hooks/useCompanion";
import { useXPToast } from "@/contexts/XPContext";
import { useCompanionAttributes } from "@/hooks/useCompanionAttributes";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCallback } from "react";

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

  const awardHabitCompletion = useCallback(async () => {
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
  }, [companion, showXPToast, awardXP, updateMindFromHabit, updateBodyFromActivity]);

  const awardAllHabitsComplete = useCallback(() => {
    if (!companion) return;
    showXPToast(XP_REWARDS.ALL_HABITS_COMPLETE, "All Habits Complete!");
    awardXP.mutate({
      eventType: "all_habits_complete",
      xpAmount: XP_REWARDS.ALL_HABITS_COMPLETE,
    });
  }, [companion, showXPToast, awardXP]);

  const awardChallengeCompletion = useCallback(() => {
    if (!companion) return;
    showXPToast(XP_REWARDS.CHALLENGE_COMPLETE, "Challenge Complete!");
    awardXP.mutate({
      eventType: "challenge_complete",
      xpAmount: XP_REWARDS.CHALLENGE_COMPLETE,
    });
  }, [companion, showXPToast, awardXP]);

  const awardWeeklyChallengeCompletion = useCallback(() => {
    if (!companion) return;
    showXPToast(XP_REWARDS.WEEKLY_CHALLENGE, "Weekly Challenge Done!");
    awardXP.mutate({
      eventType: "weekly_challenge",
      xpAmount: XP_REWARDS.WEEKLY_CHALLENGE,
    });
  }, [companion, showXPToast, awardXP]);

  const awardPepTalkListened = useCallback(() => {
    if (!companion) return;
    showXPToast(XP_REWARDS.PEP_TALK_LISTEN, "Pep Talk Listened!");
    awardXP.mutate({
      eventType: "pep_talk_listen",
      xpAmount: XP_REWARDS.PEP_TALK_LISTEN,
    });
  }, [companion, showXPToast, awardXP]);

  const awardCheckInComplete = useCallback(async () => {
    if (!companion) return;
    
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
  }, [companion, showXPToast, awardXP, updateSoulFromReflection, updateBodyFromActivity]);

  const awardStreakMilestone = useCallback(async (milestone: number) => {
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
  }, [companion, showXPToast, awardXP, updateSoulFromStreak]);

  const awardReflectionComplete = useCallback(async () => {
    if (!companion) return;
    
    try {
      showXPToast(5, "Reflection Complete!");
      awardXP.mutate({
        eventType: "reflection_complete",
        xpAmount: 5,
      });
      
      // Update soul from reflection
      await updateSoulFromReflection(companion.id);
    } catch (error) {
      console.error('Error awarding reflection:', error);
    }
  }, [companion, showXPToast, awardXP, updateSoulFromReflection]);

  const awardQuoteShared = useCallback(() => {
    if (!companion) return;
    showXPToast(3, "Quote Shared!");
    awardXP.mutate({
      eventType: "quote_shared",
      xpAmount: 3,
    });
  }, [companion, showXPToast, awardXP]);

  const awardMissionComplete = useCallback((xpReward: number) => {
    if (!companion) return;
    showXPToast(xpReward, "Mission Complete!");
    awardXP.mutate({
      eventType: "mission_complete",
      xpAmount: xpReward,
    });
  }, [companion, showXPToast, awardXP]);

  const awardCustomXP = useCallback((xpAmount: number, eventType: string, reason: string) => {
    if (!companion) return;
    showXPToast(xpAmount, reason);
    awardXP.mutate({
      eventType,
      xpAmount,
    });
  }, [companion, showXPToast, awardXP]);

  return {
    awardHabitCompletion,
    awardAllHabitsComplete,
    awardChallengeCompletion,
    awardWeeklyChallengeCompletion,
    awardPepTalkListened,
    awardCheckInComplete,
    awardStreakMilestone,
    awardReflectionComplete,
    awardQuoteShared,
    awardMissionComplete,
    awardCustomXP,
    XP_REWARDS,
  };
};