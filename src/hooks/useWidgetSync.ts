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
 * - Force sync on mount if tasks exist
 */
export const useWidgetSync = (tasks: DailyTask[], taskDate: string) => {
  const lastSyncRef = useRef<string>('');
  const isIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  
  const syncToWidget = useCallback(async (force = false) => {
    // Only run on iOS native platform
    if (!isIOS) {
      return;
    }
    
    // Separate quests and rituals
    const quests = tasks.filter(task => !task.habit_source_id);
    const rituals = tasks.filter(task => !!task.habit_source_id);
    
    // Create a fingerprint to avoid redundant syncs
    const fingerprint = JSON.stringify({
      questCount: quests.length,
      questCompleted: quests.filter(t => t.completed).length,
      ritualCount: rituals.length,
      ritualCompleted: rituals.filter(t => t.completed).length,
      ids: quests.slice(0, 10).map(t => t.id + ':' + t.completed),
      date: taskDate,
    });
    
    // Skip if nothing changed (unless force)
    if (!force && fingerprint === lastSyncRef.current) {
      return;
    }
    
    lastSyncRef.current = fingerprint;
    
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
    
    try {
      console.log('[WidgetSync] Syncing', widgetTasks.length, 'quests +', rituals.length, 'rituals for', taskDate);
      await WidgetData.updateWidgetData({
        tasks: widgetTasks,
        completedCount: quests.filter(t => t.completed).length,
        totalCount: quests.length,
        ritualCount: rituals.length,
        ritualCompleted: rituals.filter(t => t.completed).length,
        date: taskDate,
      });
      console.log('[WidgetSync] Sync complete');
    } catch (error) {
      console.error('[WidgetSync] Failed to sync:', error);
    }
  }, [tasks, taskDate, isIOS]);
  
  // Sync whenever tasks change
  useEffect(() => {
    if (tasks.length > 0) {
      syncToWidget();
    }
  }, [syncToWidget, tasks.length]);
  
  // Force sync on initial mount if we have tasks
  useEffect(() => {
    if (isIOS && tasks.length > 0) {
      // Small delay to ensure data is stable
      const timer = setTimeout(() => {
        syncToWidget(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isIOS, tasks.length > 0]); // Only on first load with tasks
  
  // Sync when app resumes from background
  useEffect(() => {
    if (!isIOS) return;
    
    const handleResume = () => {
      console.log('[WidgetSync] App resumed, forcing sync');
      syncToWidget(true);
    };
    
    // Listen for app state changes
    const listener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        handleResume();
      }
    });
    
    return () => {
      listener.then(l => l.remove());
    };
  }, [isIOS, syncToWidget]);
  
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
