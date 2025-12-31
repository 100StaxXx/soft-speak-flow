import { useState, useEffect, useCallback } from "react";
import { getPendingActionCount } from "@/utils/offlineStorage";

interface OfflineStatusState {
  isOnline: boolean;
  pendingCount: number;
  wasOffline: boolean;
}

export function useOfflineStatus() {
  const [state, setState] = useState<OfflineStatusState>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    pendingCount: 0,
    wasOffline: false,
  });

  // Update pending count periodically
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingActionCount();
      setState(prev => ({ ...prev, pendingCount: count }));
    } catch {
      // Ignore errors
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({
        ...prev,
        isOnline: true,
        // Track that we were offline (for showing sync banner)
        wasOffline: !prev.isOnline ? true : prev.wasOffline,
      }));
      refreshPendingCount();
    };

    const handleOffline = () => {
      setState(prev => ({
        ...prev,
        isOnline: false,
      }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial pending count fetch
    refreshPendingCount();

    // Refresh pending count every 5 seconds
    const interval = setInterval(refreshPendingCount, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [refreshPendingCount]);

  const clearWasOffline = useCallback(() => {
    setState(prev => ({ ...prev, wasOffline: false }));
  }, []);

  return {
    isOnline: state.isOnline,
    pendingCount: state.pendingCount,
    wasOffline: state.wasOffline,
    clearWasOffline,
    refreshPendingCount,
  };
}
