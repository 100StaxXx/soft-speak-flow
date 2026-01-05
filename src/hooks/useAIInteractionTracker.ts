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

export function useAIInteractionTracker() {
  const { user } = useAuth();

  /**
   * Log a completed AI interaction with user's action
   * NOTE: This is non-blocking and should never throw errors that affect calling code
   */
  const trackInteraction = useCallback(async (options: TrackInteractionOptions) => {
    // Silently skip if not authenticated - don't block calling code
    if (!user) return;

    const {
      interactionType,
      inputText,
      detectedIntent,
      aiResponse,
      userAction,
      modifications,
    } = options;

    try {
      // Verify session before attempting insert
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== user.id) {
        // Session mismatch - skip silently, don't block epic creation
        return;
      }

      // Insert interaction record
      const { error } = await supabase
        .from('ai_interactions')
        .insert({
          user_id: user.id,
          interaction_type: interactionType,
          input_text: inputText,
          detected_intent: detectedIntent,
          ai_response: aiResponse as any,
          user_action: userAction,
          modifications: modifications as any,
        });

      if (error) {
        // Log but don't throw - this is analytics, not critical path
        console.warn('Failed to track interaction (non-blocking):', error.message);
        return;
      }

      // Update learning profile based on action (also non-blocking)
      await updateLearningFromAction(user.id, userAction);
    } catch (err) {
      // Catch all errors - never let tracking block the main flow
      console.warn('Error tracking interaction (non-blocking):', err);
    }
  }, [user]);

  /**
   * Update user's AI learning profile based on action
   */
  const updateLearningFromAction = async (userId: string, action: UserAction) => {
    try {
      // Get current learning profile
      const { data: learning } = await supabase
        .from('user_ai_learning')
        .select('interaction_count, acceptance_rate, modification_rate')
        .eq('user_id', userId)
        .maybeSingle();

      if (!learning) {
        // Create new profile
        await supabase.from('user_ai_learning').insert({
          user_id: userId,
          interaction_count: 1,
          acceptance_rate: action === 'accepted' ? 100 : 0,
          modification_rate: action === 'modified' ? 100 : 0,
          last_interaction_at: new Date().toISOString(),
        });
        return;
      }

      // Calculate new rates
      const newCount = (learning.interaction_count || 0) + 1;
      const oldAcceptRate = learning.acceptance_rate || 0;
      const oldModifyRate = learning.modification_rate || 0;

      // Rolling average
      const newAcceptRate = action === 'accepted'
        ? ((oldAcceptRate * (newCount - 1)) + 100) / newCount
        : (oldAcceptRate * (newCount - 1)) / newCount;
      
      const newModifyRate = action === 'modified'
        ? ((oldModifyRate * (newCount - 1)) + 100) / newCount
        : (oldModifyRate * (newCount - 1)) / newCount;

      await supabase
        .from('user_ai_learning')
        .update({
          interaction_count: newCount,
          acceptance_rate: Math.round(newAcceptRate * 100) / 100,
          modification_rate: Math.round(newModifyRate * 100) / 100,
          last_interaction_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    } catch (err) {
      console.error('Error updating learning from action:', err);
    }
  };

  /**
   * Update learning profile with preference weights
   */
  const updatePreferenceWeights = useCallback(async (options: UpdateLearningOptions) => {
    if (!user) return;

    const {
      storyType,
      themeColor,
      category,
      epicDuration,
      habitDifficulty,
      habitFrequency,
      wasSuccessful,
    } = options;

    try {
      // Get current learning profile
      const { data: learning } = await supabase
        .from('user_ai_learning')
        .select('preference_weights, successful_patterns, failed_patterns, common_contexts')
        .eq('user_id', user.id)
        .maybeSingle();

      const currentWeights = (learning?.preference_weights as Record<string, Record<string, number>>) || {
        story_type: {},
        theme_color: {},
        categories: {},
      };

      const successfulPatterns = (learning?.successful_patterns as Record<string, unknown>) || {};
      const failedPatterns = (learning?.failed_patterns as Record<string, unknown>) || {};
      const commonContexts = learning?.common_contexts || [];

      // Update weights based on success/failure
      const weightDelta = wasSuccessful ? 1 : -0.5;

      if (storyType) {
        currentWeights.story_type = currentWeights.story_type || {};
        currentWeights.story_type[storyType] = (currentWeights.story_type[storyType] || 0) + weightDelta;
      }

      if (themeColor) {
        currentWeights.theme_color = currentWeights.theme_color || {};
        currentWeights.theme_color[themeColor] = (currentWeights.theme_color[themeColor] || 0) + weightDelta;
      }

      if (category && !commonContexts.includes(category)) {
        commonContexts.push(category);
      }

      // Track patterns
      const patternKey = `${storyType || 'none'}_${epicDuration || 30}_${habitDifficulty || 'medium'}`;
      if (wasSuccessful) {
        (successfulPatterns as any)[patternKey] = ((successfulPatterns as any)[patternKey] || 0) + 1;
      } else {
        (failedPatterns as any)[patternKey] = ((failedPatterns as any)[patternKey] || 0) + 1;
      }

      // Update profile
      const updates: Record<string, unknown> = {
        preference_weights: currentWeights,
        successful_patterns: successfulPatterns,
        failed_patterns: failedPatterns,
        common_contexts: commonContexts.slice(-20), // Keep last 20
        updated_at: new Date().toISOString(),
      };

      // Update preferred values if successful
      if (wasSuccessful) {
        if (epicDuration) updates.preferred_epic_duration = epicDuration;
        if (habitDifficulty) updates.preferred_habit_difficulty = habitDifficulty;
        if (habitFrequency) updates.preferred_habit_frequency = habitFrequency;
      }

      await supabase
        .from('user_ai_learning')
        .upsert({
          user_id: user.id,
          ...updates,
        }, { onConflict: 'user_id' });
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
      // Get epic details
      const { data: epic } = await supabase
        .from('epics')
        .select('story_type_slug, theme_color, target_days')
        .eq('id', epicId)
        .single();

      if (!epic) return;

      // Get associated habits
      const { data: epicHabits } = await supabase
        .from('epic_habits')
        .select('habits(difficulty, frequency)')
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
    taskId: string,
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
      // Get current learning profile
      const { data: learning } = await supabase
        .from('user_ai_learning')
        .select('successful_patterns, failed_patterns, energy_by_hour, day_of_week_patterns')
        .eq('user_id', user.id)
        .maybeSingle();

      const successfulPatterns = (learning?.successful_patterns as Record<string, number>) || {};
      const failedPatterns = (learning?.failed_patterns as Record<string, number>) || {};
      const energyByHour = (learning?.energy_by_hour as Record<string, number>) || {};
      const dayPatterns = (learning?.day_of_week_patterns as Record<string, number>) || {};

      const isSuccess = outcome === 'completed';
      const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

      // Update energy by hour if we have timing info
      if (metadata?.actualCompletionTime && isSuccess) {
        const hour = metadata.actualCompletionTime.split(':')[0];
        energyByHour[hour] = (energyByHour[hour] || 50) + 5; // Boost successful hours
      } else if (metadata?.scheduledTime && !isSuccess) {
        const hour = metadata.scheduledTime.split(':')[0];
        energyByHour[hour] = Math.max(0, (energyByHour[hour] || 50) - 5); // Reduce failed hours
      }

      // Update day-of-week patterns
      const currentDayTotal = (dayPatterns[`${dayOfWeek}_total`] || 0) + 1;
      const currentDaySuccess = (dayPatterns[`${dayOfWeek}_success`] || 0) + (isSuccess ? 1 : 0);
      dayPatterns[`${dayOfWeek}_total`] = currentDayTotal;
      dayPatterns[`${dayOfWeek}_success`] = currentDaySuccess;
      dayPatterns[dayOfWeek] = Math.round((currentDaySuccess / currentDayTotal) * 100);

      // Track category success/failure
      if (metadata?.category) {
        const catKey = `category_${metadata.category}`;
        if (isSuccess) {
          successfulPatterns[catKey] = (successfulPatterns[catKey] || 0) + 1;
        } else {
          failedPatterns[catKey] = (failedPatterns[catKey] || 0) + 1;
        }
      }

      // Track difficulty success/failure
      if (metadata?.difficulty) {
        const diffKey = `difficulty_${metadata.difficulty}`;
        if (isSuccess) {
          successfulPatterns[diffKey] = (successfulPatterns[diffKey] || 0) + 1;
        } else {
          failedPatterns[diffKey] = (failedPatterns[diffKey] || 0) + 1;
        }
      }

      await supabase
        .from('user_ai_learning')
        .upsert({
          user_id: user.id,
          successful_patterns: successfulPatterns,
          failed_patterns: failedPatterns,
          energy_by_hour: energyByHour,
          day_of_week_patterns: dayPatterns,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

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
