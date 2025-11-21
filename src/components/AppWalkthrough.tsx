import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Joyride, { Step, CallBackProps, STATUS, TooltipRenderProps } from "react-joyride";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { haptics } from "@/utils/haptics";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import confetti from "canvas-confetti";

const WALKTHROUGH_STEPS: (Step & { id?: string })[] = [
  { id: "home-checkin", target: '[data-tour="checkin-mood"]', content: "👋 Welcome! Let's start with your morning check-in. Select how you're feeling right now.", placement: 'bottom', disableBeacon: true, spotlightClicks: true, hideFooter: true },
  { id: "checkin-intention", target: '[data-tour="checkin-intention"]', content: "💭 Now, what's your main focus for today? Enter your intention here.", placement: "top", disableBeacon: true, spotlightClicks: true, hideFooter: true },
  { id: "xp-celebration", target: 'body', content: "🎉 Nice! You just earned +5 XP! Now let's meet your companion! Tap the Companion tab at the bottom.", placement: "center", disableBeacon: true, hideFooter: true },
  { id: "companion-intro", target: '[data-tour="companion-tooltip-anchor"]', content: "✨ This is your companion! They'll grow and evolve as you earn XP by completing quests and building habits. Now tap the Quests tab to create your first quest.", placement: "top", disableBeacon: true, spotlightClicks: true, floaterProps: { hideArrow: true }, hideFooter: true },
  { id: "tasks-create-quest", target: '[data-tour="today-quests-header"]', content: "✍️ Perfect! Now create a quest: Type 'Start my Journey', select Medium difficulty (10 XP), then tap Add Quest. This becomes your MAIN QUEST earning 2x XP (20 total!) - the one thing that moves your day forward!", placement: 'top', disableBeacon: true, spotlightClicks: false, floaterProps: { disableAnimation: true, hideArrow: false, offset: 20 }, styles: { options: { zIndex: 100000 }, tooltip: { minWidth: '300px', maxWidth: '85vw', padding: '1.5rem', borderRadius: '1.25rem', border: '3px solid hsl(var(--primary))', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)', marginTop: '-120px', pointerEvents: 'none' }, tooltipContent: { fontSize: '1rem', lineHeight: '1.6', padding: '0.5rem 0', textAlign: 'left', pointerEvents: 'none' } }, hideFooter: true },
  { id: "final-congrats", target: 'body', content: "🎉 Congratulations! You've mastered the basics! Your first quest is now your MAIN QUEST (2x XP = 20 XP total!). You can add 2 more Side Quests if needed. Complete your Main Quest by tapping the checkbox to evolve your companion! 🚀", placement: "center", disableBeacon: true, locale: { last: 'Begin Adventure' } },
];

const STEP_INDEX = {
  HOME_CHECKIN: 0,
  CHECKIN_INTENTION: 1,
  XP_CELEBRATION: 2,
  COMPANION_VIEW: 3,
  QUEST_CREATION: 4,
  FINAL_CONGRATULATIONS: 5,
} as const;

export const AppWalkthrough = () => {
  const { user, session } = useAuth();
  const isMobile = useIsMobile();

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [waitingForAction, setWaitingForAction] = useState(false);
  const [isWalkthroughReady, setIsWalkthroughReady] = useState(false);

  // Track and clear timeouts & intervals so scheduled actions don't fire after unmount or pause
  const activeTimeouts = useRef<Set<number>>(new Set());
  const activeIntervals = useRef<Set<number>>(new Set());

  const createTrackedTimeout = useCallback((cb: () => void, delay: number) => {
    if (typeof window === 'undefined') return -1;
    const id = window.setTimeout(() => {
      activeTimeouts.current.delete(id);
      try { cb(); } catch (e) { console.warn('tracked timeout callback error', e); }
    }, delay) as unknown as number;
    activeTimeouts.current.add(id);
    return id;
  }, []);

  const createTrackedInterval = useCallback((cb: () => void, delay: number) => {
    if (typeof window === 'undefined') return -1;
    const id = window.setInterval(() => { try { cb(); } catch (e) { console.warn('tracked interval callback error', e); } }, delay) as unknown as number;
    activeIntervals.current.add(id);
    return id;
  }, []);

  const clearAllTimers = useCallback(() => {
    activeTimeouts.current.forEach((id) => clearTimeout(id));
    activeTimeouts.current.clear();
    activeIntervals.current.forEach((id) => clearInterval(id));
    activeIntervals.current.clear();
  }, []);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  // waitForSelector using MutationObserver for efficiency
  const waitForSelector = useCallback((selector: string, timeout = 5000) => {
    if (typeof window === 'undefined') return Promise.resolve(false);
    if (!selector || selector === 'body') return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      if (document.querySelector(selector)) return resolve(true);
      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve(true);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      const t = window.setTimeout(() => {
        observer.disconnect();
        resolve(false);
      }, timeout);
      activeTimeouts.current.add(t as unknown as number);
    });
  }, []);

  const steps = useMemo(() => {
    const base = [...WALKTHROUGH_STEPS];
    if (isMobile) {
      const taskIdx = base.findIndex((s) => (s as any).target === '[data-tour="today-quests-header"]');
      if (taskIdx !== -1) {
        base[taskIdx] = { ...base[taskIdx], target: '[data-tour="today-quests-header"]', placement: 'top' } as Step & { id?: string };
      }
      const companionIdx = base.findIndex((s) => (s as any).target === '[data-tour="companion-tooltip-anchor"]');
      if (companionIdx !== -1) base[companionIdx] = { ...base[companionIdx], target: '[data-tour="companion-tooltip-anchor"]', placement: 'top' } as Step & { id?: string };
    }
    return base;
  }, [isMobile]);

  // safeSetStep will fallback to body if anchor not found
  const safeSetStep = useCallback(async (idx: number) => {
    const step = steps[idx] as Step | undefined;
    if (!step) {
      console.warn(`Tutorial step ${idx} does not exist. Steps length=${steps.length}`);
      return;
    }

    // Scroll to top when advancing to a new step
    window.scrollTo(0, 0);

    window.dispatchEvent(new CustomEvent('tutorial-step-change', { detail: { step: idx } }));

    const target = step.target as string | undefined;
    if (target && target !== 'body') {
      const found = await waitForSelector(target, 6000);
      if (!found) {
        console.warn(`Tutorial anchor not found for selector "${target}". Skipping to next step.`);
        return;
      }
    }

    setStepIndex(idx);
  }, [steps, waitForSelector]);

  // Ensure walkthrough is ready before page components load
  useEffect(() => {
    if (!user || !session) {
      console.log('[AppWalkthrough] No user/session yet');
      return;
    }

    const checkWalkthroughStatus = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_data')
        .eq('id', user.id)
        .maybeSingle();

      const walkthroughData = profile?.onboarding_data as { walkthrough_completed?: boolean } | null;
      const isWalkthroughCompleted = walkthroughData?.walkthrough_completed === true;

      // Signal that walkthrough initialization is complete (either ready to run or already done)
      setIsWalkthroughReady(true);
      
      // Dispatch ready event for other components to listen to
      window.dispatchEvent(new CustomEvent('walkthrough-ready', { 
        detail: { shouldRun: !isWalkthroughCompleted } 
      }));
    };

    checkWalkthroughStatus();
  }, [user, session]);

  // Listen for onboarding completion event to start walkthrough
  useEffect(() => {
    if (!user || !session || !isWalkthroughReady) return;

    const handleOnboardingComplete = async () => {
      console.log('[AppWalkthrough] Onboarding complete event received');
      
      // Check if walkthrough is already completed
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_data')
        .eq('id', user.id)
        .maybeSingle();

      const walkthroughData = profile?.onboarding_data as { walkthrough_completed?: boolean } | null;
      const isWalkthroughCompleted = walkthroughData?.walkthrough_completed === true;

      if (!isWalkthroughCompleted) {
        console.log('[AppWalkthrough] Starting walkthrough after onboarding');
        // Wait for navigation and DOM to settle with longer timeout for safety
        await new Promise(resolve => setTimeout(resolve, 1200));
        const found = await waitForSelector('[data-tour="checkin-mood"]', 5000);
        if (found) {
          console.log('[AppWalkthrough] All components ready, starting tour');
          setRun(true);
        } else {
          console.warn('[AppWalkthrough] Failed to find initial tour element after timeout');
        }
      }
    };

    window.addEventListener('onboarding-complete', handleOnboardingComplete);
    return () => window.removeEventListener('onboarding-complete', handleOnboardingComplete);
  }, [user, session, isWalkthroughReady, waitForSelector]);

  // Step 0: Listen for mood selection
  useEffect(() => {
    if (stepIndex !== STEP_INDEX.HOME_CHECKIN || !run) return;

    const moodButtons = document.querySelectorAll('[data-tour="checkin-mood"] button');
    const handleMoodClick = () => {
      console.log('[Tutorial] Mood selected, advancing to intention step');
      safeSetStep(STEP_INDEX.CHECKIN_INTENTION);
    };

    moodButtons.forEach(btn => btn.addEventListener('click', handleMoodClick));
    return () => moodButtons.forEach(btn => btn.removeEventListener('click', handleMoodClick));
  }, [stepIndex, run, safeSetStep]);

  // Step 1: Listen for intention submission
  useEffect(() => {
    if (stepIndex !== STEP_INDEX.CHECKIN_INTENTION || !run) return;

    const handleCheckInComplete = () => {
      console.log('[Tutorial] Check-in completed, advancing to XP celebration step');
      createTrackedTimeout(async () => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        await safeSetStep(STEP_INDEX.XP_CELEBRATION);
      }, 1500);
    };

    window.addEventListener('checkin-complete', handleCheckInComplete);
    return () => window.removeEventListener('checkin-complete', handleCheckInComplete);
  }, [stepIndex, run, safeSetStep, createTrackedTimeout]);

  // Step 2: Listen for companion tab click
  useEffect(() => {
    if (stepIndex !== STEP_INDEX.XP_CELEBRATION || !run) return;

    const navCompanion = document.querySelector('a[href="/companion"]');
    const handleNavClick = () => {
      createTrackedTimeout(async () => {
        await safeSetStep(STEP_INDEX.COMPANION_VIEW);
      }, 1500);
    };

    if (navCompanion) {
      navCompanion.addEventListener('click', handleNavClick);
      return () => navCompanion.removeEventListener('click', handleNavClick);
    }
  }, [stepIndex, run, safeSetStep, createTrackedTimeout]);

  // Step 3: Listen for tasks/quests tab click
  useEffect(() => {
    if (stepIndex !== STEP_INDEX.COMPANION_VIEW || !run) return;

    const navTasks = document.querySelector('a[href="/tasks"]');
    const handleNavClick = () => {
      createTrackedTimeout(async () => {
        await safeSetStep(STEP_INDEX.QUEST_CREATION);
      }, 1500);
    };

    if (navTasks) {
      navTasks.addEventListener('click', handleNavClick);
      return () => navTasks.removeEventListener('click', handleNavClick);
    }
  }, [stepIndex, run, safeSetStep, createTrackedTimeout]);

  // Step 4: Listen for quest creation
  useEffect(() => {
    if (stepIndex !== STEP_INDEX.QUEST_CREATION || !run) return;

    const handleTaskCreated = () => {
      console.log('[Tutorial] Quest created! Advancing to final step.');
      safeSetStep(STEP_INDEX.FINAL_CONGRATULATIONS);
    };

    window.addEventListener('task-created', handleTaskCreated);
    return () => window.removeEventListener('task-created', handleTaskCreated);
  }, [stepIndex, run, safeSetStep]);

  const handleJoyrideCallback = useCallback(async (data: CallBackProps) => {
    const { status } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      console.log('[Tutorial] Tutorial completed or skipped');
      setRun(false);
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_data')
          .eq('id', user.id)
          .maybeSingle();

        const existingData = (profile?.onboarding_data as any) || {};

        await supabase
          .from('profiles')
          .update({
            onboarding_data: {
              ...existingData,
              walkthrough_completed: true
            }
          })
          .eq('id', user.id);
        console.log('[Tutorial] Saved walkthrough_completed to database');
      }
    }
  }, [user]);

  const interactiveStepIndices: number[] = [
    STEP_INDEX.XP_CELEBRATION,
    STEP_INDEX.COMPANION_VIEW,
    STEP_INDEX.QUEST_CREATION,
    STEP_INDEX.FINAL_CONGRATULATIONS
  ];

  if (!user) return null;

  console.log('[Tutorial] Rendering Joyride with:', { run, stepIndex, stepsCount: steps.length });

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      callback={handleJoyrideCallback}
      continuous={false}
      showProgress={false}
      showSkipButton={false}
      hideCloseButton={true}
      disableOverlay={interactiveStepIndices.includes(stepIndex)}
      spotlightPadding={8}
      disableCloseOnEsc
      disableScrolling={false}
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: 'hsl(var(--primary))',
          textColor: 'hsl(var(--foreground))',
          backgroundColor: 'hsl(var(--background))',
          arrowColor: 'hsl(var(--background))',
        },
        tooltip: {
          borderRadius: '1rem',
          padding: '1.5rem',
        },
        buttonNext: {
          backgroundColor: 'hsl(var(--primary))',
          borderRadius: '0.5rem',
          padding: '0.5rem 1rem',
        },
      }}
      floaterProps={{
        disableAnimation: false,
        hideArrow: false,
      }}
      locale={{
        last: 'Begin Adventure',
      }}
    />
  );
};
