import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

export interface DailyTask {
  id: string;
  user_id: string;
  task_text: string;
  difficulty: string | null;
  xp_reward: number;
  task_date: string;
  completed: boolean | null;
  completed_at: string | null;
  is_main_quest: boolean | null;
  scheduled_time: string | null;
  estimated_duration: number | null;
  recurrence_pattern: string | null;
  recurrence_days: number[] | null;
  is_recurring: boolean | null;
  reminder_enabled: boolean | null;
  reminder_minutes_before: number | null;
  reminder_sent: boolean | null;
  parent_template_id: string | null;
  category: string | null;
  is_bonus: boolean | null;
  created_at: string | null;
  // Enhanced task features
  priority: string | null;
  energy_level: string | null;
  is_top_three: boolean | null;
  actual_time_spent: number | null;
  ai_generated: boolean | null;
  context_id: string | null;
  source: string | null;
  // Habit integration
  habit_source_id: string | null;
  // Epic/Campaign integration
  epic_id: string | null;
  epic_title?: string | null;
  // Sort order for drag reordering
  sort_order?: number | null;
  // Contact integration
  contact_id: string | null;
  auto_log_interaction: boolean | null;
  contact?: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
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
        .select(`
          *,
          epics(title),
          contact:contacts!contact_id(id, name, avatar_url)
        `)
        .eq('user_id', user.id)
        .eq('task_date', taskDate)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch daily tasks:', error);
        throw error;
      }
      
      // Flatten epic title and contact from joined data
      return (data || []).map(task => ({
        ...task,
        epic_title: (task.epics as { title: string } | null)?.title || null,
        contact: task.contact as { id: string; name: string; avatar_url: string | null } | null,
      })) as DailyTask[];
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
