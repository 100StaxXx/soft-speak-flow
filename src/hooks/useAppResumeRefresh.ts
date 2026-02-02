import { useEffect, useRef } from 'react';
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

  // Native iOS/Android: Listen for app state changes
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

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
      logger.debug('App resumed - refreshing critical data');

      // Refetch profile first (mentor ID depends on it)
      await queryClient.refetchQueries({ queryKey: ['profile'] });
      
      // Then invalidate mentor-related queries
      queryClient.invalidateQueries({ queryKey: ['mentor-page-data'] });
      queryClient.invalidateQueries({ queryKey: ['mentor-personality'] });
    };

    App.addListener('appStateChange', handleAppStateChange);

    return () => {
      App.removeAllListeners();
    };
  }, [queryClient]);

  // Web/PWA: Listen for visibility changes
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return; // Skip on native

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      const now = Date.now();
      const elapsed = now - lastResumeRef.current;

      if (elapsed < RESUME_COOLDOWN_MS) return;

      lastResumeRef.current = now;
      logger.debug('Tab became visible - refreshing critical data');

      queryClient.refetchQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['mentor-page-data'] });
      queryClient.invalidateQueries({ queryKey: ['mentor-personality'] });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [queryClient]);
};
