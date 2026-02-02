import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO, getDay } from 'date-fns';
import { toast } from 'sonner';

interface RecurringTask {
  id: string;
  task_text: string;
  difficulty: string | null;
  scheduled_time: string | null;
  estimated_duration: number | null;
  category: string | null;
  recurrence_pattern: string | null;
  recurrence_days: number[] | null;
  recurrence_end_date: string | null;
  xp_reward: number;
  epic_id: string | null;
  reminder_enabled: boolean | null;
  reminder_minutes_before: number | null;
}

/**
 * Hook to spawn recurring tasks for the current day
 * Handles daily, weekly, and custom recurrence patterns
 */
export function useRecurringTaskSpawner(selectedDate?: Date) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = format(selectedDate || new Date(), 'yyyy-MM-dd');
  const dayOfWeek = getDay(selectedDate || new Date()); // 0 = Sunday, 1 = Monday, etc.

  // Fetch recurring task templates that need spawning
  const { data: pendingRecurring, isLoading } = useQuery({
    queryKey: ['recurring-templates', user?.id, today],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get all recurring task templates (original tasks with is_recurring = true)
      const { data: templates, error: templatesError } = await supabase
        .from('daily_tasks')
        .select(`
          id,
          task_text,
          difficulty,
          scheduled_time,
          estimated_duration,
          category,
          recurrence_pattern,
          recurrence_days,
          recurrence_end_date,
          xp_reward,
          epic_id,
          reminder_enabled,
          reminder_minutes_before
        `)
        .eq('user_id', user.id)
        .eq('is_recurring', true)
        .not('recurrence_pattern', 'is', null);

      if (templatesError) throw templatesError;

      // Get existing tasks for today that were spawned from templates
      const { data: existingToday, error: existingError } = await supabase
        .from('daily_tasks')
        .select('parent_template_id, task_text')
        .eq('user_id', user.id)
        .eq('task_date', today);

      if (existingError) throw existingError;

      const existingTemplateIds = new Set(
        existingToday?.filter(t => t.parent_template_id).map(t => t.parent_template_id)
      );
      const existingTaskTexts = new Set(
        existingToday?.map(t => t.task_text.toLowerCase())
      );

      // Filter templates that need spawning today
      const needsSpawning = (templates || []).filter((template: RecurringTask) => {
        // Skip if already spawned for today
        if (existingTemplateIds.has(template.id)) return false;
        
        // Skip if a task with the same text already exists today (fallback check)
        if (existingTaskTexts.has(template.task_text.toLowerCase())) return false;

        // Skip if recurrence has ended
        if (template.recurrence_end_date) {
          const endDate = parseISO(template.recurrence_end_date);
          const currentDate = selectedDate || new Date();
          if (currentDate > endDate) return false;
        }

        // Check if this template should run today based on pattern
        return shouldSpawnToday(template, dayOfWeek);
      });

      return needsSpawning as RecurringTask[];
    },
    enabled: !!user?.id,
  });

  // Spawn all pending recurring tasks
  const spawnMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !pendingRecurring?.length) return [];

      const tasksToCreate = pendingRecurring.map(template => ({
        user_id: user.id,
        task_text: template.task_text,
        task_date: today,
        difficulty: template.difficulty,
        scheduled_time: template.scheduled_time,
        estimated_duration: template.estimated_duration,
        category: template.category,
        xp_reward: template.xp_reward,
        epic_id: template.epic_id,
        reminder_enabled: template.reminder_enabled,
        reminder_minutes_before: template.reminder_minutes_before,
        parent_template_id: template.id,
        source: 'recurring',
        is_recurring: false, // Spawned instance is not a template
      }));

      const { data, error } = await supabase
        .from('daily_tasks')
        .insert(tasksToCreate)
        .select('id');

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-templates'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      
      if (data && data.length > 0) {
        console.log(`[RecurringSpawner] Spawned ${data.length} recurring tasks for ${today}`);
      }
    },
    onError: (error: Error) => {
      console.error('[RecurringSpawner] Failed to spawn recurring tasks:', error);
      toast.error('Failed to create recurring tasks');
    },
  });

  return {
    pendingRecurringCount: pendingRecurring?.length || 0,
    isLoading,
    spawnRecurringTasks: spawnMutation.mutate,
    isSpawning: spawnMutation.isPending,
  };
}

/**
 * Determine if a recurring task should spawn today based on its pattern
 */
function shouldSpawnToday(template: RecurringTask, dayOfWeek: number): boolean {
  const pattern = template.recurrence_pattern?.toLowerCase();
  
  if (!pattern) return false;

  switch (pattern) {
    case 'daily':
      return true;

    case 'weekly':
      // If recurrence_days is set, check if today is in the list
      if (template.recurrence_days && template.recurrence_days.length > 0) {
        return template.recurrence_days.includes(dayOfWeek);
      }
      // Default to same day as original task was created (stored in recurrence_days[0])
      return true;

    case 'weekdays':
      // Monday (1) through Friday (5)
      return dayOfWeek >= 1 && dayOfWeek <= 5;

    case 'weekends':
      // Saturday (6) and Sunday (0)
      return dayOfWeek === 0 || dayOfWeek === 6;

    case 'custom':
      // Use recurrence_days array
      if (template.recurrence_days && template.recurrence_days.length > 0) {
        return template.recurrence_days.includes(dayOfWeek);
      }
      return false;

    default:
      // Handle patterns like 'every_2_days', 'biweekly', etc.
      // For now, return true for daily-like patterns
      if (pattern.includes('daily') || pattern.includes('day')) {
        return true;
      }
      return false;
  }
}
