import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useXPRewards } from "@/hooks/useXPRewards";
import { fetchCompanion, getCompanionQueryKey, type Companion } from "@/hooks/useCompanion";
import { COMPANION_HATCH_STARTED_EVENT } from "@/lib/companionEvolutionEvents";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";
import { resolveActiveMentorSlug, type ActiveMentorSlug } from "@/lib/mentorRoster";
import {
  GUIDED_TUTORIAL_FLOW_VERSION,
  GUIDED_TUTORIAL_VERSION,
  getGuidedTutorialLocalProgressKey,
} from "@/utils/guidedTutorial";
import { safeLocalStorage } from "@/utils/storage";
import { resolveTutorialTargetFromSelectors } from "@/utils/tutorialTargets";
import { trackOnboardingTutorialEvent } from "@/utils/onboardingTutorialTelemetry";
import type {
  CreateQuestSubstepId,
  GuidedMilestoneId,
  GuidedSubstepProgress,
  GuidedTutorialProgress,
  GuidedTutorialStepId,
} from "@/types/profile";

const TARGET_RESOLVE_POLL_MS = 250;
const TARGET_MISSING_FALLBACK_MS = 1400;
const NEW_GOAL_SELECTOR = '[data-tour="companion-launcher-option-goal"]';
const PATHFINDER_PRIMARY_ACTION_SELECTOR = '[data-tour="pathfinder-primary-action"]';
const PLAN_MY_DAY_SELECTOR = '[data-tour="companion-launcher-option-plan-day"]';
const COMPANION_QUICK_ACTIONS_SELECTOR = '[data-planner-tour="companion-quick-actions"]';
const PLAN_DAY_AI_FOLLOW_UP_OPTION_SELECTOR = '[data-tour="companion-plan-day-follow-up-option"]';
const PLAN_DAY_AI_INPUT_SELECTOR = '[data-tour="companion-plan-day-chat-input"]';
const PLAN_DAY_AI_SEND_SELECTOR = '[data-tour="companion-plan-day-chat-send"]';
const PLAN_DAY_SUGGESTION_SAVE_SELECTOR = '[data-tour="companion-plan-day-suggestion-save"]';
const PLAN_DAY_PENDING_CONFIRM_SELECTOR = '[data-tour="companion-plan-day-pending-confirm"]';
const PLAN_DAY_PENDING_CONFIRM_ALL_SELECTOR = '[data-tour="companion-plan-day-pending-confirm-all"]';
const EVOLVE_AUTOSCROLL_SELECTOR = '[data-tour="evolve-companion-button"]';
const EVOLVE_AUTOSCROLL_VIEWPORT_MARGIN_PX = 72;

const STEP_XP_REWARDS: Partial<Record<GuidedTutorialStepId, number>> = {
  new_goal: 5,
  plan_my_day: 5,
};

interface GuidedStep {
  id: GuidedTutorialStepId;
  route: string;
}

const GUIDED_STEPS: GuidedStep[] = [
  {
    id: "new_goal",
    route: "/journeys",
  },
  {
    id: "plan_my_day",
    route: "/journeys",
  },
  {
    id: "hatch_companion",
    route: "/companion",
  },
  {
    id: "mentor_closeout",
    route: "/companion",
  },
];

export const CREATE_QUEST_SUBSTEP_ORDER: CreateQuestSubstepId[] = [
  "open_add_quest",
  "enter_title",
  "select_time",
  "submit_create_quest",
];

const QUEST_ADD_LAUNCHER_SELECTORS = [
  '[data-tour="add-quest-fab"]',
  '[data-tour="add-quest-launcher"]',
];

const ACTIVE_GUIDED_STEP_ID_SET = new Set<GuidedTutorialStepId>(GUIDED_STEPS.map((step) => step.id));
// Legacy IDs are accepted only to sanitize older persisted progress. New flows should use GUIDED_STEPS above.
const LEGACY_GUIDED_STEP_ID_SET = new Set<GuidedTutorialStepId>([
  "quests_campaigns_intro",
  "create_quest",
  "meet_companion",
  "first_plan_closeout",
  "morning_checkin",
  "companion_tab_intro",
  "evolve_companion",
  "post_evolution_companion_intro",
]);
const GUIDED_STEP_ID_SET = new Set<GuidedTutorialStepId>([
  ...GUIDED_STEPS.map((step) => step.id),
  ...LEGACY_GUIDED_STEP_ID_SET,
]);
const CREATE_QUEST_SUBSTEP_SET = new Set<CreateQuestSubstepId>([
  ...CREATE_QUEST_SUBSTEP_ORDER,
  "stay_on_quests",
  "quests_campaigns_intro",
]);

const isGuidedStepId = (value: unknown): value is GuidedTutorialStepId =>
  typeof value === "string" && GUIDED_STEP_ID_SET.has(value as GuidedTutorialStepId);

const isCreateQuestSubstepId = (value: unknown): value is CreateQuestSubstepId =>
  typeof value === "string" && CREATE_QUEST_SUBSTEP_SET.has(value as CreateQuestSubstepId);

const isProgressRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const MILESTONE_ID_SET = new Set<GuidedMilestoneId>([
  "mentor_intro_hello",
  "start_new_goal",
  "complete_pathfinder_campaign",
  "meet_companion_intro",
  "start_plan_my_day",
  "answer_plan_day_ai",
  "save_plan_day_action",
  "tap_hatch_companion",
  "complete_companion_hatch",
  "first_plan_closeout_message",
  "stay_on_quests",
  "quests_campaigns_intro",
  "open_add_quest",
  "enter_title",
  "select_time",
  "submit_create_quest",
  "open_companion_tab",
  "confirm_companion_progress",
  "open_mentor_tab",
  "submit_morning_checkin",
  "companion_tab_intro",
  "tap_evolve_companion",
  "complete_companion_evolution",
  "post_evolution_companion_intro",
  "mentor_closeout_message",
]);

const isGuidedMilestoneId = (value: unknown): value is GuidedMilestoneId =>
  typeof value === "string" && MILESTONE_ID_SET.has(value as GuidedMilestoneId);

export const MILESTONES_ALLOWING_TEMPORARY_HIDE = new Set<GuidedMilestoneId>([
  "complete_companion_evolution",
  "start_new_goal",
  "complete_pathfinder_campaign",
  "start_plan_my_day",
  "answer_plan_day_ai",
  "save_plan_day_action",
  "tap_hatch_companion",
  "complete_companion_hatch",
  "first_plan_closeout_message",
  "mentor_closeout_message",
]);

// Milestones whose card should not render at all — the user is in a passive
// wait and the system auto-progresses, so the card adds no value.
export const MILESTONES_AUTO_HIDDEN = new Set<GuidedMilestoneId>([
  "complete_companion_hatch",
]);

const getSafeMilestoneArray = (value: unknown): GuidedMilestoneId[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isGuidedMilestoneId);
};

const emitTutorialEvent = (eventName: string, detail: Record<string, unknown>) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
  trackOnboardingTutorialEvent(eventName, detail);

  if (import.meta.env.DEV) {
    // Keep diagnostics local to development.
    console.debug(`[Tutorial] ${eventName}`, detail);
  }
};

const getTargetSelectorsForMilestone = (milestoneId: GuidedMilestoneId): string[] => {
  switch (milestoneId) {
    case "mentor_intro_hello":
    case "meet_companion_intro":
    case "first_plan_closeout_message":
      return [];
    case "start_new_goal":
      return [NEW_GOAL_SELECTOR, COMPANION_QUICK_ACTIONS_SELECTOR];
    case "complete_pathfinder_campaign":
      return [PATHFINDER_PRIMARY_ACTION_SELECTOR, '[data-testid="pathfinder-footer"]'];
    case "start_plan_my_day":
      return [PLAN_MY_DAY_SELECTOR, COMPANION_QUICK_ACTIONS_SELECTOR];
    case "answer_plan_day_ai":
      return [
        PLAN_DAY_AI_FOLLOW_UP_OPTION_SELECTOR,
        PLAN_DAY_AI_INPUT_SELECTOR,
        PLAN_DAY_AI_SEND_SELECTOR,
      ];
    case "save_plan_day_action":
      return [
        PLAN_DAY_PENDING_CONFIRM_SELECTOR,
        PLAN_DAY_PENDING_CONFIRM_ALL_SELECTOR,
        PLAN_DAY_SUGGESTION_SAVE_SELECTOR,
      ];
    case "quests_campaigns_intro":
    case "companion_tab_intro":
    case "post_evolution_companion_intro":
      return [];
    case "stay_on_quests":
      return ['[data-tour="quests-tab"]']; // legacy fallback
    case "open_add_quest":
      return QUEST_ADD_LAUNCHER_SELECTORS;
    case "enter_title":
      return ['[data-tour="add-quest-title-input"]'];
    case "select_time":
      return [
        '[data-tour="add-quest-time-panel"]',
        '[data-tour="add-quest-time-input"]',
        '[data-tour="add-quest-time-chip"]',
      ];
    case "submit_create_quest":
      return ['[data-tour="add-quest-create-button"]', ...QUEST_ADD_LAUNCHER_SELECTORS];
    case "open_companion_tab":
      return ['[data-tour="companion-tab"]'];
    case "confirm_companion_progress":
      return ['[data-tour="companion-progress-area"]', '[data-tour="companion-page"]'];
    case "open_mentor_tab":
      return ['[data-tour="mentor-tab"]'];
    case "submit_morning_checkin":
      return ['[data-tour="morning-checkin"]', '[data-tour="checkin-submit"]'];
    case "tap_evolve_companion":
      return ['[data-tour="evolve-companion-button"]'];
    case "tap_hatch_companion":
      return [EVOLVE_AUTOSCROLL_SELECTOR];
    case "complete_companion_hatch":
      return [];
    case "complete_companion_evolution":
    case "mentor_closeout_message":
      return [];
    default:
      return [];
  }
};

interface MentorDialogueLine {
  text: string;
  support?: string;
}

type TutorialDialogueKey =
  | "mentor_intro_hello"
  | "start_new_goal"
  | "complete_pathfinder_campaign"
  | "meet_companion_intro"
  | "start_plan_my_day"
  | "answer_plan_day_ai"
  | "save_plan_day_action"
  | "tap_hatch_companion"
  | "complete_companion_hatch"
  | "first_plan_closeout_message"
  | "mentor_closeout_message";

const TUTORIAL_DIALOGUE: Record<ActiveMentorSlug, Record<TutorialDialogueKey, MentorDialogueLine>> = {
  sage: {
    mentor_intro_hello: { text: "Hey, I'm Sage. I'll walk you through this." },
    start_new_goal: { text: "Tap 'New goal.'", support: "Pathfinder will turn it into a campaign." },
    complete_pathfinder_campaign: { text: "Save the campaign.", support: "That locks in your first path." },
    meet_companion_intro: { text: "This is your Companion.", support: "Use it when you need help planning your day." },
    start_plan_my_day: { text: "Tap 'Plan day.'", support: "It'll give you something simple to follow." },
    answer_plan_day_ai: { text: "Tell it what you need.", support: "Focus, catch up, or take it slow." },
    save_plan_day_action: { text: "Save one quest.", support: "That's how it becomes real." },
    tap_hatch_companion: { text: "Tap 'Hatch.'", support: "Your Companion is ready." },
    complete_companion_hatch: { text: "Let the hatch finish.", support: "I'll wrap up once it confirms." },
    first_plan_closeout_message: { text: "That's it.", support: "Take it one day at a time." },
    mentor_closeout_message: { text: "Your Companion is here.", support: "That's the tutorial — take it one day at a time." },
  },
  lyra: {
    mentor_intro_hello: { text: "Hey, I'm Lyra. I'll help you get started." },
    start_new_goal: { text: "Tap 'New goal.'", support: "Pathfinder will shape the first path." },
    complete_pathfinder_campaign: { text: "Save the campaign.", support: "Then we'll plan today around it." },
    meet_companion_intro: { text: "This is your Companion.", support: "It helps you find clarity." },
    start_plan_my_day: { text: "Tap 'Plan day.'", support: "It'll shape your day for you." },
    answer_plan_day_ai: { text: "Tell it what you need.", support: "Go with what feels true." },
    save_plan_day_action: { text: "Save one quest.", support: "That's your starting point." },
    tap_hatch_companion: { text: "Tap 'Hatch.'", support: "Your Companion is ready to meet you." },
    complete_companion_hatch: { text: "Let the hatch finish.", support: "Almost there." },
    first_plan_closeout_message: { text: "You're set.", support: "Follow the signal." },
    mentor_closeout_message: { text: "There they are.", support: "You're set. Follow the signal." },
  },
  icon: {
    mentor_intro_hello: { text: "I'm Icon. Let's get this set up right." },
    start_new_goal: { text: "Tap 'New goal.'", support: "Pathfinder will build your first campaign." },
    complete_pathfinder_campaign: { text: "Save the campaign.", support: "Good structure starts there." },
    meet_companion_intro: { text: "This is your Companion.", support: "It helps you stay aligned." },
    start_plan_my_day: { text: "Tap 'Plan day.'", support: "You'll get a clear direction for today." },
    answer_plan_day_ai: { text: "Tell it what you need.", support: "Keep it honest." },
    save_plan_day_action: { text: "Save one quest.", support: "Now it's real." },
    tap_hatch_companion: { text: "Tap 'Hatch.'", support: "You've earned the reveal." },
    complete_companion_hatch: { text: "Let the hatch finish.", support: "Hold the moment." },
    first_plan_closeout_message: { text: "You're set.", support: "Follow through." },
    mentor_closeout_message: { text: "Companion online.", support: "You're set. Follow through." },
  },
  charles: {
    mentor_intro_hello: { text: "Charles. This won't take long." },
    start_new_goal: { text: "Tap 'New goal.'", support: "Pathfinder will do the organizing." },
    complete_pathfinder_campaign: { text: "Save the campaign.", support: "No ceremony. Just lock it in." },
    meet_companion_intro: { text: "This is your Companion.", support: "Use it when you don't feel like thinking." },
    start_plan_my_day: { text: "Tap 'Plan day.'", support: "It handles the obvious next step." },
    answer_plan_day_ai: { text: "Tell it what you need.", support: "Try being honest for once." },
    save_plan_day_action: { text: "Save one quest.", support: "There. You've started." },
    tap_hatch_companion: { text: "Tap 'Hatch.'", support: "You did enough. Shocking." },
    complete_companion_hatch: { text: "Let the hatch finish.", support: "Don't tap everything at once." },
    first_plan_closeout_message: { text: "Done.", support: "Now go do it." },
    mentor_closeout_message: { text: "It hatched.", support: "Done. Now go do it." },
  },
  princess: {
    mentor_intro_hello: { text: "Hi, I'm Princess. Let's ease into this." },
    start_new_goal: { text: "Tap 'New goal.'", support: "Pathfinder will make it feel manageable." },
    complete_pathfinder_campaign: { text: "Save the campaign.", support: "A tiny brave beginning." },
    meet_companion_intro: { text: "This is your Companion.", support: "It's here to help you, not overwhelm you." },
    start_plan_my_day: { text: "Tap 'Plan day.'", support: "It'll gently guide your day." },
    answer_plan_day_ai: { text: "Tell it what you need.", support: "Whatever feels right today." },
    save_plan_day_action: { text: "Save one quest.", support: "That's a perfect start." },
    tap_hatch_companion: { text: "Tap 'Hatch.'", support: "Your Companion is ready now." },
    complete_companion_hatch: { text: "Let the hatch finish.", support: "Almost done." },
    first_plan_closeout_message: { text: "You're doing great.", support: "Just keep going." },
    mentor_closeout_message: { text: "Look at them!", support: "You're doing great — just keep going." },
  },
  operator: {
    mentor_intro_hello: { text: "Operator. Let's set your system." },
    start_new_goal: { text: "Tap 'New goal.'", support: "Pathfinder creates the campaign." },
    complete_pathfinder_campaign: { text: "Save the campaign.", support: "Primary objective recorded." },
    meet_companion_intro: { text: "This is your Companion.", support: "Use it to plan and adjust your day." },
    start_plan_my_day: { text: "Tap 'Plan day.'", support: "This builds today's structure." },
    answer_plan_day_ai: { text: "Tell it what you need.", support: "Be direct." },
    save_plan_day_action: { text: "Save one quest.", support: "Execution starts here." },
    tap_hatch_companion: { text: "Tap 'Hatch.'", support: "Companion activation is ready." },
    complete_companion_hatch: { text: "Let the hatch finish.", support: "Awaiting confirmation." },
    first_plan_closeout_message: { text: "System ready.", support: "Execute." },
    mentor_closeout_message: { text: "Companion hatched.", support: "System ready. Execute." },
  },
  rival: {
    mentor_intro_hello: { text: "I'm Rival. Let's see what you do with this." },
    start_new_goal: { text: "Tap 'New goal.'", support: "Pathfinder will show whether you mean it." },
    complete_pathfinder_campaign: { text: "Save the campaign.", support: "Commit to the path." },
    meet_companion_intro: { text: "This is your Companion.", support: "Use it if you're serious." },
    start_plan_my_day: { text: "Tap 'Plan day.'", support: "Get something real on the board." },
    answer_plan_day_ai: { text: "Tell it what you need.", support: "No excuses." },
    save_plan_day_action: { text: "Save one quest.", support: "Now prove it." },
    tap_hatch_companion: { text: "Tap 'Hatch.'", support: "You've earned one decent reveal." },
    complete_companion_hatch: { text: "Let the hatch finish.", support: "Finish what you started." },
    first_plan_closeout_message: { text: "That's all you need.", support: "Don't waste it." },
    mentor_closeout_message: { text: "It hatched.", support: "That's all you need. Don't waste it." },
  },
};

const TUTORIAL_DIALOGUE_KEYS = new Set<string>([
  "mentor_intro_hello",
  "start_new_goal",
  "complete_pathfinder_campaign",
  "meet_companion_intro",
  "start_plan_my_day",
  "answer_plan_day_ai",
  "save_plan_day_action",
  "tap_hatch_companion",
  "complete_companion_hatch",
  "first_plan_closeout_message",
  "mentor_closeout_message",
]);

const isTutorialDialogueKey = (value: string): value is TutorialDialogueKey =>
  TUTORIAL_DIALOGUE_KEYS.has(value);

const FALLBACK_DIALOGUE: MentorDialogueLine = { text: "Let's keep going." };

const getDialogueForMentor = (
  mentorSlug: string | undefined,
  key: TutorialDialogueKey,
): MentorDialogueLine => {
  const slug = resolveActiveMentorSlug(mentorSlug) ?? "sage";
  return TUTORIAL_DIALOGUE[slug][key];
};

const resolveSelectorFromCandidates = (selectors: string[]): string | null => {
  return resolveTutorialTargetFromSelectors(selectors)?.selector ?? null;
};

const isElementComfortablyInView = (element: HTMLElement, viewportHeight: number): boolean => {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= EVOLVE_AUTOSCROLL_VIEWPORT_MARGIN_PX &&
    rect.bottom <= viewportHeight - EVOLVE_AUTOSCROLL_VIEWPORT_MARGIN_PX
  );
};

export interface CreateQuestProgressState {
  current: CreateQuestSubstepId;
  completed: CreateQuestSubstepId[];
  startedAt?: string;
  completedAt?: string;
}

type GuidedTutorialProgressSnapshot = Partial<GuidedTutorialProgress> & {
  milestonesCompleted?: GuidedMilestoneId[];
};

interface MigratedGuidedProgress {
  completedSteps: GuidedTutorialStepId[];
  xpAwardedSteps: GuidedTutorialStepId[];
  milestonesCompleted: GuidedMilestoneId[];
  createQuestProgress: CreateQuestProgressState;
  completed: boolean;
  completedAt?: string;
  evolutionInFlight: boolean;
  evolutionStartedAt?: string;
  evolutionCompletedAt?: string;
  needsMigration: boolean;
}

const setEquals = <T,>(a: Set<T>, b: Set<T>) => {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
};

const toActiveStepOrder = (steps: Iterable<GuidedTutorialStepId>): GuidedTutorialStepId[] => {
  const stepSet = new Set(steps);
  return GUIDED_STEPS.map((step) => step.id).filter((stepId) => stepSet.has(stepId));
};

const toCreateQuestSubstepOrder = (substeps: Iterable<CreateQuestSubstepId>): CreateQuestSubstepId[] => {
  const substepSet = new Set(substeps);
  return CREATE_QUEST_SUBSTEP_ORDER.filter((substepId) => substepSet.has(substepId));
};

export const getNextCreateQuestSubstep = (
  completed: CreateQuestSubstepId[]
): CreateQuestSubstepId => {
  const completedSet = new Set(completed);
  return (
    CREATE_QUEST_SUBSTEP_ORDER.find((substep) => !completedSet.has(substep)) ??
    "submit_create_quest"
  );
};

export const sanitizeCreateQuestProgress = (value: unknown): CreateQuestProgressState | null => {
  if (!isProgressRecord(value)) return null;

  const legacyCompleted = Array.isArray(value.completed)
    ? value.completed.filter(isCreateQuestSubstepId)
    : [];
  const completed = toCreateQuestSubstepOrder(
    legacyCompleted.filter(
      (substep) => substep !== "stay_on_quests" && substep !== "quests_campaigns_intro"
    )
  );

  const currentCandidate = isCreateQuestSubstepId(value.current) ? value.current : null;
  const current = currentCandidate && CREATE_QUEST_SUBSTEP_ORDER.includes(currentCandidate)
    ? currentCandidate
    : getNextCreateQuestSubstep(completed);

  return {
    current,
    completed,
    startedAt: typeof value.startedAt === "string" ? value.startedAt : undefined,
    completedAt: typeof value.completedAt === "string" ? value.completedAt : undefined,
  };
};

const mergeCreateQuestProgress = (
  remote: CreateQuestProgressState | null,
  local: CreateQuestProgressState | null
): CreateQuestProgressState => {
  const remoteCompleted = remote?.completed ?? [];
  const localCompleted = local?.completed ?? [];
  const completed = toCreateQuestSubstepOrder(new Set([...remoteCompleted, ...localCompleted]));
  const current = getNextCreateQuestSubstep(completed);
  const completedAll = completed.length >= CREATE_QUEST_SUBSTEP_ORDER.length;

  return {
    current,
    completed,
    startedAt: remote?.startedAt ?? local?.startedAt ?? new Date().toISOString(),
    completedAt: completedAll ? remote?.completedAt ?? local?.completedAt ?? new Date().toISOString() : undefined,
  };
};

const migrateGuidedTutorialProgress = ({
  completedSteps,
  awardedSteps,
  milestonesCompleted,
  createQuestProgress,
  completed,
  completedAt,
  flowVersion,
  evolutionInFlight,
  evolutionStartedAt,
  evolutionCompletedAt,
}: {
  completedSteps: GuidedTutorialStepId[];
  awardedSteps: GuidedTutorialStepId[];
  milestonesCompleted: GuidedMilestoneId[];
  createQuestProgress: CreateQuestProgressState;
  completed: boolean;
  completedAt?: string;
  flowVersion?: number;
  evolutionInFlight: boolean;
  evolutionStartedAt?: string;
  evolutionCompletedAt?: string;
}): MigratedGuidedProgress => {
  const rawCompletedSet = new Set(completedSteps);
  const rawAwardedSet = new Set(awardedSteps);
  const rawMilestoneSet = new Set(milestonesCompleted);

  const migratedCompletedSet = new Set<GuidedTutorialStepId>(
    completedSteps.filter((stepId) => ACTIVE_GUIDED_STEP_ID_SET.has(stepId))
  );

  const isLegacyTutorialComplete = completed || rawCompletedSet.has("mentor_closeout");
  const shouldMarkNewGoalComplete =
    rawCompletedSet.has("new_goal") ||
    rawCompletedSet.has("meet_companion") ||
    rawCompletedSet.has("plan_my_day") ||
    rawCompletedSet.has("first_plan_closeout") ||
    rawCompletedSet.has("companion_tab_intro") ||
    rawCompletedSet.has("evolve_companion") ||
    rawCompletedSet.has("post_evolution_companion_intro") ||
    rawCompletedSet.has("mentor_closeout") ||
    rawMilestoneSet.has("complete_pathfinder_campaign") ||
    rawMilestoneSet.has("companion_tab_intro") ||
    rawMilestoneSet.has("post_evolution_companion_intro");
  const shouldMarkHatchComplete =
    rawCompletedSet.has("hatch_companion") ||
    rawCompletedSet.has("evolve_companion") ||
    rawCompletedSet.has("post_evolution_companion_intro") ||
    rawCompletedSet.has("mentor_closeout") ||
    rawMilestoneSet.has("complete_companion_hatch") ||
    rawMilestoneSet.has("complete_companion_evolution");

  if (isLegacyTutorialComplete) {
    GUIDED_STEPS.forEach((step) => migratedCompletedSet.add(step.id));
  } else {
    if (shouldMarkNewGoalComplete) {
      migratedCompletedSet.add("new_goal");
    }
    if (shouldMarkHatchComplete) {
      migratedCompletedSet.add("hatch_companion");
    }
  }

  const currentFlowMilestones = new Set<GuidedMilestoneId>([
    "mentor_intro_hello",
    "start_new_goal",
    "complete_pathfinder_campaign",
    "start_plan_my_day",
    "answer_plan_day_ai",
    "save_plan_day_action",
    "tap_hatch_companion",
    "complete_companion_hatch",
    "mentor_closeout_message",
  ]);
  const migratedMilestoneSet = new Set<GuidedMilestoneId>(
    milestonesCompleted.filter((milestoneId) => currentFlowMilestones.has(milestoneId)),
  );
  if (migratedMilestoneSet.has("answer_plan_day_ai")) {
    migratedMilestoneSet.add("start_plan_my_day");
  }
  if (migratedMilestoneSet.has("save_plan_day_action")) {
    migratedMilestoneSet.add("start_plan_my_day");
    migratedMilestoneSet.add("answer_plan_day_ai");
  }
  if (migratedCompletedSet.has("new_goal")) {
    migratedMilestoneSet.add("start_new_goal");
    migratedMilestoneSet.add("complete_pathfinder_campaign");
  }
  if (migratedCompletedSet.has("plan_my_day")) {
    migratedMilestoneSet.add("start_plan_my_day");
    migratedMilestoneSet.add("answer_plan_day_ai");
    migratedMilestoneSet.add("save_plan_day_action");
  }
  if (migratedCompletedSet.has("hatch_companion")) {
    migratedMilestoneSet.add("tap_hatch_companion");
    migratedMilestoneSet.add("complete_companion_hatch");
  }
  if (migratedCompletedSet.has("mentor_closeout")) {
    migratedMilestoneSet.add("mentor_closeout_message");
  }
  if (isLegacyTutorialComplete) {
    migratedMilestoneSet.add("start_new_goal");
    migratedMilestoneSet.add("complete_pathfinder_campaign");
    migratedMilestoneSet.add("start_plan_my_day");
    migratedMilestoneSet.add("answer_plan_day_ai");
    migratedMilestoneSet.add("save_plan_day_action");
    migratedMilestoneSet.add("tap_hatch_companion");
    migratedMilestoneSet.add("complete_companion_hatch");
    migratedMilestoneSet.add("mentor_closeout_message");
  }

  const migratedAwardedSet = new Set<GuidedTutorialStepId>(
    awardedSteps.filter((stepId) => ACTIVE_GUIDED_STEP_ID_SET.has(stepId))
  );

  const migratedCompleted = toActiveStepOrder(migratedCompletedSet);
  const migratedAwarded = toActiveStepOrder(migratedAwardedSet);
  const migratedMilestones = Array.from(migratedMilestoneSet);

  const needsMigration =
    flowVersion !== GUIDED_TUTORIAL_FLOW_VERSION ||
    !setEquals(new Set(migratedCompleted), rawCompletedSet) ||
    !setEquals(new Set(migratedAwarded), rawAwardedSet) ||
    !setEquals(new Set(migratedMilestones), rawMilestoneSet);

  return {
    completedSteps: migratedCompleted,
    xpAwardedSteps: migratedAwarded,
    milestonesCompleted: migratedMilestones,
    createQuestProgress,
    completed: isLegacyTutorialComplete || GUIDED_STEPS.every((step) => migratedCompletedSet.has(step.id)),
    completedAt,
    evolutionInFlight,
    evolutionStartedAt,
    evolutionCompletedAt,
    needsMigration,
  };
};

export const safeCompletedSteps = (value: unknown): GuidedTutorialStepId[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isGuidedStepId);
};

export const safeAwardedSteps = (value: unknown): GuidedTutorialStepId[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isGuidedStepId);
};

const readLocalProgress = (userId: string | undefined): GuidedTutorialProgressSnapshot | null => {
  if (!userId) return null;
  const raw = safeLocalStorage.getItem(getGuidedTutorialLocalProgressKey(userId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isProgressRecord(parsed)) return null;
    return parsed as GuidedTutorialProgressSnapshot;
  } catch {
    return null;
  }
};

const readRemoteProgress = (
  onboardingData: Record<string, unknown> | null
): GuidedTutorialProgressSnapshot | null => {
  const guided = onboardingData?.guided_tutorial;
  if (!isProgressRecord(guided)) return null;
  return guided as GuidedTutorialProgressSnapshot;
};

const pathIsHidden = (pathname: string) =>
  pathname === "/welcome" ||
  pathname.startsWith("/auth") ||
  pathname.startsWith("/onboarding");

const ROUTE_RESTORE_PATH_SET = new Set(["/", "/mentor", "/journeys", "/campaigns", "/companion"]);

export const shouldRestoreTutorialRoute = ({
  pathname,
  stepRoute,
  tutorialReady,
  tutorialComplete,
  currentStepId,
  evolutionInFlight,
}: {
  pathname: string;
  stepRoute: string | null;
  tutorialReady: boolean;
  tutorialComplete: boolean;
  currentStepId: GuidedTutorialStepId | null;
  evolutionInFlight: boolean;
}): boolean => {
  if (!tutorialReady || tutorialComplete || !stepRoute) return false;
  if (currentStepId === "hatch_companion" && evolutionInFlight) return false;
  if (!ROUTE_RESTORE_PATH_SET.has(pathname)) return false;
  return pathname !== stepRoute;
};

export interface PostOnboardingMentorGuidanceState {
  isIntroDialogueActive: boolean;
  isActive: boolean;
  currentStep: GuidedTutorialStepId | null;
  isPreHatchCompanionStep: boolean;
  currentSubstep: CreateQuestSubstepId | null;
  stepRoute: string | null;
  mentorInstructionLines: string[];
  progressText: string;
  activeTargetSelectors: string[];
  activeTargetSelector: string | null;
  isStrictLockActive: boolean;
  canTemporarilyHide: boolean;
  shouldAutoHideCard: boolean;
  dialogueText: string;
  dialogueSupportText?: string;
  speakerName: string;
  speakerPrimaryColor?: string;
  speakerSlug?: string;
  speakerAvatarUrl?: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  dismissTutorial?: () => void;
  dialogueActionLabel?: string;
  onDialogueAction?: () => void;
}

const DEFAULT_GUIDANCE_STATE: PostOnboardingMentorGuidanceState = {
  isIntroDialogueActive: false,
  isActive: false,
  currentStep: null,
  isPreHatchCompanionStep: false,
  currentSubstep: null,
  stepRoute: null,
  mentorInstructionLines: [],
  progressText: "",
  activeTargetSelectors: [],
  activeTargetSelector: null,
  isStrictLockActive: false,
  canTemporarilyHide: false,
  shouldAutoHideCard: false,
  dialogueText: "",
  dialogueSupportText: undefined,
  speakerName: "Your guide",
  speakerPrimaryColor: "#f59e0b",
  speakerSlug: undefined,
  speakerAvatarUrl: undefined,
  secondaryActionLabel: undefined,
  onSecondaryAction: undefined,
  dismissTutorial: undefined,
  dialogueActionLabel: undefined,
  onDialogueAction: undefined,
};

const PostOnboardingMentorGuidanceContext = createContext<PostOnboardingMentorGuidanceState>(
  DEFAULT_GUIDANCE_STATE
);

const STEP_TO_DIALOGUE_KEY: Partial<Record<GuidedTutorialStepId, TutorialDialogueKey>> = {
  new_goal: "start_new_goal",
  meet_companion: "meet_companion_intro",
  plan_my_day: "start_plan_my_day",
  hatch_companion: "tap_hatch_companion",
  first_plan_closeout: "first_plan_closeout_message",
  mentor_closeout: "mentor_closeout_message",
};

export const getMentorInstructionLines = (
  currentStep: GuidedTutorialStepId | null,
  _currentSubstep: CreateQuestSubstepId | null,
  mentorSlug: string | undefined = undefined,
): string[] => {
  if (!currentStep) return [];
  const key = STEP_TO_DIALOGUE_KEY[currentStep];
  if (!key) return [];
  return [getDialogueForMentor(mentorSlug, key).text];
};

const getMilestoneDialogue = (
  milestoneId: GuidedMilestoneId,
  mentorSlug: string | undefined,
): MentorDialogueLine => {
  if (isTutorialDialogueKey(milestoneId)) {
    return getDialogueForMentor(mentorSlug, milestoneId);
  }
  return FALLBACK_DIALOGUE;
};

export const milestoneUsesStrictLock = (milestoneId: GuidedMilestoneId | null): boolean => {
  if (!milestoneId) return false;
  if (milestoneId === "mentor_intro_hello") return false;
  if (milestoneId === "meet_companion_intro") return false;
  if (milestoneId === "answer_plan_day_ai") return false;
  if (milestoneId === "first_plan_closeout_message") return false;
  if (milestoneId === "complete_companion_hatch") return false;
  if (milestoneId === "tap_hatch_companion") return false;
  if (milestoneId === "quests_campaigns_intro") return false;
  if (milestoneId === "confirm_companion_progress") return false;
  if (milestoneId === "submit_morning_checkin") return false;
  if (milestoneId === "companion_tab_intro") return false;
  if (milestoneId === "complete_companion_evolution") return false;
  if (milestoneId === "post_evolution_companion_intro") return false;
  if (milestoneId === "mentor_closeout_message") return false;
  return true;
};

const usePostOnboardingMentorGuidanceController = (): PostOnboardingMentorGuidanceState => {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { awardCustomXP } = useXPRewards();
  const personality = useMentorPersonality();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const completionPersistRef = useRef(false);
  const stepPersistThrottleRef = useRef<Set<GuidedTutorialStepId>>(new Set());
  const missingTargetSinceRef = useRef<number | null>(null);
  const currentMilestoneStartedAtRef = useRef<number | null>(null);
  const lastTargetResolutionSignatureRef = useRef<string | null>(null);
  const lastRouteRestoreSignatureRef = useRef<string | null>(null);
  const lastEvolveAutoscrollEntryRef = useRef<string | null>(null);
  const migrationPersistSignatureRef = useRef<string | null>(null);
  const evolveCompanionBaselineUpdatedAtRef = useRef<number | null>(null);
  const evolutionStartRecordedRef = useRef(false);

  const [sessionCompleted, setSessionCompleted] = useState<GuidedTutorialStepId[]>([]);
  const [sessionAwarded, setSessionAwarded] = useState<GuidedTutorialStepId[]>([]);
  const [sessionCreateQuestCompleted, setSessionCreateQuestCompleted] = useState<CreateQuestSubstepId[]>([]);
  const [sessionMilestonesCompleted, setSessionMilestonesCompleted] = useState<GuidedMilestoneId[]>([]);
  const [sessionEvolutionInFlight, setSessionEvolutionInFlight] = useState<boolean | null>(null);
  const [sessionDismissed, setSessionDismissed] = useState<boolean | null>(null);
  const [activeTargetSelector, setActiveTargetSelector] = useState<string | null>(null);

  const onboardingData = (profile?.onboarding_data as Record<string, unknown> | null) ?? null;
  const walkthroughCompleted = onboardingData?.walkthrough_completed === true;

  const localProgress = useMemo(() => readLocalProgress(user?.id), [user?.id]);
  const remoteProgress = useMemo(() => readRemoteProgress(onboardingData), [onboardingData]);

  const tutorialEligible =
    (remoteProgress?.version === GUIDED_TUTORIAL_VERSION && remoteProgress?.eligible === true) ||
    (localProgress?.version === GUIDED_TUTORIAL_VERSION && localProgress?.eligible === true);
  const persistedDismissed = Boolean(remoteProgress?.dismissed || localProgress?.dismissed);

  useEffect(() => {
    setSessionCompleted([]);
    setSessionAwarded([]);
    setSessionCreateQuestCompleted([]);
    setSessionMilestonesCompleted([]);
    setSessionEvolutionInFlight(null);
    setSessionDismissed(null);
    setActiveTargetSelector(null);
    completionPersistRef.current = false;
    stepPersistThrottleRef.current.clear();
    missingTargetSinceRef.current = null;
    migrationPersistSignatureRef.current = null;
    evolveCompanionBaselineUpdatedAtRef.current = null;
    evolutionStartRecordedRef.current = false;
  }, [user?.id]);

  const persistedCompletedBeforeMigration = useMemo(() => {
    const remote = safeCompletedSteps(remoteProgress?.completedSteps);
    const local = safeCompletedSteps(localProgress?.completedSteps);
    return Array.from(new Set([...remote, ...local]));
  }, [localProgress?.completedSteps, remoteProgress?.completedSteps]);

  const persistedAwardedBeforeMigration = useMemo(() => {
    const remote = safeAwardedSteps(remoteProgress?.xpAwardedSteps);
    const local = safeAwardedSteps(localProgress?.xpAwardedSteps);
    return Array.from(new Set([...remote, ...local]));
  }, [localProgress?.xpAwardedSteps, remoteProgress?.xpAwardedSteps]);

  const persistedMilestonesBeforeMigration = useMemo(() => {
    const remote = getSafeMilestoneArray(remoteProgress?.milestonesCompleted);
    const local = getSafeMilestoneArray(localProgress?.milestonesCompleted);
    return Array.from(new Set([...remote, ...local]));
  }, [localProgress?.milestonesCompleted, remoteProgress?.milestonesCompleted]);

  const remoteCreateQuestProgress = useMemo(
    () => sanitizeCreateQuestProgress((remoteProgress?.substeps as GuidedSubstepProgress | undefined)?.create_quest),
    [remoteProgress?.substeps]
  );

  const localCreateQuestProgress = useMemo(
    () => sanitizeCreateQuestProgress((localProgress?.substeps as GuidedSubstepProgress | undefined)?.create_quest),
    [localProgress?.substeps]
  );

  const mergedCreateQuestProgress = useMemo(
    () => mergeCreateQuestProgress(remoteCreateQuestProgress, localCreateQuestProgress),
    [localCreateQuestProgress, remoteCreateQuestProgress]
  );

  const migratedProgress = useMemo(
    () =>
      migrateGuidedTutorialProgress({
        completedSteps: persistedCompletedBeforeMigration,
        awardedSteps: persistedAwardedBeforeMigration,
        milestonesCompleted: persistedMilestonesBeforeMigration,
        createQuestProgress: mergedCreateQuestProgress,
        completed: Boolean(remoteProgress?.completed ?? localProgress?.completed ?? false),
        completedAt:
          typeof remoteProgress?.completedAt === "string"
            ? remoteProgress.completedAt
            : typeof localProgress?.completedAt === "string"
              ? localProgress.completedAt
              : undefined,
        flowVersion:
          typeof remoteProgress?.flowVersion === "number"
            ? remoteProgress.flowVersion
            : typeof localProgress?.flowVersion === "number"
              ? localProgress.flowVersion
              : undefined,
        evolutionInFlight: Boolean(
          remoteProgress?.evolutionInFlight ?? localProgress?.evolutionInFlight ?? false
        ),
        evolutionStartedAt:
          typeof remoteProgress?.evolutionStartedAt === "string"
            ? remoteProgress.evolutionStartedAt
            : typeof localProgress?.evolutionStartedAt === "string"
              ? localProgress.evolutionStartedAt
              : undefined,
        evolutionCompletedAt:
          typeof remoteProgress?.evolutionCompletedAt === "string"
            ? remoteProgress.evolutionCompletedAt
            : typeof localProgress?.evolutionCompletedAt === "string"
              ? localProgress.evolutionCompletedAt
              : undefined,
      }),
    [
      localProgress?.completed,
      localProgress?.completedAt,
      localProgress?.evolutionCompletedAt,
      localProgress?.evolutionInFlight,
      localProgress?.evolutionStartedAt,
      localProgress?.flowVersion,
      mergedCreateQuestProgress,
      persistedAwardedBeforeMigration,
      persistedCompletedBeforeMigration,
      persistedMilestonesBeforeMigration,
      remoteProgress?.completed,
      remoteProgress?.completedAt,
      remoteProgress?.evolutionCompletedAt,
      remoteProgress?.evolutionInFlight,
      remoteProgress?.evolutionStartedAt,
      remoteProgress?.flowVersion,
    ]
  );

  const persistedCompleted = migratedProgress.completedSteps;
  const persistedAwarded = migratedProgress.xpAwardedSteps;
  const persistedMilestones = migratedProgress.milestonesCompleted;

  const createQuestProgress = useMemo(() => {
    const completed = toCreateQuestSubstepOrder([
      ...migratedProgress.createQuestProgress.completed,
      ...sessionCreateQuestCompleted,
    ]);
    return {
      ...migratedProgress.createQuestProgress,
      completed,
      current: getNextCreateQuestSubstep(completed),
    };
  }, [migratedProgress.createQuestProgress, sessionCreateQuestCompleted]);

  const completedSet = useMemo(
    () => new Set<GuidedTutorialStepId>([...persistedCompleted, ...sessionCompleted]),
    [persistedCompleted, sessionCompleted]
  );

  const awardedSet = useMemo(
    () => new Set<GuidedTutorialStepId>([...persistedAwarded, ...sessionAwarded]),
    [persistedAwarded, sessionAwarded]
  );

  const milestoneSet = useMemo(
    () => new Set<GuidedMilestoneId>([...persistedMilestones, ...sessionMilestonesCompleted]),
    [persistedMilestones, sessionMilestonesCompleted]
  );

  const currentStep = useMemo(
    () => GUIDED_STEPS.find((step) => !completedSet.has(step.id)),
    [completedSet]
  );
  const currentStepId = currentStep?.id ?? null;
  const persistedEvolutionInFlight = useMemo(() => {
    return migratedProgress.evolutionInFlight;
  }, [migratedProgress.evolutionInFlight]);
  const evolutionInFlight = sessionEvolutionInFlight ?? persistedEvolutionInFlight;
  const companionQueryKey = useMemo(() => getCompanionQueryKey(user?.id), [user?.id]);
  const { data: cachedCompanionData, dataUpdatedAt: companionDataUpdatedAt } = useQuery<Companion | null>({
    queryKey: companionQueryKey,
    queryFn: async () => queryClient.getQueryData<Companion | null>(companionQueryKey) ?? null,
    enabled: false,
  });
  const cachedCompanion = cachedCompanionData ?? null;

  const tutorialReady =
    Boolean(user?.id) && !profileLoading && walkthroughCompleted && tutorialEligible;

  const tutorialMarkedComplete = migratedProgress.completed;
  const tutorialDismissed = sessionDismissed ?? persistedDismissed;
  const tutorialComplete = tutorialReady && (tutorialMarkedComplete || !currentStep);
  const tutorialSuppressed = tutorialComplete || tutorialDismissed;
  const hasPendingIntroDialogue = Boolean(currentStep) && !milestoneSet.has("mentor_intro_hello");
  const hasRecordedEvolutionStart =
    milestoneSet.has("tap_hatch_companion") ||
    milestoneSet.has("tap_evolve_companion") ||
    evolutionInFlight ||
    Boolean(migratedProgress.evolutionStartedAt);
  const stepRoute = currentStep?.route ?? null;
  const shouldRestoreRoute = shouldRestoreTutorialRoute({
    pathname: location.pathname,
    stepRoute,
    tutorialReady,
    tutorialComplete: tutorialSuppressed,
    currentStepId,
    evolutionInFlight,
  });

  const persistProgress = useCallback(
    async (progress: GuidedTutorialProgressSnapshot) => {
      if (!user?.id) return;

      const nowIso = new Date().toISOString();
      const localCurrent = readLocalProgress(user.id) ?? {};
      const localNext: GuidedTutorialProgressSnapshot = {
        ...localCurrent,
        ...progress,
        version: GUIDED_TUTORIAL_VERSION,
        flowVersion: GUIDED_TUTORIAL_FLOW_VERSION,
        eligible: true,
        lastUpdatedAt: nowIso,
      };
      safeLocalStorage.setItem(
        getGuidedTutorialLocalProgressKey(user.id),
        JSON.stringify(localNext),
      );

      const baseData = (profile?.onboarding_data as Record<string, unknown> | null) ?? {};
      const currentGuided =
        (readRemoteProgress(baseData) as GuidedTutorialProgressSnapshot | null) ?? {};
      const remoteNext: GuidedTutorialProgressSnapshot = {
        ...currentGuided,
        ...progress,
        version: GUIDED_TUTORIAL_VERSION,
        flowVersion: GUIDED_TUTORIAL_FLOW_VERSION,
        eligible: true,
        lastUpdatedAt: nowIso,
      };

      const nextOnboardingData = {
        ...baseData,
        guided_tutorial: remoteNext,
      } as unknown as Json;

      const { error } = await supabase
        .from("profiles")
        .update({
          onboarding_data: nextOnboardingData,
        })
        .eq("id", user.id);

      if (!error) {
        queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      }
    },
    [profile?.onboarding_data, queryClient, user?.id]
  );

  useEffect(() => {
    if (!tutorialReady || !migratedProgress.needsMigration) return;

    const migrationPayload: GuidedTutorialProgressSnapshot = {
      flowVersion: GUIDED_TUTORIAL_FLOW_VERSION,
      completedSteps: migratedProgress.completedSteps,
      xpAwardedSteps: migratedProgress.xpAwardedSteps,
      milestonesCompleted: migratedProgress.milestonesCompleted,
      substeps: {
        create_quest: {
          current: migratedProgress.createQuestProgress.current,
          completed: migratedProgress.createQuestProgress.completed,
          startedAt: migratedProgress.createQuestProgress.startedAt,
          completedAt: migratedProgress.createQuestProgress.completedAt,
        },
      },
      completed: migratedProgress.completed,
      completedAt:
        migratedProgress.completedAt ??
        (migratedProgress.completed ? new Date().toISOString() : undefined),
      evolutionInFlight: migratedProgress.evolutionInFlight,
      evolutionStartedAt: migratedProgress.evolutionStartedAt,
      evolutionCompletedAt: migratedProgress.evolutionCompletedAt,
    };

    const signature = JSON.stringify(migrationPayload);
    if (migrationPersistSignatureRef.current === signature) return;
    migrationPersistSignatureRef.current = signature;

    void persistProgress(migrationPayload);
  }, [migratedProgress, persistProgress, tutorialReady]);

  useEffect(() => {
    evolutionStartRecordedRef.current = hasRecordedEvolutionStart;
  }, [hasRecordedEvolutionStart]);

  useEffect(() => {
    if (currentStepId !== "hatch_companion") {
      evolveCompanionBaselineUpdatedAtRef.current = null;
      return;
    }

    if (evolveCompanionBaselineUpdatedAtRef.current !== null) return;
    evolveCompanionBaselineUpdatedAtRef.current = companionDataUpdatedAt;
  }, [companionDataUpdatedAt, currentStepId]);

  const markMilestoneComplete = useCallback(
    (milestoneId: GuidedMilestoneId) => {
      if (milestoneSet.has(milestoneId)) return;

      emitTutorialEvent("tutorial_step_transition", {
        userId: user?.id,
        milestoneId,
        route: location.pathname,
      });

      setSessionMilestonesCompleted((prev) =>
        prev.includes(milestoneId) ? prev : [...prev, milestoneId]
      );

      const nextMilestones = Array.from(new Set([...Array.from(milestoneSet), milestoneId]));
      void persistProgress({
        milestonesCompleted: nextMilestones,
      });
    },
    [location.pathname, milestoneSet, persistProgress, user?.id]
  );

  const markCreateQuestSubstepComplete = useCallback(
    (substepId: CreateQuestSubstepId) => {
      if (hasPendingIntroDialogue) return;
      if (!tutorialReady || currentStep?.id !== "create_quest") return;
      if (createQuestProgress.current !== substepId) return;
      if (createQuestProgress.completed.includes(substepId)) return;

      const completed = [...createQuestProgress.completed, substepId];
      const completedUnique = toCreateQuestSubstepOrder(completed);
      const nextCurrent = getNextCreateQuestSubstep(completedUnique);
      const completedAll = completedUnique.length >= CREATE_QUEST_SUBSTEP_ORDER.length;

      setSessionCreateQuestCompleted((prev) =>
        prev.includes(substepId) ? prev : [...prev, substepId]
      );

      markMilestoneComplete(substepId);

      void persistProgress({
        substeps: {
          create_quest: {
            current: nextCurrent,
            completed: completedUnique,
            startedAt: createQuestProgress.startedAt ?? new Date().toISOString(),
            completedAt: completedAll ? new Date().toISOString() : undefined,
          },
        },
      });
    },
    [
      createQuestProgress,
      currentStep?.id,
      hasPendingIntroDialogue,
      markMilestoneComplete,
      persistProgress,
      tutorialReady,
    ]
  );

  const refreshCompanionForTutorialHandoff = useCallback(async () => {
    if (!user?.id) {
      await queryClient.refetchQueries({ queryKey: companionQueryKey });
      return;
    }

    try {
      await queryClient.fetchQuery({
        queryKey: companionQueryKey,
        queryFn: () => fetchCompanion(user.id),
      });
    } catch (error) {
      console.warn("Failed to refresh companion before tutorial hatch handoff:", error);
      await queryClient.refetchQueries({ queryKey: companionQueryKey });
    }
  }, [companionQueryKey, queryClient, user?.id]);

  const markStepComplete = useCallback(
    async (
      stepId: GuidedTutorialStepId,
      options?: { beforeComplete?: () => Promise<void> },
    ): Promise<boolean> => {
      if (hasPendingIntroDialogue) return false;
      if (!tutorialReady || completedSet.has(stepId)) return false;
      if (stepPersistThrottleRef.current.has(stepId)) return false;

      stepPersistThrottleRef.current.add(stepId);
      window.setTimeout(() => {
        stepPersistThrottleRef.current.delete(stepId);
      }, 1000);

      const nextAwardedSet = new Set<GuidedTutorialStepId>(awardedSet);
      const stepXPReward = STEP_XP_REWARDS[stepId] ?? 0;
      if (!nextAwardedSet.has(stepId) && stepXPReward > 0) {
        try {
          const awardResult = await awardCustomXP(stepXPReward, "guided_tutorial_step_complete", undefined, {
            guided_step: stepId,
            source: "guided_tutorial",
          });

          if (!awardResult || awardResult.xpAwarded <= 0) {
            stepPersistThrottleRef.current.delete(stepId);
            return false;
          }

          nextAwardedSet.add(stepId);
          setSessionAwarded((prev) => (prev.includes(stepId) ? prev : [...prev, stepId]));
        } catch (error) {
          stepPersistThrottleRef.current.delete(stepId);
          console.error("Failed to award guided tutorial XP:", error);
          return false;
        }
      }

      if (options?.beforeComplete) {
        try {
          await options.beforeComplete();
        } catch (error) {
          console.warn("Failed to run guided tutorial pre-completion task:", error);
        }
      }

      const nextCompletedSet = new Set<GuidedTutorialStepId>([...completedSet, stepId]);
      const nextCompleted = toActiveStepOrder(nextCompletedSet);
      const complete = GUIDED_STEPS.every((step) => nextCompletedSet.has(step.id));

      setSessionCompleted((prev) => (prev.includes(stepId) ? prev : [...prev, stepId]));

      void persistProgress({
        completedSteps: nextCompleted,
        xpAwardedSteps: toActiveStepOrder(nextAwardedSet),
        completed: complete,
        completedAt: complete ? new Date().toISOString() : undefined,
      });

      return true;
    },
    [awardCustomXP, awardedSet, completedSet, hasPendingIntroDialogue, persistProgress, tutorialReady]
  );

  useEffect(() => {
    if (!tutorialComplete || completionPersistRef.current) return;

    completionPersistRef.current = true;
    void persistProgress({
      completedSteps: GUIDED_STEPS.map((step) => step.id),
      xpAwardedSteps: Array.from(awardedSet),
      completed: true,
      completedAt: new Date().toISOString(),
    });
  }, [awardedSet, persistProgress, tutorialComplete]);

  useEffect(() => {
    if (!tutorialReady || tutorialSuppressed || hasPendingIntroDialogue || !currentStep) return;

    if (currentStep.id === "new_goal") {
      if (location.pathname !== "/journeys") return;
      if (milestoneSet.has("complete_pathfinder_campaign")) {
        void markStepComplete("new_goal");
      }
      return;
    }

    if (currentStep.id === "plan_my_day") {
      if (location.pathname !== "/journeys") return;
      if (milestoneSet.has("save_plan_day_action")) {
        void markStepComplete("plan_my_day");
      }
      return;
    }

    if (currentStep.id === "first_plan_closeout") {
      if (location.pathname !== "/journeys") return;

      if (milestoneSet.has("first_plan_closeout_message")) {
        void markStepComplete("first_plan_closeout");
      }
      return;
    }

    if (currentStep.id === "quests_campaigns_intro") {
      if (location.pathname !== "/journeys") return;
      if (milestoneSet.has("quests_campaigns_intro")) {
        void markStepComplete("quests_campaigns_intro");
      }
      return;
    }

    if (currentStep.id === "create_quest") {
      return;
    }

    if (currentStep.id === "morning_checkin") {
      if (!milestoneSet.has("open_mentor_tab") && location.pathname === "/mentor") {
        markMilestoneComplete("open_mentor_tab");
      }

      if (milestoneSet.has("open_mentor_tab") && !milestoneSet.has("submit_morning_checkin")) {
        const tryCompleteExistingCheckIn = () => {
          if (typeof document === "undefined") return false;
          if (location.pathname !== "/mentor") return false;

          const hasSubmitButton = Boolean(document.querySelector('[data-tour="checkin-submit"]'));
          const hasMorningCheckInCard = Boolean(document.querySelector('[data-tour="morning-checkin"]'));

          if (!hasMorningCheckInCard || hasSubmitButton) return false;

          markMilestoneComplete("submit_morning_checkin");
          void markStepComplete("morning_checkin");
          return true;
        };

        if (tryCompleteExistingCheckIn()) return;

        const interval = window.setInterval(() => {
          if (tryCompleteExistingCheckIn()) {
            window.clearInterval(interval);
          }
        }, TARGET_RESOLVE_POLL_MS);

        return () => {
          window.clearInterval(interval);
        };
      }
      return;
    }

    if (currentStep.id === "companion_tab_intro") {
      if (location.pathname !== "/companion") return;
      if (milestoneSet.has("companion_tab_intro")) {
        void markStepComplete("companion_tab_intro");
      }
      return;
    }

    if (currentStep.id === "hatch_companion") {
      const hasConfirmedHatch =
        Boolean(cachedCompanion) &&
        cachedCompanion.current_stage > 0 &&
        (hasRecordedEvolutionStart ||
          milestoneSet.has("tap_hatch_companion") ||
          companionDataUpdatedAt > (evolveCompanionBaselineUpdatedAtRef.current ?? 0));

      if (hasConfirmedHatch) {
        if (evolutionInFlight) {
          setSessionEvolutionInFlight(false);
        }
        void persistProgress({
          evolutionInFlight: false,
          evolutionCompletedAt:
            migratedProgress.evolutionCompletedAt ?? new Date().toISOString(),
        });
        if (!milestoneSet.has("complete_companion_hatch")) {
          markMilestoneComplete("complete_companion_hatch");
        }
        void markStepComplete("hatch_companion");
      }
      return;
    }

    if (currentStep.id === "mentor_closeout") {
      if (location.pathname !== "/companion") return;
      if (milestoneSet.has("mentor_closeout_message")) {
        void markStepComplete("mentor_closeout");
      }
      return;
    }

    if (currentStep.id === "post_evolution_companion_intro") {
      if (location.pathname !== "/companion") return;
      if (milestoneSet.has("post_evolution_companion_intro")) {
        void markStepComplete("post_evolution_companion_intro");
      }
      return;
    }

  }, [
    createQuestProgress.current,
    companionDataUpdatedAt,
    cachedCompanion,
    currentStep,
    hasRecordedEvolutionStart,
    location.pathname,
    markCreateQuestSubstepComplete,
    markMilestoneComplete,
    markStepComplete,
    persistProgress,
    milestoneSet,
    evolutionInFlight,
    hasPendingIntroDialogue,
    migratedProgress.evolutionCompletedAt,
    tutorialSuppressed,
    tutorialReady,
  ]);

  useEffect(() => {
    if (!currentStep || !tutorialReady || tutorialSuppressed || hasPendingIntroDialogue) return;

    const listeners: Array<{ eventName: string; handler: (event: Event) => void }> = [];

    if (currentStep.id === "new_goal") {
      const markNewGoalStarted = () => {
        if (location.pathname !== "/journeys") return;
        markMilestoneComplete("start_new_goal");
      };

      listeners.push({
        eventName: "companion-new-goal-started",
        handler: markNewGoalStarted,
      });

      listeners.push({
        eventName: "campaign-builder-opened",
        handler: markNewGoalStarted,
      });

      listeners.push({
        eventName: "campaign-created",
        handler: () => {
          void (async () => {
            if (!milestoneSet.has("start_new_goal")) {
              markMilestoneComplete("start_new_goal");
            }
            markMilestoneComplete("complete_pathfinder_campaign");
            await markStepComplete("new_goal");
          })();
        },
      });
    }

    if (currentStep.id === "plan_my_day") {
      listeners.push({
        eventName: "companion-plan-my-day-started",
        handler: () => {
          if (location.pathname !== "/journeys") return;
          markMilestoneComplete("start_plan_my_day");
        },
      });

      listeners.push({
        eventName: "companion-plan-my-day-ai-answered",
        handler: () => {
          if (location.pathname !== "/journeys") return;
          if (!milestoneSet.has("start_plan_my_day")) {
            markMilestoneComplete("start_plan_my_day");
          }
          markMilestoneComplete("answer_plan_day_ai");
        },
      });

      listeners.push({
        eventName: "companion-plan-my-day-action-saved",
        handler: () => {
          if (location.pathname !== "/journeys") return;
          if (!milestoneSet.has("start_plan_my_day")) {
            markMilestoneComplete("start_plan_my_day");
          }
          if (!milestoneSet.has("answer_plan_day_ai")) {
            markMilestoneComplete("answer_plan_day_ai");
          }
          markMilestoneComplete("save_plan_day_action");
          void (async () => {
            const completed = await markStepComplete("plan_my_day", {
              beforeComplete: refreshCompanionForTutorialHandoff,
            });
            if (!completed) return;
            navigate("/companion", { replace: true });
          })();
        },
      });
    }

    if (currentStep.id === "create_quest") {
      listeners.push({
        eventName: "add-quest-sheet-opened",
        handler: () => {
          if (location.pathname !== "/journeys") return;
          markCreateQuestSubstepComplete("open_add_quest");
        },
      });

      listeners.push({
        eventName: "add-quest-title-entered",
        handler: () => {
          if (location.pathname !== "/journeys") return;
          markCreateQuestSubstepComplete("enter_title");
        },
      });

      listeners.push({
        eventName: "add-quest-time-selected",
        handler: (event) => {
          if (location.pathname !== "/journeys") return;
          const detail = (event as CustomEvent<{ scheduledTime?: string | null }>).detail;
          if (!detail?.scheduledTime) return;
          markCreateQuestSubstepComplete("select_time");
        },
      });

      listeners.push({
        eventName: "task-added",
        handler: (event) => {
          if (location.pathname !== "/journeys") return;
          const detail = (event as CustomEvent<{ taskDate?: string | null; scheduledTime?: string | null }>).detail;
          if (!detail?.taskDate || !detail?.scheduledTime) return;
          if (createQuestProgress.current !== "submit_create_quest") return;

          markCreateQuestSubstepComplete("submit_create_quest");
          void markStepComplete("create_quest");
        },
      });
    }

    if (currentStep.id === "morning_checkin") {
      listeners.push({
        eventName: "morning-checkin-completed",
        handler: () => {
          if (location.pathname !== "/mentor") return;
          if (!milestoneSet.has("open_mentor_tab")) {
            markMilestoneComplete("open_mentor_tab");
          }
          markMilestoneComplete("submit_morning_checkin");
          void markStepComplete("morning_checkin");
        },
      });
    }

    if (currentStep.id === "hatch_companion") {
      listeners.push({
        eventName: "evolution-loading-start",
        handler: () => {
          evolutionStartRecordedRef.current = true;
          if (!milestoneSet.has("tap_hatch_companion")) {
            markMilestoneComplete("tap_hatch_companion");
          }
          setSessionEvolutionInFlight(true);
          void persistProgress({
            evolutionInFlight: true,
            evolutionStartedAt: new Date().toISOString(),
          });
        },
      });

      listeners.push({
        eventName: COMPANION_HATCH_STARTED_EVENT,
        handler: () => {
          evolutionStartRecordedRef.current = true;
          if (!milestoneSet.has("tap_hatch_companion")) {
            markMilestoneComplete("tap_hatch_companion");
          }
          setSessionEvolutionInFlight(true);
          void persistProgress({
            evolutionInFlight: true,
            evolutionStartedAt: new Date().toISOString(),
          });
        },
      });

      listeners.push({
        eventName: "companion-evolved",
        handler: () => {
          if (!evolutionStartRecordedRef.current) return;
          setSessionEvolutionInFlight(false);
          void persistProgress({
            evolutionInFlight: false,
            evolutionCompletedAt: new Date().toISOString(),
          });
          void queryClient.refetchQueries({ queryKey: companionQueryKey });
        },
      });
    }

    listeners.forEach(({ eventName, handler }) => {
      window.addEventListener(eventName, handler as EventListener);
    });

    return () => {
      listeners.forEach(({ eventName, handler }) => {
        window.removeEventListener(eventName, handler as EventListener);
      });
    };
  }, [
    companionQueryKey,
    createQuestProgress.current,
    currentStep,
    location.pathname,
    markCreateQuestSubstepComplete,
    markMilestoneComplete,
    markStepComplete,
    milestoneSet,
    navigate,
    persistProgress,
    queryClient,
    refreshCompanionForTutorialHandoff,
    evolutionInFlight,
    hasPendingIntroDialogue,
    migratedProgress.evolutionStartedAt,
    tutorialSuppressed,
    tutorialReady,
  ]);

  const currentMilestone = useMemo<GuidedMilestoneId | null>(() => {
    if (!currentStep) return null;
    if (!milestoneSet.has("mentor_intro_hello")) return "mentor_intro_hello";

    if (currentStep.id === "new_goal") {
      return milestoneSet.has("start_new_goal")
        ? "complete_pathfinder_campaign"
        : "start_new_goal";
    }

    if (currentStep.id === "plan_my_day") {
      const hasStartedPlanDay =
        milestoneSet.has("start_plan_my_day") ||
        milestoneSet.has("answer_plan_day_ai") ||
        milestoneSet.has("save_plan_day_action");
      const hasAnsweredPlanDayAI =
        milestoneSet.has("answer_plan_day_ai") ||
        milestoneSet.has("save_plan_day_action");

      if (!hasStartedPlanDay) {
        return "start_plan_my_day";
      }
      if (!hasAnsweredPlanDayAI) {
        return "answer_plan_day_ai";
      }
      return "save_plan_day_action";
    }

    if (currentStep.id === "first_plan_closeout") {
      return "first_plan_closeout_message";
    }

    if (currentStep.id === "quests_campaigns_intro") {
      return "quests_campaigns_intro";
    }

    if (currentStep.id === "create_quest") {
      return createQuestProgress.current;
    }

    if (currentStep.id === "morning_checkin") {
      return milestoneSet.has("open_mentor_tab")
        ? "submit_morning_checkin"
        : "open_mentor_tab";
    }

    if (currentStep.id === "companion_tab_intro") {
      return "companion_tab_intro";
    }

    if (currentStep.id === "hatch_companion") {
      return evolutionInFlight || milestoneSet.has("tap_hatch_companion")
        ? "complete_companion_hatch"
        : "tap_hatch_companion";
    }

    if (currentStep.id === "mentor_closeout") {
      return "mentor_closeout_message";
    }

    if (currentStep.id === "post_evolution_companion_intro") {
      return "post_evolution_companion_intro";
    }

    return null;
  }, [createQuestProgress.current, currentStep, evolutionInFlight, milestoneSet]);

  const isIntroDialogueActive = currentMilestone === "mentor_intro_hello";
  const supportsDialogueAction =
    currentMilestone === "mentor_intro_hello" ||
    currentMilestone === "meet_companion_intro" ||
    currentMilestone === "first_plan_closeout_message" ||
    currentMilestone === "mentor_closeout_message" ||
    currentMilestone === "quests_campaigns_intro" ||
    currentMilestone === "companion_tab_intro" ||
    currentMilestone === "post_evolution_companion_intro";
  const dialogueActionLabel = supportsDialogueAction
    ? currentMilestone === "mentor_intro_hello"
      ? "Start Tutorial"
      : currentMilestone === "first_plan_closeout_message" ||
        currentMilestone === "mentor_closeout_message"
      ? "Finish"
      : "Continue"
    : undefined;
  const onDialogueAction = useCallback(() => {
    if (!currentMilestone || !supportsDialogueAction) return;
    markMilestoneComplete(currentMilestone);
  }, [currentMilestone, markMilestoneComplete, supportsDialogueAction]);

  const dismissTutorial = useCallback(() => {
    if (!tutorialReady || tutorialMarkedComplete || tutorialDismissed) return;

    emitTutorialEvent("tutorial_skipped", {
      userId: user?.id,
      stepId: currentStepId,
      milestoneId: currentMilestone,
      route: location.pathname,
    });

    setSessionDismissed(true);
    setActiveTargetSelector(null);
    missingTargetSinceRef.current = null;

    void persistProgress({
      dismissed: true,
      completed: false,
      completedAt: undefined,
    });
  }, [
    currentMilestone,
    currentStepId,
    location.pathname,
    persistProgress,
    tutorialDismissed,
    tutorialMarkedComplete,
    tutorialReady,
    user?.id,
  ]);

  const completeTutorial = useCallback(() => {
    if (
      !tutorialReady ||
      tutorialMarkedComplete ||
      tutorialDismissed ||
      (currentStepId !== "first_plan_closeout" && currentStepId !== "mentor_closeout")
    ) {
      return;
    }

    if (currentStepId === "first_plan_closeout") {
      if (
        currentMilestone === "first_plan_closeout_message" &&
        !milestoneSet.has("first_plan_closeout_message")
      ) {
        markMilestoneComplete("first_plan_closeout_message");
      }
      void markStepComplete("first_plan_closeout");
      return;
    }

    if (currentStepId === "mentor_closeout") {
      if (!milestoneSet.has("mentor_closeout_message")) {
        markMilestoneComplete("mentor_closeout_message");
      }
      void markStepComplete("mentor_closeout");
    }
  }, [
    currentMilestone,
    currentStepId,
    markMilestoneComplete,
    markStepComplete,
    milestoneSet,
    tutorialDismissed,
    tutorialMarkedComplete,
    tutorialReady,
  ]);

  const activeTargetSelectors = useMemo(
    () => (currentMilestone ? getTargetSelectorsForMilestone(currentMilestone) : []),
    [currentMilestone]
  );

  useEffect(() => {
    if (!shouldRestoreRoute || !stepRoute) {
      lastRouteRestoreSignatureRef.current = null;
      return;
    }

    const signature = `${location.pathname}->${stepRoute}`;
    if (lastRouteRestoreSignatureRef.current === signature) {
      return;
    }
    lastRouteRestoreSignatureRef.current = signature;

    emitTutorialEvent("tutorial_route_restored", {
      userId: user?.id,
      from: location.pathname,
      to: stepRoute,
      stepId: currentStep?.id ?? null,
      milestoneId: currentMilestone,
    });
    navigate(stepRoute, { replace: true });
  }, [
    currentMilestone,
    currentStep?.id,
    location.pathname,
    navigate,
    shouldRestoreRoute,
    stepRoute,
    user?.id,
  ]);

  useEffect(() => {
    if (tutorialSuppressed || !currentMilestone) {
      currentMilestoneStartedAtRef.current = null;
      lastTargetResolutionSignatureRef.current = null;
      return;
    }

    currentMilestoneStartedAtRef.current = Date.now();
    lastTargetResolutionSignatureRef.current = null;
    emitTutorialEvent("tutorial_step_enter", {
      userId: user?.id,
      stepId: currentStep?.id,
      milestoneId: currentMilestone,
      route: location.pathname,
    });
  }, [currentMilestone, currentStep?.id, location.pathname, tutorialSuppressed, user?.id]);

  useEffect(() => {
    if (
      !tutorialReady ||
      tutorialSuppressed ||
      !currentMilestone ||
      isIntroDialogueActive ||
      shouldRestoreRoute ||
      pathIsHidden(location.pathname)
    ) {
      setActiveTargetSelector(null);
      missingTargetSinceRef.current = null;
      return;
    }

    let stopped = false;

    const resolveTarget = () => {
      if (stopped) return;
      const resolved = resolveSelectorFromCandidates(activeTargetSelectors);
      setActiveTargetSelector(resolved);

      const signature = `${currentMilestone}|${location.pathname}|${resolved ?? "none"}`;
      if (lastTargetResolutionSignatureRef.current !== signature) {
        lastTargetResolutionSignatureRef.current = signature;
        emitTutorialEvent("tutorial_target_resolution", {
          userId: user?.id,
          stepId: currentStep?.id,
          milestoneId: currentMilestone,
          selectorsTried: activeTargetSelectors,
          resolvedSelector: resolved,
          route: location.pathname,
          latencyMs:
            currentMilestoneStartedAtRef.current === null
              ? null
              : Date.now() - currentMilestoneStartedAtRef.current,
        });
      }
    };

    resolveTarget();

    const poll = window.setInterval(resolveTarget, TARGET_RESOLVE_POLL_MS);
    window.addEventListener("resize", resolveTarget);
    window.addEventListener("orientationchange", resolveTarget);
    window.addEventListener("scroll", resolveTarget, true);

    return () => {
      stopped = true;
      window.clearInterval(poll);
      window.removeEventListener("resize", resolveTarget);
      window.removeEventListener("orientationchange", resolveTarget);
      window.removeEventListener("scroll", resolveTarget, true);
    };
  }, [
    activeTargetSelectors,
    currentMilestone,
    currentStep?.id,
    isIntroDialogueActive,
    location.pathname,
    shouldRestoreRoute,
    tutorialSuppressed,
    tutorialReady,
    user?.id,
  ]);

  const isActive =
    tutorialReady &&
    !tutorialSuppressed &&
    !shouldRestoreRoute &&
    !pathIsHidden(location.pathname) &&
    Boolean(currentStep);

  useEffect(() => {
    const isEvolveEntry =
      isActive &&
      currentStepId === "hatch_companion" &&
      currentMilestone === "tap_hatch_companion" &&
      location.pathname === "/companion";

    if (!isEvolveEntry) {
      lastEvolveAutoscrollEntryRef.current = null;
      return;
    }

    const entryKey = `${currentStepId}|${currentMilestone}|${location.pathname}`;
    if (lastEvolveAutoscrollEntryRef.current === entryKey) {
      return;
    }

    if (activeTargetSelector !== EVOLVE_AUTOSCROLL_SELECTOR) {
      return;
    }

    const targetElement = document.querySelector(EVOLVE_AUTOSCROLL_SELECTOR) as HTMLElement | null;
    if (!targetElement) {
      return;
    }

    lastEvolveAutoscrollEntryRef.current = entryKey;

    if (isElementComfortablyInView(targetElement, window.innerHeight)) {
      return;
    }

    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth";

    targetElement.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior,
    });

    emitTutorialEvent("tutorial_target_autoscroll", {
      userId: user?.id,
      stepId: currentStepId,
      milestoneId: currentMilestone,
      route: location.pathname,
      selector: EVOLVE_AUTOSCROLL_SELECTOR,
      behavior,
    });
  }, [
    activeTargetSelector,
    currentMilestone,
    currentStepId,
    isActive,
    location.pathname,
    user?.id,
  ]);

  const currentSubstep = currentStepId === "create_quest" ? createQuestProgress.current : null;

  const currentIndex = currentStepId
    ? GUIDED_STEPS.findIndex((step) => step.id === currentStepId)
    : -1;

  const progressText =
    currentStepId && currentIndex >= 0
      ? `Step ${currentIndex + 1} of ${GUIDED_STEPS.length}`
      : "";

  const dialogue: MentorDialogueLine = currentMilestone
    ? getMilestoneDialogue(currentMilestone, personality?.slug)
    : { text: "" };
  const mentorInstructionLines = dialogue.support ? [dialogue.text, dialogue.support] : [dialogue.text];

  const isMissingTarget = isActive && activeTargetSelectors.length > 0 && !activeTargetSelector;
  if (isMissingTarget && missingTargetSinceRef.current === null) {
    missingTargetSinceRef.current = Date.now();
  }
  if (!isMissingTarget) {
    missingTargetSinceRef.current = null;
  }

  const targetMissingTooLong =
    isMissingTarget &&
    missingTargetSinceRef.current !== null &&
    Date.now() - missingTargetSinceRef.current > TARGET_MISSING_FALLBACK_MS;

  useEffect(() => {
    if (!targetMissingTooLong || !currentMilestone) return;

    emitTutorialEvent("tutorial_target_missing", {
      userId: user?.id,
      stepId: currentStepId,
      milestoneId: currentMilestone,
      selectorsTried: activeTargetSelectors,
      route: location.pathname,
      elapsedMs: Date.now() - (missingTargetSinceRef.current ?? Date.now()),
    });
  }, [
    activeTargetSelectors,
    currentMilestone,
    currentStepId,
    location.pathname,
    targetMissingTooLong,
    user?.id,
  ]);

  const dialogueSupportText = targetMissingTooLong
    ? "I'm waiting for this area to load. Stay on this screen and it'll highlight as soon as it's ready."
    : dialogue.support;
  const strictLockEnabled = milestoneUsesStrictLock(currentMilestone);
  const isCloseoutStep =
    currentStepId === "first_plan_closeout" || currentStepId === "mentor_closeout";
  const secondaryActionLabel =
    !tutorialSuppressed && !isIntroDialogueActive
      ? isCloseoutStep
        ? "Complete tutorial"
        : "Skip tutorial"
      : undefined;
  const onSecondaryAction = secondaryActionLabel
    ? isCloseoutStep
      ? completeTutorial
      : dismissTutorial
    : undefined;
  const isPreHatchCompanionStep = !tutorialSuppressed && currentStepId === "hatch_companion";

  return {
    isIntroDialogueActive,
    isActive,
    currentStep: tutorialSuppressed ? null : currentStepId,
    isPreHatchCompanionStep,
    currentSubstep: tutorialSuppressed ? null : currentSubstep,
    stepRoute: tutorialSuppressed ? null : stepRoute,
    mentorInstructionLines: tutorialSuppressed ? [] : mentorInstructionLines,
    progressText: tutorialSuppressed ? "" : progressText,
    activeTargetSelectors: tutorialSuppressed ? [] : activeTargetSelectors,
    activeTargetSelector: tutorialSuppressed ? null : activeTargetSelector,
    isStrictLockActive: Boolean(isActive && activeTargetSelector && strictLockEnabled),
    canTemporarilyHide: !tutorialSuppressed &&
      MILESTONES_ALLOWING_TEMPORARY_HIDE.has(currentMilestone as GuidedMilestoneId),
    shouldAutoHideCard: !tutorialSuppressed &&
      MILESTONES_AUTO_HIDDEN.has(currentMilestone as GuidedMilestoneId),
    dialogueText: tutorialSuppressed ? "" : dialogue.text,
    dialogueSupportText: tutorialSuppressed ? undefined : dialogueSupportText,
    speakerName: personality?.name ?? "Your guide",
    speakerPrimaryColor: personality?.primary_color ?? "#f59e0b",
    speakerSlug: personality?.slug,
    speakerAvatarUrl: personality?.avatar_url,
    secondaryActionLabel,
    onSecondaryAction,
    dismissTutorial: tutorialSuppressed ? undefined : dismissTutorial,
    dialogueActionLabel: tutorialSuppressed ? undefined : dialogueActionLabel,
    onDialogueAction:
      tutorialSuppressed ? undefined : (supportsDialogueAction ? onDialogueAction : undefined),
  };
};

export const PostOnboardingMentorGuidanceProvider = ({ children }: PropsWithChildren) => {
  const state = usePostOnboardingMentorGuidanceController();
  return (
    <PostOnboardingMentorGuidanceContext.Provider value={state}>
      {children}
    </PostOnboardingMentorGuidanceContext.Provider>
  );
};

export const usePostOnboardingMentorGuidance = () =>
  useContext(PostOnboardingMentorGuidanceContext);
