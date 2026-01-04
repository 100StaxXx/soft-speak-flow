import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PlanMyWeekAnswers } from '@/features/tasks/components/PlanMyWeekClarification';

interface DailyPlan {
  date: string;
  dayName: string;
  tasks: Array<{
    taskId?: string;
    title: string;
    suggestedTime?: string;
    estimatedDuration?: number;
    priority: 'high' | 'medium' | 'low';
    reason: string;
  }>;
  totalHours: number;
  energyLevel: 'low' | 'medium' | 'high';
}

interface WeeklyInsight {
  type: 'optimization' | 'warning' | 'encouragement' | 'suggestion';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  affectedDays?: string[];
}

interface WeeklyPlanOptimization {
  weekStart: string;
  weekEnd: string;
  dailyPlans: DailyPlan[];
  insights: WeeklyInsight[];
  weeklyGoalSummary?: string;
  totalPlannedHours: number;
  balanceScore: number; // 0-100 indicating how balanced the week is
}

export function useWeeklyPlanOptimization() {
  const { user } = useAuth();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['weekly-plan-optimization', user?.id],
    queryFn: async (): Promise<WeeklyPlanOptimization | null> => {
      if (!user) return null;

      const { data, error } = await supabase.functions.invoke('optimize-weekly-plan');
      
      if (error) {
        console.error('Error fetching weekly plan optimization:', error);
        throw error;
      }

      return data as WeeklyPlanOptimization;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });

  /**
   * Optimize with clarification answers from Plan My Week flow
   */
  const optimizeWithAnswers = useCallback(async (answers?: PlanMyWeekAnswers): Promise<WeeklyPlanOptimization | null> => {
    if (!user) return null;

    const body = answers ? {
      energyLevel: answers.energyLevel,
      prioritizedEpicId: answers.prioritizedEpicId,
      protectStreaks: answers.protectStreaks,
      focusDays: answers.focusDays,
      lightDays: answers.lightDays,
      weeklyGoal: answers.weeklyGoal,
    } : {};

    const { data, error } = await supabase.functions.invoke('optimize-weekly-plan', {
      body,
    });

    if (error) {
      console.error('Error fetching weekly plan optimization with answers:', error);
      throw error;
    }

    return data as WeeklyPlanOptimization;
  }, [user]);

  const insights = data?.insights ?? [];
  const dailyPlans = data?.dailyPlans ?? [];
  const hasWarnings = insights.some(i => i.type === 'warning');
  const hasOverloadedDays = dailyPlans.some(d => d.totalHours > 8);

  return {
    weekStart: data?.weekStart,
    weekEnd: data?.weekEnd,
    dailyPlans,
    insights,
    weeklyGoalSummary: data?.weeklyGoalSummary,
    totalPlannedHours: data?.totalPlannedHours ?? 0,
    balanceScore: data?.balanceScore ?? 0,
    hasWarnings,
    hasOverloadedDays,
    isLoading,
    error: error instanceof Error ? error.message : null,
    refetch,
    optimizeWithAnswers,
  };
}

export type { DailyPlan, WeeklyInsight, WeeklyPlanOptimization };
