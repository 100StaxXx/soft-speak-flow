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
  { id: "companion-intro", target: '[data-tour="companion-tooltip-anchor"]', content: "✨ This is your companion! They'll grow and evolve as you earn XP by completing quests and building habits. Now tap the Quests tab to create your first quest.", placement: "bottom", disableBeacon: true, spotlightClicks: true, floaterProps: { hideArrow: true }, hideFooter: true },
  { id: "tasks-create-quest", target: '[data-tour="today-quests-header"]', content: "✍️ Perfect! Now create a quest: Type 'Start my Journey', select Medium difficulty (10 XP), then tap Add Quest. Once added, CHECK IT OFF to complete it and earn your XP! This triggers your companion's first evolution!", placement: 'top', disableBeacon: true, spotlightClicks: false, floaterProps: { disableAnimation: true, hideArrow: false, offset: 20 }, styles: { options: { zIndex: 100000 }, tooltip: { minWidth: '300px', maxWidth: '85vw', padding: '1.5rem', borderRadius: '1.25rem', border: '3px solid hsl(var(--primary))', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)', marginTop: '-120px', pointerEvents: 'none' }, tooltipContent: { fontSize: '1rem', lineHeight: '1.6', padding: '0.5rem 0', textAlign: 'left', pointerEvents: 'none' } }, hideFooter: true },
];

const STEP_INDEX = {
  HOME_CHECKIN: 0,
  CHECKIN_INTENTION: 1,
  XP_CELEBRATION: 2,
  COMPANION_VIEW: 3,
  QUEST_CREATION: 4,
} as const;

const DELAYS = {
  POST_CHECKIN_CONFETTI: 1500,
  POST_NAV: 1000, // Reduced from separate 1500ms delays
  POST_EVOLUTION: 300,
  SCROLL_DELAY: 50,
} as const;

const TIMEOUTS = {
  EVOLUTION_COMPLETE: 15000, // 15 seconds fallback if evolution doesn't complete
  ELEMENT_WAIT: 6000, // Max time to wait for DOM elements
} as const;

export const AppWalkthrough = () => {
  const { user, session } = useAuth();
  const isMobile = useIsMobile();

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [isWalkthroughCompleted, setIsWalkthroughCompleted] = useState<boolean | null>(null);
  const [showCompletionButton, setShowCompletionButton] = useState(false);

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

  const clearAllTimers = useCallback(() => {
    activeTimeouts.current.forEach((id) => clearTimeout(id));
    activeTimeouts.current.clear();
    activeIntervals.current.forEach((id) => clearInterval(id));
    activeIntervals.current.clear();
  }, []);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  // waitForSelector using MutationObserver for efficiency
  const waitForSelector = useCallback((selector: string, timeout = TIMEOUTS.ELEMENT_WAIT) => {
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
      if (companionIdx !== -1) base[companionIdx] = { ...base[companionIdx], target: '[data-tour="companion-tooltip-anchor"]', placement: 'bottom' } as Step & { id?: string };
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

    window.dispatchEvent(new CustomEvent('tutorial-step-change', { detail: { step: idx } }));

    const target = step.target as string | undefined;
    if (target && target !== 'body') {
      const found = await waitForSelector(target, TIMEOUTS.ELEMENT_WAIT);
      if (!found) {
        console.warn(`Tutorial anchor not found for selector "${target}". Skipping to next step.`);
        return;
      }
    }

    // Scroll to top when advancing to a new step
    await new Promise(resolve => setTimeout(resolve, DELAYS.SCROLL_DELAY));
    window.scrollTo({ top: 0, behavior: 'instant' });

    setStepIndex(idx);
  }, [steps, waitForSelector]);

  // Check walkthrough status once on mount and set state
  useEffect(() => {
    if (!user || !session) return;

    const checkStatus = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_data')
        .eq('id', user.id)
        .maybeSingle();

      const walkthroughData = profile?.onboarding_data as { walkthrough_completed?: boolean } | null;
      const completed = walkthroughData?.walkthrough_completed === true;
      
      setIsWalkthroughCompleted(completed);
      
      // Dispatch ready event for other components
      window.dispatchEvent(new CustomEvent('walkthrough-ready', { 
        detail: { shouldRun: !completed } 
      }));
    };

    checkStatus();
  }, [user, session]);

  // Listen for onboarding completion event to start walkthrough
  useEffect(() => {
    if (!user || !session || isWalkthroughCompleted === null) return;
    if (isWalkthroughCompleted) return; // Already completed

    const handleOnboardingComplete = async () => {
      console.log('[AppWalkthrough] Onboarding complete, starting walkthrough');
      
      // Reset to step 0
      setStepIndex(0);
      
      // Wait for DOM element to be ready (no arbitrary delays)
      const found = await waitForSelector('[data-tour="checkin-mood"]', TIMEOUTS.ELEMENT_WAIT);
      if (found) {
        console.log('[AppWalkthrough] DOM ready, starting tour');
        window.scrollTo({ top: 0, behavior: 'instant' });
        setRun(true);
      } else {
        console.warn('[AppWalkthrough] Failed to find initial tour element');
      }
    };

    window.addEventListener('onboarding-complete', handleOnboardingComplete);
    return () => window.removeEventListener('onboarding-complete', handleOnboardingComplete);
  }, [user, session, isWalkthroughCompleted, waitForSelector]);

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
      }, DELAYS.POST_CHECKIN_CONFETTI);
    };

    window.addEventListener('checkin-complete', handleCheckInComplete);
    return () => window.removeEventListener('checkin-complete', handleCheckInComplete);
  }, [stepIndex, run, safeSetStep, createTrackedTimeout]);

  // Step 2: Listen for companion tab click
  useEffect(() => {
    if (stepIndex !== STEP_INDEX.XP_CELEBRATION || !run) return;

    const handleNavClick = () => {
      createTrackedTimeout(async () => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        await safeSetStep(STEP_INDEX.COMPANION_VIEW);
      }, DELAYS.POST_NAV);
    };

    const navCompanion = document.querySelector('a[href="/companion"]');
    if (navCompanion) {
      navCompanion.addEventListener('click', handleNavClick);
    }
    
    return () => {
      if (navCompanion) {
        navCompanion.removeEventListener('click', handleNavClick);
      }
    };
  }, [stepIndex, run, safeSetStep, createTrackedTimeout]);

  // Step 3: Listen for tasks/quests tab click
  useEffect(() => {
    if (stepIndex !== STEP_INDEX.COMPANION_VIEW || !run) return;

    const handleNavClick = () => {
      createTrackedTimeout(async () => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        await safeSetStep(STEP_INDEX.QUEST_CREATION);
      }, DELAYS.POST_NAV);
    };

    const navTasks = document.querySelector('a[href="/tasks"]');
    if (navTasks) {
      navTasks.addEventListener('click', handleNavClick);
    }
    
    return () => {
      if (navTasks) {
        navTasks.removeEventListener('click', handleNavClick);
      }
    };
  }, [stepIndex, run, safeSetStep, createTrackedTimeout]);

  // Step 4: Listen for quest completion (checkbox click)
  useEffect(() => {
    if (stepIndex !== STEP_INDEX.QUEST_CREATION || !run) return;

    // Declare timeout ref outside handlers so cleanup can access it
    const timeoutRef = { current: null as number | null };

    const handleEvolutionLoadingStart = () => {
      console.log('[Tutorial] Evolution loading started, hiding quest tooltip immediately.');
      setRun(false);
      
      // Set a fallback timeout in case evolution-modal-closed never fires
      timeoutRef.current = createTrackedTimeout(() => {
        console.warn('[Tutorial] Evolution timeout reached, showing completion button');
        setShowCompletionButton(true);
      }, TIMEOUTS.EVOLUTION_COMPLETE);
    };

    const handleEvolutionModalClosed = () => {
      console.log('[Tutorial] Evolution modal closed event received! Current state:', { 
        stepIndex, 
        run,
        showCompletionButton 
      });
      
      // Clear the fallback timeout
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // Show the manual completion button instead of auto-advancing
      setRun(false);
      setShowCompletionButton(true);
      console.log('[Tutorial] Set showCompletionButton to true');
    };

    window.addEventListener('evolution-loading-start', handleEvolutionLoadingStart);
    window.addEventListener('evolution-modal-closed', handleEvolutionModalClosed);
    
    return () => {
      // Clean up timeout if component unmounts or step changes
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      window.removeEventListener('evolution-loading-start', handleEvolutionLoadingStart);
      window.removeEventListener('evolution-modal-closed', handleEvolutionModalClosed);
    };
  }, [stepIndex, run, safeSetStep, createTrackedTimeout]);

  const handleWalkthroughComplete = useCallback(async () => {
    console.log('[Tutorial] Tutorial completed');
    setRun(false);
    setShowCompletionButton(false); // Reset button state
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
    // Reload the page to start fresh
    window.location.reload();
  }, [user]);

  const handleJoyrideCallback = useCallback(async (data: CallBackProps) => {
    const { status } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      await handleWalkthroughComplete();
    }
  }, [handleWalkthroughComplete]);

  const CustomTooltip = useCallback(({ continuous, index, step, backProps, closeProps, primaryProps, tooltipProps }: TooltipRenderProps) => {
    // Default tooltip for all steps (no special final step since we use manual button)
    return (
      <Card {...tooltipProps} className="max-w-md p-6">
        <p className="text-base">{step.content as string}</p>
      </Card>
    );
  }, []);

  const interactiveStepIndices: number[] = [
    STEP_INDEX.XP_CELEBRATION,
    STEP_INDEX.COMPANION_VIEW,
    STEP_INDEX.QUEST_CREATION,
  ];

  if (!user) return null;

  console.log('[Tutorial] Rendering Joyride with:', { run, stepIndex, stepsCount: steps.length });

  return (
    <>
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
        tooltipComponent={CustomTooltip}
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
          last: 'Close',
        }}
      />
      
      {showCompletionButton && (
        <div className="fixed bottom-24 right-6 z-[10001] animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col items-end gap-3">
            <div className="bg-gradient-to-r from-primary/20 to-accent/20 backdrop-blur-sm border-2 border-primary/50 rounded-2xl p-6 max-w-sm shadow-2xl">
              <p className="text-white text-lg font-medium leading-relaxed mb-1">
                🎉 Congratulations!
              </p>
              <p className="text-white/90 text-base leading-relaxed">
                Your companion has evolved to Stage 1! You've learned the basics—now your real journey begins. Complete quests, build habits, and watch your companion grow stronger alongside you.
              </p>
            </div>
            <Button
              onClick={async () => {
                setShowCompletionButton(false);
                await handleWalkthroughComplete();
              }}
              size="lg"
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-bold text-lg px-8 py-6 rounded-2xl shadow-2xl hover:shadow-primary/50 transition-all duration-300 animate-pulse"
            >
              <span className="mr-2">✨</span>
              Start Your Journey
              <span className="ml-2">🚀</span>
            </Button>
          </div>
        </div>
      )}
    </>
  );
};
