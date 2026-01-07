import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TaskCompletionData {
  taskId: string;
  completedAt: string;
  difficulty: string;
  scheduledTime: string | null;
  actualCompletionHour: number;
  dayOfWeek: number;
  wasOnTime: boolean | null;
  category?: string;
  taskText?: string;
}

interface ScheduleModificationData {
  suggestedTime: string;
  actualTime: string;
  taskDifficulty: string;
}

interface TaskCreationData {
  scheduledTime: string | null;
  difficulty: string;
  createdAt: string;
  hour: number;
  taskText?: string;
  category?: string;
}

export function useSchedulingLearner() {
  const { user } = useAuth();

  /**
   * Track when a task is completed - learns completion time patterns
   */
  const trackTaskCompletion = useCallback(async (data: TaskCompletionData) => {
    if (!user) {
      console.log('[SchedulingLearner] No user - skipping completion tracking');
      return;
    }

    console.log('[SchedulingLearner] Tracking completion:', {
      taskText: data.taskText?.substring(0, 30),
      category: data.category,
      difficulty: data.difficulty,
    });

    try {
      const { data: result, error } = await supabase.functions.invoke('analyze-user-patterns', {
        body: { type: 'task_completion', data },
      });
      
      if (error) {
        console.error('[SchedulingLearner] Edge function error:', error);
      } else {
        console.log('[SchedulingLearner] Completion saved:', result);
      }
    } catch (error) {
      console.error('[SchedulingLearner] Error tracking completion:', error);
    }
  }, [user]);

  /**
   * Track when user modifies a suggested time - learns preference corrections
   */
  const trackScheduleModification = useCallback(async (
    suggestedTime: string,
    actualTime: string,
    taskDifficulty: string
  ) => {
    if (!user) return;

    try {
      const data: ScheduleModificationData = { suggestedTime, actualTime, taskDifficulty };
      await supabase.functions.invoke('analyze-user-patterns', {
        body: { type: 'schedule_modification', data },
      });
    } catch (error) {
      console.error('[useSchedulingLearner] Error tracking modification:', error);
    }
  }, [user]);

  /**
   * Track when user creates a task with a specific time - learns scheduling preferences
   */
  const trackTaskCreation = useCallback(async (
    scheduledTime: string | null,
    difficulty: string,
    category?: string,
    taskText?: string
  ) => {
    if (!user) {
      console.log('[SchedulingLearner] No user - skipping creation tracking');
      return;
    }

    console.log('[SchedulingLearner] Tracking creation:', {
      taskText: taskText?.substring(0, 30),
      category,
      difficulty,
    });

    try {
      const data: TaskCreationData = {
        scheduledTime,
        difficulty,
        createdAt: new Date().toISOString(),
        hour: new Date().getHours(),
        taskText,
        category,
      };
      const { data: result, error } = await supabase.functions.invoke('analyze-user-patterns', {
        body: { type: 'task_creation', data },
      });
      
      if (error) {
        console.error('[SchedulingLearner] Edge function error:', error);
      } else {
        console.log('[SchedulingLearner] Creation saved:', result);
      }
    } catch (error) {
      console.error('[SchedulingLearner] Error tracking creation:', error);
    }
  }, [user]);

  return {
    trackTaskCompletion,
    trackScheduleModification,
    trackTaskCreation,
  };
}
