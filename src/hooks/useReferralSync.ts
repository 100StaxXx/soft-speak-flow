import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccessState } from "@/hooks/useAccessState";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { logger } from "@/utils/logger";
import {
  isRetriableFunctionInvokeError,
  parseFunctionInvokeError,
} from "@/utils/supabaseFunctionErrors";

const REFERRAL_SYNC_RETRY_DELAYS_MS = [5_000, 30_000, 120_000] as const;

function isBrowserOffline() {
  return typeof navigator !== "undefined" && "onLine" in navigator && navigator.onLine === false;
}

export function useReferralSync() {
  const { user, status } = useAuth();
  const { profile } = useProfile();
  const { accessState, isLoading: accessLoading } = useAccessState();
  const queryClient = useQueryClient();
  const lastSyncKeyRef = useRef<string | null>(null);
  const isPremium = Boolean(
    accessState.has_access &&
    accessState.subscribed &&
    accessState.access_source === "subscription",
  );

  useEffect(() => {
    if (status !== "authenticated" || !user || !profile?.created_at || accessLoading) {
      lastSyncKeyRef.current = null;
      return;
    }

    const syncKey = [user.id, profile.created_at, isPremium ? "premium" : "free"].join(":");
    if (lastSyncKeyRef.current === syncKey) {
      return;
    }

    let cancelled = false;
    let syncInFlight = false;
    let retryAttempt = 0;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const clearRetry = () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }
    };

    const scheduleRetry = (reason: string) => {
      if (cancelled || lastSyncKeyRef.current === syncKey || retryTimeout) {
        return;
      }

      const delayMs = REFERRAL_SYNC_RETRY_DELAYS_MS[retryAttempt];
      if (typeof delayMs !== "number") {
        logger.debug("Referral sync retry budget exhausted", { reason });
        return;
      }

      retryAttempt += 1;
      retryTimeout = setTimeout(() => {
        retryTimeout = null;
        void sync("retry").catch((error) => {
          void handleSyncError(error, "retry");
        });
      }, delayMs);
    };

    const shouldRetrySyncError = async (error: unknown) => {
      const parsed = await parseFunctionInvokeError(error);
      return {
        parsed,
        retryable:
          isRetriableFunctionInvokeError(error) ||
          parsed.category === "network" ||
          parsed.category === "relay" ||
          parsed.category === "rate_limit",
      };
    };

    const handleSyncError = async (error: unknown, source: string) => {
      if (cancelled) {
        return;
      }

      const { parsed, retryable } = await shouldRetrySyncError(error);
      const context = {
        category: parsed.category,
        isOffline: parsed.isOffline,
        message: parsed.backendMessage ?? parsed.message,
        name: parsed.name,
        retryAttempt,
        source,
        status: parsed.status,
      };

      if (retryable) {
        logger.debug("Referral sync deferred; will retry", context);
        scheduleRetry(parsed.category);
        return;
      }

      logger.error("Referral sync failed", context);
    };

    async function sync(source: string) {
      if (cancelled || syncInFlight || lastSyncKeyRef.current === syncKey) {
        return;
      }

      if (isBrowserOffline()) {
        logger.debug("Referral sync deferred while offline", { source });
        scheduleRetry("offline");
        return;
      }

      syncInFlight = true;

      try {
        const { data, error } = await supabase.functions.invoke("sync-referral-user", {
          body: {
            is_premium: isPremium,
          },
        });

        if (error) {
          throw error;
        }

        if (cancelled) {
          return;
        }

        const syncedReferralCode = typeof data?.user?.referral_code === "string"
          ? data.user.referral_code
          : null;
        const syncedReferredByCode = typeof data?.user?.referred_by?.code === "string"
          ? data.user.referred_by.code
          : null;

        if (
          syncedReferralCode !== (profile.referral_code ?? null) ||
          syncedReferredByCode !== (profile.referred_by_code ?? null)
        ) {
          queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
          queryClient.invalidateQueries({ queryKey: ["referral-stats", user.id] });
          queryClient.invalidateQueries({ queryKey: ["applied-referral-code-state", user.id] });
        }

        lastSyncKeyRef.current = syncKey;
        retryAttempt = 0;
        clearRetry();
      } finally {
        syncInFlight = false;
      }
    }

    const retryNow = () => {
      clearRetry();
      void sync("online").catch((error) => {
        void handleSyncError(error, "online");
      });
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", retryNow);
    }

    void sync("initial").catch((error) => {
      void handleSyncError(error, "initial");
    });

    return () => {
      cancelled = true;
      clearRetry();
      if (typeof window !== "undefined") {
        window.removeEventListener("online", retryNow);
      }
    };
  }, [
    accessLoading,
    isPremium,
    profile?.created_at,
    profile?.referral_code,
    profile?.referred_by_code,
    queryClient,
    status,
    user,
  ]);
}
