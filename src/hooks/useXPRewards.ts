import { useCompanion, XP_REWARDS } from "@/hooks/useCompanion";
import { useXPToast } from "@/contexts/XPContext";
import { useCompanionAttributes } from "@/hooks/useCompanionAttributes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/utils/logger";
import { useStreakMultiplier } from "@/hooks/useStreakMultiplier";
 import { useLivingCompanionSafe } from "@/hooks/useLivingCompanion";
import {
  FOCUS_XP_REWARDS,
  SUBTASK_XP_REWARDS,
  PRIORITY_XP_REWARDS,
  INBOX_XP_REWARDS,
  PRODUCTIVITY_XP_REWARDS,
  SCHEDULING_XP_REWARDS,
  MILESTONE_XP_REWARDS,
} from "@/config/xpRewards";

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
    updateDisciplineFromRitual,
    updateWisdomFromLearning,
    updateAlignmentFromReflection,
    updateFromStreakMilestone,
  } = useCompanionAttributes();
 
   // Living companion reaction system - safe hook returns no-op when outside provider
   const { triggerQuestComplete } = useLivingCompanionSafe();
   
   // Helper to check if this is the first quest completion today
   const checkIsFirstQuestToday = async (): Promise<boolean> => {
     if (!user?.id) return false;
     const today = new Date().toISOString().split('T')[0];
     
     const { count } = await supabase
       .from('daily_tasks')
       .select('*', { count: 'exact', head: true })
       .eq('user_id', user.id)
       .eq('task_date', today)
       .eq('completed', true);
     
     // First if count is 0 (this will be the first) or 1 (just completed)
     return (count ?? 0) <= 1;
   };

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
        updateWisdomFromLearning(companionId).catch(err => {
          logger.error('Wisdom update failed:', err);
        });
        updateDisciplineFromRitual(companionId).catch(err => {
          logger.error('Discipline update failed:', err);
        });
      }
       
       // Trigger companion reaction for quest/habit completion with first-of-day gating
       checkIsFirstQuestToday().then(isFirst => {
         triggerQuestComplete(isFirst).catch(err => 
           logger.log('[LivingCompanion] Quest reaction failed:', err)
         );
       });
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
        updateAlignmentFromReflection(companionId).catch(err => {
          logger.error('Alignment update failed:', err);
        });
        updateDisciplineFromRitual(companionId).catch(err => {
          logger.error('Discipline update failed:', err);
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
        updateFromStreakMilestone({
          companionId,
          streakDays: milestone,
        }).catch(err => logger.error('Discipline streak update failed:', err));
        
        // Create streak memory for significant milestones (7, 30, 100 days)
        if (milestone === 7 || milestone === 30 || milestone === 100) {
          const today = new Date().toISOString().split('T')[0];
          supabase.from('companion_memories').insert({
            user_id: user?.id,
            companion_id: companionId,
            memory_type: 'streak',
            memory_date: today,
            memory_context: {
              title: `${milestone}-Day Streak`,
              description: `${milestone} days of dedication and growth together.`,
              emotion: milestone >= 30 ? 'joy' : 'pride',
              details: { streakDays: milestone },
            },
            referenced_count: 0,
          }).then(({ error }) => {
            if (error) logger.error('Failed to create streak memory:', error);
          });
        }
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
        updateAlignmentFromReflection(companionId).catch(err => 
          logger.error('Alignment update failed:', err)
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

  // ============================================
  // Focus Session XP Rewards (Pomodoro with daily cap)
  // ============================================
  
  const awardFocusSessionComplete = (isPerfect: boolean = false, isUnderCap: boolean = true) => {
    if (!companion || awardXP.isPending) return;

    let baseReward: number;
    let label: string;

    if (isUnderCap) {
      baseReward = FOCUS_XP_REWARDS.SESSION_COMPLETE;
      label = "Focus Session Complete!";

      // Add perfect focus bonus if no distractions
      if (isPerfect) {
        baseReward += FOCUS_XP_REWARDS.PERFECT_FOCUS_BONUS;
        label = "Perfect Focus! 🎯";
      }
    } else {
      baseReward = FOCUS_XP_REWARDS.CAPPED_SESSION_XP;
      label = isPerfect ? "Bonus Focus! 🎯" : "Bonus Focus Session!";
    }

    const reward = applyStreakMultiplier(baseReward);
    showXPToast(reward, label);
    awardXP.mutate({
      eventType: "focus_session",
      xpAmount: reward,
      metadata: { isPerfect, isUnderCap },
    });
  };

  // ============================================
  // NEW: Subtask XP Rewards
  // ============================================

  const awardSubtaskComplete = () => {
    if (!companion) return;
    const reward = SUBTASK_XP_REWARDS.SUBTASK_COMPLETE;
    showXPToast(reward, "Subtask Done!");
    awardXP.mutate({
      eventType: "subtask_complete",
      xpAmount: reward,
    });
  };

  const awardAllSubtasksComplete = () => {
    if (!companion) return;
    const reward = applyStreakMultiplier(SUBTASK_XP_REWARDS.ALL_SUBTASKS_BONUS);
    showXPToast(reward, "All Subtasks Complete! 🎉");
    awardXP.mutate({
      eventType: "all_subtasks_complete",
      xpAmount: reward,
    });
  };

  // ============================================
  // NEW: Priority System XP Rewards
  // ============================================

  const awardTopThreeComplete = () => {
    if (!companion) return;
    const reward = applyStreakMultiplier(PRIORITY_XP_REWARDS.TOP_THREE_COMPLETE);
    showXPToast(reward, "Top 3 Task Done! 🎯");
    awardXP.mutate({
      eventType: "top_three_complete",
      xpAmount: reward,
    });
  };

  const awardAllTopThreeComplete = () => {
    if (!companion) return;
    const reward = applyStreakMultiplier(PRIORITY_XP_REWARDS.ALL_TOP_THREE_BONUS);
    showXPToast(reward, "All Top 3 Complete! 🏆");
    awardXP.mutate({
      eventType: "all_top_three_complete",
      xpAmount: reward,
    });
  };

  const awardUrgentTaskComplete = () => {
    if (!companion) return;
    const reward = applyStreakMultiplier(PRIORITY_XP_REWARDS.URGENT_IMPORTANT);
    showXPToast(reward, "Urgent Task Done!");
    awardXP.mutate({
      eventType: "urgent_task_complete",
      xpAmount: reward,
    });
  };

  // ============================================
  // NEW: Inbox XP Rewards
  // ============================================

  const awardInboxProcessed = () => {
    if (!companion) return;
    const reward = INBOX_XP_REWARDS.PROCESS_INBOX;
    // Silent - no toast for small XP
    awardXP.mutate({
      eventType: "inbox_processed",
      xpAmount: reward,
    });
  };

  const awardInboxZero = () => {
    if (!companion) return;
    const reward = applyStreakMultiplier(INBOX_XP_REWARDS.INBOX_ZERO);
    showXPToast(reward, "Inbox Zero! 📭");
    awardXP.mutate({
      eventType: "inbox_zero",
      xpAmount: reward,
    });
  };

  const awardVoiceCapture = () => {
    if (!companion) return;
    const reward = INBOX_XP_REWARDS.VOICE_CAPTURE;
    // Silent - no toast for small XP
    awardXP.mutate({
      eventType: "voice_capture",
      xpAmount: reward,
    });
  };

  // ============================================
  // NEW: Productivity XP Rewards
  // ============================================

  const awardWeeklyReview = () => {
    if (!companion) return;
    const reward = applyStreakMultiplier(PRODUCTIVITY_XP_REWARDS.WEEKLY_REVIEW);
    showXPToast(reward, "Weekly Review Complete! 📊");
    awardXP.mutate({
      eventType: "weekly_review",
      xpAmount: reward,
    });
  };

  const awardDailyReview = () => {
    if (!companion) return;
    const reward = applyStreakMultiplier(PRODUCTIVITY_XP_REWARDS.DAILY_REVIEW);
    showXPToast(reward, "Daily Review Done!");
    awardXP.mutate({
      eventType: "daily_review",
      xpAmount: reward,
    });
  };

  const awardHighProductivityDay = () => {
    if (!companion) return;
    const reward = applyStreakMultiplier(PRODUCTIVITY_XP_REWARDS.HIGH_PRODUCTIVITY_DAY);
    showXPToast(reward, "Productive Day! 📈");
    awardXP.mutate({
      eventType: "high_productivity_day",
      xpAmount: reward,
    });
  };

  const awardPerfectDay = () => {
    if (!companion) return;
    const reward = applyStreakMultiplier(PRODUCTIVITY_XP_REWARDS.PERFECT_DAY);
    showXPToast(reward, "Perfect Day! ⭐");
    awardXP.mutate({
      eventType: "perfect_day",
      xpAmount: reward,
    });
  };

  // ============================================
  // NEW: Scheduling XP Rewards
  // ============================================

  const awardOnTimeCompletion = () => {
    if (!companion) return;
    const reward = SCHEDULING_XP_REWARDS.ON_TIME_COMPLETION;
    // Silent - no toast for small XP
    awardXP.mutate({
      eventType: "on_time_completion",
      xpAmount: reward,
    });
  };

  const awardContextMatch = () => {
    if (!companion) return;
    const reward = SCHEDULING_XP_REWARDS.CONTEXT_MATCH;
    // Silent - no toast for small XP
    awardXP.mutate({
      eventType: "context_match",
      xpAmount: reward,
    });
  };

  // ============================================
  // NEW: Milestone XP Rewards
  // ============================================

  const awardMilestoneComplete = (isPostcardMilestone: boolean = false) => {
    if (!companion || awardXP.isPending) return;

    const baseReward = isPostcardMilestone
      ? MILESTONE_XP_REWARDS.POSTCARD
      : MILESTONE_XP_REWARDS.REGULAR;
    const reward = applyStreakMultiplier(baseReward);
    const label = isPostcardMilestone ? "Celebration Milestone!" : "Milestone Complete!";

    showXPToast(reward, label);
    awardXP.mutate({
      eventType: isPostcardMilestone ? "postcard_milestone" : "milestone_complete",
      xpAmount: reward,
    });
  };

  const awardPhaseComplete = (phaseName: string) => {
    if (!companion || awardXP.isPending) return;
    const reward = applyStreakMultiplier(MILESTONE_XP_REWARDS.PHASE_COMPLETE);
    showXPToast(reward, `Phase Complete: ${phaseName}!`);
    awardXP.mutate({
      eventType: "phase_complete",
      xpAmount: reward,
      metadata: { phaseName },
    });
  };

  const awardEpicComplete = (epicTitle: string) => {
    if (!companion || awardXP.isPending) return;
    const reward = applyStreakMultiplier(MILESTONE_XP_REWARDS.EPIC_COMPLETE);
    showXPToast(reward, "Epic Complete! 🏆");
    awardXP.mutate({
      eventType: "epic_complete",
      xpAmount: reward,
      metadata: { epicTitle },
    });
    
    // Create epic complete memory (non-blocking)
    const companionId = companion.id;
    if (companionId && user?.id) {
      const today = new Date().toISOString().split('T')[0];
      supabase.from('companion_memories').insert({
        user_id: user.id,
        companion_id: companionId,
        memory_type: 'epic_complete',
        memory_date: today,
        memory_context: {
          title: 'Epic Complete',
          description: `We conquered "${epicTitle}" together!`,
          emotion: 'pride',
          details: { epicTitle },
        },
        referenced_count: 0,
      }).then(({ error }) => {
        if (error) logger.error('Failed to create epic memory:', error);
      });
    }
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
    if (displayReason && xpAmount > 0) {
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
    
    // Focus Session rewards
    awardFocusSessionComplete,
    
    // NEW: Subtask rewards
    awardSubtaskComplete,
    awardAllSubtasksComplete,
    
    // NEW: Priority rewards
    awardTopThreeComplete,
    awardAllTopThreeComplete,
    awardUrgentTaskComplete,
    
    // NEW: Inbox rewards
    awardInboxProcessed,
    awardInboxZero,
    awardVoiceCapture,
    
    // NEW: Productivity rewards
    awardWeeklyReview,
    awardDailyReview,
    awardHighProductivityDay,
    awardPerfectDay,
    
    // NEW: Scheduling rewards
    awardOnTimeCompletion,
    awardContextMatch,
    
    // NEW: Milestone rewards
    awardMilestoneComplete,
    awardPhaseComplete,
    awardEpicComplete,
    
    // Legacy aliases (for backward compatibility)
    awardCheckIn: awardCheckInComplete,
    awardChallengeComplete: awardChallengeCompletion,
    awardWeeklyChallenge: awardWeeklyChallengeCompletion,
    awardPepTalkListen: awardPepTalkListened,
    
    // XP constants for display
    XP_REWARDS,
    FOCUS_XP_REWARDS,
    SUBTASK_XP_REWARDS,
    PRIORITY_XP_REWARDS,
    INBOX_XP_REWARDS,
    PRODUCTIVITY_XP_REWARDS,
    SCHEDULING_XP_REWARDS,
    MILESTONE_XP_REWARDS,
  };
};
