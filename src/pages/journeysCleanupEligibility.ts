export const hasWalkthroughCompleted = (
  onboardingData: Record<string, unknown> | null | undefined
): boolean => onboardingData?.walkthrough_completed === true;

export const isOnboardingCleanupEligible = (
  profileLoading: boolean,
  onboardingCompleted: boolean | null | undefined,
  onboardingData: Record<string, unknown> | null | undefined
): boolean => {
  if (profileLoading) return false;
  return onboardingCompleted === true || hasWalkthroughCompleted(onboardingData);
};
