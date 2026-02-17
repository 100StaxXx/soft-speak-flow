import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { TutorialInteractionGuard } from "@/components/tutorial/TutorialInteractionGuard";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useXPRewards } from "@/hooks/useXPRewards";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/utils/storage";
import { cn } from "@/lib/utils";
import type {
  CreateQuestSubstepId,
  GuidedSubstepProgress,
  GuidedTutorialProgress,
  GuidedTutorialStepId,
} from "@/types/profile";

const GUIDED_TUTORIAL_VERSION = 2;
const STEP_XP_REWARDS: Record<GuidedTutorialStepId, number> = {
  create_quest: 4,
  meet_companion: 3,
  morning_checkin: 3,
};

type GuidedLockMode = "strict";
type PanelZone = "top" | "bottom" | "left" | "right";

interface GuidedStep {
  id: GuidedTutorialStepId;
  title: string;
  description: string;
  checklist: string[];
  successHint: string;
  actionLabel: string;
  route: string;
  navSelector: string;
  inRouteSelector: string;
  lockMode: GuidedLockMode;
  spotlightPadding: number;
  preferredPanelZones?: PanelZone[];
  completion:
    | {
        type: "route_visit";
      }
    | {
        type: "event";
        eventName: string;
        requireRoute?: boolean;
      };
}

type GuidedTutorialProgressSnapshot = Partial<GuidedTutorialProgress>;

interface PanelPlacementResult {
  zone: PanelZone;
  top: number;
  left: number;
  lockEnabled: boolean;
}

interface PlacementInput {
  targetRect: Pick<DOMRectReadOnly, "top" | "left" | "right" | "bottom" | "width" | "height">;
  panelWidth: number;
  panelHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  preferredZones?: PanelZone[];
}

interface CreateQuestSubstepView {
  id: CreateQuestSubstepId;
  title: string;
  description: string;
  checklist: string[];
  successHint: string;
  actionLabel: string;
  selectors: string[];
}

interface CreateQuestProgressState {
  current: CreateQuestSubstepId;
  completed: CreateQuestSubstepId[];
  startedAt?: string;
  completedAt?: string;
}

const PANEL_GAP = 12;
const SAFE_HORIZONTAL = 12;
const SAFE_TOP = 12;
const SAFE_BOTTOM = 104;

const GUIDED_STEPS: GuidedStep[] = [
  {
    id: "create_quest",
    title: "Create your first quest",
    description: "Finish each action in order to create your first scheduled quest.",
    checklist: [
      "Stay on the QUESTS tab.",
      "Tap + in the lower-right corner.",
      "Set a time, enter a title, then tap Create Quest.",
    ],
    successHint: "You'll move one substep at a time.",
    actionLabel: "Go to Quests",
    route: "/journeys",
    navSelector: '[data-tour="quests-tab"]',
    inRouteSelector: '[data-tour="add-quest-fab"]',
    lockMode: "strict",
    spotlightPadding: 10,
    preferredPanelZones: ["top", "bottom", "left", "right"],
    completion: { type: "event", eventName: "task-added", requireRoute: true },
  },
  {
    id: "meet_companion",
    title: "Meet your companion",
    description: "Find your companion and confirm your bond/progress panel is visible.",
    checklist: [
      "Tap COMPANION in the bottom navigation bar.",
      "Wait for the companion page to fully load.",
      "Look at the progress area to confirm you're in the right place.",
    ],
    successHint: "This step auto-completes once the Companion page opens.",
    actionLabel: "Go to Companion",
    route: "/companion",
    navSelector: '[data-tour="companion-tab"]',
    inRouteSelector: '[data-tour="companion-page"]',
    lockMode: "strict",
    spotlightPadding: 12,
    preferredPanelZones: ["bottom", "top", "right", "left"],
    completion: { type: "route_visit" },
  },
  {
    id: "morning_checkin",
    title: "Complete morning check-in",
    description: "Open Mentor and submit one morning reflection.",
    checklist: [
      "Tap MENTOR in the bottom navigation bar.",
      "Open the Morning Check-in card.",
      "Answer and submit your check-in.",
    ],
    successHint: "This step auto-completes after your check-in is submitted.",
    actionLabel: "Go to Mentor",
    route: "/mentor",
    navSelector: '[data-tour="mentor-tab"]',
    inRouteSelector: '[data-tour="morning-checkin"]',
    lockMode: "strict",
    spotlightPadding: 10,
    preferredPanelZones: ["top", "bottom", "right", "left"],
    completion: { type: "event", eventName: "morning-checkin-completed", requireRoute: true },
  },
];

export const CREATE_QUEST_SUBSTEP_ORDER: CreateQuestSubstepId[] = [
  "stay_on_quests",
  "open_add_quest",
  "select_time",
  "submit_create_quest",
];

const CREATE_QUEST_SUBSTEP_VIEW: Record<CreateQuestSubstepId, CreateQuestSubstepView> = {
  stay_on_quests: {
    id: "stay_on_quests",
    title: "Stay on Quests",
    description: "You must remain on the Quests tab for this tutorial sequence.",
    checklist: ["Stay on the QUESTS tab."],
    successHint: "Once you're on Quests, we'll move to the next action.",
    actionLabel: "Go to Quests",
    selectors: ['[data-tour="quests-tab"]'],
  },
  open_add_quest: {
    id: "open_add_quest",
    title: "Open Add Quest",
    description: "Tap the + button to open the Add Quest sheet.",
    checklist: ["Tap + in the lower-right corner."],
    successHint: "The next step starts as soon as the Add Quest sheet opens.",
    actionLabel: "Highlight +",
    selectors: ['[data-tour="add-quest-fab"]'],
  },
  select_time: {
    id: "select_time",
    title: "Select a Time",
    description: "Pick a time for your quest before creating it.",
    checklist: ["Tap Time.", "Choose a time in the picker."],
    successHint: "Selecting any valid time moves you to the final substep.",
    actionLabel: "Select Time",
    selectors: ['[data-tour="add-quest-time-input"]', '[data-tour="add-quest-time-chip"]'],
  },
  submit_create_quest: {
    id: "submit_create_quest",
    title: "Tap Create Quest",
    description: "Now submit your scheduled quest.",
    checklist: ["Enter a title.", "Tap Create Quest."],
    successHint: "This completes the create-quest tutorial step.",
    actionLabel: "Create Quest",
    selectors: ['[data-tour="add-quest-create-button"]'],
  },
};

const GUIDED_STEP_ID_SET = new Set<GuidedTutorialStepId>(GUIDED_STEPS.map((step) => step.id));
const CREATE_QUEST_SUBSTEP_SET = new Set<CreateQuestSubstepId>(CREATE_QUEST_SUBSTEP_ORDER);

const isGuidedStepId = (value: unknown): value is GuidedTutorialStepId =>
  typeof value === "string" && GUIDED_STEP_ID_SET.has(value as GuidedTutorialStepId);

const isCreateQuestSubstepId = (value: unknown): value is CreateQuestSubstepId =>
  typeof value === "string" && CREATE_QUEST_SUBSTEP_SET.has(value as CreateQuestSubstepId);

const isProgressRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getDefaultPanelPlacement = (
  viewportWidth: number,
  panelWidth: number,
  fallbackTop = SAFE_TOP
): PanelPlacementResult => ({
  zone: "top",
  top: fallbackTop,
  left: clamp(
    (viewportWidth - panelWidth) / 2,
    SAFE_HORIZONTAL,
    Math.max(SAFE_HORIZONTAL, viewportWidth - panelWidth - SAFE_HORIZONTAL)
  ),
  lockEnabled: false,
});

const getNextCreateQuestSubstep = (
  completed: CreateQuestSubstepId[]
): CreateQuestSubstepId => {
  const completedSet = new Set(completed);
  return (
    CREATE_QUEST_SUBSTEP_ORDER.find((substep) => !completedSet.has(substep)) ??
    "submit_create_quest"
  );
};

const sanitizeCreateQuestProgress = (value: unknown): CreateQuestProgressState | null => {
  if (!isProgressRecord(value)) return null;

  const completed = Array.isArray(value.completed)
    ? value.completed.filter(isCreateQuestSubstepId)
    : [];

  const current = isCreateQuestSubstepId(value.current)
    ? value.current
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
  const completed = Array.from(new Set([...remoteCompleted, ...localCompleted]));

  const current = getNextCreateQuestSubstep(completed);
  const completedAll = completed.length >= CREATE_QUEST_SUBSTEP_ORDER.length;

  return {
    current,
    completed,
    startedAt: remote?.startedAt ?? local?.startedAt ?? new Date().toISOString(),
    completedAt: completedAll ? remote?.completedAt ?? local?.completedAt ?? new Date().toISOString() : undefined,
  };
};

const resolveSelectorFromCandidates = (candidates: string[]): string | null => {
  for (const candidate of candidates) {
    if (document.querySelector(candidate)) return candidate;
  }
  return candidates[0] ?? null;
};

export const computeGuidedPanelPlacement = ({
  targetRect,
  panelWidth,
  panelHeight,
  viewportWidth,
  viewportHeight,
  preferredZones,
}: PlacementInput): PanelPlacementResult => {
  const safeBottomEdge = viewportHeight - SAFE_BOTTOM;
  const centerX = targetRect.left + targetRect.width / 2;
  const centerY = targetRect.top + targetRect.height / 2;

  const availableSpace: Record<PanelZone, number> = {
    top: targetRect.top - SAFE_TOP - PANEL_GAP,
    bottom: safeBottomEdge - targetRect.bottom - PANEL_GAP,
    left: targetRect.left - SAFE_HORIZONTAL - PANEL_GAP,
    right: viewportWidth - SAFE_HORIZONTAL - targetRect.right - PANEL_GAP,
  };

  const zones: PanelZone[] =
    preferredZones && preferredZones.length > 0
      ? preferredZones
      : Object.entries(availableSpace)
          .sort((a, b) => b[1] - a[1])
          .map(([zone]) => zone as PanelZone);

  const chooseTopLeft = (zone: PanelZone) => {
    if (zone === "top") {
      return {
        top: targetRect.top - panelHeight - PANEL_GAP,
        left: centerX - panelWidth / 2,
      };
    }

    if (zone === "bottom") {
      return {
        top: targetRect.bottom + PANEL_GAP,
        left: centerX - panelWidth / 2,
      };
    }

    if (zone === "left") {
      return {
        top: centerY - panelHeight / 2,
        left: targetRect.left - panelWidth - PANEL_GAP,
      };
    }

    return {
      top: centerY - panelHeight / 2,
      left: targetRect.right + PANEL_GAP,
    };
  };

  for (const zone of zones) {
    const { top, left } = chooseTopLeft(zone);

    const clampedTop = clamp(top, SAFE_TOP, Math.max(SAFE_TOP, safeBottomEdge - panelHeight));
    const clampedLeft = clamp(
      left,
      SAFE_HORIZONTAL,
      Math.max(SAFE_HORIZONTAL, viewportWidth - panelWidth - SAFE_HORIZONTAL)
    );

    const hasVerticalRoom =
      zone === "left" || zone === "right"
        ? availableSpace.top + availableSpace.bottom >= panelHeight
        : availableSpace[zone] >= panelHeight;
    const hasHorizontalRoom =
      zone === "top" || zone === "bottom"
        ? availableSpace.left + availableSpace.right >= panelWidth
        : availableSpace[zone] >= panelWidth;

    if (hasVerticalRoom || hasHorizontalRoom) {
      return {
        zone,
        top: clampedTop,
        left: clampedLeft,
        lockEnabled: true,
      };
    }
  }

  const fallback = getDefaultPanelPlacement(viewportWidth, panelWidth);
  return {
    ...fallback,
    top: clamp(fallback.top, SAFE_TOP, Math.max(SAFE_TOP, safeBottomEdge - panelHeight)),
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

const readLocalProgress = (
  userId: string | undefined
): GuidedTutorialProgressSnapshot | null => {
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

export const TutorialOrchestrator = () => {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { awardCustomXP } = useXPRewards();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const completionPersistRef = useRef(false);
  const stepPersistThrottleRef = useRef<Set<GuidedTutorialStepId>>(new Set());
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [sessionCompleted, setSessionCompleted] = useState<GuidedTutorialStepId[]>([]);
  const [sessionAwarded, setSessionAwarded] = useState<GuidedTutorialStepId[]>([]);
  const [sessionCreateQuestCompleted, setSessionCreateQuestCompleted] = useState<CreateQuestSubstepId[]>([]);
  const [dismissedOverride, setDismissedOverride] = useState<boolean | null>(null);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [panelPlacement, setPanelPlacement] = useState<PanelPlacementResult>(() =>
    getDefaultPanelPlacement(typeof window !== "undefined" ? window.innerWidth : 390, 360)
  );

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
    setDismissedOverride(null);
    completionPersistRef.current = false;
    stepPersistThrottleRef.current.clear();
  }, [user?.id]);

  const persistedCompleted = useMemo(() => {
    const remote = safeCompletedSteps(remoteProgress?.completedSteps);
    const local = safeCompletedSteps(localProgress?.completedSteps);
    return Array.from(new Set([...remote, ...local]));
  }, [localProgress?.completedSteps, remoteProgress?.completedSteps]);

  const persistedAwarded = useMemo(() => {
    const remote = safeAwardedSteps(remoteProgress?.xpAwardedSteps);
    const local = safeAwardedSteps(localProgress?.xpAwardedSteps);
    return Array.from(new Set([...remote, ...local]));
  }, [localProgress?.xpAwardedSteps, remoteProgress?.xpAwardedSteps]);

  const remoteCreateQuestProgress = useMemo(
    () => sanitizeCreateQuestProgress((remoteProgress?.substeps as GuidedSubstepProgress | undefined)?.create_quest),
    [remoteProgress?.substeps]
  );

  const localCreateQuestProgress = useMemo(
    () => sanitizeCreateQuestProgress((localProgress?.substeps as GuidedSubstepProgress | undefined)?.create_quest),
    [localProgress?.substeps]
  );

  const createQuestProgress = useMemo(() => {
    const merged = mergeCreateQuestProgress(remoteCreateQuestProgress, localCreateQuestProgress);
    const completed = Array.from(new Set([...merged.completed, ...sessionCreateQuestCompleted]));
    return {
      ...merged,
      completed,
      current: getNextCreateQuestSubstep(completed),
    };
  }, [localCreateQuestProgress, remoteCreateQuestProgress, sessionCreateQuestCompleted]);

  const effectiveDismissed = useMemo(() => {
    if (dismissedOverride !== null) return dismissedOverride;
    return Boolean(remoteProgress?.dismissed ?? localProgress?.dismissed ?? false);
  }, [dismissedOverride, localProgress?.dismissed, remoteProgress?.dismissed]);

  const completedSet = useMemo(
    () => new Set<GuidedTutorialStepId>([...persistedCompleted, ...sessionCompleted]),
    [persistedCompleted, sessionCompleted]
  );

  const awardedSet = useMemo(
    () => new Set<GuidedTutorialStepId>([...persistedAwarded, ...sessionAwarded]),
    [persistedAwarded, sessionAwarded]
  );

  const currentStep = useMemo(
    () => GUIDED_STEPS.find((step) => !completedSet.has(step.id)),
    [completedSet]
  );

  const tutorialReady =
    Boolean(user?.id) && !profileLoading && walkthroughCompleted && tutorialEligible;

  const tutorialMarkedComplete = Boolean(
    remoteProgress?.completed ?? localProgress?.completed ?? false
  );

  const tutorialComplete = tutorialReady && (tutorialMarkedComplete || !currentStep);

  const persistProgress = useCallback(
    async (progress: GuidedTutorialProgressSnapshot) => {
      if (!user?.id) return;

      const nowIso = new Date().toISOString();

      const localCurrent = readLocalProgress(user.id) ?? {};
      const localNext: GuidedTutorialProgressSnapshot = {
        ...localCurrent,
        ...progress,
        version: GUIDED_TUTORIAL_VERSION,
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

  const markCreateQuestSubstepComplete = useCallback(
    (substepId: CreateQuestSubstepId) => {
      if (!tutorialReady || currentStep?.id !== "create_quest") return;
      if (createQuestProgress.current !== substepId) return;
      if (createQuestProgress.completed.includes(substepId)) return;

      const completed = [...createQuestProgress.completed, substepId];
      const completedUnique = Array.from(new Set(completed));
      const nextCurrent = getNextCreateQuestSubstep(completedUnique);
      const completedAll = completedUnique.length >= CREATE_QUEST_SUBSTEP_ORDER.length;

      setSessionCreateQuestCompleted((prev) =>
        prev.includes(substepId) ? prev : [...prev, substepId]
      );

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
    [createQuestProgress, currentStep?.id, persistProgress, tutorialReady]
  );

  const markStepComplete = useCallback(
    (stepId: GuidedTutorialStepId) => {
      if (!tutorialReady || completedSet.has(stepId)) return;
      if (stepPersistThrottleRef.current.has(stepId)) return;

      stepPersistThrottleRef.current.add(stepId);
      window.setTimeout(() => {
        stepPersistThrottleRef.current.delete(stepId);
      }, 1000);

      const nextCompletedSet = new Set<GuidedTutorialStepId>([...completedSet, stepId]);
      const nextCompleted = Array.from(nextCompletedSet);
      const complete = GUIDED_STEPS.every((step) => nextCompletedSet.has(step.id));

      setSessionCompleted((prev) => (prev.includes(stepId) ? prev : [...prev, stepId]));

      const nextAwardedSet = new Set<GuidedTutorialStepId>(awardedSet);
      if (!nextAwardedSet.has(stepId)) {
        nextAwardedSet.add(stepId);
        setSessionAwarded((prev) => (prev.includes(stepId) ? prev : [...prev, stepId]));

        void awardCustomXP(STEP_XP_REWARDS[stepId], "guided_tutorial_step_complete", undefined, {
          guided_step: stepId,
          source: "guided_tutorial",
        });
      }

      setDismissedOverride(false);
      void persistProgress({
        completedSteps: nextCompleted,
        xpAwardedSteps: Array.from(nextAwardedSet),
        dismissed: false,
        completed: complete,
        completedAt: complete ? new Date().toISOString() : undefined,
      });
    },
    [awardCustomXP, awardedSet, completedSet, persistProgress, tutorialReady]
  );

  useEffect(() => {
    if (!tutorialComplete || completionPersistRef.current) return;

    completionPersistRef.current = true;
    setDismissedOverride(false);

    void persistProgress({
      completedSteps: GUIDED_STEPS.map((step) => step.id),
      xpAwardedSteps: Array.from(awardedSet),
      dismissed: false,
      completed: true,
      completedAt: new Date().toISOString(),
    });
  }, [awardedSet, persistProgress, tutorialComplete]);

  useEffect(() => {
    if (!currentStep) return;
    if (currentStep.id === "create_quest") return;
    if (currentStep.completion.type !== "route_visit") return;
    if (location.pathname !== currentStep.route) return;

    const timer = window.setTimeout(() => {
      markStepComplete(currentStep.id);
    }, 700);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentStep, location.pathname, markStepComplete]);

  useEffect(() => {
    if (!tutorialReady || effectiveDismissed || currentStep?.id !== "create_quest") return;

    if (location.pathname !== "/journeys" && !pathIsHidden(location.pathname)) {
      navigate("/journeys", { replace: true });
    }
  }, [currentStep?.id, effectiveDismissed, location.pathname, navigate, tutorialReady]);

  useEffect(() => {
    if (currentStep?.id !== "create_quest") return;
    if (location.pathname !== "/journeys") return;
    if (createQuestProgress.current !== "stay_on_quests") return;

    markCreateQuestSubstepComplete("stay_on_quests");
  }, [
    createQuestProgress.current,
    currentStep?.id,
    location.pathname,
    markCreateQuestSubstepComplete,
  ]);

  useEffect(() => {
    if (!currentStep) return;

    const completion = currentStep.completion;
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
        eventName: "add-quest-time-selected",
        handler: (event) => {
          if (location.pathname !== "/journeys") return;
          const detail = (event as CustomEvent<{ scheduledTime?: string | null }>).detail;
          if (!detail?.scheduledTime) return;
          markCreateQuestSubstepComplete("select_time");
        },
      });

      listeners.push({
        eventName: completion.eventName,
        handler: (event) => {
          if (location.pathname !== "/journeys") return;
          const detail = (event as CustomEvent<{ taskDate?: string | null; scheduledTime?: string | null }>).detail;
          if (!detail?.taskDate || !detail?.scheduledTime) return;
          if (createQuestProgress.current !== "submit_create_quest") return;

          markCreateQuestSubstepComplete("submit_create_quest");
          markStepComplete("create_quest");
        },
      });
    } else if (completion.type === "event") {
      listeners.push({
        eventName: completion.eventName,
        handler: () => {
          if (completion.requireRoute && location.pathname !== currentStep.route) {
            return;
          }
          markStepComplete(currentStep.id);
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
    markStepComplete,
  ]);

  const createQuestView = useMemo(() => {
    if (currentStep?.id !== "create_quest") return null;
    return CREATE_QUEST_SUBSTEP_VIEW[createQuestProgress.current];
  }, [createQuestProgress.current, currentStep?.id]);

  const activeSelector = useMemo(() => {
    if (!currentStep) return null;

    if (currentStep.id === "create_quest" && createQuestView) {
      return resolveSelectorFromCandidates(createQuestView.selectors);
    }

    if (location.pathname === currentStep.route) return currentStep.inRouteSelector;
    return currentStep.navSelector;
  }, [createQuestView, currentStep, location.pathname]);

  useEffect(() => {
    if (!tutorialReady || tutorialComplete || !currentStep || effectiveDismissed || !activeSelector) {
      setTargetElement(null);
      return;
    }

    const updatePlacement = () => {
      const target = document.querySelector(activeSelector) as HTMLElement | null;
      const panelElement = panelRef.current;

      setTargetElement(target);

      if (!target || !panelElement) {
        const fallback = getDefaultPanelPlacement(
          window.innerWidth,
          Math.min(window.innerWidth - 24, 560)
        );
        setPanelPlacement(fallback);
        return;
      }

      const panelRect = panelElement.getBoundingClientRect();
      const panelWidth = Math.min(window.innerWidth - 24, panelRect.width || 360);
      const placement = computeGuidedPanelPlacement({
        targetRect: target.getBoundingClientRect(),
        panelWidth,
        panelHeight: panelRect.height || 220,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        preferredZones: currentStep.preferredPanelZones,
      });

      setPanelPlacement(placement);

      if (location.pathname === currentStep.route) {
        window.requestAnimationFrame(() => {
          target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
        });
      }
    };

    updatePlacement();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(updatePlacement) : null;
    const targetForObserver = document.querySelector(activeSelector) as HTMLElement | null;

    if (targetForObserver) {
      resizeObserver?.observe(targetForObserver);
    }
    if (panelRef.current) {
      resizeObserver?.observe(panelRef.current);
    }

    window.addEventListener("scroll", updatePlacement, true);
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("orientationchange", updatePlacement);

    const pollTimer = window.setInterval(updatePlacement, 350);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("scroll", updatePlacement, true);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("orientationchange", updatePlacement);
      window.clearInterval(pollTimer);
    };
  }, [
    activeSelector,
    currentStep,
    effectiveDismissed,
    location.pathname,
    tutorialComplete,
    tutorialReady,
  ]);

  const handlePrimaryAction = useCallback(() => {
    if (!currentStep) return;

    if (currentStep.id === "create_quest") {
      const view = CREATE_QUEST_SUBSTEP_VIEW[createQuestProgress.current];

      if (location.pathname !== "/journeys") {
        navigate("/journeys", { replace: true });
        return;
      }

      const selector = resolveSelectorFromCandidates(view.selectors);
      const target = selector ? (document.querySelector(selector) as HTMLElement | null) : null;
      if (target) {
        target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
        target.click();
      }
      return;
    }

    if (location.pathname !== currentStep.route) {
      navigate(currentStep.route);
      return;
    }

    const target = document.querySelector(currentStep.inRouteSelector) as HTMLElement | null;
    if (target) {
      target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    }
  }, [createQuestProgress.current, currentStep, location.pathname, navigate]);

  const handleDismiss = useCallback(() => {
    setDismissedOverride(true);
    void persistProgress({ dismissed: true });
  }, [persistProgress]);

  const handleResume = useCallback(() => {
    setDismissedOverride(false);
    void persistProgress({ dismissed: false });
  }, [persistProgress]);

  const shouldBlockAddQuestClose =
    !effectiveDismissed &&
    currentStep?.id === "create_quest" &&
    !completedSet.has("create_quest") &&
    createQuestProgress.current !== "stay_on_quests";

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("guided-create-quest-lock", {
        detail: {
          active: shouldBlockAddQuestClose,
        },
      })
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent("guided-create-quest-lock", {
          detail: {
            active: false,
          },
        })
      );
    };
  }, [shouldBlockAddQuestClose]);

  if (!tutorialReady || tutorialComplete || pathIsHidden(location.pathname) || !currentStep) {
    return null;
  }

  const currentIndex = GUIDED_STEPS.findIndex((step) => step.id === currentStep.id);
  const createQuestSubstepIndex = createQuestProgress.completed.length + 1;
  const progressText =
    currentStep.id === "create_quest"
      ? `Step ${currentIndex + 1} of ${GUIDED_STEPS.length} • Create Quest ${Math.min(
          createQuestSubstepIndex,
          CREATE_QUEST_SUBSTEP_ORDER.length
        )}/${CREATE_QUEST_SUBSTEP_ORDER.length}`
      : `Step ${currentIndex + 1} of ${GUIDED_STEPS.length}`;

  const strictLockActive =
    !effectiveDismissed &&
    currentStep.lockMode === "strict" &&
    panelPlacement.lockEnabled &&
    Boolean(targetElement);

  if (effectiveDismissed) {
    return (
      <div
        className="fixed right-4 z-[90]"
        style={{ bottom: "calc(6.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <Button
          size="sm"
          variant="secondary"
          className="rounded-full bg-card/90 backdrop-blur-md border border-primary/30 text-xs"
          onClick={handleResume}
        >
          Resume Tutorial
        </Button>
      </div>
    );
  }

  const displayTitle = currentStep.id === "create_quest" && createQuestView ? createQuestView.title : currentStep.title;
  const displayDescription = currentStep.id === "create_quest" && createQuestView
    ? createQuestView.description
    : currentStep.description;
  const displayChecklist = currentStep.id === "create_quest" && createQuestView
    ? createQuestView.checklist
    : currentStep.checklist;
  const displaySuccessHint = currentStep.id === "create_quest" && createQuestView
    ? createQuestView.successHint
    : currentStep.successHint;
  const displayActionLabel = currentStep.id === "create_quest" && createQuestView
    ? createQuestView.actionLabel
    : currentStep.actionLabel;

  return (
    <>
      <TutorialInteractionGuard
        active={strictLockActive}
        targetElement={targetElement}
        panelElement={panelRef.current}
        spotlightPadding={currentStep.spotlightPadding}
        maskStyle="dim"
      />

      <div className="fixed inset-0 z-[90] pointer-events-none" data-tutorial="guided-layer">
        <div
          ref={panelRef}
          data-tutorial="guided-panel"
          className={cn(
            "pointer-events-auto rounded-2xl border border-primary/30 bg-card/92 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.35)] p-3",
            "w-[calc(100vw-24px)] max-w-lg"
          )}
          style={{
            position: "fixed",
            top: `${panelPlacement.top}px`,
            left: `${panelPlacement.left}px`,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className="text-[10px] uppercase tracking-[0.18em] text-primary/90 font-semibold"
                aria-live="polite"
              >
                {progressText}
              </p>
              <h3 className="mt-1 text-sm font-semibold text-foreground">{displayTitle}</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {displayDescription}
              </p>
              <div className="mt-2 rounded-lg border border-border/60 bg-background/35 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/80">
                  Do this now
                </p>
                <ol className="mt-1.5 space-y-1">
                  {displayChecklist.map((item, index) => (
                    <li key={item} className="text-[11px] text-foreground/90 leading-relaxed">
                      <span className="mr-1 text-primary/90 font-semibold">{index + 1}.</span>
                      {item}
                    </li>
                  ))}
                </ol>
              </div>
              <p className="mt-2 text-[11px] text-primary/90 leading-relaxed">
                {displaySuccessHint}
              </p>
            </div>
            <button
              className={cn(
                "text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md",
                "hover:bg-muted/50"
              )}
              onClick={handleDismiss}
            >
              Hide
            </button>
          </div>
          <div className="mt-3">
            <Button size="sm" className="w-full" onClick={handlePrimaryAction}>
              {displayActionLabel}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
