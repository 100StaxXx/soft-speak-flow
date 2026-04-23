import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useStoreKit } from "@/hooks/useStoreKit";
import { invalidateProfileAccessQueries } from "@/lib/profileAccessQueryCache";
import { WinWinKit } from "@/plugins/WinWinKitPlugin";
import { isNativeIOSHandheld } from "@/utils/platformTargets";

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

    const sync = async () => {
      const isNativeIOS = Capacitor.isNativePlatform() && isNativeIOSHandheld();

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
        void invalidateProfileAccessQueries(queryClient, {
          userId: user.id,
          includeProfileDetail: true,
          includeReferralStatsDetail: true,
          includeAppliedReferralCodeStateDetail: true,
        });
      }

      lastSyncKeyRef.current = syncKey;
    };

    void sync().catch((error) => {
      console.error("[WinWinKit] Failed to sync referral state:", error);
    });

    return () => {
      cancelled = true;
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
