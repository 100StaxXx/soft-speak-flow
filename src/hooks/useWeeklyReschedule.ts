import { useMemo, useState, useCallback } from 'react';
import { format, addDays, startOfDay, isSameDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface WeeklyTask {
  id: string;
  task_text: string;
  task_date: string;
  completed: boolean;
  estimated_duration: number | null;
  scheduled_time: string | null;
  is_main_quest: boolean;
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
  const [isRescheduling, setIsRescheduling] = useState(false);

  const analysis = useMemo((): WeeklyRescheduleAnalysis => {
    const today = startOfDay(startDate);
    const weekDays: { date: Date; dateStr: string; tasks: WeeklyTask[]; totalHours: number }[] = [];

    // Build 7-day view
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

    // Calculate balance score (0-100, 100 = perfectly balanced)
    const avgHours = weekDays.reduce((sum, d) => sum + d.totalHours, 0) / 7;
    const variance = weekDays.reduce((sum, d) => sum + Math.pow(d.totalHours - avgHours, 2), 0) / 7;
    const balanceScore = Math.max(0, Math.min(100, 100 - variance * 10));

    // Determine if week is unbalanced
    const isUnbalanced = overloadedDays.length > 0 || (emptyDays.length > 3 && weeklyTasks.length > 10);

    // Suggest action based on situation
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
    setIsRescheduling(true);

    try {
      const today = startOfDay(startDate);
      const incompleteTasks = weeklyTasks.filter(t => !t.completed);
      
      if (incompleteTasks.length === 0) return;

      // Target: distribute evenly across 7 days
      const tasksPerDay = Math.ceil(incompleteTasks.length / 7);
      const updates: { id: string; task_date: string }[] = [];

      let taskIndex = 0;
      for (let dayIndex = 0; dayIndex < 7 && taskIndex < incompleteTasks.length; dayIndex++) {
        const targetDate = format(addDays(today, dayIndex), 'yyyy-MM-dd');
        
        for (let i = 0; i < tasksPerDay && taskIndex < incompleteTasks.length; i++) {
          const task = incompleteTasks[taskIndex];
          if (task.task_date !== targetDate) {
            updates.push({ id: task.id, task_date: targetDate });
          }
          taskIndex++;
        }
      }

      // Batch update
      for (const update of updates) {
        await supabase
          .from('daily_tasks')
          .update({ task_date: update.task_date })
          .eq('id', update.id)
          .eq('user_id', user.id);
      }
    } finally {
      setIsRescheduling(false);
    }
  }, [user?.id, weeklyTasks, startDate]);

  const clearWeekend = useCallback(async () => {
    if (!user?.id) return;
    setIsRescheduling(true);

    try {
      const today = startOfDay(startDate);
      const weekendDates = [5, 6].map(offset => format(addDays(today, offset), 'yyyy-MM-dd'));
      
      const weekendTasks = weeklyTasks.filter(
        t => weekendDates.includes(t.task_date) && !t.completed && !t.is_main_quest
      );

      if (weekendTasks.length === 0) return;

      // Move to weekdays (Mon-Fri)
      const weekdayDates = [0, 1, 2, 3, 4].map(offset => format(addDays(today, offset), 'yyyy-MM-dd'));
      
      for (let i = 0; i < weekendTasks.length; i++) {
        const targetDate = weekdayDates[i % 5];
        await supabase
          .from('daily_tasks')
          .update({ task_date: targetDate })
          .eq('id', weekendTasks[i].id)
          .eq('user_id', user.id);
      }
    } finally {
      setIsRescheduling(false);
    }
  }, [user?.id, weeklyTasks, startDate]);

  const pushHeavyDays = useCallback(async () => {
    if (!user?.id) return;
    setIsRescheduling(true);

    try {
      const today = startOfDay(startDate);
      
      // Find overloaded days (first 3 days)
      const earlyDays = [0, 1, 2].map(offset => ({
        date: format(addDays(today, offset), 'yyyy-MM-dd'),
        tasks: weeklyTasks.filter(t => t.task_date === format(addDays(today, offset), 'yyyy-MM-dd') && !t.completed),
      }));

      // Move excess tasks (anything beyond 4 per day) to later days
      const laterDates = [3, 4, 5, 6].map(offset => format(addDays(today, offset), 'yyyy-MM-dd'));
      let laterIndex = 0;

      for (const day of earlyDays) {
        if (day.tasks.length > 4) {
          const excess = day.tasks.slice(4).filter(t => !t.is_main_quest);
          
          for (const task of excess) {
            await supabase
              .from('daily_tasks')
              .update({ task_date: laterDates[laterIndex % 4] })
              .eq('id', task.id)
              .eq('user_id', user.id);
            laterIndex++;
          }
        }
      }
    } finally {
      setIsRescheduling(false);
    }
  }, [user?.id, weeklyTasks, startDate]);

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
