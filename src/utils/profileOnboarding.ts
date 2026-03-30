import { getResolvedMentorId } from "./mentor";

type OnboardingAwareProfile = {
  selected_mentor_id?: string | null;
  onboarding_completed?: boolean | null;
  onboarding_data?: unknown;
} | null | undefined;

export type EstablishedAccountReason =
  | "onboarding_completed"
  | "walkthrough_completed"
  | "companion_exists"
  | "legacy_resolved_mentor";

export interface OnboardingGateState {
  isEstablished: boolean;
  needsOnboarding: boolean;
  reason: EstablishedAccountReason | null;
  hasCompanion: boolean;
  shouldSelfHeal: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const hasWalkthroughCompleted = (onboardingData: unknown): boolean => {
  if (!isRecord(onboardingData)) return false;
  return onboardingData.walkthrough_completed === true;
};

const normalizeOnboardingData = (onboardingData: unknown): Record<string, unknown> =>
  isRecord(onboardingData) ? onboardingData : {};

export const getOnboardingGateState = ({
  profile,
  hasCompanion = false,
}: {
  profile: OnboardingAwareProfile;
  hasCompanion?: boolean;
}): OnboardingGateState => {
  let reason: EstablishedAccountReason | null = null;

  if (profile?.onboarding_completed === true) {
    reason = "onboarding_completed";
  } else if (hasWalkthroughCompleted(profile?.onboarding_data)) {
    reason = "walkthrough_completed";
  } else if (hasCompanion) {
    reason = "companion_exists";
  } else if (profile?.onboarding_completed == null && getResolvedMentorId(profile)) {
    reason = "legacy_resolved_mentor";
  }

  return {
    isEstablished: reason !== null,
    needsOnboarding: reason === null,
    reason,
    hasCompanion,
    shouldSelfHeal: reason === "companion_exists",
  };
};

export const isReturningProfile = (
  profile: OnboardingAwareProfile,
  options: { hasCompanion?: boolean } = {},
): boolean => getOnboardingGateState({ profile, hasCompanion: options.hasCompanion }).isEstablished;

export const buildEstablishedProfileSelfHealPatch = ({
  profile,
  hasCompanion = false,
}: {
  profile: OnboardingAwareProfile;
  hasCompanion?: boolean;
}): { onboarding_completed: true; onboarding_data: Record<string, unknown> } | null => {
  const gate = getOnboardingGateState({ profile, hasCompanion });
  if (!gate.shouldSelfHeal) return null;

  const existingData = normalizeOnboardingData(profile?.onboarding_data);

  if (profile?.onboarding_completed === true && existingData.walkthrough_completed === true) {
    return null;
  }

  return {
    onboarding_completed: true,
    onboarding_data: {
      ...existingData,
      walkthrough_completed: true,
    },
  };
};
