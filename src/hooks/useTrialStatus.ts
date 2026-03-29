import { useMemo } from "react";
import { useAccessState } from "./useAccessState";

interface TrialStatus {
  isInTrial: boolean;
  trialDaysRemaining: number;
  trialExpired: boolean;
  isSubscribed: boolean;
  needsPaywall: boolean;
  trialEndsAt: Date | null;
  loading: boolean;
}

export function useTrialStatus(): TrialStatus {
  const { accessState, isLoading } = useAccessState();

  return useMemo(() => {
    // If still loading, return safe defaults
    if (isLoading) {
      return {
        isInTrial: false,
        trialDaysRemaining: 0,
        trialExpired: false,
        isSubscribed: false,
        needsPaywall: false,
        trialEndsAt: null,
        loading: true,
      };
    }

    const isSubscribed = accessState.subscribed;
    const trialEndsAt = accessState.trial_ends_at ? new Date(accessState.trial_ends_at) : null;
    const now = new Date();
    const isInTrial = accessState.access_source === "trial" && accessState.has_access;
    const trialExpired = !isSubscribed && !accessState.has_access && Boolean(trialEndsAt && now > trialEndsAt);
    
    // Calculate days remaining (round up to show "1 day" until it's actually expired)
    let trialDaysRemaining = 0;
    if (trialEndsAt && !trialExpired) {
      const msRemaining = trialEndsAt.getTime() - now.getTime();
      trialDaysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    }

    // User needs paywall if trial expired AND not subscribed
    const needsPaywall = trialExpired && !isSubscribed;

    return {
      isInTrial,
      trialDaysRemaining,
      trialExpired,
      isSubscribed,
      needsPaywall,
      trialEndsAt,
        loading: false,
      };
  }, [accessState, isLoading]);
}
