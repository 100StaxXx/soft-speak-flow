import { useState, useEffect, useCallback } from "react";
import { getPendingActionCount } from "@/utils/offlineStorage";
import { useAuth } from "@/hooks/useAuth";

interface OfflineStatusState {
  isOnline: boolean;
  pendingCount: number;
  wasOffline: boolean;
}

export function useOfflineStatus() {
  const { user } = useAuth();
  const [state, setState] = useState<OfflineStatusState>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    pendingCount: 0,
    wasOffline: false,
  });

  // Update pending count periodically
  const refreshPendingCount = useCallback(async () => {
    try {
      if (!user?.id) {
        setState(prev => ({ ...prev, pendingCount: 0 }));
        return;
      }
      const count = await getPendingActionCount(user.id);
      setState(prev => ({ ...prev, pendingCount: count }));
    } catch {
      // Ignore errors
    }
  }, [user?.id]);

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
  }, [refreshPendingCount, user?.id]);

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
