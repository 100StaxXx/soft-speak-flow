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
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useXPRewards } from "@/hooks/useXPRewards";
import { getCompanionQueryKey, type Companion } from "@/hooks/useCompanion";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";
import { safeLocalStorage } from "@/utils/storage";
import type {
  CreateQuestSubstepId,
  GuidedMilestoneId,
  GuidedSubstepProgress,
  GuidedTutorialProgress,
  GuidedTutorialStepId,
} from "@/types/profile";

const GUIDED_TUTORIAL_VERSION = 2;
const GUIDED_TUTORIAL_FLOW_VERSION = 2;
const TARGET_RESOLVE_POLL_MS = 250;
const TARGET_MISSING_FALLBACK_MS = 1400;
const CLOSEOUT_AUTO_COMPLETE_MS = 2600;
const EVOLVE_AUTOSCROLL_SELECTOR = '[data-tour="evolve-companion-button"]';
const EVOLVE_AUTOSCROLL_VIEWPORT_MARGIN_PX = 72;

const STEP_XP_REWARDS: Partial<Record<GuidedTutorialStepId, number>> = {
  create_quest: 4,
  morning_checkin: 3,
};

interface GuidedStep {
  id: GuidedTutorialStepId;
  route: string;
}

const GUIDED_STEPS: GuidedStep[] = [
  {
    id: "quests_campaigns_intro",
    route: "/journeys",
  },
  {
    id: "create_quest",
    route: "/journeys",
  },
  {
    id: "morning_checkin",
    route: "/mentor",
  },
  {
    id: "evolve_companion",
    route: "/companion",
  },
  {
    id: "post_evolution_companion_intro",
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

const ACTIVE_GUIDED_STEP_ID_SET = new Set<GuidedTutorialStepId>(GUIDED_STEPS.map((step) => step.id));
const GUIDED_STEP_ID_SET = new Set<GuidedTutorialStepId>([
  ...GUIDED_STEPS.map((step) => step.id),
  "meet_companion",
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
  "tap_evolve_companion",
  "complete_companion_evolution",
  "post_evolution_companion_intro",
  "mentor_closeout_message",
]);

const isGuidedMilestoneId = (value: unknown): value is GuidedMilestoneId =>
  typeof value === "string" && MILESTONE_ID_SET.has(value as GuidedMilestoneId);

const getSafeMilestoneArray = (value: unknown): GuidedMilestoneId[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isGuidedMilestoneId);
};

const emitTutorialEvent = (eventName: string, detail: Record<string, unknown>) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(eventName, { detail }));

  if (import.meta.env.DEV) {
    // Keep diagnostics local to development.
    console.debug(`[Tutorial] ${eventName}`, detail);
  }
};

const getTargetSelectorsForMilestone = (milestoneId: GuidedMilestoneId): string[] => {
  switch (milestoneId) {
    case "mentor_intro_hello":
      return [];
    case "quests_campaigns_intro":
    case "post_evolution_companion_intro":
      return [];
    case "stay_on_quests":
      return ['[data-tour="quests-tab"]']; // legacy fallback
    case "open_add_quest":
      return ['[data-tour="add-quest-fab"]'];
    case "enter_title":
      return ['[data-tour="add-quest-title-input"]'];
    case "select_time":
      return ['[data-tour="add-quest-time-chip"]', '[data-tour="add-quest-time-input"]'];
    case "submit_create_quest":
      return ['[data-tour="add-quest-create-button"]'];
    case "open_companion_tab":
      return ['[data-tour="companion-tab"]'];
    case "confirm_companion_progress":
      return ['[data-tour="companion-progress-area"]', '[data-tour="companion-page"]'];
    case "open_mentor_tab":
      return ['[data-tour="mentor-tab"]'];
    case "submit_morning_checkin":
      return ['[data-tour="checkin-submit"]', '[data-tour="morning-checkin"]'];
    case "tap_evolve_companion":
      return ['[data-tour="evolve-companion-button"]'];
    case "complete_companion_evolution":
    case "mentor_closeout_message":
      return [];
    default:
      return [];
  }
};

interface MentorDialogueLine {
  text: string;
  support: string;
}

const INTRO_DIALOGUE_BY_MENTOR_SLUG: Record<string, MentorDialogueLine> = {
  atlas: {
    text: "Welcome. We begin with one deliberate step, then the next becomes clear.",
    support: "Stay with me for this short walkthrough, and your path will settle into focus.",
  },
  eli: {
    text: "Hey, I'm glad you're here. We'll take this one clear step at a time together.",
    support: "Short walkthrough now, then you'll have a rhythm you can trust.",
  },
  sienna: {
    text: "Hi, I'm really glad you're here. We'll keep this gentle and steady together.",
    support: "I'll guide your first steps so this feels safe, clear, and doable.",
  },
  stryker: {
    text: "You showed up. Good. We execute this fast and clean.",
    support: "Lock the walkthrough, then run your day like a mission.",
  },
  carmen: {
    text: "Welcome. We're setting your standard from the first tap.",
    support: "Quick walkthrough, then your system is live and accountable.",
  },
  reign: {
    text: "I love this energy. Let's set your pace and move with intention.",
    support: "Nail this walkthrough, then build momentum and own the day.",
  },
  solace: {
    text: "Hi friend, you're in the right place. Let's begin with one steady win.",
    support: "I'll keep this calm and clear so you feel grounded right away.",
  },
};

const getMentorIntroDialogue = (mentorSlug: string | undefined, speakerName: string) => {
  const slug = mentorSlug?.toLowerCase();
  if (slug && INTRO_DIALOGUE_BY_MENTOR_SLUG[slug]) {
    return INTRO_DIALOGUE_BY_MENTOR_SLUG[slug];
  }

  if (speakerName && speakerName !== "Your mentor") {
    return {
      text: `Hey, I'm ${speakerName}. I'm glad you're here.`,
      support: "I'll guide your first few taps so you can settle in quickly.",
    };
  }

  return {
    text: "Hey, I'm your mentor. I'm glad you're here.",
    support: "I'll guide your first few taps so you can settle in quickly.",
  };
};

const QUESTS_CAMPAIGNS_DIALOGUE_BY_MENTOR_SLUG: Record<string, MentorDialogueLine> = {
  atlas: {
    text: "This is Quests: choose what matters now, or place a to-do for later.",
    support: "Campaigns are for long-term goals, pursued with steady direction over time.",
  },
  eli: {
    text: "This is Quests. We can do a task now or save a to-do for later.",
    support: "Campaigns are how we go after long-term goals one step at a time.",
  },
  sienna: {
    text: "This is Quests. You can handle something now or set a gentle to-do for later.",
    support: "Campaigns support your long-term goals so growth feels steady, not rushed.",
  },
  stryker: {
    text: "This is Quests. Execute a task now or queue a to-do for later.",
    support: "Campaigns are for long-term goals; we run them with consistent follow-through.",
  },
  carmen: {
    text: "This is Quests. Handle priority tasks now or schedule to-dos for later.",
    support: "Campaigns are your long-term goals, managed with structure and standards.",
  },
  reign: {
    text: "This is Quests. Hit a task now or line up a to-do for later.",
    support: "Campaigns are for long-term goals and sustained momentum.",
  },
  solace: {
    text: "This is Quests. You can take care of something now or leave a to-do for later.",
    support: "Campaigns hold your long-term goals so you can keep moving with calm consistency.",
  },
};

const getQuestsCampaignsIntroDialogue = (
  mentorSlug: string | undefined
): MentorDialogueLine => {
  const slug = mentorSlug?.toLowerCase();
  if (slug && QUESTS_CAMPAIGNS_DIALOGUE_BY_MENTOR_SLUG[slug]) {
    return QUESTS_CAMPAIGNS_DIALOGUE_BY_MENTOR_SLUG[slug];
  }

  return {
    text: "This is Quests. You can do a task now or save a to-do for later.",
    support: "Campaigns are for long-term goals you want to pursue with consistency.",
  };
};

const resolveSelectorFromCandidates = (selectors: string[]): string | null => {
  for (const selector of selectors) {
    if (document.querySelector(selector)) return selector;
  }
  return null;
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

const hasCreateQuestProgressSignal = ({
  completedSteps,
  milestones,
  createQuestProgress,
}: {
  completedSteps: Set<GuidedTutorialStepId>;
  milestones: Set<GuidedMilestoneId>;
  createQuestProgress: CreateQuestProgressState;
}) =>
  createQuestProgress.completed.length > 0 ||
  completedSteps.has("create_quest") ||
  completedSteps.has("meet_companion") ||
  completedSteps.has("morning_checkin") ||
  completedSteps.has("evolve_companion") ||
  completedSteps.has("post_evolution_companion_intro") ||
  completedSteps.has("mentor_closeout") ||
  milestones.has("stay_on_quests") ||
  milestones.has("open_add_quest") ||
  milestones.has("enter_title") ||
  milestones.has("select_time") ||
  milestones.has("submit_create_quest");

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

  const shouldMarkQuestsIntroComplete = hasCreateQuestProgressSignal({
    completedSteps: rawCompletedSet,
    milestones: rawMilestoneSet,
    createQuestProgress,
  });

  const migratedCompletedSet = new Set<GuidedTutorialStepId>(
    completedSteps.filter((stepId) => ACTIVE_GUIDED_STEP_ID_SET.has(stepId))
  );
  if (shouldMarkQuestsIntroComplete) {
    migratedCompletedSet.add("quests_campaigns_intro");
  }

  const isLegacyTutorialComplete = completed || rawCompletedSet.has("mentor_closeout");
  if (isLegacyTutorialComplete) {
    GUIDED_STEPS.forEach((step) => migratedCompletedSet.add(step.id));
  }

  const migratedMilestoneSet = new Set<GuidedMilestoneId>(milestonesCompleted);
  if (shouldMarkQuestsIntroComplete) {
    migratedMilestoneSet.add("quests_campaigns_intro");
  }
  if (isLegacyTutorialComplete) {
    migratedMilestoneSet.add("post_evolution_companion_intro");
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

const getLocalProgressKey = (userId: string) => `guided_tutorial_progress_${userId}`;

const readLocalProgress = (userId: string | undefined): GuidedTutorialProgressSnapshot | null => {
  if (!userId) return null;
  const raw = safeLocalStorage.getItem(getLocalProgressKey(userId));
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
  pathname === "/preview" ||
  pathname.startsWith("/auth") ||
  pathname.startsWith("/onboarding");

const ROUTE_RESTORE_PATH_SET = new Set(["/", "/mentor", "/inbox", "/journeys", "/companion"]);

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
  if (currentStepId === "evolve_companion" && evolutionInFlight) return false;
  if (!ROUTE_RESTORE_PATH_SET.has(pathname)) return false;
  return pathname !== stepRoute;
};

export interface PostOnboardingMentorGuidanceState {
  isIntroDialogueActive: boolean;
  isActive: boolean;
  currentStep: GuidedTutorialStepId | null;
  currentSubstep: CreateQuestSubstepId | null;
  stepRoute: string | null;
  mentorInstructionLines: string[];
  progressText: string;
  activeTargetSelectors: string[];
  activeTargetSelector: string | null;
  isStrictLockActive: boolean;
  canTemporarilyHide: boolean;
  dialogueText: string;
  dialogueSupportText?: string;
  speakerName: string;
  speakerPrimaryColor?: string;
  speakerSlug?: string;
  speakerAvatarUrl?: string;
  dialogueActionLabel?: string;
  onDialogueAction?: () => void;
}

const DEFAULT_GUIDANCE_STATE: PostOnboardingMentorGuidanceState = {
  isIntroDialogueActive: false,
  isActive: false,
  currentStep: null,
  currentSubstep: null,
  stepRoute: null,
  mentorInstructionLines: [],
  progressText: "",
  activeTargetSelectors: [],
  activeTargetSelector: null,
  isStrictLockActive: false,
  canTemporarilyHide: false,
  dialogueText: "",
  dialogueSupportText: undefined,
  speakerName: "Your mentor",
  speakerPrimaryColor: "#f59e0b",
  speakerSlug: undefined,
  speakerAvatarUrl: undefined,
  dialogueActionLabel: undefined,
  onDialogueAction: undefined,
};

const PostOnboardingMentorGuidanceContext = createContext<PostOnboardingMentorGuidanceState>(
  DEFAULT_GUIDANCE_STATE
);

export const getMentorInstructionLines = (
  currentStep: GuidedTutorialStepId | null,
  currentSubstep: CreateQuestSubstepId | null
): string[] => {
  if (currentStep === "quests_campaigns_intro") {
    return ["This is Quests: tasks can be done now or saved for later, while campaigns track long-term goals."];
  }

  if (currentStep === "create_quest") {
    if (currentSubstep === "open_add_quest") {
      return ["Tap the + in the bottom right."];
    }

    if (currentSubstep === "enter_title") {
      return ["Type your quest title here."];
    }

    if (currentSubstep === "select_time") {
      return ["Set a time so this is scheduled."];
    }

    return ["Now tap Create Quest."];
  }

  if (currentStep === "morning_checkin") {
    return ["Head to Mentor."];
  }

  if (currentStep === "evolve_companion") {
    return ["Your companion is ready. Tap Evolve."];
  }

  if (currentStep === "post_evolution_companion_intro") {
    return ["You're on Companion. This is where you track growth after evolution."];
  }

  if (currentStep === "mentor_closeout") {
    return ["Beautiful work. Your tutorial is complete."];
  }

  return [];
};

const getMilestoneDialogue = (
  milestoneId: GuidedMilestoneId,
  mentorSlug: string | undefined
): { text: string; support?: string } => {
  switch (milestoneId) {
    case "quests_campaigns_intro":
      return getQuestsCampaignsIntroDialogue(mentorSlug);
    case "stay_on_quests":
      return {
        text: "Start on Quests. We'll build your first quest together.",
        support: "You and I are setting the tone for your whole adventure.",
      };
    case "open_add_quest":
      return {
        text: "Tap the + in the bottom right.",
        support: "This opens your quest forge.",
      };
    case "enter_title":
      return {
        text: "Type your quest title here.",
        support: "Name it clearly so future-you knows exactly what to do.",
      };
    case "select_time":
      return {
        text: "Set a time so this is scheduled.",
        support: "A quest with a time gets done.",
      };
    case "submit_create_quest":
      return {
        text: "Now tap Create Quest.",
        support: "Once you submit, your first mission goes live.",
      };
    case "open_companion_tab":
      return {
        text: "Open Companion.",
        support: "Let's check in with your ally.",
      };
    case "confirm_companion_progress":
      return {
        text: "This is your companion progress area.",
        support: "Every completed quest strengthens your bond.",
      };
    case "open_mentor_tab":
      return {
        text: "Head to Mentor.",
        support: "We're about to lock in your focus for the day.",
      };
    case "submit_morning_checkin":
      return {
        text: "Complete your check-in and submit.",
        support: "Keep it honest and simple.",
      };
    case "tap_evolve_companion":
      return {
        text: "Your companion is ready. Tap Evolve.",
        support: "This is the moment your effort transforms into growth.",
      };
    case "complete_companion_evolution":
      return {
        text: "Evolution is in progress. This may take a little while.",
        support: "You can leave this screen and use the app like usual. I'll bring you back to complete your tutorial when it's ready.",
      };
    case "post_evolution_companion_intro":
      return {
        text: "Great evolution. This Companion page is where you follow your bond and growth.",
        support: "Take a look here before we close out.",
      };
    case "mentor_closeout_message":
      return {
        text: "Outstanding. You completed your tutorial.",
        support: "Now keep the momentum going with your daily quests and check-ins.",
      };
    default:
      return {
        text: "Let's keep going.",
      };
  }
};

export const milestoneUsesStrictLock = (milestoneId: GuidedMilestoneId | null): boolean => {
  if (!milestoneId) return false;
  if (milestoneId === "mentor_intro_hello") return false;
  if (milestoneId === "quests_campaigns_intro") return false;
  if (milestoneId === "confirm_companion_progress") return false;
  if (milestoneId === "submit_morning_checkin") return false;
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

  const [sessionCompleted, setSessionCompleted] = useState<GuidedTutorialStepId[]>([]);
  const [sessionAwarded, setSessionAwarded] = useState<GuidedTutorialStepId[]>([]);
  const [sessionCreateQuestCompleted, setSessionCreateQuestCompleted] = useState<CreateQuestSubstepId[]>([]);
  const [sessionMilestonesCompleted, setSessionMilestonesCompleted] = useState<GuidedMilestoneId[]>([]);
  const [sessionEvolutionInFlight, setSessionEvolutionInFlight] = useState<boolean | null>(null);
  const [activeTargetSelector, setActiveTargetSelector] = useState<string | null>(null);

  const onboardingData = (profile?.onboarding_data as Record<string, unknown> | null) ?? null;
  const walkthroughCompleted = onboardingData?.walkthrough_completed === true;

  const localProgress = useMemo(() => readLocalProgress(user?.id), [user?.id]);
  const remoteProgress = useMemo(() => readRemoteProgress(onboardingData), [onboardingData]);

  const tutorialEligible =
    remoteProgress?.version === GUIDED_TUTORIAL_VERSION && remoteProgress?.eligible === true;

  useEffect(() => {
    setSessionCompleted([]);
    setSessionAwarded([]);
    setSessionCreateQuestCompleted([]);
    setSessionMilestonesCompleted([]);
    setSessionEvolutionInFlight(null);
    setActiveTargetSelector(null);
    completionPersistRef.current = false;
    stepPersistThrottleRef.current.clear();
    missingTargetSinceRef.current = null;
    migrationPersistSignatureRef.current = null;
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

  const tutorialReady =
    Boolean(user?.id) && !profileLoading && walkthroughCompleted && tutorialEligible;

  const tutorialMarkedComplete = migratedProgress.completed;

  const tutorialComplete = tutorialReady && (tutorialMarkedComplete || !currentStep);
  const hasPendingIntroDialogue = Boolean(currentStep) && !milestoneSet.has("mentor_intro_hello");
  const stepRoute = currentStep?.route ?? null;
  const shouldRestoreRoute = shouldRestoreTutorialRoute({
    pathname: location.pathname,
    stepRoute,
    tutorialReady,
    tutorialComplete,
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
      safeLocalStorage.setItem(getLocalProgressKey(user.id), JSON.stringify(localNext));

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

      const { error } = await supabase
        .from("profiles")
        .update({
          onboarding_data: {
            ...baseData,
            guided_tutorial: remoteNext,
          },
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

  const markStepComplete = useCallback(
    (stepId: GuidedTutorialStepId) => {
      if (hasPendingIntroDialogue) return;
      if (!tutorialReady || completedSet.has(stepId)) return;
      if (stepPersistThrottleRef.current.has(stepId)) return;

      stepPersistThrottleRef.current.add(stepId);
      window.setTimeout(() => {
        stepPersistThrottleRef.current.delete(stepId);
      }, 1000);

      const nextCompletedSet = new Set<GuidedTutorialStepId>([...completedSet, stepId]);
      const nextCompleted = toActiveStepOrder(nextCompletedSet);
      const complete = GUIDED_STEPS.every((step) => nextCompletedSet.has(step.id));

      setSessionCompleted((prev) => (prev.includes(stepId) ? prev : [...prev, stepId]));

      const nextAwardedSet = new Set<GuidedTutorialStepId>(awardedSet);
      const stepXPReward = STEP_XP_REWARDS[stepId] ?? 0;
      if (!nextAwardedSet.has(stepId) && stepXPReward > 0) {
        nextAwardedSet.add(stepId);
        setSessionAwarded((prev) => (prev.includes(stepId) ? prev : [...prev, stepId]));

        void awardCustomXP(stepXPReward, "guided_tutorial_step_complete", undefined, {
          guided_step: stepId,
          source: "guided_tutorial",
        });
      }

      void persistProgress({
        completedSteps: nextCompleted,
        xpAwardedSteps: toActiveStepOrder(nextAwardedSet),
        completed: complete,
        completedAt: complete ? new Date().toISOString() : undefined,
      });
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
    if (!tutorialReady || tutorialComplete || hasPendingIntroDialogue || !currentStep) return;

    if (currentStep.id === "quests_campaigns_intro") {
      if (location.pathname !== "/journeys") return;
      if (milestoneSet.has("quests_campaigns_intro")) {
        markStepComplete("quests_campaigns_intro");
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
          markStepComplete("morning_checkin");
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

    if (currentStep.id === "evolve_companion") {
      const cachedCompanion = user?.id
        ? queryClient.getQueryData<Companion | null>(getCompanionQueryKey(user.id))
        : null;

      if (
        cachedCompanion &&
        cachedCompanion.current_stage > 0 &&
        !milestoneSet.has("complete_companion_evolution")
      ) {
        markMilestoneComplete("complete_companion_evolution");
        markStepComplete("evolve_companion");
      }
      return;
    }

    if (currentStep.id === "post_evolution_companion_intro") {
      if (location.pathname !== "/companion") return;
      if (milestoneSet.has("post_evolution_companion_intro")) {
        markStepComplete("post_evolution_companion_intro");
      }
      return;
    }

    if (currentStep.id === "mentor_closeout") {
      if (location.pathname !== "/companion") return;

      if (!milestoneSet.has("mentor_closeout_message")) {
        markMilestoneComplete("mentor_closeout_message");
      }

      const timeout = window.setTimeout(() => {
        markStepComplete("mentor_closeout");
      }, CLOSEOUT_AUTO_COMPLETE_MS);

      return () => {
        window.clearTimeout(timeout);
      };
    }
  }, [
    createQuestProgress.current,
    currentStep,
    location.pathname,
    markCreateQuestSubstepComplete,
    markMilestoneComplete,
    markStepComplete,
    queryClient,
    milestoneSet,
    hasPendingIntroDialogue,
    tutorialComplete,
    tutorialReady,
    user?.id,
  ]);

  useEffect(() => {
    if (!currentStep || !tutorialReady || tutorialComplete || hasPendingIntroDialogue) return;

    const listeners: Array<{ eventName: string; handler: (event: Event) => void }> = [];

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
          markStepComplete("create_quest");
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
          markStepComplete("morning_checkin");
        },
      });
    }

    if (currentStep.id === "evolve_companion") {
      listeners.push({
        eventName: "evolution-loading-start",
        handler: () => {
          if (!milestoneSet.has("tap_evolve_companion")) {
            markMilestoneComplete("tap_evolve_companion");
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
          setSessionEvolutionInFlight(false);
          void persistProgress({
            evolutionInFlight: false,
            evolutionCompletedAt: new Date().toISOString(),
          });
          if (!milestoneSet.has("complete_companion_evolution")) {
            markMilestoneComplete("complete_companion_evolution");
          }
          markStepComplete("evolve_companion");
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
    createQuestProgress.current,
    currentStep,
    location.pathname,
    markCreateQuestSubstepComplete,
    markMilestoneComplete,
    markStepComplete,
    milestoneSet,
    persistProgress,
    hasPendingIntroDialogue,
    tutorialComplete,
    tutorialReady,
  ]);

  const currentMilestone = useMemo<GuidedMilestoneId | null>(() => {
    if (!currentStep) return null;
    if (!milestoneSet.has("mentor_intro_hello")) return "mentor_intro_hello";

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

    if (currentStep.id === "evolve_companion") {
      return evolutionInFlight ? "complete_companion_evolution" : "tap_evolve_companion";
    }

    if (currentStep.id === "post_evolution_companion_intro") {
      return "post_evolution_companion_intro";
    }

    if (currentStep.id === "mentor_closeout") {
      return "mentor_closeout_message";
    }

    return null;
  }, [createQuestProgress.current, currentStep, evolutionInFlight, milestoneSet]);

  const isIntroDialogueActive = currentMilestone === "mentor_intro_hello";
  const supportsDialogueAction =
    currentMilestone === "mentor_intro_hello" ||
    currentMilestone === "quests_campaigns_intro" ||
    currentMilestone === "post_evolution_companion_intro";
  const dialogueActionLabel = supportsDialogueAction
    ? currentMilestone === "mentor_intro_hello"
      ? "Start Tutorial"
      : "Continue"
    : undefined;
  const onDialogueAction = useCallback(() => {
    if (!currentMilestone || !supportsDialogueAction) return;
    markMilestoneComplete(currentMilestone);
  }, [currentMilestone, markMilestoneComplete, supportsDialogueAction]);

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
    if (!currentMilestone) {
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
  }, [currentMilestone, currentStep?.id, location.pathname, user?.id]);

  useEffect(() => {
    if (
      !tutorialReady ||
      tutorialComplete ||
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
    tutorialComplete,
    tutorialReady,
    user?.id,
  ]);

  const isActive =
    tutorialReady &&
    !tutorialComplete &&
    !shouldRestoreRoute &&
    !pathIsHidden(location.pathname) &&
    Boolean(currentStep);

  useEffect(() => {
    const isEvolveEntry =
      isActive &&
      currentStepId === "evolve_companion" &&
      currentMilestone === "tap_evolve_companion" &&
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
  const createQuestSubstepIndex = createQuestProgress.completed.length + 1;

  const progressText =
    currentStepId === "create_quest"
      ? `Step ${currentIndex + 1} of ${GUIDED_STEPS.length} - Create Quest ${Math.min(
          createQuestSubstepIndex,
          CREATE_QUEST_SUBSTEP_ORDER.length
        )}/${CREATE_QUEST_SUBSTEP_ORDER.length}`
      : currentStepId
        ? `Step ${currentIndex + 1} of ${GUIDED_STEPS.length}`
        : "";

  const dialogue = currentMilestone
    ? currentMilestone === "mentor_intro_hello"
      ? getMentorIntroDialogue(personality?.slug, personality?.name ?? "Your mentor")
      : getMilestoneDialogue(currentMilestone, personality?.slug)
    : { text: "", support: undefined };
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

  return {
    isIntroDialogueActive,
    isActive,
    currentStep: currentStepId,
    currentSubstep,
    stepRoute,
    mentorInstructionLines,
    progressText,
    activeTargetSelectors,
    activeTargetSelector,
    isStrictLockActive: Boolean(isActive && activeTargetSelector && strictLockEnabled),
    canTemporarilyHide: currentMilestone === "complete_companion_evolution",
    dialogueText: dialogue.text,
    dialogueSupportText,
    speakerName: personality?.name ?? "Your mentor",
    speakerPrimaryColor: personality?.primary_color ?? "#f59e0b",
    speakerSlug: personality?.slug,
    speakerAvatarUrl: personality?.avatar_url,
    dialogueActionLabel,
    onDialogueAction: supportsDialogueAction ? onDialogueAction : undefined,
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
