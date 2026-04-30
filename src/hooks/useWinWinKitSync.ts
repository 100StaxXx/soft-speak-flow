import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useStoreKit } from "@/hooks/useStoreKit";
import { WinWinKit } from "@/plugins/WinWinKitPlugin";
import { logger } from "@/utils/logger";
import { isNativeIOSHandheld } from "@/utils/platformTargets";
import {
  isRetriableFunctionInvokeError,
  parseFunctionInvokeError,
} from "@/utils/supabaseFunctionErrors";

const WINWINKIT_SYNC_RETRY_DELAYS_MS = [5_000, 30_000, 120_000] as const;

function isBrowserOffline() {
  return typeof navigator !== "undefined" && "onLine" in navigator && navigator.onLine === false;
}

export function useWinWinKitSync() {
  const { user, status } = useAuth();
  const { profile } = useProfile();
  const { isPro } = useStoreKit();
  const queryClient = useQueryClient();
  const lastSyncKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !user || !profile?.created_at) {
      lastSyncKeyRef.current = null;
      return;
    }

    const syncKey = [user.id, profile.created_at, isPro ? "premium" : "free"].join(":");
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

      const delayMs = WINWINKIT_SYNC_RETRY_DELAYS_MS[retryAttempt];
      if (typeof delayMs !== "number") {
        logger.debug("WinWinKit referral sync retry budget exhausted", { reason });
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
        logger.debug("WinWinKit referral sync deferred; will retry", context);
        scheduleRetry(parsed.category);
        return;
      }

      logger.error("WinWinKit referral sync failed", context);
    };

    async function sync(source: string) {
      if (cancelled || syncInFlight || lastSyncKeyRef.current === syncKey) {
        return;
      }

      if (isBrowserOffline()) {
        logger.debug("WinWinKit referral sync deferred while offline", { source });
        scheduleRetry("offline");
        return;
      }

      syncInFlight = true;
      const isNativeIOS = Capacitor.isNativePlatform() && isNativeIOSHandheld();

      try {
        if (isNativeIOS) {
          await WinWinKit.configure();
          await WinWinKit.setAppUserId({ appUserId: user.id });
          await WinWinKit.setFirstSeenAt({ isoDate: profile.created_at });
          await WinWinKit.setIsPremium({ isPremium: Boolean(isPro) });
        }

        const { data, error } = await supabase.functions.invoke("sync-winwinkit-user", {
          body: {
            first_seen_at: profile.created_at,
            is_premium: Boolean(isPro),
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
    isPro,
    profile?.created_at,
    profile?.referral_code,
    profile?.referred_by_code,
    queryClient,
    status,
    user,
  ]);
}
