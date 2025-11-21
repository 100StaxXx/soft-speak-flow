import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Joyride, { CallBackProps, STATUS, Step, TooltipRenderProps } from "react-joyride";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { haptics } from "@/utils/haptics";
import confetti from "canvas-confetti";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Step index constants for clarity and maintainability
const STEP_INDEX = {
  CHECKIN_MOOD: 0,
  CHECKIN_INTENTION: 1,
  XP_CELEBRATION: 2,
  COMPANION_VIEW: 3,
  QUEST_CREATION: 4,
  FINAL_CONGRATULATIONS: 5,
} as const;

const WALKTHROUGH_STEPS: Step[] = [
  // Step 0: HOME PAGE - Check-in mood
  {
    target: '[data-tour="morning-checkin"]',
    content: "👋 Welcome! Let's start with your morning check-in. Select how you're feeling right now.",
    placement: "bottom",
    disableBeacon: true,
    spotlightClicks: true,
    styles: {
      tooltip: {
        marginTop: '-120px',
      }
    }
  },
  // Step 1: Check-in intention
  {
    target: '[data-tour="checkin-intention"]',
    content: "💭 Now, what's your main focus for today? Enter your intention here.",
    placement: "top",
    disableBeacon: true,
    spotlightClicks: true,
  },
  // Step 2: XP celebration and navigate to companion
  {
    target: 'body',
    content: "🎉 Nice! You just earned +5 XP! Now let's meet your companion! Tap the Companion tab at the bottom.",
    placement: "center",
    disableBeacon: true,
  },

  // Step 3: COMPANION PAGE - Show companion and navigate to tasks
  {
    target: '[data-tour="companion-tooltip-anchor"]',
    content: "✨ This is your companion! They'll grow and evolve as you earn XP by completing quests and building habits. Now let's create your first quest! Tap the Quests tab.",
    placement: "top",
    disableBeacon: true,
    spotlightClicks: true,
    floaterProps: {
      hideArrow: true,
    },
    styles: {
      tooltip: {
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '90vw',
        marginBottom: '120px',
        pointerEvents: 'none' as const,
      },
      tooltipContent: {
        pointerEvents: 'auto' as const,
      }
    }
  },

  // Step 4: TASKS PAGE - Create quest instructions
  {
    target: '[data-tour="today-quests-header"]',
    content: "✍️ Perfect! Now create a quest: Type 'Start my Journey', select Medium difficulty (10 XP), tap Add Quest, then tap 'Set as Main Quest' in the popup. This earns you 2x XP (20 total!) and triggers your companion's first evolution!",
    placement: 'top',
    disableBeacon: true,
    spotlightClicks: false,
    floaterProps: {
      disableAnimation: true,
      hideArrow: false,
      offset: 20,
      styles: {
        floater: {
          pointerEvents: 'none' as const,
        }
      }
    },
    styles: {
      options: {
        zIndex: 100000,
      },
      overlay: {
        mixBlendMode: 'normal' as const,
        pointerEvents: 'none' as const,
      },
      tooltip: {
        minWidth: '300px',
        maxWidth: '85vw',
        padding: '1.5rem',
        borderRadius: '1.25rem',
        border: '3px solid hsl(var(--primary))',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        marginTop: '-120px',
        pointerEvents: 'none',
        position: 'relative' as const,
      },
      tooltipContent: {
        fontSize: '1rem',
        lineHeight: '1.6',
        padding: '0.5rem 0',
        textAlign: 'left' as const,
        pointerEvents: 'none',
      }
    }
  },
  // Step 5: Final congratulations
  {
    target: 'body',
    content: "🎉 Congratulations! You've completed your first day! You earned 25 XP (5 from check-in + 20 from Main Quest) and your companion evolved to Stage 1 (Cracking Awakening)! Continue completing quests (max 3/day) and building habits (max 2 active) to help them grow. Your journey has begun! 🚀",
    placement: "center",
    disableBeacon: true,
    locale: { last: 'Begin Adventure' },
    styles: {
      tooltip: {
        pointerEvents: 'auto',
      },
    },
  },
];

export const AppWalkthrough = () => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [waitingForAction, setWaitingForAction] = useState(false);

  // Track active timeouts for proper cleanup
  const activeTimeouts = useRef<Set<NodeJS.Timeout>>(new Set());

  // Utility: Create tracked timeout that auto-cleans up
  const createTrackedTimeout = useCallback((callback: () => void, delay: number) => {
    const timeout = setTimeout(() => {
      activeTimeouts.current.delete(timeout);
      callback();
    }, delay);
    activeTimeouts.current.add(timeout);
    return timeout;
  }, []);

  // Cleanup all active timeouts
  const clearAllTimeouts = useCallback(() => {
    activeTimeouts.current.forEach(clearTimeout);
    activeTimeouts.current.clear();
  }, []);

  // Shared confetti celebration logic
  const triggerConfettiCelebration = useCallback(() => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10001 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  }, []);

  // Custom tooltip for final step
  const CustomFinalTooltip = useCallback(({ continuous, index, step, backProps, closeProps, primaryProps, tooltipProps }: TooltipRenderProps) => {
    if (index !== STEP_INDEX.FINAL_CONGRATULATIONS) return null;
    
    const handleFinish = () => {
      haptics.success();
      triggerConfettiCelebration();
      clearAllTimeouts();

      setRun(false);
      localStorage.setItem('hasSeenAppWalkthrough', 'true');
      localStorage.removeItem('onboardingComplete');
      localStorage.removeItem('appWalkthroughActive');

      // Clear tutorial step
      window.dispatchEvent(new CustomEvent('tutorial-step-change', {
        detail: { step: null }
      }));
    };

    return (
      <Card 
        {...tooltipProps}
        className="border-[3px] border-primary shadow-2xl"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 100000,
          maxWidth: '90vw',
          width: '400px',
          pointerEvents: 'auto',
          touchAction: 'auto',
        }}
      >
        <div className="p-6 text-center space-y-4">
          <div className="text-base leading-relaxed">
            {step.content}
          </div>
          <Button
            onClick={handleFinish}
            size="lg"
            className="w-full text-base font-bold"
            style={{
              pointerEvents: 'auto',
              touchAction: 'auto',
              cursor: 'pointer',
            }}
          >
            Begin Adventure
          </Button>
        </div>
      </Card>
    );
  }, [triggerConfettiCelebration, clearAllTimeouts]);


  const isMobile = useIsMobile();
  const steps = useMemo<Step[]>(() => {
    const base = [...WALKTHROUGH_STEPS];
    if (isMobile) {
      // Find and adjust quest creation step (target: today-quests-header)
      const questStepIdx = base.findIndex(s => s.target === '[data-tour="today-quests-header"]');
      if (questStepIdx !== -1) {
        const questStep = base[questStepIdx] as Step & { floaterProps?: Record<string, unknown>; styles?: Record<string, unknown> };
        base[questStepIdx] = {
          ...questStep,
          target: '[data-tour="today-quests-header"]',
          placement: 'top',
          floaterProps: {
            ...(questStep.floaterProps || {}),
            offset: 0,
          },
          styles: {
            ...(questStep.styles || {}),
            tooltip: {
              ...((questStep.styles as Record<string, Record<string, unknown>>)?.tooltip || {}),
              marginTop: undefined,
              marginBottom: '8px',
              pointerEvents: 'none',
            },
          },
        } as Step;
      }

      // Find and adjust companion page step (target: companion-tooltip-anchor)
      const companionStepIdx = base.findIndex(s => s.target === '[data-tour="companion-tooltip-anchor"]');
      if (companionStepIdx !== -1) {
        base[companionStepIdx] = {
          ...base[companionStepIdx],
          target: '[data-tour="companion-tooltip-anchor"]',
          placement: 'top',
        } as Step;
      }
    }
    return base;
  }, [isMobile]);

  // Utility: wait for a selector to exist before advancing
  // Returns true if element found, false if timeout
  const waitForSelector = useCallback((selector: string, timeout = 5000) => {
    return new Promise<boolean>((resolve) => {
      const start = Date.now();
      const check = () => {
        if (document.querySelector(selector)) return resolve(true);
        if (Date.now() - start > timeout) return resolve(false);
        requestAnimationFrame(check);
      };
      check();
    });
  }, []);

  // Utility: safely set step after ensuring target exists
  const safeSetStep = useCallback(async (idx: number) => {
    const step = steps[idx] as Step | undefined;

    if (!step) {
      console.warn(`Tutorial step ${idx} does not exist. Total steps: ${steps.length}`);
      return;
    }

    // Emit custom event for BottomNav FIRST so navigation becomes clickable immediately
    window.dispatchEvent(new CustomEvent('tutorial-step-change', {
      detail: { step: idx }
    }));

    const target = step.target as string | undefined;
    if (target && target !== 'body') {
      // Wait for element to exist
      const elementFound = await waitForSelector(target, 6000);

      // If element not found after timeout, log warning and fallback to body
      if (!elementFound) {
        console.warn(`Tutorial element not found after timeout: ${target} for step ${idx}. Falling back to body anchor.`);
        // Element will still be used as target, Joyride will handle missing elements gracefully
      }
    }

    setStepIndex(idx);
  }, [waitForSelector, steps]);

  useEffect(() => {
    const checkWalkthroughStatus = async () => {
      if (!user || !session) return;

      const hasSeenWalkthrough = localStorage.getItem('hasSeenAppWalkthrough');
      const onboardingComplete = localStorage.getItem('onboardingComplete');

      if (!hasSeenWalkthrough && onboardingComplete === 'true') {
        // Check if user just completed onboarding and has a companion
        const { data: companion } = await supabase
          .from('user_companion')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (companion && location.pathname === '/') {
          // Wait for initial step target to be present, then start
          await waitForSelector(((steps[0] as Step).target as string) || 'body', 8000);
          createTrackedTimeout(() => {
            localStorage.setItem('appWalkthroughActive', 'true');
            setRun(true);
            // Emit initial tutorial step
            window.dispatchEvent(new CustomEvent('tutorial-step-change', {
              detail: { step: 0 }
            }));
          }, 300);
        }
      }
    };

    checkWalkthroughStatus();
  }, [user, session, location.pathname, waitForSelector, steps, createTrackedTimeout]);


  // Listen for mood selection to advance from step 0 to step 1
  useEffect(() => {
    const handleMoodSelected = () => {
      if (run && stepIndex === STEP_INDEX.CHECKIN_MOOD) {
        haptics.light();
        createTrackedTimeout(() => safeSetStep(STEP_INDEX.CHECKIN_INTENTION), 300);
      }
    };

    window.addEventListener('mood-selected', handleMoodSelected);
    return () => window.removeEventListener('mood-selected', handleMoodSelected);
  }, [stepIndex, run, safeSetStep, createTrackedTimeout]);

  // Listen for check-in completion
  useEffect(() => {
    const handleCheckInComplete = () => {
      if (run && stepIndex <= STEP_INDEX.CHECKIN_INTENTION) {
        haptics.success();
        setWaitingForAction(false);
        createTrackedTimeout(() => safeSetStep(STEP_INDEX.XP_CELEBRATION), 500); // Go to XP celebration, then companion
      }
    };

    window.addEventListener('checkin-complete', handleCheckInComplete);
    return () => window.removeEventListener('checkin-complete', handleCheckInComplete);
  }, [stepIndex, run, safeSetStep, createTrackedTimeout]);

  // Listen for mission completion
  useEffect(() => {
    const handleTaskCompleted = () => {
      if (run && stepIndex === STEP_INDEX.QUEST_CREATION) {
        haptics.heavy();
        setWaitingForAction(false);

        // PAUSE the tour completely during evolution animation
        setRun(false);

        // Clear tutorial step temporarily during evolution
        window.dispatchEvent(new CustomEvent('tutorial-step-change', {
          detail: { step: null }
        }));
      }
    };

    window.addEventListener('mission-completed', handleTaskCompleted);
    return () => window.removeEventListener('mission-completed', handleTaskCompleted);
  }, [run, stepIndex]);

  // Listen for evolution completion to show final step
  useEffect(() => {
    const handleEvolutionComplete = () => {
      if (stepIndex === STEP_INDEX.QUEST_CREATION) {
        // Evolution complete - now show final congratulations step
        haptics.success();
        setRun(true);
        setWaitingForAction(false);
        createTrackedTimeout(() => safeSetStep(STEP_INDEX.FINAL_CONGRATULATIONS), 500);
      }
    };

    window.addEventListener('evolution-complete', handleEvolutionComplete);
    return () => window.removeEventListener('evolution-complete', handleEvolutionComplete);
  }, [stepIndex, safeSetStep, createTrackedTimeout]);


  // Listen for route changes to progress tutorial
  useEffect(() => {
    if (!run) return;

    if (stepIndex === STEP_INDEX.XP_CELEBRATION && location.pathname === '/companion') {
      // User clicked Companion tab from XP celebration step
      haptics.medium();
      createTrackedTimeout(() => {
        safeSetStep(STEP_INDEX.COMPANION_VIEW);
      }, 100);
    } else if (stepIndex === STEP_INDEX.COMPANION_VIEW && location.pathname === '/tasks') {
      // User clicked Quests tab from companion step
      haptics.medium();
      createTrackedTimeout(() => {
        safeSetStep(STEP_INDEX.QUEST_CREATION);
      }, 100);
    }
  }, [location.pathname, stepIndex, run, safeSetStep, createTrackedTimeout]);


  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { status, index, lifecycle } = data;

    // Only allow finishing when tutorial is complete
    if (status === STATUS.FINISHED) {
      haptics.success();
      triggerConfettiCelebration();
      clearAllTimeouts();

      setRun(false);
      localStorage.setItem('hasSeenAppWalkthrough', 'true');
      localStorage.removeItem('onboardingComplete');
      localStorage.removeItem('appWalkthroughActive');

      // Clear tutorial step
      window.dispatchEvent(new CustomEvent('tutorial-step-change', {
        detail: { step: null }
      }));
      return;
    }

    // Set waiting states for steps requiring user actions
    if (lifecycle === 'complete') {
      if (index === STEP_INDEX.QUEST_CREATION) {
        // Wait for quest completion (which triggers evolution)
        setWaitingForAction(true);
      }
    }
  }, [triggerConfettiCelebration, clearAllTimeouts]);

  // Cleanup timeouts when tutorial stops or component unmounts
  useEffect(() => {
    if (!run) {
      clearAllTimeouts();
    }
    return () => {
      clearAllTimeouts();
    };
  }, [run, clearAllTimeouts]);

  // Lock body scroll during tutorial but allow pointer events for spotlight clicks
  useEffect(() => {
    if (run) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = '0';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    };
  }, [run]);

  if (!user || !session) return null;

  // Interactive steps that allow user interaction (XP celebration, companion view, quest creation, final)
  const interactiveStepIndices: number[] = [
    STEP_INDEX.XP_CELEBRATION, 
    STEP_INDEX.COMPANION_VIEW, 
    STEP_INDEX.QUEST_CREATION, 
    STEP_INDEX.FINAL_CONGRATULATIONS
  ];
  const isFinalStep = stepIndex === STEP_INDEX.FINAL_CONGRATULATIONS;

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      callback={handleJoyrideCallback}
      continuous={true}
      showProgress={false}
      showSkipButton={false}
      disableOverlayClose={!isFinalStep}
      disableCloseOnEsc={!isFinalStep}
      hideCloseButton={!isFinalStep}
      disableScrolling
      scrollToFirstStep={false}
      spotlightPadding={0}
      tooltipComponent={isFinalStep ? CustomFinalTooltip : undefined}
      styles={{
        options: {
          primaryColor: 'hsl(var(--primary))',
          textColor: 'hsl(var(--foreground))',
          backgroundColor: 'hsl(var(--card))',
          overlayColor: 'transparent',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: '1.25rem',
          padding: '1.5rem',
          border: '3px solid hsl(var(--primary))',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          pointerEvents: 'auto',
          animation: 'tooltip-border-pulse 2s ease-in-out infinite',
          backgroundColor: 'hsl(var(--card))',
          opacity: 1,
        },
        tooltipContent: {
          fontSize: '1rem',
          lineHeight: '1.6',
          padding: '0.5rem 0',
        },
        buttonNext: {
          display: isFinalStep ? 'block' : 'none',
          backgroundColor: 'hsl(var(--primary))',
          padding: '0.75rem 2rem',
          fontSize: '1rem',
          fontWeight: 'bold',
          borderRadius: '0.75rem',
          pointerEvents: 'auto',
        },
        buttonBack: {
          display: 'none',
        },
        buttonClose: {
          display: 'none !important',
          opacity: 0,
          visibility: 'hidden',
          pointerEvents: 'none',
        },
        buttonSkip: {
          display: 'none',
        },
        overlay: {
          mixBlendMode: 'normal',
        },
        spotlight: {
          boxShadow: 'none',
          backgroundColor: 'transparent',
        },
      }}
      disableOverlay={interactiveStepIndices.includes(stepIndex)}
      locale={{
        back: 'Back',
        close: '',
        last: 'Begin Your Adventure',
        next: 'Next',
      }}
    />
  );
};
