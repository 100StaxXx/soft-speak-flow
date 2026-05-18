import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Browser } from '@capacitor/browser';
import { initializeDeepLinkHandler, DeepLinkData } from '@/utils/deepLinkHandler';
import { logger } from '@/utils/logger';

interface DeepLinkContextType {
  pendingTaskId: string | null;
  clearPendingTask: () => void;
}

const DeepLinkContext = createContext<DeepLinkContextType>({
  pendingTaskId: null,
  clearPendingTask: () => {},
});

const closeOAuthBrowser = () => {
  void Browser.close().catch((error) => {
    logger.log('[DeepLinkProvider] Calendar OAuth browser close skipped:', error);
  });
};

export const useDeepLink = () => useContext(DeepLinkContext);

export const DeepLinkProvider = ({ children }: { children: ReactNode }) => {
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

  const handleDeepLink = useCallback((data: DeepLinkData) => {
    logger.log('[DeepLinkProvider] Received deep link:', data);
    
    if (data.type === 'task' && data.taskId) {
      setPendingTaskId(data.taskId);
      // Dispatch navigation event to go to journeys page
      window.dispatchEvent(new CustomEvent('deep-link-navigation', { 
        detail: { path: '/journeys', taskId: data.taskId } 
      }));
      return;
    }

    if (data.type === 'calendar_oauth' && data.provider && data.status) {
      closeOAuthBrowser();
      const params = new URLSearchParams({
        calendar_oauth_provider: data.provider,
        calendar_oauth_status: data.status,
      });

      if (data.message) {
        params.set('calendar_oauth_message', data.message);
      }

      window.dispatchEvent(new CustomEvent('deep-link-navigation', {
        detail: { path: `/profile?${params.toString()}` },
      }));
      return;
    }

    if (
      (data.type === 'auth_recovery' ||
        data.type === 'calendar_oauth_callback' ||
        data.type === 'join_epic' ||
        data.type === 'journeys') &&
      data.path
    ) {
      if (data.type === 'calendar_oauth_callback') {
        closeOAuthBrowser();
      }
      window.dispatchEvent(new CustomEvent('deep-link-navigation', {
        detail: { path: data.path },
      }));
    }
  }, []);

  const clearPendingTask = useCallback(() => {
    setPendingTaskId(null);
  }, []);

  useEffect(() => {
    const cleanup = initializeDeepLinkHandler(handleDeepLink);
    return cleanup;
  }, [handleDeepLink]);

  return (
    <DeepLinkContext.Provider value={{ pendingTaskId, clearPendingTask }}>
      {children}
    </DeepLinkContext.Provider>
  );
};
