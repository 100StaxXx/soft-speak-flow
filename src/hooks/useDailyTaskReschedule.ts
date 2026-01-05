import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, addHours, addDays } from 'date-fns';
import { toast } from 'sonner';

export interface RescheduleAction {
  type: 'push_hours' | 'prioritize' | 'extend_tomorrow' | 'replan';
  label: string;
  description: string;
  icon: string;
}

export interface RescheduleAnalysis {
  isBehind: boolean;
  completionRate: number;
  incompleteTasks: number;
  suggestedAction: RescheduleAction | null;
  message: string;
}

export function useDailyTaskReschedule(tasks: any[], selectedDate: Date) {
  const { user } = useAuth();
  const [isRescheduling, setIsRescheduling] = useState(false);

  const analysis = useMemo((): RescheduleAnalysis => {
    if (!tasks.length) {
      return {
        isBehind: false,
        completionRate: 100,
        incompleteTasks: 0,
        suggestedAction: null,
        message: 'No tasks for today',
      };
    }

    const now = new Date();
    const currentHour = now.getHours();
    const isToday = format(selectedDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
    
    const completed = tasks.filter(t => t.completed).length;
    const total = tasks.length;
    const completionRate = Math.round((completed / total) * 100);
    const incompleteTasks = total - completed;

    // Only analyze if it's today and past noon
    if (!isToday || currentHour < 12) {
      return {
        isBehind: false,
        completionRate,
        incompleteTasks,
        suggestedAction: null,
        message: incompleteTasks > 0 ? `${incompleteTasks} tasks remaining` : 'All done!',
      };
    }

    // Calculate expected progress based on time of day
    // By 6pm, expect ~75% done; by 9pm, expect 100%
    const expectedProgress = Math.min(100, Math.max(0, (currentHour - 8) / 13 * 100));
    const isBehind = completionRate < expectedProgress - 20;

    if (!isBehind || incompleteTasks === 0) {
      return {
        isBehind: false,
        completionRate,
        incompleteTasks,
        suggestedAction: null,
        message: incompleteTasks > 0 ? `${incompleteTasks} tasks remaining` : '🎉 All done!',
      };
    }

    // Determine best action based on time and task count
    let suggestedAction: RescheduleAction;

    if (currentHour >= 20) {
      // Late evening - suggest moving to tomorrow
      suggestedAction = {
        type: 'extend_tomorrow',
        label: 'Move to tomorrow',
        description: `Move ${incompleteTasks} incomplete tasks to tomorrow`,
        icon: '📅',
      };
    } else if (incompleteTasks > 5) {
      // Many tasks - prioritize essentials
      suggestedAction = {
        type: 'prioritize',
        label: 'Focus on essentials',
        description: 'Keep only high-priority tasks, move rest',
        icon: '🎯',
      };
    } else {
      // Default - push times
      suggestedAction = {
        type: 'push_hours',
        label: 'Push by 2 hours',
        description: 'Shift all scheduled times forward',
        icon: '⏰',
      };
    }

    return {
      isBehind: true,
      completionRate,
      incompleteTasks,
      suggestedAction,
      message: `Behind schedule: ${completionRate}% done, expected ~${Math.round(expectedProgress)}%`,
    };
  }, [tasks, selectedDate]);

  const pushByHours = useCallback(async (hours: number = 2) => {
    if (!user) return;
    setIsRescheduling(true);

    try {
      const incompleteTasks = tasks.filter(t => !t.completed && t.scheduled_time);
      
      for (const task of incompleteTasks) {
        const [h, m] = task.scheduled_time.split(':').map(Number);
        const newHour = Math.min(23, h + hours);
        const newTime = `${String(newHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        
        await supabase
          .from('daily_tasks')
          .update({ scheduled_time: newTime })
          .eq('id', task.id);
      }

      toast.success(`Pushed ${incompleteTasks.length} tasks by ${hours} hours`);
    } catch (error) {
      console.error('Error pushing tasks:', error);
      toast.error('Failed to reschedule tasks');
    } finally {
      setIsRescheduling(false);
    }
  }, [user, tasks]);

  const prioritizeEssentials = useCallback(async () => {
    if (!user) return;
    setIsRescheduling(true);

    try {
      const incompleteTasks = tasks.filter(t => !t.completed);
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      
      // Keep high priority and habit-linked tasks, move rest to tomorrow
      const toKeep = incompleteTasks.filter(t => 
        t.priority === 'high' || 
        t.habit_source_id || 
        t.is_main_quest
      );
      const toMove = incompleteTasks.filter(t => 
        t.priority !== 'high' && 
        !t.habit_source_id && 
        !t.is_main_quest
      );

      for (const task of toMove) {
        await supabase
          .from('daily_tasks')
          .update({ task_date: tomorrow })
          .eq('id', task.id);
      }

      toast.success(`Focused on ${toKeep.length} essentials, moved ${toMove.length} to tomorrow`);
    } catch (error) {
      console.error('Error prioritizing tasks:', error);
      toast.error('Failed to prioritize tasks');
    } finally {
      setIsRescheduling(false);
    }
  }, [user, tasks]);

  const extendToTomorrow = useCallback(async () => {
    if (!user) return;
    setIsRescheduling(true);

    try {
      const incompleteTasks = tasks.filter(t => !t.completed);
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      
      const { error } = await supabase
        .from('daily_tasks')
        .update({ task_date: tomorrow })
        .in('id', incompleteTasks.map(t => t.id));

      if (error) throw error;

      toast.success(`Moved ${incompleteTasks.length} tasks to tomorrow`);
    } catch (error) {
      console.error('Error moving tasks:', error);
      toast.error('Failed to move tasks');
    } finally {
      setIsRescheduling(false);
    }
  }, [user, tasks]);

  const executeAction = useCallback(async (action: RescheduleAction['type']) => {
    switch (action) {
      case 'push_hours':
        await pushByHours(2);
        break;
      case 'prioritize':
        await prioritizeEssentials();
        break;
      case 'extend_tomorrow':
        await extendToTomorrow();
        break;
      case 'replan':
        // This would trigger a new plan generation - handled by parent
        break;
    }
  }, [pushByHours, prioritizeEssentials, extendToTomorrow]);

  return {
    analysis,
    isRescheduling,
    pushByHours,
    prioritizeEssentials,
    extendToTomorrow,
    executeAction,
  };
}
