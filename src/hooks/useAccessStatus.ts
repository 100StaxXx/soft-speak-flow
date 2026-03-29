import { useProfile } from "./useProfile";
import { useAccessState } from "./useAccessState";

export type AccessSource = 'subscription' | 'promo_code' | 'trial' | 'none';
export type AccessGateReason = 'none' | 'pre_trial_signup' | 'trial_expired';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasGuidedTutorialCompleted = (onboardingData: Record<string, unknown> | null): boolean => {
  if (!isRecord(onboardingData)) return false;
  const guidedTutorial = onboardingData.guided_tutorial;
  if (!isRecord(guidedTutorial)) return false;
  return guidedTutorial.completed === true;
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
    if (!isRecord(parsed)) return false;
    return parsed.completed === true;
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
  const isSubscribed = accessState.subscribed;

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
      isSubscribed,
      isInTrial: false,
      trialExpired: false,
      trialDaysRemaining: 0,
      accessSource: isSubscribed ? 'subscription' : 'none',
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
  const isInTrial = accessState.access_source === "trial" && accessState.has_access;
  const trialExpired = !isSubscribed && !accessState.has_access && Boolean(trialEndsAt && now > trialEndsAt);

  let trialDaysRemaining = 0;
  if (isInTrial && trialEndsAt) {
    const msRemaining = trialEndsAt.getTime() - now.getTime();
    trialDaysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  }

  // Product rule: once guided tutorial concludes, unsubscribed users should land on the trial CTA gate.
  // This intentionally takes precedence over legacy trial timestamp fields.
  const needsPreTrialSignup = !isSubscribed && tutorialCompleted;

  let hasAccess = true;
  let accessSource: AccessSource = 'none';
  let gateReason: AccessGateReason = 'none';

  if (isSubscribed) {
    accessSource = accessState.access_source === 'promo_code' ? 'promo_code' : 'subscription';
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
    isInTrial: isInTrial && !isSubscribed,
    trialExpired: trialExpired && !isSubscribed,
    trialDaysRemaining: isSubscribed ? 0 : trialDaysRemaining,
    accessSource,
    gateReason,
    trialEndsAt,
    loading: false,
  };
}
