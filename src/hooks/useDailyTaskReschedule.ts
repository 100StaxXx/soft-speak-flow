import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export interface RescheduleAction {
  type: 'prioritize' | 'extend_tomorrow' | 'replan';
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
  const queryClient = useQueryClient();
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

    let suggestedAction: RescheduleAction | null = null;

    if (currentHour >= 20) {
      suggestedAction = {
        type: 'extend_tomorrow',
        label: 'Move to tomorrow',
        description: `Move ${incompleteTasks} incomplete tasks to tomorrow`,
        icon: '📅',
      };
    } else if (incompleteTasks > 3) {
      suggestedAction = {
        type: 'prioritize',
        label: 'Focus on essentials',
        description: 'Keep only high-priority tasks, move rest',
        icon: '🎯',
      };
    }
    // For 1-3 tasks, don't show suggestions - user can manage

    if (!suggestedAction) {
      return {
        isBehind: false,
        completionRate,
        incompleteTasks,
        suggestedAction: null,
        message: `${incompleteTasks} tasks remaining`,
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

  const prioritizeEssentials = useCallback(async () => {
    if (!user) return;

    const incompleteTasks = tasks.filter(t => !t.completed);
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    
    const toMove = incompleteTasks.filter(t => 
      t.priority !== 'high' && 
      !t.habit_source_id && 
      !t.is_main_quest
    );

    if (toMove.length === 0) return;

    // Optimistically remove moved tasks from today's view
    const moveIds = new Set(toMove.map(t => t.id));
    queryClient.setQueriesData({ queryKey: ['daily-tasks'] }, (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.filter(t => !moveIds.has(t.id) || t.completed);
    });

    setIsRescheduling(true);
    try {
      // Batch update using .in()
      const { error } = await supabase
        .from('daily_tasks')
        .update({ task_date: tomorrow })
        .in('id', toMove.map(t => t.id));

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      
      const kept = incompleteTasks.length - toMove.length;
      toast.success(`Focused on ${kept} essentials, moved ${toMove.length} quests to tomorrow`);
    } catch (error) {
      console.error('Error prioritizing tasks:', error);
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      toast.error('Failed to prioritize quests');
    } finally {
      setIsRescheduling(false);
    }
  }, [user, tasks, queryClient]);

  const extendToTomorrow = useCallback(async () => {
    if (!user) return;

    const incompleteTasks = tasks.filter(t => !t.completed);
    if (incompleteTasks.length === 0) return;

    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const moveIds = new Set(incompleteTasks.map(t => t.id));

    // Optimistically remove from today's view immediately
    queryClient.setQueriesData({ queryKey: ['daily-tasks'] }, (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.filter(t => !moveIds.has(t.id));
    });

    setIsRescheduling(true);
    try {
      // Single batch update
      const { error } = await supabase
        .from('daily_tasks')
        .update({ task_date: tomorrow })
        .in('id', incompleteTasks.map(t => t.id));

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      toast.success(`Moved ${incompleteTasks.length} quests to tomorrow`);
    } catch (error) {
      console.error('Error moving tasks:', error);
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      toast.error('Failed to move quests');
    } finally {
      setIsRescheduling(false);
    }
  }, [user, tasks, queryClient]);

  const executeAction = useCallback(async (action: RescheduleAction['type']) => {
    switch (action) {
      case 'prioritize':
        await prioritizeEssentials();
        break;
      case 'extend_tomorrow':
        await extendToTomorrow();
        break;
      case 'replan':
        break;
    }
  }, [prioritizeEssentials, extendToTomorrow]);

  return {
    analysis,
    isRescheduling,
    prioritizeEssentials,
    extendToTomorrow,
    executeAction,
  };
}
