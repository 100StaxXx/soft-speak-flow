import { useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { WidgetData, type WidgetTask } from '@/plugins/WidgetDataPlugin';
import type { DailyTask } from './useTasksQuery';

/**
 * Hook to sync daily tasks to the iOS WidgetKit extension
 * via App Group shared UserDefaults
 */
export const useWidgetSync = (tasks: DailyTask[], taskDate: string) => {
  const syncToWidget = useCallback(async () => {
    // Only run on iOS native platform
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
      return;
    }
    
    // Map tasks to widget format (limit to 10 for performance)
    const widgetTasks: WidgetTask[] = tasks.slice(0, 10).map(task => ({
      id: task.id,
      text: task.task_text,
      completed: task.completed ?? false,
      xpReward: task.xp_reward,
      isMainQuest: task.is_main_quest ?? false,
      category: task.category,
      section: getSection(task.scheduled_time),
      scheduledTime: task.scheduled_time,
    }));
    
    try {
      await WidgetData.updateWidgetData({
        tasks: widgetTasks,
        completedCount: tasks.filter(t => t.completed).length,
        totalCount: tasks.length,
        date: taskDate,
      });
    } catch (error) {
      console.error('[WidgetSync] Failed to sync:', error);
    }
  }, [tasks, taskDate]);
  
  // Sync whenever tasks change
  useEffect(() => {
    syncToWidget();
  }, [syncToWidget]);
  
  return { syncToWidget };
};

/**
 * Determine time-of-day section based on scheduled time
 */
function getSection(scheduledTime: string | null): string {
  if (!scheduledTime) return 'unscheduled';
  const hour = parseInt(scheduledTime.split(':')[0], 10);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
