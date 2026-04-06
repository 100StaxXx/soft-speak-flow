import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useResilience } from "@/contexts/ResilienceContext";
import { QueuedActionsSheet } from "@/components/resilience/QueuedActionsSheet";

const BANNER_STYLES: Record<string, string> = {
  offline: "bg-amber-600 text-white",
  degraded: "bg-amber-700 text-white",
  outage: "bg-red-700 text-white",
  recovering: "bg-sky-700 text-white",
  recovered: "bg-emerald-700 text-white",
};

export function ResilienceStatusBanner() {
  const navigate = useNavigate();
  const {
    state,
    queueCount,
    receipts,
    syncStatus,
    lastSyncError,
    retryNow,
    dismissDegraded,
  } = useResilience();
  const [showQueueSheet, setShowQueueSheet] = useState(false);

  const visible = state !== "healthy";
  const queuedForSyncCount = useMemo(
    () => receipts.filter((receipt) => receipt.status === "queued" || receipt.status === "syncing").length,
    [receipts],
  );
  const failedCount = useMemo(
    () => receipts.filter((receipt) => receipt.status === "failed").length,
    [receipts],
  );

  const message = useMemo(() => {
    switch (state) {
      case "offline":
        return `You're offline. ${queueCount} action${queueCount === 1 ? "" : "s"} queued.`;
      case "degraded":
        return "Service issues detected. We'll retry automatically.";
      case "outage":
        return "Server outage. Your actions are being queued locally.";
      case "recovering":
        if (syncStatus === "syncing" && queuedForSyncCount > 0) {
          return `Back online. Syncing ${queuedForSyncCount} action${queuedForSyncCount === 1 ? "" : "s"}...`;
        }
        if (failedCount > 0 && queuedForSyncCount === 0) {
          const retryMessage = lastSyncError ?? `${failedCount} action${failedCount === 1 ? "" : "s"} need${failedCount === 1 ? "s" : ""} retry.`;
          return retryMessage.startsWith("Back online.") ? retryMessage : `Back online. ${retryMessage}`;
        }
        if (queuedForSyncCount > 0) {
          return `Back online. ${queuedForSyncCount} action${queuedForSyncCount === 1 ? "" : "s"} queued for sync.`;
        }
        return `Back online. ${queueCount} action${queueCount === 1 ? "" : "s"} queued.`;
      case "recovered":
        return "All queued actions synced.";
      default:
        return "";
    }
  }, [failedCount, lastSyncError, queueCount, queuedForSyncCount, state, syncStatus]);

  if (!visible) return null;

  return (
    <>
      <div className={`sticky top-0 z-[60] border-b border-black/20 px-3 py-2 text-xs sm:text-sm ${BANNER_STYLES[state] ?? BANNER_STYLES.offline}`}>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium">{message}</p>
          {state !== "recovered" && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-2 text-xs"
                onClick={() => setShowQueueSheet(true)}
              >
                View queued actions
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-2 text-xs"
                onClick={() => void retryNow()}
              >
                Retry now
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-2 text-xs"
                onClick={() => navigate("/support/report")}
              >
                Report issue
              </Button>
              {state === "degraded" && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2 text-xs"
                  onClick={dismissDegraded}
                >
                  Dismiss
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <QueuedActionsSheet open={showQueueSheet} onOpenChange={setShowQueueSheet} />
    </>
  );
}
