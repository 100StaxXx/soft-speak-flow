import { useProfile } from "./useProfile";
import { useAccessState } from "./useAccessState";
import { hasCompletedFinalTutorialCloseout } from "@/utils/guidedTutorial";

export type AccessSource = 'subscription' | 'promo_code' | 'trial' | 'none';
export type AccessGateReason = 'none' | 'pre_trial_signup' | 'trial_expired';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasGuidedTutorialCompleted = (onboardingData: unknown): boolean => {
  if (!isRecord(onboardingData)) return false;
  const guidedTutorial = onboardingData.guided_tutorial;
  return hasCompletedFinalTutorialCloseout(guidedTutorial);
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
    return hasCompletedFinalTutorialCloseout(parsed);
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

  // Entitlement checks fail closed while they are unresolved. ProtectedRoute can
  // keep a previously resolved decision for the same user during background
  // refreshes, but a new session must never inherit optimistic access.
  if (loading) {
    return {
      hasAccess: false,
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

  // Profile data is part of the access decision. A missing profile must not
  // become an implicit entitlement.
  if (!profile) {
    return {
      hasAccess: false,
      isSubscribed,
      isInTrial: false,
      trialExpired: false,
      trialDaysRemaining: 0,
      accessSource: isSubscribed ? 'subscription' : 'none',
      gateReason: 'pre_trial_signup' as AccessGateReason,
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
