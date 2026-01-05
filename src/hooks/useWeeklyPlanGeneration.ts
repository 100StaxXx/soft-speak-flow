import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PlanMyWeekAnswers } from '@/features/tasks/components/PlanMyWeekClarification';

interface WeeklyTask {
  id: string;
  task_text: string;
  task_date: string;
  scheduled_time: string | null;
  estimated_duration: number | null;
  difficulty: string;
  category: string | null;
  priority: string;
}

interface WeeklyPlanResult {
  weekStart: string;
  weekEnd: string;
  weeklyTasks: WeeklyTask[];
  balanceScore: number;
  summaryMessage: string;
  protectedStreaks: Array<{ id: string; title: string; streak: number }>;
}

export function useWeeklyPlanGeneration() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (answers?: PlanMyWeekAnswers): Promise<WeeklyPlanResult | null> => {
      if (!user) return null;

      const body = answers ? {
        energyLevel: answers.energyLevel,
        prioritizedEpicId: answers.prioritizedEpicId,
        protectStreaks: answers.protectStreaks,
        focusDays: answers.focusDays,
        lightDays: answers.lightDays,
        weeklyGoal: answers.weeklyGoal,
      } : {};

      const { data, error } = await supabase.functions.invoke('generate-weekly-plan', {
        body,
      });

      if (error) {
        console.error('Error generating weekly plan:', error);
        throw error;
      }

      return data as WeeklyPlanResult;
    },
    onSuccess: () => {
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-plan-optimization'] });
    },
  });

  const generateWeeklyPlan = useCallback(async (answers?: PlanMyWeekAnswers) => {
    return mutation.mutateAsync(answers);
  }, [mutation]);

  return {
    generateWeeklyPlan,
    isGenerating: mutation.isPending,
    error: mutation.error instanceof Error ? mutation.error.message : null,
  };
}
