import { useProfile } from "./useProfile";
import { useAccessState } from "./useAccessState";
import { hasConcludedGuidedTutorial } from "@/utils/guidedTutorial";

export type AccessSource = 'subscription' | 'promo_code' | 'trial' | 'none';
export type AccessGateReason = 'none' | 'pre_trial_signup' | 'trial_expired';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasGuidedTutorialCompleted = (onboardingData: unknown): boolean => {
  if (!isRecord(onboardingData)) return false;
  const guidedTutorial = onboardingData.guided_tutorial;
  return hasConcludedGuidedTutorial(guidedTutorial);
};

const hasLocalGuidedTutorialCompleted = (profileId: unknown): boolean => {
  if (typeof window === "undefined") return false;
  if (typeof profileId !== "string" || profileId.length === 0) return false;

  try {
    const storage = window.localStorage;
    if (!storage || typeof storage.getItem !== "function") return false;
    const raw = storage.getItem(`guided_tutorial_progress_${profileId}`);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    return hasConcludedGuidedTutorial(parsed);
  } catch {
    return false;
  }
};

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
  /** Why access is currently blocked */
  gateReason: AccessGateReason;
  /** Trial end date */
  trialEndsAt: Date | null;
  /** Loading state */
  loading: boolean;
}

export function useAccessStatus(): AccessStatus {
  const { profile, loading: profileLoading } = useProfile();
  const { accessState, isLoading: accessLoading } = useAccessState();
  const hasSubscriptionEntitlement = accessState.has_access && (
    accessState.subscribed || accessState.access_source === "trial"
  );

  const loading = profileLoading || accessLoading;

  // If still loading, return safe defaults (grant access during load to avoid flash)
  if (loading) {
    return {
      hasAccess: true, // Optimistic - don't block during load
      isSubscribed: false,
      isInTrial: false,
      trialExpired: false,
      trialDaysRemaining: 0,
      accessSource: 'none' as AccessSource,
      gateReason: 'none' as AccessGateReason,
      trialEndsAt: null,
      loading: true,
    };
  }

  // Profile should exist for authenticated users, but fail open if it does not.
  if (!profile) {
    return {
      hasAccess: true,
      isSubscribed: hasSubscriptionEntitlement && accessState.status !== "trialing",
      isInTrial: hasSubscriptionEntitlement && accessState.status === "trialing",
      trialExpired: false,
      trialDaysRemaining: 0,
      accessSource: hasSubscriptionEntitlement
        ? accessState.status === "trialing" ? 'trial' : 'subscription'
        : 'none',
      gateReason: 'none' as AccessGateReason,
      trialEndsAt: null,
      loading: false,
    };
  }

  const tutorialCompleted =
    hasGuidedTutorialCompleted(profile.onboarding_data) ||
    hasLocalGuidedTutorialCompleted(profile.id);

  const trialEndsAt = accessState.trial_ends_at ? new Date(accessState.trial_ends_at) : null;

  const now = new Date();
  const isInTrial = accessState.has_access && (
    accessState.access_source === "trial"
    || (accessState.access_source === "subscription" && accessState.status === "trialing")
  );
  const isSubscribed = hasSubscriptionEntitlement && !isInTrial;
  const trialExpired = !hasSubscriptionEntitlement && Boolean(trialEndsAt && now > trialEndsAt);

  let trialDaysRemaining = 0;
  if (isInTrial && trialEndsAt) {
    const msRemaining = trialEndsAt.getTime() - now.getTime();
    trialDaysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  }

  // Product rule: once guided tutorial concludes, unsubscribed users should land on the trial CTA gate.
  // This intentionally takes precedence over legacy trial timestamp fields.
  const needsPreTrialSignup = !hasSubscriptionEntitlement && tutorialCompleted;

  let hasAccess = true;
  let accessSource: AccessSource = 'none';
  let gateReason: AccessGateReason = 'none';

  if (hasSubscriptionEntitlement) {
    accessSource = accessState.access_source === 'promo_code'
      ? 'promo_code'
      : isInTrial
        ? 'trial'
        : 'subscription';
    hasAccess = true;
  } else if (needsPreTrialSignup) {
    hasAccess = false;
    gateReason = 'pre_trial_signup';
  } else if (accessState.has_access) {
    accessSource = accessState.access_source === 'trial' ? 'trial' : 'subscription';
    hasAccess = true;
  } else if (trialExpired) {
    hasAccess = false;
    gateReason = 'trial_expired';
  }

  return {
    hasAccess,
    isSubscribed,
    isInTrial,
    trialExpired: trialExpired && !isSubscribed,
    trialDaysRemaining: isInTrial ? trialDaysRemaining : 0,
    accessSource,
    gateReason,
    trialEndsAt,
    loading: false,
  };
}
