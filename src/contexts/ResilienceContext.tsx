import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/hooks/useAuth";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { getErrorStatus, isQueueableWriteError, extractErrorMessage } from "@/utils/networkErrors";
import { trackResilienceEvent } from "@/utils/resilienceTelemetry";
import { deriveBaseResilienceState, deriveResilienceState } from "@/utils/resilienceState";
import { submitSupportReport } from "@/utils/supportReport";
import { sanitizeSupportReportPayload } from "@/utils/supportDiagnostics";
import type {
  BackendHealthState,
  QueuedActionReceipt,
  ResilienceState,
  SupportReportPayload,
} from "@/types/resilience";

const HEALTH_PROBE_INTERVAL_MS = 30_000;
const HEALTH_PROBE_TIMEOUT_MS = 8_000;
const OUTAGE_THRESHOLD = 3;
const DEGRADED_ERROR_THRESHOLD = 3;
const ERROR_WINDOW_MS = 2 * 60 * 1000;
const RECOVERED_BANNER_MS = 5_000;

export interface ResilienceContextValue {
  state: ResilienceState;
  isOnline: boolean;
  backendHealth: BackendHealthState;
  queueCount: number;
  lastHealthyAt: number | null;
  receipts: QueuedActionReceipt[];
  syncStatus: "idle" | "syncing" | "success" | "error";
  lastSyncError: string | null;
  shouldQueueWrites: boolean;
  retryAll: () => Promise<void>;
  retryAction: (id: string) => Promise<void>;
  discardAction: (id: string) => Promise<void>;
  retryNow: () => Promise<void>;
  queueAction: ReturnType<typeof useOfflineQueue>["queueAction"];
  queueTaskAction: ReturnType<typeof useOfflineQueue>["queueTaskAction"];
  reportIssue: (payload: SupportReportPayload) => Promise<{ queued: boolean; submitted: boolean }>;
  reportApiFailure: (error: unknown, context?: Record<string, unknown>) => void;
  recentErrorFingerprints: string[];
  dismissDegraded: () => void;
}

const ResilienceContext = createContext<ResilienceContextValue | undefined>(undefined);

function createErrorFingerprint(error: unknown, context?: Record<string, unknown>): string {
  const message = extractErrorMessage(error);
  const ctx = context && Object.keys(context).length > 0 ? JSON.stringify(context) : "";
  return `${message}${ctx ? ` | ${ctx}` : ""}`.slice(0, 220);
}

export function ResilienceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const {
    pendingCount,
    syncStatus,
    lastSyncError,
    receipts,
    queueAction,
    queueTaskAction,
    retryAction,
    retryAllFailed,
    discardAction,
    triggerSync,
  } = useOfflineQueue();

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [backendHealth, setBackendHealth] = useState<BackendHealthState>("unknown");
  const [probeFailures, setProbeFailures] = useState(0);
  const [lastHealthyAt, setLastHealthyAt] = useState<number | null>(null);
  const [recentErrorTimes, setRecentErrorTimes] = useState<number[]>([]);
  const [recentErrorFingerprints, setRecentErrorFingerprints] = useState<string[]>([]);
  const [showRecoveredUntil, setShowRecoveredUntil] = useState<number>(0);
  const [degradedDismissed, setDegradedDismissed] = useState(false);

  const hasIncidentRef = useRef(false);
  const lastBannerStateRef = useRef<ResilienceState | null>(null);

  const pruneErrorTimes = useCallback((times: number[], now: number) => {
    return times.filter((time) => now - time <= ERROR_WINDOW_MS);
  }, []);

  const reportApiFailure = useCallback(
    (error: unknown, context?: Record<string, unknown>) => {
      if (!isQueueableWriteError(error)) return;

      const now = Date.now();
      setRecentErrorTimes((prev) => pruneErrorTimes([...prev, now], now));
      setRecentErrorFingerprints((prev) => {
        const fingerprint = createErrorFingerprint(error, context);
        const next = [...prev, fingerprint];
        return next.slice(Math.max(0, next.length - 20));
      });
    },
    [pruneErrorTimes],
  );

  const runHealthProbe = useCallback(async () => {
    if (!isOnline) {
      setBackendHealth("unknown");
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    if (!supabaseUrl || !publishableKey) {
      setBackendHealth("unknown");
      return;
    }

    const abort = new AbortController();
    const timeoutId = window.setTimeout(() => abort.abort(), HEALTH_PROBE_TIMEOUT_MS);

    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
        method: "GET",
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
        },
        signal: abort.signal,
      });

      if (!response.ok) {
        throw new Error(`Health probe failed with ${response.status}`);
      }

      const now = Date.now();
      setProbeFailures(0);
      setBackendHealth("healthy");
      setLastHealthyAt(now);
    } catch (error) {
      reportApiFailure(error, { source: "health_probe" });
      setProbeFailures((prev) => prev + 1);
      setBackendHealth((prev) => (prev === "outage" ? "outage" : "degraded"));
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [isOnline, reportApiFailure]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setDegradedDismissed(false);
      void runHealthProbe();
    };

    const handleOffline = () => {
      setIsOnline(false);
      hasIncidentRef.current = true;
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [runHealthProbe]);

  useEffect(() => {
    if (!isOnline) return;

    void runHealthProbe();

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void runHealthProbe();
    }, HEALTH_PROBE_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [isOnline, runHealthProbe]);

  useEffect(() => {
    if (probeFailures >= OUTAGE_THRESHOLD) {
      setBackendHealth("outage");
      hasIncidentRef.current = true;
    }
  }, [probeFailures]);

  useEffect(() => {
    const now = Date.now();
    setRecentErrorTimes((prev) => {
      const pruned = pruneErrorTimes(prev, now);
      return pruned.length === prev.length ? prev : pruned;
    });
  }, [pruneErrorTimes, recentErrorTimes]);

  const recentErrorCount = useMemo(() => {
    const now = Date.now();
    return pruneErrorTimes(recentErrorTimes, now).length;
  }, [pruneErrorTimes, recentErrorTimes]);

  const degradedByErrors = recentErrorCount >= DEGRADED_ERROR_THRESHOLD;

  const baseState: ResilienceState = useMemo(
    () =>
      deriveBaseResilienceState({
        isOnline,
        backendHealth,
        probeFailures,
        outageThreshold: OUTAGE_THRESHOLD,
        hasIncident: hasIncidentRef.current,
        queueCount: pendingCount,
        degradedByErrors,
        degradedDismissed,
      }),
    [backendHealth, degradedByErrors, degradedDismissed, isOnline, pendingCount, probeFailures],
  );

  useEffect(() => {
    if (baseState === "offline" || baseState === "outage") {
      hasIncidentRef.current = true;
    }

    if ((baseState === "recovering" || hasIncidentRef.current) && pendingCount === 0 && isOnline && backendHealth === "healthy") {
      hasIncidentRef.current = false;
      setShowRecoveredUntil(Date.now() + RECOVERED_BANNER_MS);
      trackResilienceEvent("queue_recovered", {
        recoveredAt: new Date().toISOString(),
      });
    }
  }, [backendHealth, baseState, isOnline, pendingCount]);

  const state: ResilienceState = useMemo(
    () =>
      deriveResilienceState({
        isOnline,
        backendHealth,
        probeFailures,
        outageThreshold: OUTAGE_THRESHOLD,
        hasIncident: hasIncidentRef.current,
        queueCount: pendingCount,
        degradedByErrors,
        degradedDismissed,
        showRecoveredUntil,
      }),
    [
      backendHealth,
      degradedByErrors,
      degradedDismissed,
      isOnline,
      pendingCount,
      probeFailures,
      showRecoveredUntil,
    ],
  );

  useEffect(() => {
    if (state === "healthy") {
      lastBannerStateRef.current = null;
      return;
    }

    if (lastBannerStateRef.current === state) return;

    lastBannerStateRef.current = state;
    trackResilienceEvent("status_banner_shown", {
      state,
      queueCount: pendingCount,
      backendHealth,
    });
  }, [backendHealth, pendingCount, state]);

  const reportIssue = useCallback(
    async (payload: SupportReportPayload) => {
      if (!user?.id) throw new Error("You must be signed in to report issues");

      const sanitizedPayload = sanitizeSupportReportPayload(payload);

      if (!isOnline || state === "outage") {
        await queueAction({
          actionKind: "SUPPORT_REPORT",
          entityType: "support_report",
          entityId: sanitizedPayload.correlationId,
          payload: sanitizedPayload,
        });
        trackResilienceEvent("support_report_queued", { correlationId: sanitizedPayload.correlationId, reason: state });
        return { queued: true, submitted: false };
      }

      try {
        await submitSupportReport(sanitizedPayload);
        trackResilienceEvent("support_report_submitted", { correlationId: sanitizedPayload.correlationId });
        return { queued: false, submitted: true };
      } catch (error) {
        reportApiFailure(error, { source: "support_report_submit" });

        const status = getErrorStatus(error);
        if (status === 404 || isQueueableWriteError(error)) {
          await queueAction({
            actionKind: "SUPPORT_REPORT",
            entityType: "support_report",
            entityId: sanitizedPayload.correlationId,
            payload: sanitizedPayload,
          });
          trackResilienceEvent("support_report_queued", {
            correlationId: sanitizedPayload.correlationId,
            reason: "network_or_outage",
          });
          return { queued: true, submitted: false };
        }

        throw error;
      }
    },
    [isOnline, queueAction, reportApiFailure, state, user?.id],
  );

  const dismissDegraded = useCallback(() => {
    setDegradedDismissed(true);
  }, []);

  const shouldQueueWrites = !isOnline || state === "offline" || state === "outage";

  const value = useMemo<ResilienceContextValue>(
    () => ({
      state,
      isOnline,
      backendHealth,
      queueCount: pendingCount,
      lastHealthyAt,
      receipts: receipts.map((receipt) => ({
        id: receipt.id,
        actionKind: receipt.action_kind,
        entityType: receipt.entity_type,
        entityId: receipt.entity_id,
        status: receipt.status,
        retryCount: receipt.retry_count,
        lastError: receipt.last_error,
        createdAt: receipt.created_at,
        updatedAt: receipt.updated_at,
      })),
      syncStatus,
      lastSyncError,
      shouldQueueWrites,
      retryAll: retryAllFailed,
      retryAction,
      discardAction,
      retryNow: triggerSync,
      queueAction,
      queueTaskAction,
      reportIssue,
      reportApiFailure,
      recentErrorFingerprints,
      dismissDegraded,
    }),
    [
      backendHealth,
      dismissDegraded,
      isOnline,
      lastHealthyAt,
      lastSyncError,
      pendingCount,
      queueAction,
      queueTaskAction,
      receipts,
      recentErrorFingerprints,
      reportApiFailure,
      reportIssue,
      retryAction,
      retryAllFailed,
      shouldQueueWrites,
      state,
      syncStatus,
      triggerSync,
      discardAction,
    ],
  );

  return <ResilienceContext.Provider value={value}>{children}</ResilienceContext.Provider>;
}

export function useResilience() {
  const context = useContext(ResilienceContext);
  if (!context) {
    throw new Error("useResilience must be used within a ResilienceProvider");
  }
  return context;
}
