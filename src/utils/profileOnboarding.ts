import { getResolvedMentorId } from "./mentor";

type OnboardingAwareProfile = {
  selected_mentor_id?: string | null;
  onboarding_completed?: boolean | null;
  onboarding_data?: unknown;
} | null | undefined;

export const isReturningProfile = (profile: OnboardingAwareProfile): boolean => {
  if (!profile) return false;
  if (profile.onboarding_completed === true) return true;
  if (profile.onboarding_completed === false) return false;

  return Boolean(getResolvedMentorId(profile));
};
