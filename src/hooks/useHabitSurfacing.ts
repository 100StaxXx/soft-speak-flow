import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

export interface SurfacedHabit {
  id: string;
  habit_id: string;
  habit_name: string;
  habit_description: string | null;
  frequency: string;
  estimated_minutes: number | null;
  preferred_time: string | null;
  epic_id: string | null;
  epic_title: string | null;
  task_id: string | null;
  is_completed: boolean;
  category: string | null;
}

export function useHabitSurfacing(selectedDate?: Date) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const taskDate = format(selectedDate || new Date(), 'yyyy-MM-dd');

  // Fetch habits that should be surfaced as tasks today
  const { data: surfacedHabits, isLoading, error } = useQuery({
    queryKey: ['habit-surfacing', user?.id, taskDate],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get all active habits for the user
      const { data: habits, error: habitsError } = await supabase
        .from('habits')
        .select(`
          id,
          title,
          description,
          difficulty,
          frequency,
          estimated_minutes,
          preferred_time,
          epic_habits(epic_id, epics(id, title, status))
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (habitsError) throw habitsError;

      // Get existing tasks for today that are linked to habits
      const { data: existingTasks, error: tasksError } = await supabase
        .from('daily_tasks')
        .select('id, habit_source_id, completed')
        .eq('user_id', user.id)
        .eq('task_date', taskDate)
        .not('habit_source_id', 'is', null);

      if (tasksError) throw tasksError;

      const tasksByHabit = new Map(
        existingTasks?.map(t => [t.habit_source_id, t]) || []
      );

      // Map habits to surfaced format
      const surfaced: SurfacedHabit[] = (habits || []).map(habit => {
        const epicHabit = habit.epic_habits?.[0];
        const epic = epicHabit?.epics;
        const existingTask = tasksByHabit.get(habit.id);

        return {
          id: habit.id,
          habit_id: habit.id,
          habit_name: habit.title,
          habit_description: habit.description || null,
          frequency: habit.frequency || 'daily',
          estimated_minutes: habit.estimated_minutes || null,
          preferred_time: habit.preferred_time || null,
          epic_id: epic?.status === 'active' ? epic.id : null,
          epic_title: epic?.status === 'active' ? epic.title : null,
          task_id: existingTask?.id || null,
          is_completed: existingTask?.completed || false,
          category: habit.difficulty || 'medium',
        };
      });

      return surfaced;
    },
    enabled: !!user?.id,
  });

  // Surface a habit as a task
  const surfaceHabitMutation = useMutation({
    mutationFn: async (habitId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const habit = surfacedHabits?.find(h => h.habit_id === habitId);
      if (!habit) throw new Error('Habit not found');

      // Check if task already exists
      if (habit.task_id) {
        return { id: habit.task_id };
      }

      const { data, error } = await supabase
        .from('daily_tasks')
        .insert({
          user_id: user.id,
          task_text: habit.habit_name,
          task_date: taskDate,
          habit_source_id: habitId,
          epic_id: habit.epic_id,
          category: habit.category,
          source: 'habit',
          scheduled_time: habit.preferred_time,
          estimated_duration: habit.estimated_minutes,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habit-surfacing'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
    },
  });

  // Surface all habits linked to active epics
  const surfaceAllEpicHabits = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      const habitsToSurface = surfacedHabits?.filter(
        h => h.epic_id && !h.task_id
      ) || [];

      if (habitsToSurface.length === 0) return [];

      const tasks = habitsToSurface.map(habit => ({
        user_id: user.id,
        task_text: habit.habit_name,
        task_date: taskDate,
        habit_source_id: habit.habit_id,
        epic_id: habit.epic_id,
        category: habit.category,
        source: 'habit',
        scheduled_time: habit.preferred_time,
        estimated_duration: habit.estimated_minutes,
      }));

      const { data, error } = await supabase
        .from('daily_tasks')
        .insert(tasks)
        .select('id');

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habit-surfacing'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
    },
  });

  return {
    surfacedHabits: surfacedHabits || [],
    isLoading,
    error,
    surfaceHabit: surfaceHabitMutation.mutate,
    surfaceAllEpicHabits: surfaceAllEpicHabits.mutate,
    unsurfacedEpicHabitsCount: surfacedHabits?.filter(h => h.epic_id && !h.task_id).length || 0,
  };
}
