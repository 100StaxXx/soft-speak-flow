import { useCallback, useEffect, useMemo, useRef } from "react";

import { useCalendarIntegrations, type CalendarProvider } from "@/hooks/useCalendarIntegrations";
import { useQuestCalendarSync } from "@/hooks/useQuestCalendarSync";
import {
  CALENDAR_TASK_DELETE_REQUEST_EVENT,
  CALENDAR_TASK_UPDATED_EVENT,
  type CalendarTaskDeleteRequestDetail,
  type CalendarTaskUpdatedDetail,
} from "@/utils/calendarSyncEvents";

const BACKGROUND_SYNC_INTERVAL_MS = 2 * 60 * 1000;
const MIN_PROVIDER_SYNC_GAP_MS = 30 * 1000;
const TASK_UPDATE_DEBOUNCE_MS = 350;

interface GlobalCalendarSyncBridgeProps {
  enabled: boolean;
}

export function GlobalCalendarSyncBridge({ enabled }: GlobalCalendarSyncBridgeProps) {
  const { connections } = useCalendarIntegrations({ enabled });
  const { syncProviderPull, syncTaskUpdate, syncTaskDelete } = useQuestCalendarSync({ enabled });
  const syncProviderPullAsync = syncProviderPull.mutateAsync;
  const syncTaskUpdateAsync = syncTaskUpdate.mutateAsync;
  const syncTaskDeleteAsync = syncTaskDelete.mutateAsync;
  const inFlightProvidersRef = useRef(new Set<string>());
  const lastProviderSyncAtRef = useRef(new Map<string, number>());
  const taskUpdateTimersRef = useRef(new Map<string, number>());

  const providers = useMemo(
    () => connections
      .filter((connection) => (
        connection.sync_enabled !== false
        && connection.sync_mode === "full_sync"
        && (connection.provider === "google" || connection.provider === "outlook")
      ))
      .map((connection) => connection.provider as Exclude<CalendarProvider, "apple">),
    [connections],
  );
  const providerKey = providers.join(",");

  const syncProvider = useCallback(async (
    provider: Exclude<CalendarProvider, "apple">,
    force = false,
  ) => {
    const now = Date.now();
    if (inFlightProvidersRef.current.has(provider)) return;
    if (!force && now - (lastProviderSyncAtRef.current.get(provider) ?? 0) < MIN_PROVIDER_SYNC_GAP_MS) {
      return;
    }

    inFlightProvidersRef.current.add(provider);
    try {
      await syncProviderPullAsync({ provider });
      lastProviderSyncAtRef.current.set(provider, Date.now());
    } catch (error) {
      console.warn(`[CalendarSync] ${provider} background sync failed:`, error);
    } finally {
      inFlightProvidersRef.current.delete(provider);
    }
  }, [syncProviderPullAsync]);

  const syncAllProviders = useCallback((force = false) => {
    if (!enabled || document.visibilityState === "hidden") return;
    for (const provider of providers) {
      void syncProvider(provider, force);
    }
  }, [enabled, providerKey, syncProvider]);

  useEffect(() => {
    if (!enabled || providers.length === 0) return;

    syncAllProviders(true);
    const intervalId = window.setInterval(() => syncAllProviders(), BACKGROUND_SYNC_INTERVAL_MS);
    const handleFocus = () => syncAllProviders();
    const handleOnline = () => syncAllProviders(true);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") syncAllProviders();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, providerKey, syncAllProviders]);

  useEffect(() => {
    if (!enabled) return;

    const handleTaskUpdated = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<CalendarTaskUpdatedDetail>;
      const taskId = event.detail?.taskId;
      if (!taskId) return;

      const existingTimer = taskUpdateTimersRef.current.get(taskId);
      if (existingTimer !== undefined) window.clearTimeout(existingTimer);
      const timer = window.setTimeout(() => {
        taskUpdateTimersRef.current.delete(taskId);
        void syncTaskUpdateAsync({ taskId }).catch((error) => {
          console.warn("[CalendarSync] Failed to push linked task update:", error);
        });
      }, TASK_UPDATE_DEBOUNCE_MS);
      taskUpdateTimersRef.current.set(taskId, timer);
    };

    const handleTaskDeleteRequest = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<CalendarTaskDeleteRequestDetail>;
      const taskId = event.detail?.taskId;
      if (!taskId || typeof event.detail?.register !== "function") return;
      event.detail.register(syncTaskDeleteAsync({ taskId }));
    };

    window.addEventListener(CALENDAR_TASK_UPDATED_EVENT, handleTaskUpdated);
    window.addEventListener(CALENDAR_TASK_DELETE_REQUEST_EVENT, handleTaskDeleteRequest);
    return () => {
      window.removeEventListener(CALENDAR_TASK_UPDATED_EVENT, handleTaskUpdated);
      window.removeEventListener(CALENDAR_TASK_DELETE_REQUEST_EVENT, handleTaskDeleteRequest);
      for (const timer of taskUpdateTimersRef.current.values()) window.clearTimeout(timer);
      taskUpdateTimersRef.current.clear();
    };
  }, [enabled, syncTaskDeleteAsync, syncTaskUpdateAsync]);

  return null;
}
