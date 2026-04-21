import {
  ACTIVE_MENTOR_SLUGS,
  isActiveMentorSlug,
  resolveActiveMentorSlug,
  type ActiveMentorSlug,
} from "@/lib/mentorRoster";

export const ENERGY_OPTION_IDS = [
  "feminine_presence",
  "masculine_presence",
  "neutral_presence",
  "either_works",
] as const;

export const FOCUS_OPTION_IDS = [
  "clarity_signal",
  "standards_identity",
  "gentle_routines",
  "execution_pressure",
] as const;

export const TONE_OPTION_IDS = [
  "calm_reflective",
  "composed_polished",
  "warm_encouraging",
  "direct_challenging",
] as const;

export const PROGRESS_OPTION_IDS = [
  "perspective_next_step",
  "identity_alignment",
  "gentle_accountability",
  "hard_accountability",
] as const;

export const CLARITY_LENS_OPTION_IDS = [
  "calm_perspective",
  "pattern_strategy",
  "standards_self_command",
] as const;

export const PRESSURE_STYLE_OPTION_IDS = [
  "systems_precision",
  "prove_it_pressure",
  "sarcastic_callout",
] as const;

export type EnergyOptionId = (typeof ENERGY_OPTION_IDS)[number];
export type FocusOptionId = (typeof FOCUS_OPTION_IDS)[number];
export type ToneOptionId = (typeof TONE_OPTION_IDS)[number];
export type ProgressOptionId = (typeof PROGRESS_OPTION_IDS)[number];
export type ClarityLensOptionId = (typeof CLARITY_LENS_OPTION_IDS)[number];
export type PressureStyleOptionId = (typeof PRESSURE_STYLE_OPTION_IDS)[number];

export type ClarifierQuestionId = "clarity_lens" | "pressure_style";
export type ClarifierOptionId = ClarityLensOptionId | PressureStyleOptionId;

export const ACTIVE_ONBOARDING_MENTOR_SLUGS = ACTIVE_MENTOR_SLUGS;
export type OnboardingMentorSlug = ActiveMentorSlug;

export type AssignmentAnswerInput = {
  questionId: string;
  optionId?: string | null;
};

type WeightedQuestionId =
  | "focus_area"
  | "guidance_tone"
  | "progress_style"
  | ClarifierQuestionId;

type MentorProfile = {
  focus: FocusOptionId;
  tone: ToneOptionId;
  progress: ProgressOptionId;
  clarifierQuestionId?: ClarifierQuestionId;
  clarifierOptionId?: ClarifierOptionId;
};

type ScoredMentor = {
  slug: OnboardingMentorSlug;
  score: number;
  primaryMatches: number;
};

const BASE_WEIGHT_BY_QUESTION: Record<WeightedQuestionId, number> = {
  focus_area: 5,
  guidance_tone: 4,
  progress_style: 4,
  clarity_lens: 6,
  pressure_style: 6,
};

const ENERGY_CANDIDATES: Record<EnergyOptionId, readonly OnboardingMentorSlug[]> = {
  feminine_presence: ["lyra", "icon", "princess", "sage", "charles"],
  masculine_presence: ["operator", "rival", "sage", "charles"],
  neutral_presence: ["sage", "charles"],
  either_works: ["sage", "lyra", "icon", "princess", "operator", "rival", "charles"],
};

const PRIORITY_BY_ENERGY: Record<EnergyOptionId, readonly OnboardingMentorSlug[]> = {
  feminine_presence: ["lyra", "icon", "princess", "sage", "charles"],
  masculine_presence: ["operator", "rival", "sage", "charles"],
  neutral_presence: ["sage", "charles"],
  either_works: ["sage", "lyra", "icon", "princess", "operator", "rival", "charles"],
};

const CLARITY_BRANCH_SLUGS = new Set<OnboardingMentorSlug>(["sage", "lyra", "icon"]);
const DIRECT_BRANCH_SLUGS = new Set<OnboardingMentorSlug>(["operator", "rival", "charles"]);

const MENTOR_PROFILES: Record<OnboardingMentorSlug, MentorProfile> = {
  sage: {
    focus: "clarity_signal",
    tone: "calm_reflective",
    progress: "perspective_next_step",
    clarifierQuestionId: "clarity_lens",
    clarifierOptionId: "calm_perspective",
  },
  lyra: {
    focus: "clarity_signal",
    tone: "composed_polished",
    progress: "perspective_next_step",
    clarifierQuestionId: "clarity_lens",
    clarifierOptionId: "pattern_strategy",
  },
  icon: {
    focus: "standards_identity",
    tone: "composed_polished",
    progress: "identity_alignment",
    clarifierQuestionId: "clarity_lens",
    clarifierOptionId: "standards_self_command",
  },
  charles: {
    focus: "execution_pressure",
    tone: "direct_challenging",
    progress: "hard_accountability",
    clarifierQuestionId: "pressure_style",
    clarifierOptionId: "sarcastic_callout",
  },
  princess: {
    focus: "gentle_routines",
    tone: "warm_encouraging",
    progress: "gentle_accountability",
  },
  operator: {
    focus: "execution_pressure",
    tone: "direct_challenging",
    progress: "hard_accountability",
    clarifierQuestionId: "pressure_style",
    clarifierOptionId: "systems_precision",
  },
  rival: {
    focus: "execution_pressure",
    tone: "direct_challenging",
    progress: "hard_accountability",
    clarifierQuestionId: "pressure_style",
    clarifierOptionId: "prove_it_pressure",
  },
};

const SECONDARY_SCORE_BONUSES: Partial<Record<OnboardingMentorSlug, Partial<Record<string, number>>>> = {
  lyra: {
    standards_identity: 1,
  },
  icon: {
    clarity_signal: 1,
  },
};

const ALLOWED_OPTION_IDS = new Set<string>([
  ...ENERGY_OPTION_IDS,
  ...FOCUS_OPTION_IDS,
  ...TONE_OPTION_IDS,
  ...PROGRESS_OPTION_IDS,
  ...CLARITY_LENS_OPTION_IDS,
  ...PRESSURE_STYLE_OPTION_IDS,
]);

const isEnergyOptionId = (value: string): value is EnergyOptionId =>
  (ENERGY_OPTION_IDS as readonly string[]).includes(value);

const getOptionId = (answers: AssignmentAnswerInput[], questionId: string): string | null => {
  const answer = answers.find((candidate) => candidate.questionId === questionId);
  if (!answer?.optionId) return null;

  const normalizedOptionId = answer.optionId.trim();
  if (!normalizedOptionId || !ALLOWED_OPTION_IDS.has(normalizedOptionId)) return null;
  return normalizedOptionId;
};

const resolveEnergyOptionId = (answers: AssignmentAnswerInput[]): EnergyOptionId => {
  const energyOptionCandidate = getOptionId(answers, "mentor_energy");
  return energyOptionCandidate && isEnergyOptionId(energyOptionCandidate)
    ? energyOptionCandidate
    : "either_works";
};

const scoreMentor = (
  mentorSlug: OnboardingMentorSlug,
  answers: AssignmentAnswerInput[],
): ScoredMentor => {
  const mentorProfile = MENTOR_PROFILES[mentorSlug];
  let score = 0;
  let primaryMatches = 0;

  const focusOptionId = getOptionId(answers, "focus_area");
  if (focusOptionId && focusOptionId === mentorProfile.focus) {
    score += BASE_WEIGHT_BY_QUESTION.focus_area;
    primaryMatches += 1;
  }

  const toneOptionId = getOptionId(answers, "guidance_tone");
  if (toneOptionId && toneOptionId === mentorProfile.tone) {
    score += BASE_WEIGHT_BY_QUESTION.guidance_tone;
    primaryMatches += 1;
  }

  const progressOptionId = getOptionId(answers, "progress_style");
  if (progressOptionId && progressOptionId === mentorProfile.progress) {
    score += BASE_WEIGHT_BY_QUESTION.progress_style;
    primaryMatches += 1;
  }

  if (mentorProfile.clarifierQuestionId && mentorProfile.clarifierOptionId) {
    const clarifierOptionId = getOptionId(answers, mentorProfile.clarifierQuestionId);
    if (clarifierOptionId && clarifierOptionId === mentorProfile.clarifierOptionId) {
      score += BASE_WEIGHT_BY_QUESTION[mentorProfile.clarifierQuestionId];
      primaryMatches += 1;
    }
  }

  const secondaryBonuses = SECONDARY_SCORE_BONUSES[mentorSlug];
  if (secondaryBonuses) {
    const focusOptionId = getOptionId(answers, "focus_area");
    if (focusOptionId && focusOptionId !== mentorProfile.focus) {
      score += secondaryBonuses[focusOptionId] ?? 0;
    }

    const toneOptionId = getOptionId(answers, "guidance_tone");
    if (toneOptionId && toneOptionId !== mentorProfile.tone) {
      score += secondaryBonuses[toneOptionId] ?? 0;
    }

    const progressOptionId = getOptionId(answers, "progress_style");
    if (progressOptionId && progressOptionId !== mentorProfile.progress) {
      score += secondaryBonuses[progressOptionId] ?? 0;
    }
  }

  return {
    slug: mentorSlug,
    score,
    primaryMatches,
  };
};

const compareByScoreAndMatches = (left: ScoredMentor, right: ScoredMentor): number => {
  if (right.score !== left.score) return right.score - left.score;
  if (right.primaryMatches !== left.primaryMatches) return right.primaryMatches - left.primaryMatches;
  return 0;
};

const compareByBranchPriority = (
  left: ScoredMentor,
  right: ScoredMentor,
  priorityIndex: Map<OnboardingMentorSlug, number>,
): number => {
  const scoreAndMatchDelta = compareByScoreAndMatches(left, right);
  if (scoreAndMatchDelta !== 0) return scoreAndMatchDelta;
  return (priorityIndex.get(left.slug) ?? 999) - (priorityIndex.get(right.slug) ?? 999);
};

const getComparableLeaders = (
  scoredCandidates: ScoredMentor[],
): ScoredMentor[] => {
  if (scoredCandidates.length === 0) return [];

  const sortedCandidates = [...scoredCandidates].sort(compareByScoreAndMatches);
  const topCandidate = sortedCandidates[0];

  return sortedCandidates.filter((candidate) =>
    candidate.score === topCandidate.score
    && candidate.primaryMatches === topCandidate.primaryMatches,
  );
};

const hasRequiredBaseAnswers = (answers: AssignmentAnswerInput[]): boolean => {
  return Boolean(
    getOptionId(answers, "focus_area")
    && getOptionId(answers, "guidance_tone")
    && getOptionId(answers, "progress_style"),
  );
};

const getBaseAnswersOnly = (answers: AssignmentAnswerInput[]): AssignmentAnswerInput[] =>
  answers.filter((answer) => answer.questionId !== "clarity_lens" && answer.questionId !== "pressure_style");

export const resolveOnboardingClarifierQuestionId = (
  answers: AssignmentAnswerInput[],
): ClarifierQuestionId | null => {
  const baseAnswers = getBaseAnswersOnly(answers);
  if (!hasRequiredBaseAnswers(baseAnswers)) return null;

  const energyOptionId = resolveEnergyOptionId(baseAnswers);
  const scoredCandidates = ENERGY_CANDIDATES[energyOptionId].map((mentorSlug) =>
    scoreMentor(mentorSlug, baseAnswers),
  );
  const comparableLeaders = getComparableLeaders(scoredCandidates);

  const clarityLeaders = comparableLeaders.filter((candidate) =>
    CLARITY_BRANCH_SLUGS.has(candidate.slug),
  );
  if (clarityLeaders.length > 1) {
    return "clarity_lens";
  }

  const directLeaders = comparableLeaders.filter((candidate) =>
    DIRECT_BRANCH_SLUGS.has(candidate.slug),
  );
  if (directLeaders.length > 1) {
    return "pressure_style";
  }

  return null;
};

export const SAME_ENERGY_FALLBACKS: Record<EnergyOptionId, readonly OnboardingMentorSlug[]> = {
  feminine_presence: ["lyra", "icon", "princess", "sage", "charles"],
  masculine_presence: ["operator", "rival", "sage", "charles"],
  neutral_presence: ["sage", "charles"],
  either_works: ["sage", "lyra", "icon", "princess", "operator", "rival", "charles"],
};

export const resolvePreassignedMentorSlug = (
  answers: AssignmentAnswerInput[],
): OnboardingMentorSlug | null => {
  if (!hasRequiredBaseAnswers(answers)) return null;

  const energyOptionId = resolveEnergyOptionId(answers);
  const priorityOrder = PRIORITY_BY_ENERGY[energyOptionId];
  const priorityIndex = new Map(
    priorityOrder.map((slug, index) => [slug, index]),
  );

  const rankedCandidates = ENERGY_CANDIDATES[energyOptionId]
    .map((mentorSlug) => scoreMentor(mentorSlug, answers))
    .sort((left, right) => compareByBranchPriority(left, right, priorityIndex));

  return rankedCandidates[0]?.slug ?? null;
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
    if (!resolvedSlug || !isActiveMentorSlug(resolvedSlug)) return;
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

  const energyOptionId = resolveEnergyOptionId(answers);

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
