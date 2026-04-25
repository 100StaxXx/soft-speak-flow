import type { PlannerMemoryProfile } from "@/types/companionPlanner";

export const ONBOARDING_SCHEDULE_ARCHETYPE_QUESTION_ID = "schedule_archetype";

export const ONBOARDING_SCHEDULE_ARCHETYPE_OPTIONS = [
  {
    optionId: "nine_to_five",
    text: "I work a 9-5",
    tags: ["schedule_9_to_5"],
  },
  {
    optionId: "business_owner",
    text: "I run a business",
    tags: ["schedule_business_owner"],
  },
  {
    optionId: "after_work_builder",
    text: "I'm building something after work",
    tags: ["schedule_after_work_builder"],
  },
  {
    optionId: "student",
    text: "I'm a student",
    tags: ["schedule_student"],
  },
  {
    optionId: "variable_schedule",
    text: "My schedule changes often",
    tags: ["schedule_variable"],
  },
  {
    optionId: "flexible_transition",
    text: "I'm in a flexible / transition season",
    tags: ["schedule_flexible_transition"],
  },
] as const;

export type OnboardingScheduleArchetype =
  (typeof ONBOARDING_SCHEDULE_ARCHETYPE_OPTIONS)[number]["optionId"];

export type OnboardingScheduleAnswerInput = {
  questionId: string;
  optionId?: string | null;
};

export interface OnboardingScheduleArchetypeProfile {
  id: OnboardingScheduleArchetype;
  label: string;
  plannerHint: string;
  defaultWorkloadTolerance: PlannerMemoryProfile["workloadTolerance"];
  defaultPreferredTimeOfDay: PlannerMemoryProfile["preferredTimeOfDay"];
  defaultPreferredTimeReason: string | null;
}

export const ONBOARDING_SCHEDULE_ARCHETYPE_PROFILES: Record<
  OnboardingScheduleArchetype,
  OnboardingScheduleArchetypeProfile
> = {
  nine_to_five: {
    id: "nine_to_five",
    label: "9-5 schedule",
    plannerHint:
      "Assume daytime work hours are constrained; favor morning, lunch, evening, or clearly open windows.",
    defaultWorkloadTolerance: "normal",
    defaultPreferredTimeOfDay: "evening",
    defaultPreferredTimeReason:
      "You said we are planning around a 9-5, so after-work windows may be more realistic.",
  },
  business_owner: {
    id: "business_owner",
    label: "business owner",
    plannerHint:
      "Favor leverage, revenue, follow-ups, admin batching, and protected deep-work blocks.",
    defaultWorkloadTolerance: "normal",
    defaultPreferredTimeOfDay: "morning",
    defaultPreferredTimeReason:
      "Business owner planning usually benefits from protecting early deep-work momentum.",
  },
  after_work_builder: {
    id: "after_work_builder",
    label: "after-work builder",
    plannerHint:
      "Keep daily plans small and energy-aware; favor one meaningful evening momentum task over overload.",
    defaultWorkloadTolerance: "light",
    defaultPreferredTimeOfDay: "evening",
    defaultPreferredTimeReason:
      "You said you are building after work, so evening plans should stay focused and realistic.",
  },
  student: {
    id: "student",
    label: "student",
    plannerHint:
      "Weight classes, assignments, exams, due dates, study blocks, and recovery between academic demands.",
    defaultWorkloadTolerance: "normal",
    defaultPreferredTimeOfDay: "afternoon",
    defaultPreferredTimeReason:
      "Student schedules often work best when study blocks fit around class and deadline pressure.",
  },
  variable_schedule: {
    id: "variable_schedule",
    label: "variable schedule",
    plannerHint:
      "Avoid rigid assumptions; prefer lighter plans, flexible ordering, and easy Adjust My Day recovery.",
    defaultWorkloadTolerance: "light",
    defaultPreferredTimeOfDay: null,
    defaultPreferredTimeReason: null,
  },
  flexible_transition: {
    id: "flexible_transition",
    label: "flexible or transition season",
    plannerHint:
      "Create gentle anchors and clear next actions without assuming a fixed routine or overloading the day.",
    defaultWorkloadTolerance: "light",
    defaultPreferredTimeOfDay: "morning",
    defaultPreferredTimeReason:
      "A flexible season benefits from a simple morning anchor before the day diffuses.",
  },
};

const SCHEDULE_ARCHETYPE_IDS = new Set<string>(
  ONBOARDING_SCHEDULE_ARCHETYPE_OPTIONS.map((option) => option.optionId),
);

export const isOnboardingScheduleArchetype = (
  value: unknown,
): value is OnboardingScheduleArchetype =>
  typeof value === "string" && SCHEDULE_ARCHETYPE_IDS.has(value);

export const normalizeOnboardingScheduleArchetype = (
  value: unknown,
): OnboardingScheduleArchetype | null => {
  if (!isOnboardingScheduleArchetype(value)) return null;
  return value;
};

export const getOnboardingScheduleArchetypeFromAnswers = (
  answers: OnboardingScheduleAnswerInput[],
): OnboardingScheduleArchetype | null => {
  const answer = answers.find(
    (candidate) =>
      candidate.questionId === ONBOARDING_SCHEDULE_ARCHETYPE_QUESTION_ID,
  );
  return normalizeOnboardingScheduleArchetype(answer?.optionId);
};

export const getOnboardingScheduleArchetypeProfile = (
  archetype: unknown,
): OnboardingScheduleArchetypeProfile | null => {
  const normalized = normalizeOnboardingScheduleArchetype(archetype);
  return normalized ? ONBOARDING_SCHEDULE_ARCHETYPE_PROFILES[normalized] : null;
};
