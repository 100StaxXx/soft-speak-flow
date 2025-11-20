import { useEffect, useState, useCallback, useMemo } from "react";
import Joyride, { CallBackProps, STATUS, Step, TooltipRenderProps } from "react-joyride";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { haptics } from "@/utils/haptics";
import confetti from "canvas-confetti";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const WALKTHROUGH_STEPS: Step[] = [
  // HOME PAGE - Check-in
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
  {
    target: '[data-tour="checkin-intention"]',
    content: "💭 Now, what's your main focus for today? Enter your intention here.",
    placement: "top",
    disableBeacon: true,
    spotlightClicks: true,
  },
  {
    target: 'body',
    content: "🎉 Nice! You just earned +5 XP! Now let's meet your companion! Tap the Companion tab at the bottom.",
    placement: "center",
    disableBeacon: true,
  },
  
  // COMPANION PAGE
  {
    target: '[data-tour="companion-tab"]',
    content: "🐾 Let's meet your companion! Tap the Companion tab to see them.",
    placement: "top",
    disableBeacon: true,
    spotlightClicks: true,
  },
  {
    target: '[data-tour="tasks-tab"]',
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
  
  // TASKS PAGE
  {
    target: '[data-tour="tasks-tab"]',
    content: "📋 Now let's build your first quest! Tap the Quests tab to get started.",
    placement: "top",
    disableBeacon: true,
    spotlightClicks: true,
  },
  {
    target: '[data-tour="today-quests-header"]',
    content: "✍️ Perfect! Now create a quest: Type 'Start my Journey', select Medium difficulty (15 XP), then tap Add Quest. This will become your MAIN QUEST - the one thing that moves your day forward! Main Quests earn 2x XP.",
    placement: 'top',
    disableBeacon: true,
    spotlightClicks: false,
    floaterProps: {
      disableAnimation: true,
      hideArrow: false,
      offset: 20,
    },
    styles: {
      options: {
        zIndex: 100000,
      },
      overlay: {
        mixBlendMode: 'normal' as const,
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
      },
      tooltipContent: {
        fontSize: '1rem',
        lineHeight: '1.6',
        padding: '0.5rem 0',
        textAlign: 'left' as const,
        pointerEvents: 'auto',
      }
    }
  },
  {
    target: 'body',
    content: "🎉 Congratulations! You've mastered the basics! You know how to check in daily and create quests. Your first quest is now your MAIN QUEST (2x XP!) - you can add 2 more Side Quests if needed. Complete your Main Quest by tapping the checkbox to evolve your companion! 🚀",
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

  // Custom tooltip for final step
  const CustomFinalTooltip = useCallback(({ continuous, index, step, backProps, closeProps, primaryProps, tooltipProps }: TooltipRenderProps) => {
    if (index !== 7) return null;
    
    const handleFinish = () => {
      haptics.success();
      
      // Trigger confetti celebration
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10001 };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval: any = setInterval(function() {
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
  }, []);


  const isMobile = useIsMobile();
  const steps = useMemo<Step[]>(() => {
    const base = [...WALKTHROUGH_STEPS];
    if (isMobile) {
      // Adjust quest creation step
      base[6] = {
        ...base[6],
        target: '[data-tour="today-quests-header"]',
        placement: 'top',
        floaterProps: {
          ...((base[6] as any).floaterProps || {}),
          offset: 0,
        },
        styles: {
          ...((base[6] as any).styles || {}),
          tooltip: {
            ...(((base[6] as any).styles?.tooltip) || {}),
            marginTop: undefined,
            marginBottom: '8px',
            pointerEvents: 'none',
          },
        },
      } as Step;
      
      // Adjust companion page step (step 4) - target XP bar below image
      base[4] = {
        ...base[4],
        target: '[data-tour="companion-tooltip-anchor"]',
        placement: 'top',
      } as Step;
    }
    return base;
  }, [isMobile]);

  // Utility: wait for a selector to exist before advancing
  const waitForSelector = useCallback((selector: string, timeout = 5000) => {
    return new Promise<void>((resolve) => {
      const start = Date.now();
      const check = () => {
        if (document.querySelector(selector)) return resolve();
        if (Date.now() - start > timeout) return resolve();
        requestAnimationFrame(check);
      };
      check();
    });
  }, []);

  // Utility: safely set step after ensuring target exists
  const safeSetStep = useCallback(async (idx: number) => {
    // Emit custom event for BottomNav FIRST so navigation becomes clickable immediately
    window.dispatchEvent(new CustomEvent('tutorial-step-change', { 
      detail: { step: idx } 
    }));
    
    setStepIndex(idx);
    
    const target = (steps[idx] as Step | undefined)?.target as string | undefined;
    if (target && target !== 'body') {
      await waitForSelector(target, 6000);
    }
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
          setTimeout(() => {
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
  }, [user, session, location.pathname, waitForSelector, steps]);


  // Listen for mood selection to advance from step 0 to step 1
  useEffect(() => {
    const handleMoodSelected = () => {
      if (run && stepIndex === 0) {
        haptics.light();
        setTimeout(() => safeSetStep(1), 300);
      }
    };

    window.addEventListener('mood-selected', handleMoodSelected);
    return () => window.removeEventListener('mood-selected', handleMoodSelected);
  }, [stepIndex, run, safeSetStep]);

  // Listen for check-in completion
  useEffect(() => {
    const handleCheckInComplete = () => {
      if (run && stepIndex <= 1) {
        haptics.success();
        setWaitingForAction(false);
        setTimeout(() => safeSetStep(2), 500); // Go to XP celebration, then companion
      }
    };

    window.addEventListener('checkin-complete', handleCheckInComplete);
    return () => window.removeEventListener('checkin-complete', handleCheckInComplete);
  }, [stepIndex, run, safeSetStep]);

  // Listen for mission completion
  useEffect(() => {
    const handleTaskCompleted = () => {
      if (run && stepIndex === 6) {
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
      if (stepIndex === 6) {
        // Evolution complete - now show final congratulations step
        haptics.success();
        setRun(true);
        setWaitingForAction(false);
        setTimeout(() => safeSetStep(7), 500);
      }
    };

    window.addEventListener('evolution-complete', handleEvolutionComplete);
    return () => window.removeEventListener('evolution-complete', handleEvolutionComplete);
  }, [stepIndex, safeSetStep]);


  // Listen for route changes to progress tutorial
  useEffect(() => {
    if (!run) return;
    
    if (stepIndex === 2 && location.pathname === '/companion') {
      // User clicked Companion tab from XP step
      haptics.medium();
      setTimeout(() => {
        safeSetStep(4);
      }, 100);
    } else if (stepIndex === 4 && location.pathname === '/tasks') {
      // User clicked Quests tab from companion step
      haptics.medium();
      setTimeout(() => {
        safeSetStep(6);
      }, 100);
    } else if (stepIndex === 3 && location.pathname === '/companion') {
      // User clicked Companion tab
      haptics.medium();
      setTimeout(() => {
        safeSetStep(4);
      }, 100);
    } else if (stepIndex === 5 && location.pathname === '/tasks') {
      // User clicked Quests tab
      haptics.medium();
      setTimeout(() => {
        safeSetStep(6);
      }, 100);
    }
  }, [location.pathname, stepIndex, run, safeSetStep]);


  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { status, index, lifecycle } = data;

    // Only allow finishing when tutorial is complete
    if (status === STATUS.FINISHED) {
      haptics.success();
      
      // Trigger confetti celebration
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10001 };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval: any = setInterval(function() {
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
      if (index === 6) {
        // Wait for quest completion (which triggers evolution)
        setWaitingForAction(true);
      }
    }
  }, []);

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

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      callback={handleJoyrideCallback}
      continuous={true}
      showProgress={false}
      showSkipButton={false}
      disableOverlayClose={stepIndex !== 7}
      disableCloseOnEsc={stepIndex !== 7}
      hideCloseButton={stepIndex !== 7}
      disableScrolling
      scrollToFirstStep={false}
      spotlightPadding={0}
      tooltipComponent={stepIndex === 7 ? CustomFinalTooltip : undefined}
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
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        },
        tooltipContent: {
          fontSize: '1rem',
          lineHeight: '1.6',
          padding: '0.5rem 0',
        },
        buttonNext: {
          display: stepIndex === 7 ? 'block' : 'none',
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
      disableOverlay={stepIndex === 2 || stepIndex === 3 || stepIndex === 4 || stepIndex === 5 || stepIndex === 6 || stepIndex === 7}
      locale={{
        back: 'Back',
        close: '',
        last: 'Begin Your Adventure',
        next: 'Next',
      }}
    />
  );
};
