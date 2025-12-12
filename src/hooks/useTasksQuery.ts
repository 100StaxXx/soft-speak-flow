import { useQuery } from "@tanstack/react-query";
import { getDocuments, timestampToISO } from "@/lib/firebase/firestore";
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
  reminder_minutes_before: number | null;
  reminder_sent: boolean | null;
  parent_template_id: string | null;
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
    queryKey: ['daily-tasks', user?.uid, taskDate],
    queryFn: async () => {
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }
      
      const data = await getDocuments<DailyTask>(
        'daily_tasks',
        [
          ['user_id', '==', user.uid],
          ['task_date', '==', taskDate],
        ],
        'created_at',
        'desc'
      );

      // Convert Firestore timestamps to ISO strings
      return data.map(task => ({
        ...task,
        created_at: timestampToISO(task.created_at as any) || task.created_at || new Date().toISOString(),
        completed_at: timestampToISO(task.completed_at as any) || task.completed_at,
      })) as DailyTask[];
    },
    enabled: !!user?.uid,
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
