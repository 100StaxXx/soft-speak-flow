import { useCompanion, XP_REWARDS } from "@/hooks/useCompanion";
import { useXPToast } from "@/contexts/XPContext";
import { useCompanionAttributes } from "@/hooks/useCompanionAttributes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/utils/logger";
import { useStreakMultiplier } from "@/hooks/useStreakMultiplier";

// Helper to mark user as active (resets companion decay)
const markUserActive = async (userId: string) => {
  const today = new Date().toISOString().split('T')[0];
  await supabase
    .from('user_companion')
    .update({
      last_activity_date: today,
      inactive_days: 0,
      current_mood: 'happy',
    })
    .eq('user_id', userId);
};

/**
 * Centralized XP reward system
 * Use these helpers instead of hard-coding XP values across components
 */
export const useXPRewards = () => {
  const { user } = useAuth();
  const { companion, awardXP } = useCompanion();
  const { showXPToast } = useXPToast();
  const queryClient = useQueryClient();
  const { multiplier: streakMultiplier } = useStreakMultiplier();
  const {
    updateBodyFromActivity,
    updateMindFromHabit,
    updateSoulFromReflection,
    updateSoulFromStreak,
  } = useCompanionAttributes();

  const applyStreakMultiplier = (baseAmount: number) => {
    const normalizedMultiplier = streakMultiplier ?? 1;
    return Math.round(baseAmount * normalizedMultiplier);
  };

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
    if (!companion || awardXP.isPending) return;
    
    try {
      // Mark user as active (resets companion decay)
      if (user?.id) {
        markUserActive(user.id).then(() => {
          queryClient.invalidateQueries({ queryKey: ['companion-health'] });
        });
      }
      
      const reward = applyStreakMultiplier(XP_REWARDS.HABIT_COMPLETE);
      showXPToast(reward, "Habit Completed!");
      awardXP.mutate({
        eventType: "habit_complete",
        xpAmount: reward,
      });
      
      // Update attributes in background without waiting - verify companion exists at call time
      const companionId = companion.id;
      if (companionId) {
        updateMindFromHabit(companionId).catch(err => {
          logger.error('Mind update failed:', err);
        });
        updateBodyFromActivity(companionId).catch(err => {
          logger.error('Body update failed:', err);
        });
      }
    } catch (error) {
      logger.error('Error awarding habit completion:', error);
    }
  };

  const awardAllHabitsComplete = () => {
    if (!companion) return;
    const reward = applyStreakMultiplier(XP_REWARDS.ALL_HABITS_COMPLETE);
    showXPToast(reward, "All Habits Complete!");
    awardXP.mutate({
      eventType: "all_habits_complete",
      xpAmount: reward,
    });
  };

  const awardChallengeCompletion = () => {
    if (!companion) return;
    
    // Mark user as active (resets companion decay)
    if (user?.id) {
      markUserActive(user.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['companion-health'] });
      });
    }
    
    const reward = applyStreakMultiplier(XP_REWARDS.CHALLENGE_COMPLETE);
    showXPToast(reward, "Challenge Complete!");
    awardXP.mutate({
      eventType: "challenge_complete",
      xpAmount: reward,
    });
  };

  const awardWeeklyChallengeCompletion = () => {
    if (!companion) return;
    
    // Mark user as active (resets companion decay)
    if (user?.id) {
      markUserActive(user.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['companion-health'] });
      });
    }
    
    const reward = applyStreakMultiplier(XP_REWARDS.WEEKLY_CHALLENGE);
    showXPToast(reward, "Weekly Challenge Done!");
    awardXP.mutate({
      eventType: "weekly_challenge",
      xpAmount: reward,
    });
  };

  const awardPepTalkListened = (metadata?: Record<string, string | number | boolean | undefined>) => {
    if (!companion) return;
    const reward = applyStreakMultiplier(XP_REWARDS.PEP_TALK_LISTEN);
    showXPToast(reward, "Pep Talk Listened!");
    awardXP.mutate({
      eventType: "pep_talk_listen",
      xpAmount: reward,
      metadata,
    });
  };

  const awardCheckInComplete = async () => {
    if (!companion || awardXP.isPending) return;

    try {
      // Mark user as active (resets companion decay)
      if (user?.id) {
        markUserActive(user.id).then(() => {
          queryClient.invalidateQueries({ queryKey: ['companion-health'] });
        });
      }
      
      const reward = applyStreakMultiplier(XP_REWARDS.CHECK_IN);
      showXPToast(reward, "Check-In Complete!");
      awardXP.mutate({
        eventType: "check_in",
        xpAmount: reward,
      });
      
      // Update attributes in background without waiting - verify companion exists at call time
      const companionId = companion.id;
      if (companionId) {
        updateSoulFromReflection(companionId).catch(err => {
          logger.error('Soul update failed:', err);
        });
        updateBodyFromActivity(companionId).catch(err => {
          logger.error('Body update failed:', err);
        });
      }
    } catch (error) {
      logger.error('Error awarding check-in:', error);
    }
  };

  const awardStreakMilestone = async (milestone: number) => {
    if (!companion || awardXP.isPending) return;
    
    try {
      const reward = applyStreakMultiplier(XP_REWARDS.STREAK_MILESTONE);
      showXPToast(reward, `${milestone} Day Streak!`);
      awardXP.mutate({
        eventType: "streak_milestone",
        xpAmount: reward,
        metadata: { milestone },
      });
      
      // Update soul in background without waiting - verify companion exists at call time
      const companionId = companion.id;
      if (companionId) {
        updateSoulFromStreak({
          companionId,
          streakDays: milestone,
        }).catch(err => logger.error('Soul streak update failed:', err));
      }
    } catch (error) {
      logger.error('Error awarding streak milestone:', error);
    }
  };

  const awardReflectionComplete = async () => {
    if (!companion || awardXP.isPending) return;
    
    try {
      const reward = applyStreakMultiplier(XP_REWARDS.CHECK_IN);
      showXPToast(reward, "Reflection Saved!");
      awardXP.mutate({
        eventType: "reflection",
        xpAmount: reward,
      });
      
      // Update soul in background without waiting - verify companion exists at call time
      const companionId = companion.id;
      if (companionId) {
        updateSoulFromReflection(companionId).catch(err => 
          logger.error('Soul update failed:', err)
        );
      }
    } catch (error) {
      logger.error('Error awarding reflection:', error);
    }
  };

  const awardQuoteShared = () => {
    if (!companion) return;
    const reward = applyStreakMultiplier(XP_REWARDS.PEP_TALK_LISTEN);
    showXPToast(reward, "Quote Shared!");
    awardXP.mutate({
      eventType: "quote_shared",
      xpAmount: reward,
    });
  };

  const awardCustomXP = async (xpAmount: number, eventType: string, displayReason?: string, metadata?: Record<string, string | number | boolean | undefined>) => {
    // Guard: Don't attempt XP award if companion not loaded or mutation in progress
    if (!companion) {
      logger.warn('Cannot award XP: companion not loaded yet');
      return;
    }
    if (awardXP.isPending) {
      logger.warn('Cannot award XP: previous award still in progress');
      return;
    }
    if (displayReason) {
      showXPToast(xpAmount, displayReason);
    }

    try {
      await awardXP.mutateAsync({
        eventType,
        xpAmount,
        metadata,
      });
    } catch (error) {
      logger.error('Error awarding custom XP:', error);
    }
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
