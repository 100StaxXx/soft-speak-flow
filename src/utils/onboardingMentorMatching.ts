export type EnergyPreference = "masculine" | "feminine" | "neutral" | "no_preference";
export type MentorEnergy = "masculine" | "feminine" | "unknown";
export type GuidanceIntensity = "high" | "medium" | "gentle";

interface AnswerLike {
  questionId: string;
  optionId?: string | null;
  tags?: string[] | null;
}

interface MentorLike {
  gender_energy?: string | null;
  tags?: string[] | null;
  slug?: string | null;
}

const MASCULINE_BRANCH_SLUGS = new Set(["operator", "rival", "sage", "charles"]);
const FEMININE_BRANCH_SLUGS = new Set(["lyra", "princess", "icon", "sage", "charles"]);
const NEUTRAL_BRANCH_SLUGS = new Set(["sage", "charles"]);
const MASCULINE_SLUGS = new Set(["sage", "operator", "rival", "charles"]);
const FEMININE_SLUGS = new Set(["lyra", "princess", "icon"]);

const normalizeEnergy = (value?: string | null): MentorEnergy | null => {
  if (!value) return null;

  const normalized = value.toLowerCase().trim();
  if (["masculine", "male", "masc"].includes(normalized)) return "masculine";
  if (["feminine", "female", "fem"].includes(normalized)) return "feminine";

  return null;
};

export const getEnergyPreferenceFromAnswers = (
  answers: AnswerLike[],
): EnergyPreference => {
  const energyAnswer = answers.find((answer) => answer.questionId === "mentor_energy");
  if (energyAnswer?.optionId === "masculine_presence") return "masculine";
  if (energyAnswer?.optionId === "feminine_presence") return "feminine";
  if (energyAnswer?.optionId === "neutral_presence") return "neutral";
  if (energyAnswer?.optionId === "either_works") return "no_preference";
  if (!energyAnswer?.tags?.length) return "no_preference";

  const hasFeminine = energyAnswer.tags.includes("feminine_preference");
  const hasMasculine = energyAnswer.tags.includes("masculine_preference");
  const hasNeutral = energyAnswer.tags.includes("neutral_preference");

  if (hasMasculine && !hasFeminine) return "masculine";
  if (hasFeminine && !hasMasculine) return "feminine";
  if (hasNeutral && !hasMasculine && !hasFeminine) return "neutral";

  return "no_preference";
};

export const resolveMentorEnergy = (mentor: MentorLike): MentorEnergy => {
  const explicitEnergy = normalizeEnergy(mentor.gender_energy);
  if (explicitEnergy) return explicitEnergy;

  const normalizedTags = (mentor.tags ?? []).map((tag) => tag?.toLowerCase().trim());
  if (normalizedTags.includes("masculine") || normalizedTags.includes("male")) return "masculine";
  if (normalizedTags.includes("feminine") || normalizedTags.includes("female")) return "feminine";

  const slug = mentor.slug?.toLowerCase().trim();
  if (slug && MASCULINE_SLUGS.has(slug)) return "masculine";
  if (slug && FEMININE_SLUGS.has(slug)) return "feminine";

  return "unknown";
};

export const filterMentorsByEnergyPreference = <T extends MentorLike>(
  mentors: T[],
  preference: EnergyPreference,
): { candidates: T[] } => {
  if (preference === "no_preference") {
    return { candidates: mentors };
  }

  const filtered = mentors.filter((mentor) => {
    const slug = mentor.slug?.toLowerCase().trim();
    if (slug) {
      if (preference === "masculine" && MASCULINE_BRANCH_SLUGS.has(slug)) return true;
      if (preference === "feminine" && FEMININE_BRANCH_SLUGS.has(slug)) return true;
      if (preference === "neutral" && NEUTRAL_BRANCH_SLUGS.has(slug)) return true;
    }

    if (preference === "neutral") return false;
    return resolveMentorEnergy(mentor) === preference;
  });
  return { candidates: filtered };
};

export const getDesiredIntensityFromGuidanceTone = (
  answerText?: string | null,
): GuidanceIntensity => {
  if (!answerText) return "medium";

  const normalized = answerText.toLowerCase();
  if (normalized.includes("direct") && normalized.includes("challenging")) return "high";
  if (normalized.includes("aggressive") && normalized.includes("challenging")) return "high";
  if (normalized.includes("precise") && normalized.includes("no-nonsense")) return "high";
  if (normalized.includes("sharp") && normalized.includes("sarcastic")) return "medium";
  if (normalized.includes("calm") && normalized.includes("reflective")) return "gentle";
  if (normalized.includes("warm") && normalized.includes("encouraging")) return "gentle";
  if (normalized.includes("composed") && normalized.includes("polished")) return "medium";
  if (normalized.includes("composed") && normalized.includes("standards-first")) return "medium";
  if (normalized.includes("direct") && normalized.includes("demanding")) return "high";
  if (normalized.includes("gentle") && normalized.includes("compassionate")) return "gentle";
  if (normalized.includes("calm") && normalized.includes("grounded")) return "gentle";
  if (normalized.includes("encouraging") && normalized.includes("supportive")) return "medium";

  return "medium";
};
