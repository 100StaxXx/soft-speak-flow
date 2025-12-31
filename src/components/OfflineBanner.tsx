import { useEffect, useState, useCallback } from "react";
import { WifiOff, RefreshCw, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { Button } from "@/components/ui/button";

export const OfflineBanner = () => {
  const { isOnline, pendingCount, wasOffline, clearWasOffline } = useOfflineStatus();
  const { syncStatus, triggerSync } = useOfflineQueue();
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  // Show success message briefly after sync
  useEffect(() => {
    if (syncStatus === "success") {
      setShowSyncSuccess(true);
      const timer = setTimeout(() => {
        setShowSyncSuccess(false);
        clearWasOffline();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [syncStatus, clearWasOffline]);

  const handleSync = useCallback(async () => {
    await triggerSync();
  }, [triggerSync]);

  // Show offline banner
  if (!isOnline) {
    return (
      <div className={cn(
        "fixed top-0 left-0 right-0 z-50 px-4 py-2",
        "bg-gradient-to-r from-amber-600 to-orange-600",
        "text-white flex items-center justify-center gap-2 text-sm",
        "animate-fade-in"
      )}>
        <WifiOff className="h-4 w-4" />
        <span className="font-medium">You're offline</span>
        {pendingCount > 0 && (
          <span className="text-amber-100">
            • {pendingCount} action{pendingCount > 1 ? "s" : ""} pending sync
          </span>
        )}
      </div>
    );
  }

  // Show sync banner when back online with pending actions
  if (wasOffline && pendingCount > 0) {
    return (
      <div className={cn(
        "fixed top-0 left-0 right-0 z-50 px-4 py-2",
        "bg-gradient-to-r from-sky-600 to-blue-600",
        "text-white flex items-center justify-center gap-2 text-sm",
        "animate-fade-in"
      )}>
        <Check className="h-4 w-4" />
        <span className="font-medium">Back online!</span>
        <span className="text-sky-100">
          {pendingCount} action{pendingCount > 1 ? "s" : ""} ready to sync
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSync}
          disabled={syncStatus === "syncing"}
          className="ml-2 h-6 px-2 text-white hover:bg-white/20"
        >
          <RefreshCw className={cn(
            "h-3 w-3 mr-1",
            syncStatus === "syncing" && "animate-spin"
          )} />
          {syncStatus === "syncing" ? "Syncing..." : "Sync now"}
        </Button>
      </div>
    );
  }

  // Show success banner briefly
  if (showSyncSuccess) {
    return (
      <div className={cn(
        "fixed top-0 left-0 right-0 z-50 px-4 py-2",
        "bg-gradient-to-r from-green-600 to-emerald-600",
        "text-white flex items-center justify-center gap-2 text-sm",
        "animate-fade-in"
      )}>
        <Check className="h-4 w-4" />
        <span className="font-medium">All synced!</span>
      </div>
    );
  }

  // Show error banner if sync failed
  if (syncStatus === "error" && pendingCount > 0) {
    return (
      <div className={cn(
        "fixed top-0 left-0 right-0 z-50 px-4 py-2",
        "bg-gradient-to-r from-red-600 to-rose-600",
        "text-white flex items-center justify-center gap-2 text-sm",
        "animate-fade-in"
      )}>
        <AlertCircle className="h-4 w-4" />
        <span className="font-medium">Sync failed</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSync}
          className="ml-2 h-6 px-2 text-white hover:bg-white/20"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  return null;
};
