import { useMemo } from "react";
import { useProfile } from "./useProfile";
import { useSubscription } from "./useSubscription";

/**
 * Centralized access status hook - single source of truth for user access level
 * 
 * Returns the user's current access status and related information.
 * This is the ONLY hook that should be used to determine premium access.
 * 
 * User States:
 * - "trial": User is in their 7-day free trial period
 * - "subscribed": User has an active paid subscription
 * - "free": Trial has expired and no active subscription (limited access)
 * 
 * @returns {Object} Access status information
 */
export interface AccessStatus {
  /** Current access status */
  status: "trial" | "subscribed" | "free" | "loading";
  
  /** Whether user has premium access (trial OR subscribed) */
  hasPremiumAccess: boolean;
  
  /** Whether user is currently in trial period */
  isInTrial: boolean;
  
  /** Whether user has an active paid subscription */
  isSubscribed: boolean;
  
  /** Days remaining in trial (0 if not in trial) */
  trialDaysRemaining: number;
  
  /** Date when trial ends (null if no trial info) */
  trialEndsAt: Date | null;
  
  /** Whether user should see paywall (trial expired AND not subscribed) */
  needsPaywall: boolean;
  
  /** Loading state */
  loading: boolean;
}

export function useAccessStatus(): AccessStatus {
  const { profile, loading: profileLoading } = useProfile();
  const { isActive: isSubscribed, isLoading: subscriptionLoading } = useSubscription();

  return useMemo(() => {
    const loading = profileLoading || subscriptionLoading;
    
    // Safe defaults while loading
    if (loading || !profile) {
      return {
        status: "loading" as const,
        hasPremiumAccess: false,
        isInTrial: false,
        isSubscribed: false,
        trialDaysRemaining: 0,
        trialEndsAt: null,
        needsPaywall: false,
        loading: true,
      };
    }

    // Parse trial end date with fallback to created_at + 7 days
    let trialEndsAt: Date | null = null;
    
    if (profile.trial_ends_at) {
      trialEndsAt = new Date(profile.trial_ends_at);
    } else if (profile.created_at) {
      // Defensive fallback: use profile creation date + 7 days
      // This should rarely happen now that we explicitly set trial_ends_at
      trialEndsAt = new Date(new Date(profile.created_at).getTime() + 7 * 24 * 60 * 60 * 1000);
      console.warn("trial_ends_at not set, falling back to created_at + 7 days");
    }
    
    const now = new Date();
    
    // Calculate trial status
    // If no trial date exists, assume trial is active (benefit of the doubt for new users)
    const trialActive = trialEndsAt ? now <= trialEndsAt : true;
    const trialExpired = trialEndsAt ? now > trialEndsAt : false;
    
    // Calculate days remaining (round up to show "1 day" until it's actually expired)
    let trialDaysRemaining = 0;
    if (trialEndsAt && trialActive) {
      const msRemaining = trialEndsAt.getTime() - now.getTime();
      trialDaysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    }

    // Determine access state
    // Priority: subscription > trial > free
    let status: "trial" | "subscribed" | "free";
    if (isSubscribed) {
      status = "subscribed";
    } else if (trialActive) {
      status = "trial";
    } else {
      status = "free";
    }

    // Premium access = subscribed OR in trial
    const hasPremiumAccess = isSubscribed || trialActive;
    
    // Paywall = trial expired AND not subscribed
    const needsPaywall = trialExpired && !isSubscribed;

    return {
      status,
      hasPremiumAccess,
      isInTrial: trialActive && !isSubscribed, // Only count as "trial" if not subscribed
      isSubscribed,
      trialDaysRemaining,
      trialEndsAt,
      needsPaywall,
      loading: false,
    };
  }, [profile, profileLoading, isSubscribed, subscriptionLoading]);
}
