type MentorAwareProfile = {
  selected_mentor_id?: string | null;
  onboarding_completed?: boolean | null;
  onboarding_data?: unknown;
} | null;

type MentorReferenceError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
} | null | undefined;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const getOnboardingMentorId = (profile: MentorAwareProfile): string | null => {
  if (!profile || !isRecord(profile.onboarding_data)) return null;

  const candidate = profile.onboarding_data.mentorId;
  if (typeof candidate !== "string") return null;

  const mentorId = candidate.trim();
  if (!mentorId) return null;

  return UUID_REGEX.test(mentorId) ? mentorId : null;
};

export const stripOnboardingMentorId = (onboardingData: unknown): Record<string, unknown> => {
  if (!isRecord(onboardingData)) return {};

  const { mentorId: _mentorId, ...rest } = onboardingData;
  return rest;
};

export const isInvalidMentorReferenceError = (error: MentorReferenceError): boolean => {
  if (!error) return false;
  if (error.code === "23503") return true;

  const haystack = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return haystack.includes("profiles_selected_mentor_id_fkey") || haystack.includes("foreign key");
};

export const getResolvedMentorId = (profile: MentorAwareProfile): string | null => {
  if (!profile) return null;
  if (profile.selected_mentor_id) return profile.selected_mentor_id;

  const onboardingMentorId = getOnboardingMentorId(profile);
  if (!onboardingMentorId) return null;

  // Only trust onboarding fallback while onboarding is still in progress.
  if (profile.onboarding_completed === true) return null;

  return onboardingMentorId;
};
