import { useCompanion, XP_REWARDS } from "@/hooks/useCompanion";
import { useXPToast } from "@/contexts/XPContext";
import { useCompanionAttributes } from "@/hooks/useCompanionAttributes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/utils/logger";

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
    if (!companion || awardXP.isPending) return;
    
    try {
      // Mark user as active (resets companion decay)
      if (user?.id) {
        markUserActive(user.id).then(() => {
          queryClient.invalidateQueries({ queryKey: ['companion-health'] });
        });
      }
      
      showXPToast(XP_REWARDS.HABIT_COMPLETE, "Habit Completed!");
      awardXP.mutate({
        eventType: "habit_complete",
        xpAmount: XP_REWARDS.HABIT_COMPLETE,
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
    showXPToast(XP_REWARDS.ALL_HABITS_COMPLETE, "All Habits Complete!");
    awardXP.mutate({
      eventType: "all_habits_complete",
      xpAmount: XP_REWARDS.ALL_HABITS_COMPLETE,
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
    
    showXPToast(XP_REWARDS.CHALLENGE_COMPLETE, "Challenge Complete!");
    awardXP.mutate({
      eventType: "challenge_complete",
      xpAmount: XP_REWARDS.CHALLENGE_COMPLETE,
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
    
    showXPToast(XP_REWARDS.WEEKLY_CHALLENGE, "Weekly Challenge Done!");
    awardXP.mutate({
      eventType: "weekly_challenge",
      xpAmount: XP_REWARDS.WEEKLY_CHALLENGE,
    });
  };

  const awardPepTalkListened = (metadata?: Record<string, string | number | boolean | undefined>) => {
    if (!companion) return;
    showXPToast(XP_REWARDS.PEP_TALK_LISTEN, "Pep Talk Listened!");
    awardXP.mutate({
      eventType: "pep_talk_listen",
      xpAmount: XP_REWARDS.PEP_TALK_LISTEN,
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
      
      showXPToast(XP_REWARDS.CHECK_IN, "Check-In Complete!");
      awardXP.mutate({
        eventType: "check_in",
        xpAmount: XP_REWARDS.CHECK_IN,
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
      showXPToast(XP_REWARDS.STREAK_MILESTONE, `${milestone} Day Streak!`);
      awardXP.mutate({
        eventType: "streak_milestone",
        xpAmount: XP_REWARDS.STREAK_MILESTONE,
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
      showXPToast(XP_REWARDS.CHECK_IN, "Reflection Saved!");
      awardXP.mutate({
        eventType: "reflection",
        xpAmount: XP_REWARDS.CHECK_IN,
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
    showXPToast(XP_REWARDS.PEP_TALK_LISTEN, "Quote Shared!");
    awardXP.mutate({
      eventType: "quote_shared",
      xpAmount: XP_REWARDS.PEP_TALK_LISTEN,
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
    awardXP.mutate({
      eventType,
      xpAmount,
      metadata,
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
