import { useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { WidgetData, type WidgetTask } from '@/plugins/WidgetDataPlugin';
import type { DailyTask } from './useTasksQuery';

/**
 * Hook to sync daily tasks to the iOS WidgetKit extension
 * via App Group shared UserDefaults
 * 
 * Syncs:
 * - When tasks change
 * - When app resumes from background
 * - Force sync shortly after mount
 */
export const useWidgetSync = (tasks: DailyTask[], taskDate: string) => {
  const lastSyncRef = useRef<string>('');
  const syncRef = useRef<(force?: boolean) => void>(() => {});
  const isIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  
  const syncToWidget = useCallback(async (force = false) => {
    // Only run on iOS native platform
    if (!isIOS) {
      return;
    }

    // The home-screen widget should always represent real local "today"
    const today = getLocalDateString();
    if (taskDate !== today) {
      return;
    }
    
    // Separate quests and rituals
    const quests = tasks.filter(task => !task.habit_source_id);
    const rituals = tasks.filter(task => !!task.habit_source_id);

    // Map quests to widget format (limit to 10 for performance)
    const widgetTasks: WidgetTask[] = quests.slice(0, 10).map(task => ({
      id: task.id,
      text: task.task_text,
      completed: task.completed ?? false,
      xpReward: task.xp_reward,
      isMainQuest: task.is_main_quest ?? false,
      category: task.category,
      section: getSection(task.scheduled_time),
      scheduledTime: task.scheduled_time,
    }));
    
    // Create a fingerprint to avoid redundant syncs
    const fingerprint = JSON.stringify({
      date: taskDate,
      tasks: widgetTasks,
      questCount: quests.length,
      questCompleted: quests.filter(t => !!t.completed).length,
      ritualCount: rituals.length,
      ritualCompleted: rituals.filter(t => !!t.completed).length,
    });
    
    // Skip if nothing changed (unless force)
    if (!force && fingerprint === lastSyncRef.current) {
      return;
    }

    try {
      await WidgetData.updateWidgetData({
        tasks: widgetTasks,
        completedCount: quests.filter(t => !!t.completed).length,
        totalCount: quests.length,
        ritualCount: rituals.length,
        ritualCompleted: rituals.filter(t => !!t.completed).length,
        date: taskDate,
      });
      lastSyncRef.current = fingerprint;
    } catch (error) {
      console.error('[WidgetSync] Failed to sync:', error);
    }
  }, [tasks, taskDate, isIOS]);

  useEffect(() => {
    syncRef.current = syncToWidget;
  }, [syncToWidget]);
  
  // Sync whenever tasks change
  useEffect(() => {
    syncToWidget();
  }, [syncToWidget]);
  
  // Force sync shortly after mount
  useEffect(() => {
    if (!isIOS) {
      return;
    }

    const timer = setTimeout(() => {
      syncRef.current(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [isIOS]);
  
  // Sync when app resumes from background (single listener, latest callback via ref)
  useEffect(() => {
    if (!isIOS) return;
    
    const listener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        syncRef.current(true);
      }
    });
    
    return () => {
      listener.then(l => l.remove());
    };
  }, [isIOS]);
  
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

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
