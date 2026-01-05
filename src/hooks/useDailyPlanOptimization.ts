import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PlanMyDayAnswers } from '@/features/tasks/components/PlanMyDayClarification';

interface DailyInsight {
  type: 'optimization' | 'warning' | 'encouragement' | 'suggestion';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  actionLabel?: string;
  actionType?: 'reschedule' | 'add_break' | 'simplify' | 'celebrate';
  relatedTaskIds?: string[];
}

interface DailyPlanOptimization {
  insights: DailyInsight[];
  suggestedSchedule?: Array<{
    taskId: string;
    suggestedTime: string;
    reason: string;
  }>;
  energyForecast: {
    morning: 'low' | 'medium' | 'high';
    afternoon: 'low' | 'medium' | 'high';
    evening: 'low' | 'medium' | 'high';
  };
  overallReadiness: number;
}

interface GeneratedPlanResponse {
  plan: {
    energyLevel: string;
    dayType: string;
    focusArea: string;
    taskCount: number;
  };
  tasks: Array<{
    id: string;
    task_text: string;
    category: string;
    difficulty: string;
    scheduled_time: string;
    estimated_duration: number;
    xp_reward: number;
  }>;
  preservedTasks: Array<{ id: string; task_text: string }>;
  protectedStreaks: Array<{ habitId: string; title: string; streak: number }>;
  optionalBonus: string | null;
  summaryMessage: string;
}

export function useDailyPlanOptimization() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['daily-plan-optimization', user?.id],
    queryFn: async (): Promise<DailyPlanOptimization | null> => {
      if (!user) return null;

      const { data, error } = await supabase.functions.invoke('optimize-daily-plan');
      
      if (error) {
        console.error('Error fetching daily plan optimization:', error);
        throw error;
      }

      return data as DailyPlanOptimization;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false,
  });

  /**
   * Generate a new daily plan with tasks (opinionated AI)
   */
  const generatePlanMutation = useMutation({
    mutationFn: async (answers: PlanMyDayAnswers): Promise<GeneratedPlanResponse> => {
      const { data, error } = await supabase.functions.invoke('generate-daily-plan', {
        body: answers,
      });

      if (error) {
        console.error('Error generating daily plan:', error);
        throw error;
      }

      return data as GeneratedPlanResponse;
    },
    onSuccess: () => {
      // Invalidate task queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
    },
  });

  /**
   * Legacy: Optimize with clarification answers (keeps suggestions flow)
   */
  const optimizeWithAnswers = useCallback(async (answers?: PlanMyDayAnswers): Promise<DailyPlanOptimization | null> => {
    if (!user) return null;

    // Map PlanMyDayAnswers to edge function format
    const body = answers ? {
      energyLevel: answers.energyLevel,
      dayType: answers.dayType,
      focusArea: answers.focusArea,
    } : {};

    const { data, error } = await supabase.functions.invoke('optimize-daily-plan', {
      body,
    });

    if (error) {
      console.error('Error fetching daily plan optimization with answers:', error);
      throw error;
    }

    return data as DailyPlanOptimization;
  }, [user]);

  const insights = data?.insights ?? [];
  const highPriorityInsights = insights.filter(i => i.priority === 'high');
  const hasWarnings = insights.some(i => i.type === 'warning');
  const hasEncouragement = insights.some(i => i.type === 'encouragement');

  return {
    insights,
    highPriorityInsights,
    energyForecast: data?.energyForecast,
    overallReadiness: data?.overallReadiness ?? 0,
    suggestedSchedule: data?.suggestedSchedule,
    hasWarnings,
    hasEncouragement,
    isLoading,
    error: error instanceof Error ? error.message : null,
    refetch,
    optimizeWithAnswers,
    // New generation API
    generatePlan: generatePlanMutation.mutateAsync,
    isGenerating: generatePlanMutation.isPending,
    generateError: generatePlanMutation.error,
  };
}

export type { DailyInsight, DailyPlanOptimization, GeneratedPlanResponse };
