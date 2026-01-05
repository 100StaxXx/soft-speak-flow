import { useMemo } from "react";
import { useProfile } from "./useProfile";
import { useSubscription } from "./useSubscription";

export type AccessSource = 'subscription' | 'trial' | 'none';

interface AccessStatus {
  /** True if user has access via subscription OR active trial */
  hasAccess: boolean;
  /** True if user has an active paid subscription */
  isSubscribed: boolean;
  /** True if user is currently in their trial period */
  isInTrial: boolean;
  /** True if trial has expired (and not subscribed) */
  trialExpired: boolean;
  /** Days remaining in trial (0 if expired or subscribed) */
  trialDaysRemaining: number;
  /** Source of current access */
  accessSource: AccessSource;
  /** Trial end date */
  trialEndsAt: Date | null;
  /** Loading state */
  loading: boolean;
}

export function useAccessStatus(): AccessStatus {
  const { profile, loading: profileLoading } = useProfile();
  const { isActive: isSubscribed, isLoading: subscriptionLoading } = useSubscription();

  return useMemo(() => {
    const loading = profileLoading || subscriptionLoading;
    
    // If still loading, return safe defaults (grant access during load to avoid flash)
    if (loading || !profile) {
      return {
        hasAccess: true, // Optimistic - don't block during load
        isSubscribed: false,
        isInTrial: false,
        trialExpired: false,
        trialDaysRemaining: 0,
        accessSource: 'none' as AccessSource,
        trialEndsAt: null,
        loading: true,
      };
    }

    // Parse trial end date with fallback to created_at + 7 days
    let trialEndsAt: Date | null = null;
    
    if (profile.trial_ends_at) {
      trialEndsAt = new Date(profile.trial_ends_at);
    } else if (profile.created_at) {
      // Fallback: use profile creation date + 7 days
      trialEndsAt = new Date(new Date(profile.created_at).getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    
    const now = new Date();
    
    // Calculate trial status
    const trialExpired = trialEndsAt ? now > trialEndsAt : false;
    const isInTrial = trialEndsAt ? now <= trialEndsAt : true;
    
    // Calculate days remaining (round up to show "1 day" until it's actually expired)
    let trialDaysRemaining = 0;
    if (trialEndsAt && !trialExpired) {
      const msRemaining = trialEndsAt.getTime() - now.getTime();
      trialDaysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    }

    // Determine access source and overall access
    let accessSource: AccessSource = 'none';
    let hasAccess = false;

    if (isSubscribed) {
      accessSource = 'subscription';
      hasAccess = true;
    } else if (isInTrial) {
      accessSource = 'trial';
      hasAccess = true;
    }

    return {
      hasAccess,
      isSubscribed,
      isInTrial: isInTrial && !isSubscribed, // Only show as "in trial" if not subscribed
      trialExpired: trialExpired && !isSubscribed,
      trialDaysRemaining: isSubscribed ? 0 : trialDaysRemaining,
      accessSource,
      trialEndsAt,
      loading: false,
    };
  }, [profile, profileLoading, isSubscribed, subscriptionLoading]);
}
