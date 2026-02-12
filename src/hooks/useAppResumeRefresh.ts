import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { logger } from '@/utils/logger';

const RESUME_COOLDOWN_MS = 10000; // 10 second cooldown to prevent spam

/**
 * Refreshes critical data when the app resumes from background.
 * 
 * On iOS/Android: Listens to Capacitor appStateChange events
 * On Web: Listens to document visibilitychange events
 * 
 * This fixes the "mentor disconnection" issue where profile data
 * becomes stale while the app is backgrounded, causing the mentor
 * section to appear empty on resume.
 */
export const useAppResumeRefresh = () => {
  const queryClient = useQueryClient();
  const lastResumeRef = useRef<number>(0);

  const refreshCriticalData = useCallback(async (source: string) => {
    logger.debug(`${source} - refreshing critical data`);

    // Refetch profile first (mentor ID depends on it)
    await queryClient.refetchQueries({ queryKey: ['profile'] });

    // Invalidate mentor queries used across mentor tab/chat/profile/nav
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['mentor-page-data'] }),
      queryClient.invalidateQueries({ queryKey: ['mentor-personality'] }),
      queryClient.invalidateQueries({ queryKey: ['mentor'] }),
      queryClient.invalidateQueries({ queryKey: ['selected-mentor'] }),
    ]);

    // Invalidate habit and epic data for cross-device sync
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['habits'] }),
      queryClient.invalidateQueries({ queryKey: ['habit-surfacing'] }),
      queryClient.invalidateQueries({ queryKey: ['epics'] }),
      queryClient.invalidateQueries({ queryKey: ['epic-progress'] }),
    ]);
  }, [queryClient]);

  // Native iOS/Android: Listen for app state changes
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let isDisposed = false;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const handleAppStateChange = async ({ isActive }: { isActive: boolean }) => {
      if (!isActive) return; // Only care about resume

      const now = Date.now();
      const elapsed = now - lastResumeRef.current;

      // Apply cooldown to prevent refresh spam
      if (elapsed < RESUME_COOLDOWN_MS) {
        logger.debug('App resume refresh skipped (cooldown)');
        return;
      }

      lastResumeRef.current = now;
      try {
        await refreshCriticalData('App resumed');
      } catch (error) {
        logger.warn('App resume refresh failed', { error: error instanceof Error ? error.message : String(error) });
      }
    };

    const setupListener = async () => {
      const handle = await App.addListener('appStateChange', handleAppStateChange);
      if (isDisposed) {
        await handle.remove();
        return;
      }
      listenerHandle = handle;
    };

    void setupListener();

    return () => {
      isDisposed = true;
      if (listenerHandle) {
        void listenerHandle.remove();
      }
    };
  }, [refreshCriticalData]);

  // Web/PWA: Listen for visibility changes
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return; // Skip on native

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;

      const now = Date.now();
      const elapsed = now - lastResumeRef.current;

      if (elapsed < RESUME_COOLDOWN_MS) return;

      lastResumeRef.current = now;
      try {
        await refreshCriticalData('Tab became visible');
      } catch (error) {
        logger.warn('Visibility refresh failed', { error: error instanceof Error ? error.message : String(error) });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshCriticalData]);
};
