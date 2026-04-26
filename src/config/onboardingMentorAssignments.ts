import { resolveActiveMentorSlug } from "@/lib/mentorRoster";

export const ENERGY_OPTION_IDS = [
  "feminine_presence",
  "masculine_presence",
  "either_works",
] as const;

export const FOCUS_OPTION_IDS = [
  "clarity_mindset",
  "emotions_healing",
  "discipline_performance",
  "confidence_self_belief",
] as const;

export const TONE_OPTION_IDS = [
  "gentle_compassionate",
  "encouraging_supportive",
  "calm_grounded",
  "direct_demanding",
] as const;

export const PROGRESS_OPTION_IDS = [
  "principles_logic",
  "emotional_reassurance",
  "belief_support",
  "pressure_standards",
] as const;

export type EnergyOptionId = (typeof ENERGY_OPTION_IDS)[number];
export type FocusOptionId = (typeof FOCUS_OPTION_IDS)[number];
export type ToneOptionId = (typeof TONE_OPTION_IDS)[number];
export type ProgressOptionId = (typeof PROGRESS_OPTION_IDS)[number];

export type OnboardingAssignmentKey =
  `${EnergyOptionId}|${FocusOptionId}|${ToneOptionId}|${ProgressOptionId}`;

export const ACTIVE_ONBOARDING_MENTOR_SLUGS = [
  "sage",
  "lyra",
  "icon",
  "charles",
  "princess",
  "operator",
  "rival",
] as const;

export type OnboardingMentorSlug = (typeof ACTIVE_ONBOARDING_MENTOR_SLUGS)[number];

export type AssignmentAnswerInput = {
  questionId: string;
  optionId?: string | null;
};

type MentorScoreCard = {
  focus: Record<FocusOptionId, number>;
  tone: Record<ToneOptionId, number>;
  progress: Record<ProgressOptionId, number>;
};

const ENERGY_CANDIDATES: Record<EnergyOptionId, readonly OnboardingMentorSlug[]> = {
  feminine_presence: ["princess", "icon", "lyra"],
  masculine_presence: ["sage", "operator", "rival", "charles"],
  either_works: ["sage", "lyra", "icon", "charles", "princess", "operator", "rival"],
};

const MENTOR_PRIORITY: readonly OnboardingMentorSlug[] = [
  "operator",
  "icon",
  "sage",
  "lyra",
  "princess",
  "rival",
  "charles",
];

const SCORE_CARDS: Record<OnboardingMentorSlug, MentorScoreCard> = {
  sage: {
    focus: {
      clarity_mindset: 5,
      emotions_healing: 5,
      discipline_performance: 1,
      confidence_self_belief: 2,
    },
    tone: {
      gentle_compassionate: 3,
      encouraging_supportive: 2,
      calm_grounded: 5,
      direct_demanding: 1,
    },
    progress: {
      principles_logic: 4,
      emotional_reassurance: 4,
      belief_support: 3,
      pressure_standards: 1,
    },
  },
  lyra: {
    focus: {
      clarity_mindset: 5,
      emotions_healing: 4,
      discipline_performance: 1,
      confidence_self_belief: 3,
    },
    tone: {
      gentle_compassionate: 4,
      encouraging_supportive: 3,
      calm_grounded: 5,
      direct_demanding: 0,
    },
    progress: {
      principles_logic: 4,
      emotional_reassurance: 4,
      belief_support: 4,
      pressure_standards: 0,
    },
  },
  icon: {
    focus: {
      clarity_mindset: 2,
      emotions_healing: 1,
      discipline_performance: 2,
      confidence_self_belief: 6,
    },
    tone: {
      gentle_compassionate: 1,
      encouraging_supportive: 4,
      calm_grounded: 3,
      direct_demanding: 4,
    },
    progress: {
      principles_logic: 3,
      emotional_reassurance: 1,
      belief_support: 6,
      pressure_standards: 5,
    },
  },
  charles: {
    focus: {
      clarity_mindset: 1,
      emotions_healing: 0,
      discipline_performance: 3,
      confidence_self_belief: 1,
    },
    tone: {
      gentle_compassionate: 0,
      encouraging_supportive: 0,
      calm_grounded: 0,
      direct_demanding: 3,
    },
    progress: {
      principles_logic: 1,
      emotional_reassurance: 0,
      belief_support: 0,
      pressure_standards: 3,
    },
  },
  princess: {
    focus: {
      clarity_mindset: 2,
      emotions_healing: 5,
      discipline_performance: 3,
      confidence_self_belief: 4,
    },
    tone: {
      gentle_compassionate: 5,
      encouraging_supportive: 5,
      calm_grounded: 3,
      direct_demanding: 0,
    },
    progress: {
      principles_logic: 1,
      emotional_reassurance: 5,
      belief_support: 5,
      pressure_standards: 2,
    },
  },
  operator: {
    focus: {
      clarity_mindset: 5,
      emotions_healing: 0,
      discipline_performance: 5,
      confidence_self_belief: 2,
    },
    tone: {
      gentle_compassionate: 0,
      encouraging_supportive: 1,
      calm_grounded: 4,
      direct_demanding: 5,
    },
    progress: {
      principles_logic: 5,
      emotional_reassurance: 0,
      belief_support: 2,
      pressure_standards: 5,
    },
  },
  rival: {
    focus: {
      clarity_mindset: 1,
      emotions_healing: 0,
      discipline_performance: 6,
      confidence_self_belief: 3,
    },
    tone: {
      gentle_compassionate: 0,
      encouraging_supportive: 3,
      calm_grounded: 0,
      direct_demanding: 5,
    },
    progress: {
      principles_logic: 2,
      emotional_reassurance: 0,
      belief_support: 3,
      pressure_standards: 6,
    },
  },
};

const ALLOWED_OPTION_IDS = new Set<string>([
  ...ENERGY_OPTION_IDS,
  ...FOCUS_OPTION_IDS,
  ...TONE_OPTION_IDS,
  ...PROGRESS_OPTION_IDS,
]);

const PRIORITY_INDEX = new Map(
  MENTOR_PRIORITY.map((slug, index) => [slug, index]),
);

const isEnergyOptionId = (value: string): value is EnergyOptionId =>
  (ENERGY_OPTION_IDS as readonly string[]).includes(value);

const isOnboardingMentorSlug = (value: string): value is OnboardingMentorSlug =>
  (ACTIVE_ONBOARDING_MENTOR_SLUGS as readonly string[]).includes(value);

const getOptionId = (answers: AssignmentAnswerInput[], questionId: string): string | null => {
  const answer = answers.find((candidate) => candidate.questionId === questionId);
  if (!answer?.optionId) return null;

  const normalizedOptionId = answer.optionId.trim();
  if (!normalizedOptionId || !ALLOWED_OPTION_IDS.has(normalizedOptionId)) return null;
  return normalizedOptionId;
};

export const buildOnboardingAssignmentKey = (
  answers: AssignmentAnswerInput[],
): OnboardingAssignmentKey | null => {
  const energyOptionId = getOptionId(answers, "mentor_energy");
  const focusOptionId = getOptionId(answers, "focus_area");
  const toneOptionId = getOptionId(answers, "guidance_tone");
  const progressOptionId = getOptionId(answers, "progress_style");

  if (!energyOptionId || !focusOptionId || !toneOptionId || !progressOptionId) return null;

  return `${energyOptionId}|${focusOptionId}|${toneOptionId}|${progressOptionId}` as OnboardingAssignmentKey;
};

const getMentorScore = (
  mentorSlug: OnboardingMentorSlug,
  focusOptionId: FocusOptionId,
  toneOptionId: ToneOptionId,
  progressOptionId: ProgressOptionId,
): number => {
  const card = SCORE_CARDS[mentorSlug];
  let score =
    card.focus[focusOptionId]
    + card.tone[toneOptionId]
    + card.progress[progressOptionId];

  if (mentorSlug === "sage" && toneOptionId === "calm_grounded") {
    score += 1;
  }

  if (
    mentorSlug === "sage"
    && focusOptionId === "clarity_mindset"
    && toneOptionId === "calm_grounded"
    && progressOptionId === "principles_logic"
  ) {
    score += 2;
  }

  if (
    mentorSlug === "princess"
    && (focusOptionId === "emotions_healing" || focusOptionId === "confidence_self_belief")
    && (toneOptionId === "gentle_compassionate" || toneOptionId === "encouraging_supportive")
  ) {
    score += 1;
  }

  if (
    mentorSlug === "princess"
    && focusOptionId === "confidence_self_belief"
    && toneOptionId === "gentle_compassionate"
    && progressOptionId === "belief_support"
  ) {
    score += 2;
  }

  if (
    mentorSlug === "operator"
    && focusOptionId === "clarity_mindset"
    && progressOptionId === "principles_logic"
  ) {
    score += 2;
  }

  if (
    mentorSlug === "operator"
    && focusOptionId === "discipline_performance"
    && progressOptionId === "pressure_standards"
  ) {
    score += 2;
  }

  if (mentorSlug === "operator" && toneOptionId === "gentle_compassionate") {
    score -= 1;
  }

  if (mentorSlug === "operator" && progressOptionId === "emotional_reassurance") {
    score -= 1;
  }

  if (mentorSlug === "operator" && focusOptionId === "emotions_healing") {
    score -= 2;
  }

  if (
    mentorSlug === "rival"
    && focusOptionId === "discipline_performance"
    && toneOptionId === "direct_demanding"
  ) {
    score += 1;
  }

  if (mentorSlug === "rival" && toneOptionId === "gentle_compassionate") {
    score -= 4;
  }

  if (mentorSlug === "rival" && progressOptionId === "emotional_reassurance") {
    score -= 3;
  }

  if (
    mentorSlug === "rival"
    && focusOptionId === "confidence_self_belief"
    && toneOptionId === "encouraging_supportive"
    && progressOptionId === "belief_support"
  ) {
    score -= 3;
  }

  if (
    mentorSlug === "icon"
    && focusOptionId === "confidence_self_belief"
    && progressOptionId === "pressure_standards"
  ) {
    score += 2;
  }

  if (
    mentorSlug === "icon"
    && focusOptionId === "confidence_self_belief"
    && progressOptionId === "belief_support"
  ) {
    score += 2;
  }

  if (mentorSlug === "icon" && focusOptionId === "emotions_healing") {
    score -= 2;
  }

  if (mentorSlug === "icon" && progressOptionId === "emotional_reassurance") {
    score -= 1;
  }

  if (
    mentorSlug === "charles"
    && focusOptionId === "discipline_performance"
    && toneOptionId === "direct_demanding"
    && progressOptionId === "pressure_standards"
  ) {
    score += 12;
  }

  return score;
};

const selectMentorForCombination = (
  energyOptionId: EnergyOptionId,
  focusOptionId: FocusOptionId,
  toneOptionId: ToneOptionId,
  progressOptionId: ProgressOptionId,
): OnboardingMentorSlug => {
  const candidates = ENERGY_CANDIDATES[energyOptionId];
  const winner = [...candidates].sort((left, right) => {
    const scoreDelta =
      getMentorScore(right, focusOptionId, toneOptionId, progressOptionId)
      - getMentorScore(left, focusOptionId, toneOptionId, progressOptionId);

    if (scoreDelta !== 0) return scoreDelta;

    return (PRIORITY_INDEX.get(left) ?? 999) - (PRIORITY_INDEX.get(right) ?? 999);
  })[0];

  return winner;
};

export const ONBOARDING_MENTOR_ASSIGNMENTS: Record<OnboardingAssignmentKey, OnboardingMentorSlug> =
  Object.fromEntries(
    ENERGY_OPTION_IDS.flatMap((energyOptionId) =>
      FOCUS_OPTION_IDS.flatMap((focusOptionId) =>
        TONE_OPTION_IDS.flatMap((toneOptionId) =>
          PROGRESS_OPTION_IDS.map((progressOptionId) => {
            const key =
              `${energyOptionId}|${focusOptionId}|${toneOptionId}|${progressOptionId}` as OnboardingAssignmentKey;

            return [
              key,
              selectMentorForCombination(
                energyOptionId,
                focusOptionId,
                toneOptionId,
                progressOptionId,
              ),
            ];
          }),
        ),
      ),
    ),
  ) as Record<OnboardingAssignmentKey, OnboardingMentorSlug>;

export const SAME_ENERGY_FALLBACKS: Record<EnergyOptionId, readonly OnboardingMentorSlug[]> = {
  feminine_presence: ["princess", "icon", "lyra"],
  masculine_presence: ["sage", "operator", "rival", "charles"],
  either_works: ["sage", "lyra", "princess", "operator", "icon", "rival", "charles"],
};

export const resolvePreassignedMentorSlug = (
  answers: AssignmentAnswerInput[],
): OnboardingMentorSlug | null => {
  const key = buildOnboardingAssignmentKey(answers);
  if (!key) return null;
  return ONBOARDING_MENTOR_ASSIGNMENTS[key] ?? null;
};

export interface AssignedMentorResolution<TMentor> {
  mentor: TMentor | null;
  requestedSlug: OnboardingMentorSlug | null;
  resolvedSlug: OnboardingMentorSlug | null;
  usedFallback: boolean;
}

export const resolveAssignedMentorFromActiveMentors = <TMentor extends { slug?: string | null }>(
  answers: AssignmentAnswerInput[],
  activeMentors: TMentor[],
): AssignedMentorResolution<TMentor> => {
  const activeBySlug = new Map<OnboardingMentorSlug, TMentor>();
  activeMentors.forEach((mentor) => {
    const resolvedSlug = resolveActiveMentorSlug(mentor.slug);
    if (!resolvedSlug || !isOnboardingMentorSlug(resolvedSlug)) return;
    activeBySlug.set(resolvedSlug, mentor);
  });

  const requestedSlug = resolvePreassignedMentorSlug(answers);
  if (requestedSlug) {
    const requestedMentor = activeBySlug.get(requestedSlug);
    if (requestedMentor) {
      return {
        mentor: requestedMentor,
        requestedSlug,
        resolvedSlug: requestedSlug,
        usedFallback: false,
      };
    }
  }

  const energyOptionCandidate = getOptionId(answers, "mentor_energy");
  const energyOptionId: EnergyOptionId =
    energyOptionCandidate && isEnergyOptionId(energyOptionCandidate)
      ? energyOptionCandidate
      : "either_works";

  for (const fallbackSlug of SAME_ENERGY_FALLBACKS[energyOptionId]) {
    const fallbackMentor = activeBySlug.get(fallbackSlug);
    if (!fallbackMentor) continue;

    return {
      mentor: fallbackMentor,
      requestedSlug,
      resolvedSlug: fallbackSlug,
      usedFallback: true,
    };
  }

  return {
    mentor: null,
    requestedSlug,
    resolvedSlug: null,
    usedFallback: true,
  };
};
