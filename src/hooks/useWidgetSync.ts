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
interface WidgetSyncOptions {
  enabled?: boolean;
}

export const useWidgetSync = (
  tasks: DailyTask[],
  taskDate: string,
  options: WidgetSyncOptions = {},
) => {
  const { enabled = true } = options;
  const lastSyncRef = useRef<string>('');
  const syncRef = useRef<(force?: boolean) => void>(() => {});
  const sessionSyncDisabledRef = useRef(false);
  const isIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  
  const syncToWidget = useCallback(async (force = false) => {
    if (!enabled) {
      return;
    }

    if (sessionSyncDisabledRef.current) {
      return;
    }

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

    const completedCount = quests.filter(t => !!t.completed).length;
    const ritualCompleted = rituals.filter(t => !!t.completed).length;

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
      questCompleted: completedCount,
      ritualCount: rituals.length,
      ritualCompleted,
    });
    
    // Skip if nothing changed (unless force)
    if (!force && fingerprint === lastSyncRef.current) {
      return;
    }

    try {
      await WidgetData.updateWidgetData({
        tasks: widgetTasks,
        completedCount,
        totalCount: quests.length,
        ritualCount: rituals.length,
        ritualCompleted,
        date: taskDate,
      });
      lastSyncRef.current = fingerprint;
      console.info('[WidgetSync] Synced widget payload', {
        taskDate,
        force,
        totalCount: quests.length,
        completedCount,
        ritualCount: rituals.length,
        ritualCompleted,
        widgetTaskCount: widgetTasks.length,
      });
    } catch (error) {
      if (isUnimplementedPluginError(error)) {
        sessionSyncDisabledRef.current = true;
        console.info('[WidgetSync] WidgetData plugin unavailable at runtime; disabling widget sync for this session.');
        return;
      }
      const details = getErrorDetails(error);
      console.error('[WidgetSync] Failed to sync widget payload', {
        taskDate,
        code: details.code,
        message: details.message,
      });
    }
  }, [enabled, isIOS, taskDate, tasks]);

  useEffect(() => {
    syncRef.current = syncToWidget;
  }, [syncToWidget]);
  
  // Sync whenever tasks change
  useEffect(() => {
    if (!enabled) {
      return;
    }
    syncToWidget();
  }, [enabled, syncToWidget]);
  
  // Force sync shortly after mount
  useEffect(() => {
    if (!enabled || !isIOS) {
      return;
    }

    const timer = setTimeout(() => {
      syncRef.current(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [enabled, isIOS]);
  
  // Sync when app resumes from background (single listener, latest callback via ref)
  useEffect(() => {
    if (!enabled || !isIOS) return;
    
    const listener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        syncRef.current(true);
      }
    });
    
    return () => {
      listener.then(l => l.remove());
    };
  }, [enabled, isIOS]);

  // Run a one-time diagnostics check to confirm App Group payload visibility on iOS.
  useEffect(() => {
    if (!isIOS) {
      return;
    }

    let cancelled = false;

    const runDiagnostics = async () => {
      try {
        const diagnostics = await WidgetData.getWidgetSyncDiagnostics();
        if (cancelled) {
          return;
        }
        console.info('[WidgetSync] Diagnostics snapshot', diagnostics);

        if (!diagnostics.appGroupAccessible || !diagnostics.hasPayload) {
          console.warn('[WidgetSync] Diagnostics indicate missing shared payload state', diagnostics);
        }
      } catch (error) {
        if (isUnimplementedPluginError(error)) {
          sessionSyncDisabledRef.current = true;
          console.info('[WidgetSync] WidgetData plugin unavailable at runtime; disabling widget sync for this session.');
          return;
        }

        const details = getErrorDetails(error);
        console.warn('[WidgetSync] Diagnostics check failed', {
          code: details.code,
          message: details.message,
        });
      }
    };

    void runDiagnostics();

    return () => {
      cancelled = true;
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

function isUnimplementedPluginError(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';

  const message = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : '';

  return code.toUpperCase() === 'UNIMPLEMENTED' || message.toUpperCase().includes('UNIMPLEMENTED');
}

function getErrorDetails(error: unknown): { code: string; message: string } {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';

  const message = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : 'Unknown error';

  return { code, message };
}
