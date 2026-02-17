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
import type { GuidedTutorialProgress, GuidedTutorialStepId } from "@/types/profile";

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

const PANEL_GAP = 12;
const SAFE_HORIZONTAL = 12;
const SAFE_TOP = 12;
const SAFE_BOTTOM = 104;

const GUIDED_STEPS: GuidedStep[] = [
  {
    id: "create_quest",
    title: "Create your first quest",
    description: "Schedule one quest with a time so it appears in Quests.",
    checklist: [
      "Stay on the QUESTS tab.",
      "Tap + in the lower-right corner.",
      "Set a time, enter a title, then tap Create Quest.",
    ],
    successHint: "If time is missing, it becomes an Inbox item.",
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

const GUIDED_STEP_ID_SET = new Set<GuidedTutorialStepId>(GUIDED_STEPS.map((step) => step.id));

const isGuidedStepId = (value: unknown): value is GuidedTutorialStepId =>
  typeof value === "string" && GUIDED_STEP_ID_SET.has(value as GuidedTutorialStepId);

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
  left: clamp((viewportWidth - panelWidth) / 2, SAFE_HORIZONTAL, Math.max(SAFE_HORIZONTAL, viewportWidth - panelWidth - SAFE_HORIZONTAL)),
  lockEnabled: false,
});

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
      : (Object.entries(availableSpace)
          .sort((a, b) => b[1] - a[1])
          .map(([zone]) => zone as PanelZone));

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
      zone === "left" || zone === "right" ? availableSpace.top + availableSpace.bottom >= panelHeight : availableSpace[zone] >= panelHeight;
    const hasHorizontalRoom =
      zone === "top" || zone === "bottom" ? availableSpace.left + availableSpace.right >= panelWidth : availableSpace[zone] >= panelWidth;

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
    if (!currentStep) return;
    const completion = currentStep.completion;
    if (completion.type !== "event") return;

    const listener = (event: Event) => {
      if (completion.requireRoute && location.pathname !== currentStep.route) {
        return;
      }

      if (currentStep.id === "create_quest") {
        const detail = (
          event as CustomEvent<{ taskDate?: string | null; scheduledTime?: string | null }>
        ).detail;
        if (!detail?.taskDate || !detail?.scheduledTime) {
          return;
        }
      }

      markStepComplete(currentStep.id);
    };

    window.addEventListener(completion.eventName, listener as EventListener);
    return () => {
      window.removeEventListener(completion.eventName, listener as EventListener);
    };
  }, [currentStep, location.pathname, markStepComplete]);

  const activeSelector = useMemo(() => {
    if (!currentStep) return null;
    if (location.pathname === currentStep.route) return currentStep.inRouteSelector;
    return currentStep.navSelector;
  }, [currentStep, location.pathname]);

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
        const fallback = getDefaultPanelPlacement(window.innerWidth, Math.min(window.innerWidth - 24, 560));
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

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updatePlacement) : null;
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
    if (location.pathname !== currentStep.route) {
      navigate(currentStep.route);
      return;
    }

    const target = document.querySelector(currentStep.inRouteSelector) as HTMLElement | null;
    if (target) {
      target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    }
  }, [currentStep, location.pathname, navigate]);

  const handleDismiss = useCallback(() => {
    setDismissedOverride(true);
    void persistProgress({ dismissed: true });
  }, [persistProgress]);

  const handleResume = useCallback(() => {
    setDismissedOverride(false);
    void persistProgress({ dismissed: false });
  }, [persistProgress]);

  if (!tutorialReady || tutorialComplete || pathIsHidden(location.pathname) || !currentStep) {
    return null;
  }

  const currentIndex = GUIDED_STEPS.findIndex((step) => step.id === currentStep.id);
  const progressText = `Step ${currentIndex + 1} of ${GUIDED_STEPS.length}`;
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
              <h3 className="mt-1 text-sm font-semibold text-foreground">{currentStep.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {currentStep.description}
              </p>
              <div className="mt-2 rounded-lg border border-border/60 bg-background/35 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/80">
                  Do this now
                </p>
                <ol className="mt-1.5 space-y-1">
                  {currentStep.checklist.map((item, index) => (
                    <li key={item} className="text-[11px] text-foreground/90 leading-relaxed">
                      <span className="mr-1 text-primary/90 font-semibold">{index + 1}.</span>
                      {item}
                    </li>
                  ))}
                </ol>
              </div>
              <p className="mt-2 text-[11px] text-primary/90 leading-relaxed">
                {currentStep.successHint}
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
              {currentStep.actionLabel}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
