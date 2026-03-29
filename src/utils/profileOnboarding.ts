import { getResolvedMentorId } from "./mentor";

type OnboardingAwareProfile = {
  selected_mentor_id?: string | null;
  onboarding_completed?: boolean | null;
  onboarding_data?: unknown;
} | null | undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const hasWalkthroughCompleted = (onboardingData: unknown): boolean => {
  if (!isRecord(onboardingData)) return false;
  return onboardingData.walkthrough_completed === true;
};

export const isReturningProfile = (profile: OnboardingAwareProfile): boolean => {
  if (!profile) return false;
  if (profile.onboarding_completed === true) return true;
  if (hasWalkthroughCompleted(profile.onboarding_data)) return true;
  if (profile.onboarding_completed === false) return false;

  return Boolean(getResolvedMentorId(profile));
};
