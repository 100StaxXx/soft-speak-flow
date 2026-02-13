import { useMemo, useState, useCallback } from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { normalizeTaskSchedulingState } from '@/utils/taskSchedulingRules';

interface WeeklyTask {
  id: string;
  task_text: string;
  task_date: string;
  completed: boolean;
  estimated_duration: number | null;
  scheduled_time: string | null;
  is_main_quest: boolean;
  habit_source_id?: string | null;
  source?: string | null;
}

interface RescheduleAction {
  type: 'balance_week' | 'clear_weekend' | 'push_heavy_days' | 'redistribute';
  label: string;
  description: string;
}

interface WeeklyRescheduleAnalysis {
  isUnbalanced: boolean;
  overloadedDays: string[];
  emptyDays: string[];
  suggestedAction: RescheduleAction | null;
  balanceScore: number;
  recommendation: string;
}

export function useWeeklyReschedule(weeklyTasks: WeeklyTask[], startDate: Date = new Date()) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isRescheduling, setIsRescheduling] = useState(false);

  const analysis = useMemo((): WeeklyRescheduleAnalysis => {
    const today = startOfDay(startDate);
    const weekDays: { date: Date; dateStr: string; tasks: WeeklyTask[]; totalHours: number }[] = [];

    for (let i = 0; i < 7; i++) {
      const date = addDays(today, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayTasks = weeklyTasks.filter(t => t.task_date === dateStr && !t.completed);
      const totalHours = dayTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0) / 60;
      weekDays.push({ date, dateStr, tasks: dayTasks, totalHours });
    }

    const overloadedDays = weekDays
      .filter(d => d.totalHours > 5)
      .map(d => format(d.date, 'EEEE'));

    const emptyDays = weekDays
      .filter(d => d.tasks.length === 0)
      .map(d => format(d.date, 'EEEE'));

    const avgHours = weekDays.reduce((sum, d) => sum + d.totalHours, 0) / 7;
    const variance = weekDays.reduce((sum, d) => sum + Math.pow(d.totalHours - avgHours, 2), 0) / 7;
    const balanceScore = Math.max(0, Math.min(100, 100 - variance * 10));

    const isUnbalanced = overloadedDays.length > 0 || (emptyDays.length > 3 && weeklyTasks.length > 10);

    let suggestedAction: RescheduleAction | null = null;
    let recommendation = '';

    if (overloadedDays.length >= 3) {
      suggestedAction = {
        type: 'redistribute',
        label: 'Redistribute Tasks',
        description: 'Move tasks from busy days to lighter days',
      };
      recommendation = `${overloadedDays.length} days are overloaded. Consider redistributing tasks across the week.`;
    } else if (overloadedDays.length > 0 && emptyDays.length > 0) {
      suggestedAction = {
        type: 'balance_week',
        label: 'Balance Week',
        description: 'Spread tasks evenly across all days',
      };
      recommendation = `${overloadedDays.join(', ')} ${overloadedDays.length === 1 ? 'is' : 'are'} heavy. Move some tasks to ${emptyDays.slice(0, 2).join(', ')}.`;
    } else if (weekDays.slice(5, 7).every(d => d.totalHours > 4)) {
      suggestedAction = {
        type: 'clear_weekend',
        label: 'Lighten Weekend',
        description: 'Move weekend tasks to weekdays',
      };
      recommendation = 'Your weekend looks busy. Consider moving some tasks to weekdays.';
    } else if (weekDays.slice(0, 2).every(d => d.totalHours > 6)) {
      suggestedAction = {
        type: 'push_heavy_days',
        label: 'Spread Early Week',
        description: 'Push some tasks to later in the week',
      };
      recommendation = 'Heavy start to the week. Consider spreading tasks out.';
    } else if (balanceScore < 60) {
      recommendation = 'Your week could be more balanced. Consider rearranging tasks.';
    } else {
      recommendation = 'Your week looks balanced!';
    }

    return {
      isUnbalanced,
      overloadedDays,
      emptyDays,
      suggestedAction,
      balanceScore,
      recommendation,
    };
  }, [weeklyTasks, startDate]);

  const balanceWeek = useCallback(async () => {
    if (!user?.id) return;
    
    const today = startOfDay(startDate);
    const incompleteTasks = weeklyTasks.filter(t => !t.completed);
    
    if (incompleteTasks.length === 0) return;

    const tasksPerDay = Math.ceil(incompleteTasks.length / 7);
    const updates: Array<{
      id: string;
      task_date: string | null;
      scheduled_time: string | null;
      source: string | null;
      previousSource: string | null;
      normalizedToInbox: boolean;
    }> = [];

    let taskIndex = 0;
    for (let dayIndex = 0; dayIndex < 7 && taskIndex < incompleteTasks.length; dayIndex++) {
      const targetDate = format(addDays(today, dayIndex), 'yyyy-MM-dd');
      
      for (let i = 0; i < tasksPerDay && taskIndex < incompleteTasks.length; i++) {
        const task = incompleteTasks[taskIndex];
        if (task.task_date !== targetDate) {
          const normalized = normalizeTaskSchedulingState({
            task_date: targetDate,
            scheduled_time: task.scheduled_time ?? null,
            habit_source_id: task.habit_source_id ?? null,
            source: task.source ?? null,
          });
          updates.push({
            id: task.id,
            task_date: normalized.task_date,
            scheduled_time: normalized.scheduled_time,
            source: normalized.source ?? null,
            previousSource: task.source ?? null,
            normalizedToInbox: normalized.normalizedToInbox,
          });
        }
        taskIndex++;
      }
    }

    if (updates.length === 0) return;

    // Optimistic update
    const updateMap = new Map(updates.map(u => [u.id, u.task_date]));
    queryClient.setQueriesData({ queryKey: ['daily-tasks'] }, (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map(t => updateMap.has(t.id) ? { ...t, task_date: updateMap.get(t.id) } : t);
    });
    queryClient.setQueriesData({ queryKey: ['calendar-tasks'] }, (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map(t => updateMap.has(t.id) ? { ...t, task_date: updateMap.get(t.id) } : t);
    });

    setIsRescheduling(true);
    try {
      for (const update of updates) {
        const updateData: Record<string, unknown> = {
          task_date: update.task_date,
          scheduled_time: update.scheduled_time,
        };
        if (update.source !== update.previousSource) {
          updateData.source = update.source;
        }

        await supabase
          .from('daily_tasks')
          .update(updateData)
          .eq('id', update.id)
          .eq('user_id', user.id);
      }

      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });

      const normalizedCount = updates.filter(update => update.normalizedToInbox).length;
      if (normalizedCount > 0) {
        toast(`${normalizedCount} quest${normalizedCount === 1 ? '' : 's'} stayed in Inbox (time required).`);
      }
    } catch {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
    } finally {
      setIsRescheduling(false);
    }
  }, [user?.id, weeklyTasks, startDate, queryClient]);

  const clearWeekend = useCallback(async () => {
    if (!user?.id) return;

    const today = startOfDay(startDate);
    const weekendDates = [5, 6].map(offset => format(addDays(today, offset), 'yyyy-MM-dd'));
    
    const weekendTasks = weeklyTasks.filter(
      t => weekendDates.includes(t.task_date) && !t.completed && !t.is_main_quest
    );

    if (weekendTasks.length === 0) return;

    const weekdayDates = [0, 1, 2, 3, 4].map(offset => format(addDays(today, offset), 'yyyy-MM-dd'));
    const updates = weekendTasks.map((task, i) => {
      const normalized = normalizeTaskSchedulingState({
        task_date: weekdayDates[i % 5],
        scheduled_time: task.scheduled_time ?? null,
        habit_source_id: task.habit_source_id ?? null,
        source: task.source ?? null,
      });

      return {
        id: task.id,
        task_date: normalized.task_date,
        scheduled_time: normalized.scheduled_time,
        source: normalized.source ?? null,
        previousSource: task.source ?? null,
        normalizedToInbox: normalized.normalizedToInbox,
      };
    });

    // Optimistic update
    const updateMap = new Map(updates.map(u => [u.id, u.task_date]));
    queryClient.setQueriesData({ queryKey: ['daily-tasks'] }, (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map(t => updateMap.has(t.id) ? { ...t, task_date: updateMap.get(t.id) } : t);
    });
    queryClient.setQueriesData({ queryKey: ['calendar-tasks'] }, (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map(t => updateMap.has(t.id) ? { ...t, task_date: updateMap.get(t.id) } : t);
    });

    setIsRescheduling(true);
    try {
      for (const update of updates) {
        const updateData: Record<string, unknown> = {
          task_date: update.task_date,
          scheduled_time: update.scheduled_time,
        };
        if (update.source !== update.previousSource) {
          updateData.source = update.source;
        }

        await supabase
          .from('daily_tasks')
          .update(updateData)
          .eq('id', update.id)
          .eq('user_id', user.id);
      }

      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });

      const normalizedCount = updates.filter(update => update.normalizedToInbox).length;
      if (normalizedCount > 0) {
        toast(`${normalizedCount} quest${normalizedCount === 1 ? '' : 's'} stayed in Inbox (time required).`);
      }
    } catch {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
    } finally {
      setIsRescheduling(false);
    }
  }, [user?.id, weeklyTasks, startDate, queryClient]);

  const pushHeavyDays = useCallback(async () => {
    if (!user?.id) return;

    const today = startOfDay(startDate);
    const updates: Array<{
      id: string;
      task_date: string | null;
      scheduled_time: string | null;
      source: string | null;
      previousSource: string | null;
      normalizedToInbox: boolean;
    }> = [];
    const laterDates = [3, 4, 5, 6].map(offset => format(addDays(today, offset), 'yyyy-MM-dd'));
    let laterIndex = 0;

    for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
      const dateStr = format(addDays(today, dayOffset), 'yyyy-MM-dd');
      const dayTasks = weeklyTasks.filter(t => t.task_date === dateStr && !t.completed);
      
      if (dayTasks.length > 4) {
        const excess = dayTasks.slice(4).filter(t => !t.is_main_quest);
        for (const task of excess) {
          const normalized = normalizeTaskSchedulingState({
            task_date: laterDates[laterIndex % 4],
            scheduled_time: task.scheduled_time ?? null,
            habit_source_id: task.habit_source_id ?? null,
            source: task.source ?? null,
          });
          updates.push({
            id: task.id,
            task_date: normalized.task_date,
            scheduled_time: normalized.scheduled_time,
            source: normalized.source ?? null,
            previousSource: task.source ?? null,
            normalizedToInbox: normalized.normalizedToInbox,
          });
          laterIndex++;
        }
      }
    }

    if (updates.length === 0) return;

    // Optimistic update
    const updateMap = new Map(updates.map(u => [u.id, u.task_date]));
    queryClient.setQueriesData({ queryKey: ['daily-tasks'] }, (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map(t => updateMap.has(t.id) ? { ...t, task_date: updateMap.get(t.id) } : t);
    });
    queryClient.setQueriesData({ queryKey: ['calendar-tasks'] }, (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map(t => updateMap.has(t.id) ? { ...t, task_date: updateMap.get(t.id) } : t);
    });

    setIsRescheduling(true);
    try {
      for (const update of updates) {
        const updateData: Record<string, unknown> = {
          task_date: update.task_date,
          scheduled_time: update.scheduled_time,
        };
        if (update.source !== update.previousSource) {
          updateData.source = update.source;
        }

        await supabase
          .from('daily_tasks')
          .update(updateData)
          .eq('id', update.id)
          .eq('user_id', user.id);
      }

      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });

      const normalizedCount = updates.filter(update => update.normalizedToInbox).length;
      if (normalizedCount > 0) {
        toast(`${normalizedCount} quest${normalizedCount === 1 ? '' : 's'} stayed in Inbox (time required).`);
      }
    } catch {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
    } finally {
      setIsRescheduling(false);
    }
  }, [user?.id, weeklyTasks, startDate, queryClient]);

  const executeAction = useCallback(async (actionType: RescheduleAction['type']) => {
    switch (actionType) {
      case 'balance_week':
      case 'redistribute':
        await balanceWeek();
        break;
      case 'clear_weekend':
        await clearWeekend();
        break;
      case 'push_heavy_days':
        await pushHeavyDays();
        break;
    }
  }, [balanceWeek, clearWeekend, pushHeavyDays]);

  return {
    analysis,
    isRescheduling,
    balanceWeek,
    clearWeekend,
    pushHeavyDays,
    executeAction,
  };
}
