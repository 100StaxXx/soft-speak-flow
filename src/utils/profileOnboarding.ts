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
  | "egg_selected"
  | "legacy_resolved_mentor";

export interface OnboardingGateState {
  isEstablished: boolean;
  needsOnboarding: boolean;
  needsCompanionMigration: boolean;
  needsProgressionReset: boolean;
  reason: EstablishedAccountReason | null;
  hasCompanion: boolean;
  hasPresetCompanion: boolean;
  companionStage: number | null;
  shouldSelfHeal: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const hasWalkthroughCompleted = (onboardingData: unknown): boolean => {
  if (!isRecord(onboardingData)) return false;
  return onboardingData.walkthrough_completed === true;
};

export const hasProgressionResetPending = (onboardingData: unknown): boolean => {
  if (!isRecord(onboardingData)) return false;
  return onboardingData.progression_reset_required === true;
};

const normalizeOnboardingData = (onboardingData: unknown): Record<string, unknown> =>
  isRecord(onboardingData) ? onboardingData : {};

export const getOnboardingGateState = ({
  profile,
  hasCompanion = false,
  hasPresetCompanion = false,
  companionStage = null,
}: {
  profile: OnboardingAwareProfile;
  hasCompanion?: boolean;
  hasPresetCompanion?: boolean;
  companionStage?: number | null;
}): OnboardingGateState => {
  const needsProgressionReset = hasProgressionResetPending(profile?.onboarding_data);
  const hasEggCompanion = hasCompanion && !hasPresetCompanion && companionStage === 0;
  const needsCompanionMigration = hasCompanion && !hasPresetCompanion && companionStage !== 0;
  let reason: EstablishedAccountReason | null = null;

  if (needsProgressionReset) {
    reason = null;
  } else if (needsCompanionMigration) {
    reason = null;
  } else if (profile?.onboarding_completed === true) {
    reason = "onboarding_completed";
  } else if (hasWalkthroughCompleted(profile?.onboarding_data)) {
      reason = "walkthrough_completed";
  } else if (hasPresetCompanion) {
    reason = "companion_exists";
  } else if (hasEggCompanion) {
    reason = "egg_selected";
  } else if (profile?.onboarding_completed == null && getResolvedMentorId(profile)) {
    reason = "legacy_resolved_mentor";
  }

  return {
    isEstablished: reason !== null,
    needsOnboarding: reason === null,
    needsCompanionMigration,
    needsProgressionReset,
    reason,
    hasCompanion,
    hasPresetCompanion,
    companionStage,
    shouldSelfHeal: !needsProgressionReset && (reason === "companion_exists" || reason === "egg_selected") && !needsCompanionMigration,
  };
};

export const isReturningProfile = (
  profile: OnboardingAwareProfile,
  options: { hasCompanion?: boolean; hasPresetCompanion?: boolean; companionStage?: number | null } = {},
): boolean => getOnboardingGateState({
  profile,
  hasCompanion: options.hasCompanion,
  hasPresetCompanion: options.hasPresetCompanion,
  companionStage: options.companionStage,
}).isEstablished;

export const buildEstablishedProfileSelfHealPatch = ({
  profile,
  hasCompanion = false,
  hasPresetCompanion = false,
  companionStage = null,
}: {
  profile: OnboardingAwareProfile;
  hasCompanion?: boolean;
  hasPresetCompanion?: boolean;
  companionStage?: number | null;
}): { onboarding_completed: true; onboarding_data: Record<string, unknown> } | null => {
  const gate = getOnboardingGateState({ profile, hasCompanion, hasPresetCompanion, companionStage });
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
