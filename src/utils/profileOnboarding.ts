import { getResolvedMentorId } from "./mentor";

type OnboardingAwareProfile = {
  selected_mentor_id?: string | null;
  onboarding_completed?: boolean | null;
  onboarding_step?: string | null;
  onboarding_data?: unknown;
} | null | undefined;

export type EstablishedAccountReason =
  | "onboarding_completed"
  | "onboarding_step_complete"
  | "walkthrough_completed"
  | "companion_exists"
  | "legacy_resolved_mentor";

export type OnboardingResumeStep = "journey-begins";

export interface OnboardingGateState {
  isEstablished: boolean;
  needsOnboarding: boolean;
  needsCompanionMigration: boolean;
  needsProgressionReset: boolean;
  reason: EstablishedAccountReason | null;
  resumeStep: OnboardingResumeStep | null;
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

export const hasGuidedTutorialProgress = (onboardingData: unknown): boolean => {
  if (!isRecord(onboardingData)) return false;
  return isRecord(onboardingData.guided_tutorial);
};

const normalizeOnboardingData = (onboardingData: unknown): Record<string, unknown> =>
  isRecord(onboardingData) ? onboardingData : {};

const normalizeOnboardingStep = (
  onboardingStep: string | null | undefined,
): string | null => {
  if (typeof onboardingStep !== "string") return null;

  const normalized = onboardingStep.trim();
  return normalized.length > 0 ? normalized : null;
};

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
  const onboardingStep = normalizeOnboardingStep(profile?.onboarding_step);
  const isCompletionStep = onboardingStep === "complete";
  const needsJourneyBeginsRecovery =
    hasEggCompanion
    && !isCompletionStep
    && (
      onboardingStep === "journey-begins"
      || !hasGuidedTutorialProgress(profile?.onboarding_data)
    );
  let reason: EstablishedAccountReason | null = null;
  let resumeStep: OnboardingResumeStep | null = null;

  if (needsProgressionReset) {
    reason = null;
  } else if (needsCompanionMigration) {
    reason = null;
  } else if (needsJourneyBeginsRecovery) {
    resumeStep = "journey-begins";
  } else if (isCompletionStep) {
    reason = "onboarding_step_complete";
  } else if (profile?.onboarding_completed === true) {
    reason = "onboarding_completed";
  } else if (hasWalkthroughCompleted(profile?.onboarding_data)) {
    reason = "walkthrough_completed";
  } else if (hasPresetCompanion) {
    reason = "companion_exists";
  } else if (profile?.onboarding_completed == null && getResolvedMentorId(profile)) {
    reason = "legacy_resolved_mentor";
  }

  return {
    isEstablished: reason !== null,
    needsOnboarding: reason === null,
    needsCompanionMigration,
    needsProgressionReset,
    reason,
    resumeStep,
    hasCompanion,
    hasPresetCompanion,
    companionStage,
    shouldSelfHeal:
      !needsProgressionReset
      && !needsCompanionMigration
      && (reason === "companion_exists" || reason === "onboarding_step_complete"),
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
