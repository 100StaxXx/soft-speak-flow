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
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useXPRewards } from "@/hooks/useXPRewards";
import { safeLocalStorage } from "@/utils/storage";
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

interface GuidedStep {
  id: GuidedTutorialStepId;
  route: string;
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

const GUIDED_STEPS: GuidedStep[] = [
  {
    id: "create_quest",
    route: "/journeys",
    completion: { type: "event", eventName: "task-added", requireRoute: true },
  },
  {
    id: "meet_companion",
    route: "/companion",
    completion: { type: "route_visit" },
  },
  {
    id: "morning_checkin",
    route: "/mentor",
    completion: { type: "event", eventName: "morning-checkin-completed", requireRoute: true },
  },
];

export const CREATE_QUEST_SUBSTEP_ORDER: CreateQuestSubstepId[] = [
  "stay_on_quests",
  "open_add_quest",
  "select_time",
  "submit_create_quest",
];

const GUIDED_STEP_ID_SET = new Set<GuidedTutorialStepId>(GUIDED_STEPS.map((step) => step.id));
const CREATE_QUEST_SUBSTEP_SET = new Set<CreateQuestSubstepId>(CREATE_QUEST_SUBSTEP_ORDER);

const isGuidedStepId = (value: unknown): value is GuidedTutorialStepId =>
  typeof value === "string" && GUIDED_STEP_ID_SET.has(value as GuidedTutorialStepId);

const isCreateQuestSubstepId = (value: unknown): value is CreateQuestSubstepId =>
  typeof value === "string" && CREATE_QUEST_SUBSTEP_SET.has(value as CreateQuestSubstepId);

const isProgressRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export interface CreateQuestProgressState {
  current: CreateQuestSubstepId;
  completed: CreateQuestSubstepId[];
  startedAt?: string;
  completedAt?: string;
}

type GuidedTutorialProgressSnapshot = Partial<GuidedTutorialProgress>;

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

export interface PostOnboardingMentorGuidanceState {
  isActive: boolean;
  currentStep: GuidedTutorialStepId | null;
  currentSubstep: CreateQuestSubstepId | null;
  stepRoute: string | null;
  mentorInstructionLines: string[];
  progressText: string;
}

const DEFAULT_GUIDANCE_STATE: PostOnboardingMentorGuidanceState = {
  isActive: false,
  currentStep: null,
  currentSubstep: null,
  stepRoute: null,
  mentorInstructionLines: [],
  progressText: "",
};

const PostOnboardingMentorGuidanceContext = createContext<PostOnboardingMentorGuidanceState>(
  DEFAULT_GUIDANCE_STATE
);

export const getMentorInstructionLines = (
  currentStep: GuidedTutorialStepId | null,
  currentSubstep: CreateQuestSubstepId | null
): string[] => {
  if (currentStep === "create_quest") {
    if (currentSubstep === "stay_on_quests") {
      return [
        "Step 1: Stay on Quests.",
        "Once you are here, we will move to opening your first quest.",
      ];
    }

    if (currentSubstep === "open_add_quest") {
      return [
        "Step 1: Tap the + button to open Add Quest.",
        "Use the same button you would normally use. No extra tutorial controls needed.",
      ];
    }

    if (currentSubstep === "select_time") {
      return [
        "Step 1: Choose a time for your quest.",
        "Pick any valid time that fits your day.",
      ];
    }

    return [
      "Step 1: Enter a quest title, then tap Create Quest.",
      "As soon as it is created, we continue to your next step.",
    ];
  }

  if (currentStep === "meet_companion") {
    return [
      "Step 2: Open Companion and check your bond/progress area.",
      "Just entering Companion completes this step.",
    ];
  }

  if (currentStep === "morning_checkin") {
    return [
      "Step 3: Open Mentor and complete one Morning Check-in.",
      "Answer and submit once to finish your guided start.",
    ];
  }

  return [];
};

const usePostOnboardingMentorGuidanceController = (): PostOnboardingMentorGuidanceState => {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { awardCustomXP } = useXPRewards();
  const queryClient = useQueryClient();
  const location = useLocation();

  const completionPersistRef = useRef(false);
  const stepPersistThrottleRef = useRef<Set<GuidedTutorialStepId>>(new Set());
  const [sessionCompleted, setSessionCompleted] = useState<GuidedTutorialStepId[]>([]);
  const [sessionAwarded, setSessionAwarded] = useState<GuidedTutorialStepId[]>([]);
  const [sessionCreateQuestCompleted, setSessionCreateQuestCompleted] = useState<CreateQuestSubstepId[]>([]);

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

      void persistProgress({
        completedSteps: nextCompleted,
        xpAwardedSteps: Array.from(nextAwardedSet),
        completed: complete,
        completedAt: complete ? new Date().toISOString() : undefined,
      });
    },
    [awardCustomXP, awardedSet, completedSet, persistProgress, tutorialReady]
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
    if (!currentStep || !tutorialReady || tutorialComplete) return;

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
          if (completion.requireRoute && location.pathname !== currentStep.route) return;
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
    tutorialComplete,
    tutorialReady,
  ]);

  const isActive = tutorialReady && !tutorialComplete && !pathIsHidden(location.pathname) && Boolean(currentStep);
  const currentStepId = currentStep?.id ?? null;
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

  return {
    isActive,
    currentStep: currentStepId,
    currentSubstep,
    stepRoute: currentStep?.route ?? null,
    mentorInstructionLines: getMentorInstructionLines(currentStepId, currentSubstep),
    progressText,
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

