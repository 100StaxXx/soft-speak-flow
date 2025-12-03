import { useMemo } from "react";
import { useProfile } from "./useProfile";
import { useSubscription } from "./useSubscription";

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
  const { profile, loading: profileLoading } = useProfile();
  const { isActive, isLoading: subscriptionLoading } = useSubscription();

  return useMemo(() => {
    const loading = profileLoading || subscriptionLoading;
    
    // If still loading, return safe defaults
    if (loading || !profile) {
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

    const isSubscribed = isActive;
    
    // Parse trial end date with fallback to created_at + 7 days
    let trialEndsAt: Date | null = null;
    
    if (profile.trial_ends_at) {
      trialEndsAt = new Date(profile.trial_ends_at);
    } else if (profile.created_at) {
      // Fallback: use profile creation date + 7 days
      trialEndsAt = new Date(new Date(profile.created_at).getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    
    const now = new Date();
    
    // Calculate trial status - default to NOT expired if no date (benefit of doubt for new users)
    const trialExpired = trialEndsAt ? now > trialEndsAt : false;
    const isInTrial = trialEndsAt ? now <= trialEndsAt : true;
    
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
  }, [profile, profileLoading, isActive, subscriptionLoading]);
}
