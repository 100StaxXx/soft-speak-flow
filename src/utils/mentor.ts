type MentorAwareProfile = {
  selected_mentor_id?: string | null;
  onboarding_data?: unknown;
} | null;

export const getResolvedMentorId = (profile: MentorAwareProfile): string | null => {
  if (!profile) return null;

  const onboardingMentorId = (profile.onboarding_data as { mentorId?: string | null } | null)?.mentorId;

  return profile.selected_mentor_id ?? onboardingMentorId ?? null;
};
