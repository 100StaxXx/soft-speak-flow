import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { parseISO } from 'date-fns';
import { categorizeQuest } from '@/utils/questCategorization';
import { getEffectiveMissionDate, getEffectiveDayOfWeek } from '@/utils/timezone';
import { isHabitScheduledForDate } from '@/utils/habitSchedule';

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
  custom_days: number[] | null;
  custom_month_days: number[] | null;
}

/**
 * Determine if a habit should surface today based on its frequency
 */
function shouldSurfaceToday(habit: SurfacedHabit, dayOfWeek: number, targetDate: Date): boolean {
  return isHabitScheduledForDate(habit, targetDate, dayOfWeek);
}

export function useHabitSurfacing(_selectedDate?: Date) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Use 2 AM reset timezone logic for consistent daily reset
  const taskDate = getEffectiveMissionDate();
  // Get effective day of week (0=Sunday standard JS convention) respecting 2 AM reset
  const jsDay = getEffectiveDayOfWeek();
  // Convert to our convention: 0=Mon, 1=Tue, ..., 6=Sun
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;
  const effectiveDate = parseISO(taskDate);
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
          category,
          frequency,
          estimated_minutes,
          preferred_time,
          custom_days,
          custom_month_days,
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

      // Filter out habits linked to non-active epics, then map to surfaced format
      const surfaced: SurfacedHabit[] = (habits || [])
        .filter(habit => {
          // If habit is linked to an epic, that epic must be active
          const epicHabit = habit.epic_habits?.[0];
          const epic = epicHabit?.epics;
          if (epicHabit && epic && epic.status !== 'active') {
            return false; // Skip habits from abandoned/completed epics
          }
          return true;
        })
        .map(habit => {
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
            epic_id: epic?.id || null,
            epic_title: epic?.title || null,
            task_id: existingTask?.id || null,
            is_completed: existingTask?.completed || false,
            category: categorizeQuest(habit.title),
            custom_days: habit.custom_days || null,
            custom_month_days: habit.custom_month_days || null,
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
          category: categorizeQuest(habit.habit_name),
          source: 'recurring',
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

  // Surface all habits that should appear today (epic-linked OR standalone daily)
  const surfaceAllHabits = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      // Filter habits that:
      // 1. Don't already have a task for today
      // 2. Should surface based on their frequency
      const habitsToSurface = surfacedHabits?.filter(
        h => !h.task_id && shouldSurfaceToday(h, dayOfWeek, effectiveDate)
      ) || [];

      console.log('[Habit Surfacing] Habits to surface:', habitsToSurface.length, habitsToSurface);

      if (habitsToSurface.length === 0) {
        console.log('[Habit Surfacing] No habits need surfacing');
        return [];
      }

      const tasks = habitsToSurface.map(habit => ({
        user_id: user.id,
        task_text: habit.habit_name,
        task_date: taskDate,
        habit_source_id: habit.habit_id,
        epic_id: habit.epic_id,
        category: categorizeQuest(habit.habit_name),
        source: 'recurring',
        scheduled_time: habit.preferred_time,
        estimated_duration: habit.estimated_minutes,
      }));

      // Check for existing habit tasks to avoid duplicate insert errors
      const { data: existingTasks } = await supabase
        .from('daily_tasks')
        .select('habit_source_id')
        .eq('user_id', user.id)
        .eq('task_date', taskDate)
        .not('habit_source_id', 'is', null);

      const existingHabitIds = new Set(existingTasks?.map(t => t.habit_source_id) || []);
      const newTasks = tasks.filter(t => !existingHabitIds.has(t.habit_source_id));

      console.log('[Habit Surfacing] Inserting new tasks:', newTasks.length, 'of', tasks.length);

      if (newTasks.length === 0) {
        console.log('[Habit Surfacing] All habits already have tasks for today');
        return [];
      }

      const { data, error } = await supabase
        .from('daily_tasks')
        .insert(newTasks)
        .select('id');

      if (error) {
        console.error('[Habit Surfacing] Insert error:', error);
        throw error;
      }

      console.log('[Habit Surfacing] Successfully surfaced', data?.length, 'habits');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['habit-surfacing'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      if (data && data.length > 0) {
        toast.success(`${data.length} ritual${data.length > 1 ? 's' : ''} added to today's quests`);
      }
    },
    onError: (error: Error) => {
      console.error('[Habit Surfacing] Mutation error:', error);
      toast.error('Failed to surface habits as quests');
    },
  });

  // Count habits that should surface today but haven't yet
  const unsurfacedCount = surfacedHabits?.filter(
    h => !h.task_id && shouldSurfaceToday(h, dayOfWeek, effectiveDate)
  ).length || 0;

  return {
    surfacedHabits: surfacedHabits || [],
    isLoading,
    error,
    surfaceHabit: surfaceHabitMutation.mutate,
    surfaceAllEpicHabits: surfaceAllHabits.mutate, // Keep old name for compatibility
    surfaceAllHabits: surfaceAllHabits.mutate,
    unsurfacedEpicHabitsCount: unsurfacedCount, // Keep old name for compatibility
    unsurfacedHabitsCount: unsurfacedCount,
  };
}
