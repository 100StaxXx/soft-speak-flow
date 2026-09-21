export type OnboardingVisualPersona = "male" | "female" | "neutral";

export const ONBOARDING_VISUAL_PERSONA_QUESTION_ID = "visual_persona";

export const ONBOARDING_VISUAL_PERSONA_TAGS: Record<OnboardingVisualPersona, string> = {
  male: "visual_persona_male",
  female: "visual_persona_female",
  neutral: "visual_persona_neutral",
};

export const ONBOARDING_VISUAL_PERSONA_OPTIONS = [
  {
    optionId: "visual_persona_male",
    text: "Male",
    tags: [ONBOARDING_VISUAL_PERSONA_TAGS.male],
  },
  {
    optionId: "visual_persona_female",
    text: "Female",
    tags: [ONBOARDING_VISUAL_PERSONA_TAGS.female],
  },
  {
    optionId: "visual_persona_neutral",
    text: "Prefer not to say",
    tags: [ONBOARDING_VISUAL_PERSONA_TAGS.neutral],
  },
] as const;

export const isOnboardingVisualPersona = (value: unknown): value is OnboardingVisualPersona =>
  value === "male" || value === "female" || value === "neutral";

export const getOnboardingVisualPersonaFromTags = (
  tags: readonly string[] | null | undefined,
): OnboardingVisualPersona => {
  if (!Array.isArray(tags)) return "neutral";

  if (tags.includes(ONBOARDING_VISUAL_PERSONA_TAGS.male)) return "male";
  if (tags.includes(ONBOARDING_VISUAL_PERSONA_TAGS.female)) return "female";
  return "neutral";
};

export const getOnboardingVisualPersonaFromQuestionnaireRows = (
  rows: Array<{ question_id?: string | null; answer_tags?: string[] | null }> | null | undefined,
): OnboardingVisualPersona => {
  const visualPersonaRow = rows?.find(
    (row) => row.question_id === ONBOARDING_VISUAL_PERSONA_QUESTION_ID,
  );

  return getOnboardingVisualPersonaFromTags(visualPersonaRow?.answer_tags);
};
