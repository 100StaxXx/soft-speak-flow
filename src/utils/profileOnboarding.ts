import { getResolvedMentorId } from "./mentor";
import { hasValidCompanionStage } from "@/lib/companionPredicates";

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

export const ONBOARDING_RESUME_STEPS = [
  "prologue",
  "destiny",
  "faction",
  "questionnaire",
  "mentor-result",
  "mentor-grid",
  "story-tone",
  "egg-prelude",
  "companion",
  "journey-begins",
] as const;

export type OnboardingResumeStep = typeof ONBOARDING_RESUME_STEPS[number];

const ONBOARDING_RESUME_STEP_SET = new Set<string>(ONBOARDING_RESUME_STEPS);

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

export const hasResolvedGuidedTutorialProgress = (onboardingData: unknown): boolean => {
  if (!isRecord(onboardingData)) return false;
  const guidedTutorial = onboardingData.guided_tutorial;
  if (!isRecord(guidedTutorial)) return false;
  return guidedTutorial.completed === true || guidedTutorial.dismissed === true;
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
  hasCompanionImages = false,
}: {
  profile: OnboardingAwareProfile;
  hasCompanion?: boolean;
  hasPresetCompanion?: boolean;
  companionStage?: number | null;
  hasCompanionImages?: boolean;
}): OnboardingGateState => {
  const walkthroughCompleted = hasWalkthroughCompleted(profile?.onboarding_data);
  const hasResolvedGuidedTutorial = hasResolvedGuidedTutorialProgress(profile?.onboarding_data);
  const needsProgressionReset = hasProgressionResetPending(profile?.onboarding_data);
  const hasStageZeroEggCompanion = hasCompanion && companionStage === 0;
  const hasInvalidCompanionStage = hasCompanion && !hasValidCompanionStage({ current_stage: companionStage });
  const needsCompanionMigration = hasCompanion && (
    hasInvalidCompanionStage
    || (!hasPresetCompanion && !hasCompanionImages)
  );
  const onboardingStep = normalizeOnboardingStep(profile?.onboarding_step);
  const isCompletionStep = onboardingStep === "complete";
  const inProgressResumeStep = onboardingStep && ONBOARDING_RESUME_STEP_SET.has(onboardingStep)
    ? onboardingStep as OnboardingResumeStep
    : null;
  const needsJourneyBeginsRecovery =
    hasCompanion
    && !walkthroughCompleted
    && !isCompletionStep
    && (
      onboardingStep === "journey-begins"
      || (hasStageZeroEggCompanion && !hasResolvedGuidedTutorial)
    );
  let reason: EstablishedAccountReason | null = null;
  let resumeStep: OnboardingResumeStep | null = null;

  if (needsProgressionReset) {
    reason = null;
  } else if (needsCompanionMigration) {
    reason = null;
  } else if (needsJourneyBeginsRecovery) {
    resumeStep = "journey-begins";
  } else if (inProgressResumeStep && !walkthroughCompleted && !isCompletionStep) {
    resumeStep = inProgressResumeStep;
  } else if (isCompletionStep) {
    reason = "onboarding_step_complete";
  } else if (profile?.onboarding_completed === true) {
    reason = "onboarding_completed";
  } else if (walkthroughCompleted) {
    reason = "walkthrough_completed";
  } else if (hasCompanion && !hasStageZeroEggCompanion) {
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
  options: {
    hasCompanion?: boolean;
    hasPresetCompanion?: boolean;
    companionStage?: number | null;
    hasCompanionImages?: boolean;
  } = {},
): boolean => getOnboardingGateState({
  profile,
  hasCompanion: options.hasCompanion,
  hasPresetCompanion: options.hasPresetCompanion,
  companionStage: options.companionStage,
  hasCompanionImages: options.hasCompanionImages,
}).isEstablished;

export const buildEstablishedProfileSelfHealPatch = ({
  profile,
  hasCompanion = false,
  hasPresetCompanion = false,
  companionStage = null,
  hasCompanionImages = false,
}: {
  profile: OnboardingAwareProfile;
  hasCompanion?: boolean;
  hasPresetCompanion?: boolean;
  companionStage?: number | null;
  hasCompanionImages?: boolean;
}): { onboarding_completed: true; onboarding_data: Record<string, unknown> } | null => {
  const gate = getOnboardingGateState({
    profile,
    hasCompanion,
    hasPresetCompanion,
    companionStage,
    hasCompanionImages,
  });
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
