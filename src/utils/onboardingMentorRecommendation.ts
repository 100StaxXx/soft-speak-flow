import {
  canonicalizeTags,
  getCanonicalTag,
  MENTOR_FALLBACK_TAGS,
} from "@/config/mentorMatching";
import {
  filterMentorsByEnergyPreference,
  getDesiredIntensityFromGuidanceTone,
  getEnergyPreferenceFromAnswers,
  type EnergyPreference,
} from "@/utils/onboardingMentorMatching";

export interface OnboardingMentorLike {
  id: string;
  slug: string;
  tags?: string[] | null;
  themes?: string[] | null;
  intensity_level?: string | null;
  gender_energy?: string | null;
}

export interface OnboardingAnswerLike {
  questionId: string;
  answer?: string | null;
  tags: string[];
}

export interface OnboardingMentorScore<TMentor extends OnboardingMentorLike = OnboardingMentorLike> {
  mentor: TMentor;
  score: number;
  exactMatches: number;
  intensityMatch: boolean;
}

export interface OnboardingMentorRecommendationResult<
  TMentor extends OnboardingMentorLike = OnboardingMentorLike,
> {
  mentor: TMentor | null;
  energyPreference: EnergyPreference;
  usedEnergyFallback: boolean;
  reason: "ok" | "no_active_mentors";
  mentorScores: OnboardingMentorScore<TMentor>[];
  topScore: number;
}

const QUESTION_WEIGHT_BY_ID: Record<string, number> = {
  mentor_energy: 1.0,
  focus_area: 1.5,
  guidance_tone: 1.3,
  progress_style: 1.1,
};

const QUESTION_WEIGHT_COUNT = Object.keys(QUESTION_WEIGHT_BY_ID).length;
const QUESTION_WEIGHT_TOTAL = Object.values(QUESTION_WEIGHT_BY_ID).reduce(
  (sum, value) => sum + value,
  0,
);

const normalizeIntensityLevel = (value?: string | null): "high" | "medium" | "gentle" => {
  const normalized = value?.toLowerCase();
  if (!normalized) return "medium";
  if (["gentle", "soft", "low"].includes(normalized)) return "gentle";
  if (["high", "strong", "intense"].includes(normalized)) return "high";
  return "medium";
};

const pickRandom = <T>(items: T[], randomFn: () => number): T | null => {
  if (items.length === 0) return null;
  const randomIndex = Math.floor(randomFn() * items.length);
  return items[randomIndex] ?? null;
};

const toCanonicalMentorTags = (mentor: OnboardingMentorLike): string[] => {
  const normalized = canonicalizeTags([...(mentor.tags ?? []), ...(mentor.themes ?? [])]);
  if (normalized.length > 0) return normalized;
  return MENTOR_FALLBACK_TAGS[mentor.slug] ?? [];
};

export const recommendMentorFromAnswers = <TMentor extends OnboardingMentorLike>(
  mentors: TMentor[],
  questionAnswers: OnboardingAnswerLike[],
  options?: {
    randomFn?: () => number;
  },
): OnboardingMentorRecommendationResult<TMentor> => {
  const energyPreference = getEnergyPreferenceFromAnswers(questionAnswers);

  if (mentors.length === 0) {
    return {
      mentor: null,
      energyPreference,
      usedEnergyFallback: false,
      reason: "no_active_mentors",
      mentorScores: [],
      topScore: 0,
    };
  }

  const randomFn = options?.randomFn ?? Math.random;

  const canonicalTagWeights: Record<string, number> = {};
  questionAnswers.forEach((answer) => {
    const weight = QUESTION_WEIGHT_BY_ID[answer.questionId] ?? 1.0;
    answer.tags.forEach((tag) => {
      const canonical = getCanonicalTag(tag);
      if (!canonical) return;
      canonicalTagWeights[canonical] = (canonicalTagWeights[canonical] ?? 0) + weight;
    });
  });

  const toneAnswer = questionAnswers.find((answer) => answer.questionId === "guidance_tone");
  const desiredIntensity = getDesiredIntensityFromGuidanceTone(toneAnswer?.answer ?? "");

  const { candidates } = filterMentorsByEnergyPreference(mentors, energyPreference);
  const usedEnergyFallback = energyPreference !== "no_preference" && candidates.length === 0;
  const mentorsForScoring = usedEnergyFallback ? mentors : candidates;

  const mentorScores: OnboardingMentorScore<TMentor>[] = mentorsForScoring.map((mentor) => {
    const mentorCanonicalTags = toCanonicalMentorTags(mentor);

    let score = 0;
    let exactMatches = 0;

    mentorCanonicalTags.forEach((tag) => {
      const tagWeight = canonicalTagWeights[tag];
      if (!tagWeight) return;
      score += tagWeight;
      exactMatches += 1;
    });

    const mentorIntensity = normalizeIntensityLevel(mentor.intensity_level);
    const intensityMatch = mentorIntensity === desiredIntensity;
    if (intensityMatch) {
      score += 0.8;
    }

    return {
      mentor,
      score,
      exactMatches,
      intensityMatch,
    };
  });

  mentorScores.sort((a, b) => b.score - a.score);

  const topScore = mentorScores[0]?.score ?? 0;
  const topMentors = mentorScores.filter((mentorScore) => mentorScore.score === topScore);

  let bestMatch: TMentor | null = null;

  if (topMentors.length === 1) {
    bestMatch = topMentors[0].mentor;
  } else if (topMentors.length > 1) {
    const intensityMatches = topMentors.filter((mentorScore) => mentorScore.intensityMatch);

    if (intensityMatches.length === 1) {
      bestMatch = intensityMatches[0].mentor;
    } else if (intensityMatches.length > 1) {
      intensityMatches.sort((a, b) => b.exactMatches - a.exactMatches);
      const topExactMatches = intensityMatches[0].exactMatches;
      const topExactMatchMentors = intensityMatches.filter(
        (mentorScore) => mentorScore.exactMatches === topExactMatches,
      );
      bestMatch = pickRandom(
        topExactMatchMentors.map((mentorScore) => mentorScore.mentor),
        randomFn,
      );
    } else {
      topMentors.sort((a, b) => b.exactMatches - a.exactMatches);
      const topExactMatches = topMentors[0].exactMatches;
      const topExactMatchMentors = topMentors.filter(
        (mentorScore) => mentorScore.exactMatches === topExactMatches,
      );
      bestMatch = pickRandom(
        topExactMatchMentors.map((mentorScore) => mentorScore.mentor),
        randomFn,
      );
    }
  }

  if (!bestMatch || topScore === 0) {
    bestMatch =
      mentorsForScoring.find((mentor) => mentor.slug === "atlas") ??
      mentorsForScoring.find((mentor) => mentor.slug === "eli") ??
      mentorsForScoring[0] ??
      null;
  }

  return {
    mentor: bestMatch,
    energyPreference,
    usedEnergyFallback,
    reason: "ok",
    mentorScores,
    topScore,
  };
};

export const calculateMentorCompatibilityPercent = (
  mentor: OnboardingMentorLike,
  bestScore: number,
): number => {
  const mentorTags = toCanonicalMentorTags(mentor);
  const maxScore =
    Math.max(mentorTags.length * (QUESTION_WEIGHT_TOTAL / QUESTION_WEIGHT_COUNT) * 2, 4) + 0.8;
  const rawPercent = Math.round((bestScore / maxScore) * 100);
  return Math.max(65, Math.min(99, rawPercent));
};
