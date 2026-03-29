import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type UserAction = 'accepted' | 'modified' | 'rejected';

interface TrackInteractionOptions {
  interactionId?: string;
  interactionType: string;
  inputText: string;
  detectedIntent?: string;
  aiResponse?: Record<string, unknown>;
  userAction: UserAction;
  modifications?: Record<string, unknown>;
}

interface UpdateLearningOptions {
  storyType?: string;
  themeColor?: string;
  category?: string;
  epicDuration?: number;
  habitDifficulty?: string;
  habitFrequency?: string;
  wasSuccessful: boolean;
}

async function invokeTracker(body: Record<string, unknown>) {
  const { error } = await supabase.functions.invoke('record-ai-interaction', {
    body,
  });

  if (error) {
    throw error;
  }
}

export function useAIInteractionTracker() {
  const { user } = useAuth();

  /**
   * Log a completed AI interaction with user's action
   * NOTE: This is non-blocking and should never throw errors that affect calling code
   */
  const trackInteraction = useCallback(async (options: TrackInteractionOptions) => {
    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== user.id) {
        return;
      }

      await invokeTracker({
        action: 'track_interaction',
        interactionType: options.interactionType,
        inputText: options.inputText,
        detectedIntent: options.detectedIntent,
        aiResponse: options.aiResponse,
        userAction: options.userAction,
        modifications: options.modifications,
      });
    } catch (err) {
      console.warn('Error tracking interaction (non-blocking):', err);
    }
  }, [user]);

  /**
   * Update learning profile with preference weights
   */
  const updatePreferenceWeights = useCallback(async (options: UpdateLearningOptions) => {
    if (!user) return;

    try {
      await invokeTracker({
        action: 'update_preferences',
        ...options,
      });
    } catch (err) {
      console.error('Error updating preference weights:', err);
    }
  }, [user]);

  /**
   * Track epic completion for learning
   */
  const trackEpicOutcome = useCallback(async (epicId: string, outcome: 'completed' | 'abandoned') => {
    if (!user) return;

    try {
      const { data: epic } = await supabase
        .from('epics')
        .select('story_type_slug, theme_color, target_days')
        .eq('id', epicId)
        .maybeSingle();

      if (!epic) return;

      const { data: epicHabits } = await supabase
        .from('epic_habits')
        .select('habits(difficulty, frequency, category, custom_days)')
        .eq('epic_id', epicId);

      const avgDifficulty = epicHabits?.length
        ? (epicHabits.reduce((acc, eh) => {
            const diff = (eh.habits as any)?.difficulty || 'medium';
            return acc + (diff === 'easy' ? 1 : diff === 'medium' ? 2 : 3);
          }, 0) / epicHabits.length)
        : 2;

      const difficultyLabel = avgDifficulty < 1.5 ? 'easy' : avgDifficulty < 2.5 ? 'medium' : 'hard';

      await updatePreferenceWeights({
        storyType: epic.story_type_slug || undefined,
        themeColor: epic.theme_color || undefined,
        epicDuration: epic.target_days,
        habitDifficulty: difficultyLabel,
        wasSuccessful: outcome === 'completed',
      });
    } catch (err) {
      console.error('Error tracking epic outcome:', err);
    }
  }, [user, updatePreferenceWeights]);

  /**
   * Track daily plan task outcomes for learning
   */
  const trackDailyPlanOutcome = useCallback(async (
    _taskId: string,
    outcome: 'completed' | 'skipped' | 'deleted' | 'rescheduled',
    metadata?: {
      scheduledTime?: string;
      actualCompletionTime?: string;
      difficulty?: string;
      category?: string;
      wasOnTime?: boolean;
    }
  ) => {
    if (!user) return;

    try {
      await invokeTracker({
        action: 'track_daily_plan_outcome',
        outcome,
        metadata,
      });
    } catch (err) {
      console.warn('Error tracking daily plan outcome (non-blocking):', err);
    }
  }, [user]);

  return {
    trackInteraction,
    updatePreferenceWeights,
    trackEpicOutcome,
    trackDailyPlanOutcome,
  };
}
