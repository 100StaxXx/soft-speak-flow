import { useCompanion, XP_REWARDS } from "@/hooks/useCompanion";
import { useXPToast } from "@/contexts/XPContext";
import { useCompanionAttributes } from "@/hooks/useCompanionAttributes";
import { useQueryClient } from "@tanstack/react-query";
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

type XPEventMetadata = Record<string, string | number | boolean | undefined>;
const REPEATABLE_STREAK_EVENTS = new Set(["task_complete", "habit_complete", "focus_session"]);

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

  const applyStreakMultiplier = (baseAmount: number, eventType: string) => {
    if (!REPEATABLE_STREAK_EVENTS.has(eventType)) return baseAmount;
    const normalizedMultiplier = streakMultiplier ?? 1;
    return Math.round(baseAmount * normalizedMultiplier);
  };

  const createIdempotencyKey = (eventType: string, metadata?: XPEventMetadata) => {
    const metadataDigest = metadata
      ? Object.entries(metadata)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => `${key}:${String(value)}`)
          .sort()
          .join("|")
      : "none";
    const randomPart = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `${eventType}:${metadataDigest}:${randomPart}`;
  };

  const awardXPEvent = (
    eventType: string,
    xpAmount: number,
    metadata?: XPEventMetadata,
    idempotencyKey?: string,
  ) => {
    awardXP.mutate({
      eventType,
      xpAmount,
      metadata,
      idempotencyKey: idempotencyKey ?? createIdempotencyKey(eventType, metadata),
    });
  };

  const awardXPEventAsync = (
    eventType: string,
    xpAmount: number,
    metadata?: XPEventMetadata,
    idempotencyKey?: string,
  ) => {
    return awardXP.mutateAsync({
      eventType,
      xpAmount,
      metadata,
      idempotencyKey: idempotencyKey ?? createIdempotencyKey(eventType, metadata),
    });
  };

  const awardHabitCompletion = async () => {
    if (!companion || awardXP.isPending) return;
    
    try {
      // Mark user as active (resets companion decay)
      if (user?.id) {
        markUserActive(user.id).then(() => {
          queryClient.invalidateQueries({ queryKey: ['companion-health'] });
        });
      }
      
      const reward = applyStreakMultiplier(XP_REWARDS.HABIT_COMPLETE, "habit_complete");
      showXPToast(reward, "Habit Completed!");
      awardXPEvent("habit_complete", reward);
      
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
    const reward = XP_REWARDS.ALL_HABITS_COMPLETE;
    showXPToast(reward, "All Habits Complete!");
    awardXPEvent("all_habits_complete", reward);
  };

  const awardChallengeCompletion = () => {
    if (!companion) return;
    
    // Mark user as active (resets companion decay)
    if (user?.id) {
      markUserActive(user.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['companion-health'] });
      });
    }
    
    const reward = XP_REWARDS.CHALLENGE_COMPLETE;
    showXPToast(reward, "Challenge Complete!");
    awardXPEvent("challenge_complete", reward);
  };

  const awardWeeklyChallengeCompletion = () => {
    if (!companion) return;
    
    // Mark user as active (resets companion decay)
    if (user?.id) {
      markUserActive(user.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['companion-health'] });
      });
    }
    
    const reward = XP_REWARDS.WEEKLY_CHALLENGE;
    showXPToast(reward, "Weekly Challenge Done!");
    awardXPEvent("weekly_challenge", reward);
  };

  const awardPepTalkListened = (metadata?: Record<string, string | number | boolean | undefined>) => {
    if (!companion) return;
    const reward = XP_REWARDS.PEP_TALK_LISTEN;
    showXPToast(reward, "Pep Talk Listened!");
    awardXPEvent("pep_talk_listen", reward, metadata);
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
      
      const reward = XP_REWARDS.CHECK_IN;
      showXPToast(reward, "Check-In Complete!");
      awardXPEvent("check_in", reward);
      
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
      const reward = XP_REWARDS.STREAK_MILESTONE;
      showXPToast(reward, `${milestone} Day Streak!`);
      awardXPEvent("streak_milestone", reward, { milestone });
      
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
      const reward = XP_REWARDS.EVENING_REFLECTION;
      showXPToast(reward, "Reflection Saved!");
      awardXPEvent("evening_reflection", reward);
      
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
    const reward = XP_REWARDS.PEP_TALK_LISTEN;
    showXPToast(reward, "Quote Shared!");
    awardXPEvent("quote_shared", reward);
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

    const reward = applyStreakMultiplier(baseReward, "focus_session");
    showXPToast(reward, label);
    awardXPEvent("focus_session", reward, { isPerfect, isUnderCap });
  };

  // ============================================
  // NEW: Subtask XP Rewards
  // ============================================

  const awardSubtaskComplete = () => {
    if (!companion) return;
    const reward = SUBTASK_XP_REWARDS.SUBTASK_COMPLETE;
    showXPToast(reward, "Subtask Done!");
    awardXPEvent("subtask_complete", reward);
  };

  const awardAllSubtasksComplete = () => {
    if (!companion) return;
    const reward = SUBTASK_XP_REWARDS.ALL_SUBTASKS_BONUS;
    showXPToast(reward, "All Subtasks Complete! 🎉");
    awardXPEvent("all_subtasks_complete", reward);
  };

  // ============================================
  // NEW: Priority System XP Rewards
  // ============================================

  const awardTopThreeComplete = () => {
    if (!companion) return;
    const reward = PRIORITY_XP_REWARDS.TOP_THREE_COMPLETE;
    showXPToast(reward, "Top 3 Task Done! 🎯");
    awardXPEvent("top_three_complete", reward);
  };

  const awardAllTopThreeComplete = () => {
    if (!companion) return;
    const reward = PRIORITY_XP_REWARDS.ALL_TOP_THREE_BONUS;
    showXPToast(reward, "All Top 3 Complete! 🏆");
    awardXPEvent("all_top_three_complete", reward);
  };

  const awardUrgentTaskComplete = () => {
    if (!companion) return;
    const reward = PRIORITY_XP_REWARDS.URGENT_IMPORTANT;
    showXPToast(reward, "Urgent Task Done!");
    awardXPEvent("urgent_task_complete", reward);
  };

  // ============================================
  // NEW: Inbox XP Rewards
  // ============================================

  const awardInboxProcessed = () => {
    if (!companion) return;
    const reward = INBOX_XP_REWARDS.PROCESS_INBOX;
    // Silent - no toast for small XP
    awardXPEvent("inbox_processed", reward);
  };

  const awardInboxZero = () => {
    if (!companion) return;
    const reward = INBOX_XP_REWARDS.INBOX_ZERO;
    showXPToast(reward, "Inbox Zero! 📭");
    awardXPEvent("inbox_zero", reward);
  };

  const awardVoiceCapture = () => {
    if (!companion) return;
    const reward = INBOX_XP_REWARDS.VOICE_CAPTURE;
    // Silent - no toast for small XP
    awardXPEvent("voice_capture", reward);
  };

  // ============================================
  // NEW: Productivity XP Rewards
  // ============================================

  const awardWeeklyReview = () => {
    if (!companion) return;
    const reward = PRODUCTIVITY_XP_REWARDS.WEEKLY_REVIEW;
    showXPToast(reward, "Weekly Review Complete! 📊");
    awardXPEvent("weekly_review", reward);
  };

  const awardDailyReview = () => {
    if (!companion) return;
    const reward = PRODUCTIVITY_XP_REWARDS.DAILY_REVIEW;
    showXPToast(reward, "Daily Review Done!");
    awardXPEvent("daily_review", reward);
  };

  const awardHighProductivityDay = () => {
    if (!companion) return;
    const reward = PRODUCTIVITY_XP_REWARDS.HIGH_PRODUCTIVITY_DAY;
    showXPToast(reward, "Productive Day! 📈");
    awardXPEvent("high_productivity_day", reward);
  };

  const awardPerfectDay = () => {
    if (!companion) return;
    const reward = PRODUCTIVITY_XP_REWARDS.PERFECT_DAY;
    showXPToast(reward, "Perfect Day! ⭐");
    awardXPEvent("perfect_day", reward);
  };

  // ============================================
  // NEW: Scheduling XP Rewards
  // ============================================

  const awardOnTimeCompletion = () => {
    if (!companion) return;
    const reward = SCHEDULING_XP_REWARDS.ON_TIME_COMPLETION;
    // Silent - no toast for small XP
    awardXPEvent("on_time_completion", reward);
  };

  const awardContextMatch = () => {
    if (!companion) return;
    const reward = SCHEDULING_XP_REWARDS.CONTEXT_MATCH;
    // Silent - no toast for small XP
    awardXPEvent("context_match", reward);
  };

  // ============================================
  // NEW: Milestone XP Rewards
  // ============================================

  const awardMilestoneComplete = (isPostcardMilestone: boolean = false) => {
    if (!companion || awardXP.isPending) return;

    const baseReward = isPostcardMilestone
      ? MILESTONE_XP_REWARDS.POSTCARD
      : MILESTONE_XP_REWARDS.REGULAR;
    const reward = baseReward;
    const label = isPostcardMilestone ? "Celebration Milestone!" : "Milestone Complete!";

    showXPToast(reward, label);
    awardXPEvent(isPostcardMilestone ? "postcard_milestone" : "milestone_complete", reward);
  };

  const awardPhaseComplete = (phaseName: string) => {
    if (!companion || awardXP.isPending) return;
    const reward = MILESTONE_XP_REWARDS.PHASE_COMPLETE;
    showXPToast(reward, `Phase Complete: ${phaseName}!`);
    awardXPEvent("phase_complete", reward, { phaseName });
  };

  const awardEpicComplete = (epicTitle: string) => {
    if (!companion || awardXP.isPending) return;
    const reward = MILESTONE_XP_REWARDS.EPIC_COMPLETE;
    showXPToast(reward, "Epic Complete! 🏆");
    awardXPEvent("epic_complete", reward, { epicTitle });
    
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

  const awardCustomXP = async (
    xpAmount: number,
    eventType: string,
    displayReason?: string,
    metadata?: XPEventMetadata,
  ) => {
    // Guard: Don't attempt XP award if companion not loaded or mutation in progress
    if (!companion) {
      logger.warn('Cannot award XP: companion not loaded yet');
      return;
    }
    if (awardXP.isPending) {
      logger.warn('Cannot award XP: previous award still in progress');
      return;
    }
    const effectiveAmount = applyStreakMultiplier(xpAmount, eventType);
    if (displayReason && effectiveAmount > 0) {
      showXPToast(effectiveAmount, displayReason);
    }

    try {
      return await awardXPEventAsync(eventType, effectiveAmount, metadata);
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
