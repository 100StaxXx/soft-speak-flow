import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
