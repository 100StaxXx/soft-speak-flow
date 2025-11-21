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
  { id: "mentor-intro", target: 'body', content: "👋 Welcome! This is your AI mentor - they'll guide and motivate you throughout your journey. Let's explore what they can do! Tap 'Next' to continue.", placement: 'center', disableBeacon: true },
  { id: "navigate-to-companion", target: 'body', content: "✨ Now let's meet your companion! They'll grow and evolve as you complete quests. Tap the Companion icon at the bottom to continue.", placement: "center", disableBeacon: true },
  { id: "companion-intro", target: '[data-tour="companion-display"]', content: "🐾 This is your companion! They evolve through multiple stages as you earn XP from completing habits and quests. Watch them grow stronger with you!", placement: "bottom", disableBeacon: true },
  { id: "navigate-to-quests", target: 'body', content: "📋 Ready to start earning XP? Let's create your first quest! Tap the Quests icon at the bottom.", placement: "center", disableBeacon: true },
  { id: "create-quest", target: '[data-tour="today-quests-header"]', content: "✍️ Create your first quest! Type 'Start my Journey', select Medium difficulty (10 XP), then tap Add Quest. This becomes your MAIN QUEST with 2x XP!", placement: 'top', disableBeacon: true, spotlightClicks: true },
  { id: "final-congrats", target: 'body', content: "🎉 Congratulations! You've mastered the basics! Complete your Main Quest to earn XP and evolve your companion. Your adventure begins now! 🚀", placement: "center", disableBeacon: true, locale: { last: 'Begin Adventure' } },
];

const STEP_INDEX = {
  MENTOR_INTRO: 0,
  NAVIGATE_TO_COMPANION: 1,
  COMPANION_INTRO: 2,
  NAVIGATE_TO_QUESTS: 3,
  CREATE_QUEST: 4,
  FINAL_CONGRATS: 5,
} as const;

export const AppWalkthrough = () => {
  const { user, session } = useAuth();
  const isMobile = useIsMobile();

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [waitingForAction, setWaitingForAction] = useState(false);

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

  // Initialize tutorial state from DB
  useEffect(() => {
    if (!user || !session) {
      console.log('[AppWalkthrough] No user/session yet');
      return;
    }

    const checkAndStartTutorial = async () => {
      try {
        console.log('[AppWalkthrough] Fetching profile for user:', user.id);

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_data, onboarding_completed')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('[AppWalkthrough] Profile fetch error:', error);
          return;
        }

        if (!profile) {
          console.error('[AppWalkthrough] No profile found');
          return;
        }

        console.log('[AppWalkthrough] Raw profile data:', profile);

        // Check if walkthrough is completed
        const walkthroughData = profile.onboarding_data as { walkthrough_completed?: boolean } | null;
        const isWalkthroughCompleted = walkthroughData?.walkthrough_completed === true;

        console.log('[AppWalkthrough] Status check:', {
          onboarding_completed: profile.onboarding_completed,
          walkthrough_completed: isWalkthroughCompleted,
          full_onboarding_data: walkthroughData
        });

        // Only run if onboarding is complete AND walkthrough is NOT complete
        if (profile.onboarding_completed === true && !isWalkthroughCompleted) {
          console.log('[AppWalkthrough] ✅ Starting walkthrough!');
          setTimeout(() => {
            setRun(true);
          }, 800);
        } else {
          console.log('[AppWalkthrough] ❌ Not starting:', {
            reason: !profile.onboarding_completed ? 'onboarding not complete' : 'walkthrough already done'
          });
        }
      } catch (error) {
        console.error('[AppWalkthrough] Error:', error);
      }
    };

    checkAndStartTutorial();
  }, [user, session]);

  // Listen for quest creation to advance from step 4 -> 5
  useEffect(() => {
    if (stepIndex !== STEP_INDEX.QUEST_CREATION || !waitingForAction) return;

    const handleTaskCreated = () => {
      console.log('[Tutorial] Quest created! Advancing to final step.');
      setWaitingForAction(false);
      safeSetStep(STEP_INDEX.FINAL_CONGRATULATIONS);
    };

    window.addEventListener('task-created', handleTaskCreated);
    return () => window.removeEventListener('task-created', handleTaskCreated);
  }, [stepIndex, waitingForAction, safeSetStep]);

  const handleJoyrideCallback = useCallback(async (data: CallBackProps) => {
    const { status, action, index, type, lifecycle } = data;

    console.log('[Tutorial] Joyride callback:', { status, action, index, type, lifecycle });

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      console.log('[Tutorial] Tutorial completed or skipped');
      setRun(false);
      if (user) {
        // Fetch existing onboarding_data to preserve userName and other fields
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
      return;
    }

    // Step 0 -> 1: Check-in selected
    if (index === STEP_INDEX.HOME_CHECKIN && type === 'step:after') {
      const intentionField = document.querySelector('[data-tour="checkin-intention"]');
      if (intentionField) {
        await safeSetStep(STEP_INDEX.CHECKIN_INTENTION);
      }
    }

    // Step 1 -> 2: Intention submitted, show XP celebration
    if (index === STEP_INDEX.CHECKIN_INTENTION && type === 'step:after') {
      const checkForSubmit = () => {
        const intentionField = document.querySelector('[data-tour="checkin-intention"]') as HTMLTextAreaElement | null;
        if (intentionField && intentionField.value.trim().length > 0) {
          const submitButton = intentionField.closest('form')?.querySelector('button[type="submit"]');
          if (submitButton && !(submitButton as HTMLButtonElement).disabled) {
            const observer = new MutationObserver(() => {
              if ((submitButton as HTMLButtonElement).disabled) {
                observer.disconnect();
                createTrackedTimeout(async () => {
                  confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 }
                  });
                  await safeSetStep(STEP_INDEX.XP_CELEBRATION);
                }, 1500);
              }
            });
            observer.observe(submitButton, { attributes: true });
          }
        }
      };

      const timeoutId = createTrackedTimeout(() => {
        checkForSubmit();
        const checkInterval = setInterval(() => {
          checkForSubmit();
        }, 500);
        createTrackedTimeout(() => clearInterval(checkInterval), 10000);
      }, 1000);
    }

    // Step 2 -> 3: Navigate to companion page
    if (index === STEP_INDEX.XP_CELEBRATION && action === 'next') {
      const navCompanion = document.querySelector('a[href="/companion"]');
      if (navCompanion) {
        setWaitingForAction(true);
        const handleNavClick = () => {
          createTrackedTimeout(async () => {
            await safeSetStep(STEP_INDEX.COMPANION_VIEW);
            setWaitingForAction(false);
          }, 1500);
          navCompanion.removeEventListener('click', handleNavClick);
        };
        navCompanion.addEventListener('click', handleNavClick);
      }
    }

    // Step 3 -> 4: Navigate to tasks page
    if (index === STEP_INDEX.COMPANION_VIEW && action === 'next') {
      const navTasks = document.querySelector('a[href="/tasks"]');
      if (navTasks) {
        setWaitingForAction(true);
        const handleNavClick = () => {
          createTrackedTimeout(async () => {
            await safeSetStep(STEP_INDEX.QUEST_CREATION);
            setWaitingForAction(false);
          }, 1500);
          navTasks.removeEventListener('click', handleNavClick);
        };
        navTasks.addEventListener('click', handleNavClick);
      }
    }

    // Step 4: Wait for quest creation (handled by event listener above)
    if (index === STEP_INDEX.QUEST_CREATION && type === 'step:after') {
      setWaitingForAction(true);
    }

  }, [user, safeSetStep, createTrackedTimeout]);

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
      continuous
      showProgress
      showSkipButton
      disableOverlay={interactiveStepIndices.includes(stepIndex)}
      spotlightPadding={8}
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
        buttonBack: {
          color: 'hsl(var(--muted-foreground))',
        },
        buttonSkip: {
          color: 'hsl(var(--muted-foreground))',
        },
      }}
      floaterProps={{
        disableAnimation: false,
        hideArrow: false,
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip',
      }}
    />
  );
};
