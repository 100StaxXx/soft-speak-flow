export const ENERGY_OPTION_IDS = [
  'feminine_presence',
  'masculine_presence',
  'either_works',
] as const;

export const FOCUS_OPTION_IDS = [
  'clarity_mindset',
  'emotions_healing',
  'discipline_performance',
  'confidence_self_belief',
] as const;

export const TONE_OPTION_IDS = [
  'gentle_compassionate',
  'encouraging_supportive',
  'calm_grounded',
  'direct_demanding',
] as const;

export const PROGRESS_OPTION_IDS = [
  'principles_logic',
  'emotional_reassurance',
  'belief_support',
  'pressure_standards',
] as const;

export type EnergyOptionId = (typeof ENERGY_OPTION_IDS)[number];
export type FocusOptionId = (typeof FOCUS_OPTION_IDS)[number];
export type ToneOptionId = (typeof TONE_OPTION_IDS)[number];
export type ProgressOptionId = (typeof PROGRESS_OPTION_IDS)[number];

export type OnboardingAssignmentKey =
  `${EnergyOptionId}|${FocusOptionId}|${ToneOptionId}|${ProgressOptionId}`;

export const ACTIVE_ONBOARDING_MENTOR_SLUGS = [
  'atlas',
  'eli',
  'stryker',
  'sienna',
  'carmen',
  'reign',
  'solace',
] as const;

export type OnboardingMentorSlug = (typeof ACTIVE_ONBOARDING_MENTOR_SLUGS)[number];

export type AssignmentAnswerInput = {
  questionId: string;
  optionId?: string | null;
};

const ALLOWED_OPTION_IDS = new Set<string>([
  ...ENERGY_OPTION_IDS,
  ...FOCUS_OPTION_IDS,
  ...TONE_OPTION_IDS,
  ...PROGRESS_OPTION_IDS,
]);

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
  const energyOptionId = getOptionId(answers, 'mentor_energy');
  const focusOptionId = getOptionId(answers, 'focus_area');
  const toneOptionId = getOptionId(answers, 'guidance_tone');
  const progressOptionId = getOptionId(answers, 'progress_style');

  if (!energyOptionId || !focusOptionId || !toneOptionId || !progressOptionId) return null;

  return `${energyOptionId}|${focusOptionId}|${toneOptionId}|${progressOptionId}` as OnboardingAssignmentKey;
};

export const ONBOARDING_MENTOR_ASSIGNMENTS: Record<OnboardingAssignmentKey, OnboardingMentorSlug> = {
'feminine_presence|clarity_mindset|gentle_compassionate|principles_logic': 'sienna',
'feminine_presence|clarity_mindset|gentle_compassionate|emotional_reassurance': 'sienna',
'feminine_presence|clarity_mindset|gentle_compassionate|belief_support': 'sienna',
'feminine_presence|clarity_mindset|gentle_compassionate|pressure_standards': 'sienna',
'feminine_presence|clarity_mindset|encouraging_supportive|principles_logic': 'sienna',
'feminine_presence|clarity_mindset|encouraging_supportive|emotional_reassurance': 'sienna',
'feminine_presence|clarity_mindset|encouraging_supportive|belief_support': 'solace',
'feminine_presence|clarity_mindset|encouraging_supportive|pressure_standards': 'carmen',
'feminine_presence|clarity_mindset|calm_grounded|principles_logic': 'sienna',
'feminine_presence|clarity_mindset|calm_grounded|emotional_reassurance': 'sienna',
'feminine_presence|clarity_mindset|calm_grounded|belief_support': 'sienna',
'feminine_presence|clarity_mindset|calm_grounded|pressure_standards': 'reign',
'feminine_presence|clarity_mindset|direct_demanding|principles_logic': 'reign',
'feminine_presence|clarity_mindset|direct_demanding|emotional_reassurance': 'reign',
'feminine_presence|clarity_mindset|direct_demanding|belief_support': 'reign',
'feminine_presence|clarity_mindset|direct_demanding|pressure_standards': 'reign',
'feminine_presence|emotions_healing|gentle_compassionate|principles_logic': 'sienna',
'feminine_presence|emotions_healing|gentle_compassionate|emotional_reassurance': 'sienna',
'feminine_presence|emotions_healing|gentle_compassionate|belief_support': 'sienna',
'feminine_presence|emotions_healing|gentle_compassionate|pressure_standards': 'sienna',
'feminine_presence|emotions_healing|encouraging_supportive|principles_logic': 'sienna',
'feminine_presence|emotions_healing|encouraging_supportive|emotional_reassurance': 'sienna',
'feminine_presence|emotions_healing|encouraging_supportive|belief_support': 'solace',
'feminine_presence|emotions_healing|encouraging_supportive|pressure_standards': 'solace',
'feminine_presence|emotions_healing|calm_grounded|principles_logic': 'sienna',
'feminine_presence|emotions_healing|calm_grounded|emotional_reassurance': 'sienna',
'feminine_presence|emotions_healing|calm_grounded|belief_support': 'sienna',
'feminine_presence|emotions_healing|calm_grounded|pressure_standards': 'sienna',
'feminine_presence|emotions_healing|direct_demanding|principles_logic': 'reign',
'feminine_presence|emotions_healing|direct_demanding|emotional_reassurance': 'sienna',
'feminine_presence|emotions_healing|direct_demanding|belief_support': 'sienna',
'feminine_presence|emotions_healing|direct_demanding|pressure_standards': 'reign',
'feminine_presence|discipline_performance|gentle_compassionate|principles_logic': 'sienna',
'feminine_presence|discipline_performance|gentle_compassionate|emotional_reassurance': 'sienna',
'feminine_presence|discipline_performance|gentle_compassionate|belief_support': 'sienna',
'feminine_presence|discipline_performance|gentle_compassionate|pressure_standards': 'reign',
'feminine_presence|discipline_performance|encouraging_supportive|principles_logic': 'reign',
'feminine_presence|discipline_performance|encouraging_supportive|emotional_reassurance': 'solace',
'feminine_presence|discipline_performance|encouraging_supportive|belief_support': 'solace',
'feminine_presence|discipline_performance|encouraging_supportive|pressure_standards': 'reign',
'feminine_presence|discipline_performance|calm_grounded|principles_logic': 'reign',
'feminine_presence|discipline_performance|calm_grounded|emotional_reassurance': 'sienna',
'feminine_presence|discipline_performance|calm_grounded|belief_support': 'reign',
'feminine_presence|discipline_performance|calm_grounded|pressure_standards': 'reign',
'feminine_presence|discipline_performance|direct_demanding|principles_logic': 'reign',
'feminine_presence|discipline_performance|direct_demanding|emotional_reassurance': 'reign',
'feminine_presence|discipline_performance|direct_demanding|belief_support': 'reign',
'feminine_presence|discipline_performance|direct_demanding|pressure_standards': 'reign',
'feminine_presence|confidence_self_belief|gentle_compassionate|principles_logic': 'sienna',
'feminine_presence|confidence_self_belief|gentle_compassionate|emotional_reassurance': 'sienna',
'feminine_presence|confidence_self_belief|gentle_compassionate|belief_support': 'sienna',
'feminine_presence|confidence_self_belief|gentle_compassionate|pressure_standards': 'sienna',
'feminine_presence|confidence_self_belief|encouraging_supportive|principles_logic': 'solace',
'feminine_presence|confidence_self_belief|encouraging_supportive|emotional_reassurance': 'solace',
'feminine_presence|confidence_self_belief|encouraging_supportive|belief_support': 'solace',
'feminine_presence|confidence_self_belief|encouraging_supportive|pressure_standards': 'solace',
'feminine_presence|confidence_self_belief|calm_grounded|principles_logic': 'sienna',
'feminine_presence|confidence_self_belief|calm_grounded|emotional_reassurance': 'sienna',
'feminine_presence|confidence_self_belief|calm_grounded|belief_support': 'solace',
'feminine_presence|confidence_self_belief|calm_grounded|pressure_standards': 'carmen',
'feminine_presence|confidence_self_belief|direct_demanding|principles_logic': 'carmen',
'feminine_presence|confidence_self_belief|direct_demanding|emotional_reassurance': 'solace',
'feminine_presence|confidence_self_belief|direct_demanding|belief_support': 'solace',
'feminine_presence|confidence_self_belief|direct_demanding|pressure_standards': 'reign',
'masculine_presence|clarity_mindset|gentle_compassionate|principles_logic': 'atlas',
'masculine_presence|clarity_mindset|gentle_compassionate|emotional_reassurance': 'atlas',
'masculine_presence|clarity_mindset|gentle_compassionate|belief_support': 'atlas',
'masculine_presence|clarity_mindset|gentle_compassionate|pressure_standards': 'atlas',
'masculine_presence|clarity_mindset|encouraging_supportive|principles_logic': 'atlas',
'masculine_presence|clarity_mindset|encouraging_supportive|emotional_reassurance': 'eli',
'masculine_presence|clarity_mindset|encouraging_supportive|belief_support': 'eli',
'masculine_presence|clarity_mindset|encouraging_supportive|pressure_standards': 'atlas',
'masculine_presence|clarity_mindset|calm_grounded|principles_logic': 'atlas',
'masculine_presence|clarity_mindset|calm_grounded|emotional_reassurance': 'atlas',
'masculine_presence|clarity_mindset|calm_grounded|belief_support': 'atlas',
'masculine_presence|clarity_mindset|calm_grounded|pressure_standards': 'atlas',
'masculine_presence|clarity_mindset|direct_demanding|principles_logic': 'atlas',
'masculine_presence|clarity_mindset|direct_demanding|emotional_reassurance': 'stryker',
'masculine_presence|clarity_mindset|direct_demanding|belief_support': 'stryker',
'masculine_presence|clarity_mindset|direct_demanding|pressure_standards': 'stryker',
'masculine_presence|emotions_healing|gentle_compassionate|principles_logic': 'atlas',
'masculine_presence|emotions_healing|gentle_compassionate|emotional_reassurance': 'eli',
'masculine_presence|emotions_healing|gentle_compassionate|belief_support': 'eli',
'masculine_presence|emotions_healing|gentle_compassionate|pressure_standards': 'eli',
'masculine_presence|emotions_healing|encouraging_supportive|principles_logic': 'eli',
'masculine_presence|emotions_healing|encouraging_supportive|emotional_reassurance': 'eli',
'masculine_presence|emotions_healing|encouraging_supportive|belief_support': 'eli',
'masculine_presence|emotions_healing|encouraging_supportive|pressure_standards': 'eli',
'masculine_presence|emotions_healing|calm_grounded|principles_logic': 'atlas',
'masculine_presence|emotions_healing|calm_grounded|emotional_reassurance': 'atlas',
'masculine_presence|emotions_healing|calm_grounded|belief_support': 'eli',
'masculine_presence|emotions_healing|calm_grounded|pressure_standards': 'atlas',
'masculine_presence|emotions_healing|direct_demanding|principles_logic': 'stryker',
'masculine_presence|emotions_healing|direct_demanding|emotional_reassurance': 'eli',
'masculine_presence|emotions_healing|direct_demanding|belief_support': 'eli',
'masculine_presence|emotions_healing|direct_demanding|pressure_standards': 'stryker',
'masculine_presence|discipline_performance|gentle_compassionate|principles_logic': 'atlas',
'masculine_presence|discipline_performance|gentle_compassionate|emotional_reassurance': 'stryker',
'masculine_presence|discipline_performance|gentle_compassionate|belief_support': 'eli',
'masculine_presence|discipline_performance|gentle_compassionate|pressure_standards': 'stryker',
'masculine_presence|discipline_performance|encouraging_supportive|principles_logic': 'eli',
'masculine_presence|discipline_performance|encouraging_supportive|emotional_reassurance': 'eli',
'masculine_presence|discipline_performance|encouraging_supportive|belief_support': 'eli',
'masculine_presence|discipline_performance|encouraging_supportive|pressure_standards': 'eli',
'masculine_presence|discipline_performance|calm_grounded|principles_logic': 'atlas',
'masculine_presence|discipline_performance|calm_grounded|emotional_reassurance': 'stryker',
'masculine_presence|discipline_performance|calm_grounded|belief_support': 'stryker',
'masculine_presence|discipline_performance|calm_grounded|pressure_standards': 'stryker',
'masculine_presence|discipline_performance|direct_demanding|principles_logic': 'stryker',
'masculine_presence|discipline_performance|direct_demanding|emotional_reassurance': 'stryker',
'masculine_presence|discipline_performance|direct_demanding|belief_support': 'stryker',
'masculine_presence|discipline_performance|direct_demanding|pressure_standards': 'stryker',
'masculine_presence|confidence_self_belief|gentle_compassionate|principles_logic': 'atlas',
'masculine_presence|confidence_self_belief|gentle_compassionate|emotional_reassurance': 'eli',
'masculine_presence|confidence_self_belief|gentle_compassionate|belief_support': 'eli',
'masculine_presence|confidence_self_belief|gentle_compassionate|pressure_standards': 'eli',
'masculine_presence|confidence_self_belief|encouraging_supportive|principles_logic': 'eli',
'masculine_presence|confidence_self_belief|encouraging_supportive|emotional_reassurance': 'eli',
'masculine_presence|confidence_self_belief|encouraging_supportive|belief_support': 'eli',
'masculine_presence|confidence_self_belief|encouraging_supportive|pressure_standards': 'eli',
'masculine_presence|confidence_self_belief|calm_grounded|principles_logic': 'atlas',
'masculine_presence|confidence_self_belief|calm_grounded|emotional_reassurance': 'eli',
'masculine_presence|confidence_self_belief|calm_grounded|belief_support': 'eli',
'masculine_presence|confidence_self_belief|calm_grounded|pressure_standards': 'eli',
'masculine_presence|confidence_self_belief|direct_demanding|principles_logic': 'stryker',
'masculine_presence|confidence_self_belief|direct_demanding|emotional_reassurance': 'eli',
'masculine_presence|confidence_self_belief|direct_demanding|belief_support': 'eli',
'masculine_presence|confidence_self_belief|direct_demanding|pressure_standards': 'stryker',
'either_works|clarity_mindset|gentle_compassionate|principles_logic': 'atlas',
'either_works|clarity_mindset|gentle_compassionate|emotional_reassurance': 'sienna',
'either_works|clarity_mindset|gentle_compassionate|belief_support': 'sienna',
'either_works|clarity_mindset|gentle_compassionate|pressure_standards': 'atlas',
'either_works|clarity_mindset|encouraging_supportive|principles_logic': 'atlas',
'either_works|clarity_mindset|encouraging_supportive|emotional_reassurance': 'sienna',
'either_works|clarity_mindset|encouraging_supportive|belief_support': 'eli',
'either_works|clarity_mindset|encouraging_supportive|pressure_standards': 'atlas',
'either_works|clarity_mindset|calm_grounded|principles_logic': 'atlas',
'either_works|clarity_mindset|calm_grounded|emotional_reassurance': 'sienna',
'either_works|clarity_mindset|calm_grounded|belief_support': 'atlas',
'either_works|clarity_mindset|calm_grounded|pressure_standards': 'atlas',
'either_works|clarity_mindset|direct_demanding|principles_logic': 'atlas',
'either_works|clarity_mindset|direct_demanding|emotional_reassurance': 'stryker',
'either_works|clarity_mindset|direct_demanding|belief_support': 'stryker',
'either_works|clarity_mindset|direct_demanding|pressure_standards': 'stryker',
'either_works|emotions_healing|gentle_compassionate|principles_logic': 'sienna',
'either_works|emotions_healing|gentle_compassionate|emotional_reassurance': 'sienna',
'either_works|emotions_healing|gentle_compassionate|belief_support': 'sienna',
'either_works|emotions_healing|gentle_compassionate|pressure_standards': 'sienna',
'either_works|emotions_healing|encouraging_supportive|principles_logic': 'sienna',
'either_works|emotions_healing|encouraging_supportive|emotional_reassurance': 'sienna',
'either_works|emotions_healing|encouraging_supportive|belief_support': 'eli',
'either_works|emotions_healing|encouraging_supportive|pressure_standards': 'eli',
'either_works|emotions_healing|calm_grounded|principles_logic': 'sienna',
'either_works|emotions_healing|calm_grounded|emotional_reassurance': 'sienna',
'either_works|emotions_healing|calm_grounded|belief_support': 'sienna',
'either_works|emotions_healing|calm_grounded|pressure_standards': 'sienna',
'either_works|emotions_healing|direct_demanding|principles_logic': 'stryker',
'either_works|emotions_healing|direct_demanding|emotional_reassurance': 'sienna',
'either_works|emotions_healing|direct_demanding|belief_support': 'eli',
'either_works|emotions_healing|direct_demanding|pressure_standards': 'stryker',
'either_works|discipline_performance|gentle_compassionate|principles_logic': 'atlas',
'either_works|discipline_performance|gentle_compassionate|emotional_reassurance': 'sienna',
'either_works|discipline_performance|gentle_compassionate|belief_support': 'sienna',
'either_works|discipline_performance|gentle_compassionate|pressure_standards': 'stryker',
'either_works|discipline_performance|encouraging_supportive|principles_logic': 'eli',
'either_works|discipline_performance|encouraging_supportive|emotional_reassurance': 'eli',
'either_works|discipline_performance|encouraging_supportive|belief_support': 'eli',
'either_works|discipline_performance|encouraging_supportive|pressure_standards': 'eli',
'either_works|discipline_performance|calm_grounded|principles_logic': 'atlas',
'either_works|discipline_performance|calm_grounded|emotional_reassurance': 'sienna',
'either_works|discipline_performance|calm_grounded|belief_support': 'stryker',
'either_works|discipline_performance|calm_grounded|pressure_standards': 'stryker',
'either_works|discipline_performance|direct_demanding|principles_logic': 'stryker',
'either_works|discipline_performance|direct_demanding|emotional_reassurance': 'stryker',
'either_works|discipline_performance|direct_demanding|belief_support': 'stryker',
'either_works|discipline_performance|direct_demanding|pressure_standards': 'stryker',
'either_works|confidence_self_belief|gentle_compassionate|principles_logic': 'sienna',
'either_works|confidence_self_belief|gentle_compassionate|emotional_reassurance': 'sienna',
'either_works|confidence_self_belief|gentle_compassionate|belief_support': 'sienna',
'either_works|confidence_self_belief|gentle_compassionate|pressure_standards': 'sienna',
'either_works|confidence_self_belief|encouraging_supportive|principles_logic': 'eli',
'either_works|confidence_self_belief|encouraging_supportive|emotional_reassurance': 'eli',
'either_works|confidence_self_belief|encouraging_supportive|belief_support': 'eli',
'either_works|confidence_self_belief|encouraging_supportive|pressure_standards': 'eli',
'either_works|confidence_self_belief|calm_grounded|principles_logic': 'atlas',
'either_works|confidence_self_belief|calm_grounded|emotional_reassurance': 'sienna',
'either_works|confidence_self_belief|calm_grounded|belief_support': 'eli',
'either_works|confidence_self_belief|calm_grounded|pressure_standards': 'eli',
'either_works|confidence_self_belief|direct_demanding|principles_logic': 'carmen',
'either_works|confidence_self_belief|direct_demanding|emotional_reassurance': 'eli',
'either_works|confidence_self_belief|direct_demanding|belief_support': 'eli',
'either_works|confidence_self_belief|direct_demanding|pressure_standards': 'stryker',
} as const;

export const SAME_ENERGY_FALLBACKS: Record<EnergyOptionId, readonly OnboardingMentorSlug[]> = {
  feminine_presence: ['sienna', 'solace', 'carmen', 'reign'],
  masculine_presence: ['atlas', 'eli', 'stryker'],
  either_works: ['atlas', 'eli', 'sienna', 'stryker', 'carmen', 'reign', 'solace'],
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
    const normalizedSlug = mentor.slug?.trim().toLowerCase() ?? '';
    if (!isOnboardingMentorSlug(normalizedSlug)) return;
    activeBySlug.set(normalizedSlug, mentor);
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

  const energyOptionCandidate = getOptionId(answers, 'mentor_energy');
  const energyOptionId: EnergyOptionId =
    energyOptionCandidate && isEnergyOptionId(energyOptionCandidate)
      ? energyOptionCandidate
      : 'either_works';

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
