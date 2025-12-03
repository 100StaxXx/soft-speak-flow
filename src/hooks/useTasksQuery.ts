import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

export interface DailyTask {
  id: string;
  user_id: string;
  task_text: string;
  difficulty: string;
  xp_reward: number;
  task_date: string;
  completed: boolean;
  completed_at: string | null;
  is_main_quest: boolean;
  scheduled_time: string | null;
  estimated_duration: number | null;
  recurrence_pattern: string | null;
  recurrence_days: number[] | null;
  is_recurring: boolean;
  reminder_enabled: boolean;
  reminder_minutes_before: number;
  category: string | null;
  is_bonus: boolean;
  created_at: string;
}

export const useTasksQuery = (selectedDate?: Date) => {
  const { user } = useAuth();
  
  // Using local device date for task queries
  const taskDate = selectedDate 
    ? format(selectedDate, 'yyyy-MM-dd') 
    : format(new Date(), 'yyyy-MM-dd');

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['daily-tasks', user?.id, taskDate],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('task_date', taskDate)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch daily tasks:', error);
        throw error;
      }
      return (data || []) as DailyTask[];
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;

  return {
    tasks,
    isLoading,
    error,
    taskDate,
    completedCount,
    totalCount,
  };
};
