import { useEffect, useState, useCallback, useMemo } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { haptics } from "@/utils/haptics";
import confetti from "canvas-confetti";
import { useIsMobile } from "@/hooks/use-mobile";

const WALKTHROUGH_STEPS: Step[] = [
  // HOME PAGE - Check-in
  {
    target: '[data-tour="morning-checkin"]',
    content: "👋 Welcome! Let's start with your morning check-in. Select how you're feeling right now.",
    placement: "bottom",
    disableBeacon: true,
    spotlightClicks: true,
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
    content: "🎉 Nice! You just earned +5 XP! Now tap the Quests tab at the bottom to start building your first quest!",
    placement: "center",
    disableBeacon: true,
  },
  {
    target: '[data-tour="todays-pep-talk"]',
    content: "🎯 Here's your personalized pep talk for today - crafted just for you by your mentor!",
    placement: "bottom",
  },
  {
    target: '[data-tour="ask-mentor"]',
    content: "💬 Need guidance anytime? Use this quick chat to ask your mentor anything.",
    placement: "top",
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
    target: 'body',
    content: "✍️ Perfect! Now create a quest: Type 'Complete Tutorial Quest', select Medium difficulty (15 XP), then click Add Quest. Once created, complete it by clicking the checkbox to evolve your companion!",
    placement: 'center',
    disableBeacon: true,
    spotlightClicks: false,
    floaterProps: {
      disableAnimation: true,
    },
    styles: {
      options: {
        zIndex: 100000,
      },
      tooltip: {
        marginTop: '280px',
      }
    }
  },
  {
    target: 'body',
    content: "🎉 Congratulations! You've mastered the basics! You know how to check in daily and create quests to earn XP. Keep building your momentum and watch your companion evolve through amazing stages. Your journey starts now! 🚀",
    placement: "center",
    disableBeacon: true,
    locale: { last: 'Begin Your Adventure' },
    styles: {
      buttonNext: {
        display: 'block',
      }
    }
  },
];

export const AppWalkthrough = () => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [waitingForAction, setWaitingForAction] = useState(false);

  const isMobile = useIsMobile();
  const steps = useMemo<Step[]>(() => {
    const base = [...WALKTHROUGH_STEPS];
    if (isMobile) {
      base[6] = {
        ...base[6],
        target: '[data-tour="week-calendar"]',
        placement: 'top',
        styles: {
          ...((base[6] as any).styles || {}),
          tooltip: {
            ...(((base[6] as any).styles?.tooltip) || {}),
            marginTop: undefined,
            marginBottom: '8px',
          },
        },
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
    const target = (steps[idx] as Step | undefined)?.target as string | undefined;
    if (target && target !== 'body') {
      await waitForSelector(target, 6000);
    }
    setStepIndex(idx);
    
    // Emit custom event for BottomNav to listen to
    window.dispatchEvent(new CustomEvent('tutorial-step-change', { 
      detail: { step: idx } 
    }));
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
        setTimeout(() => safeSetStep(2), 500); // Go to XP celebration step
      }
    };

    window.addEventListener('checkin-complete', handleCheckInComplete);
    return () => window.removeEventListener('checkin-complete', handleCheckInComplete);
  }, [stepIndex, run, safeSetStep]);

  // Listen for quest completion to advance to final step
  useEffect(() => {
    const handleTaskCompleted = () => {
      if (run && stepIndex === 6) {
        haptics.heavy();
        setWaitingForAction(false);
        // Wait for evolution modal to appear and dismiss
        setTimeout(() => safeSetStep(7), 3000);
      }
    };

    window.addEventListener('mission-completed', handleTaskCompleted);
    return () => window.removeEventListener('mission-completed', handleTaskCompleted);
  }, [run, stepIndex, safeSetStep]);


  // Listen for route changes to progress tutorial
  useEffect(() => {
    if (!run) return;
    
    if (stepIndex === 2 && location.pathname === '/tasks') {
      // User clicked Quests tab from XP step, skip directly to quest creation with immediate display
      haptics.medium();
      setTimeout(() => {
        setStepIndex(6);
      }, 100); // Very short delay to ensure UI is ready
    } else if (stepIndex === 5 && location.pathname === '/tasks') {
      // User clicked Quests tab, progress to quest creation step immediately
      haptics.medium();
      setTimeout(() => {
        setStepIndex(6);
      }, 100);
    }
  }, [location.pathname, stepIndex, run]);


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
      
      // Clear tutorial step to re-enable navigation
      window.dispatchEvent(new CustomEvent('tutorial-step-change', { 
        detail: { step: null } 
      }));
      return;
    }

    // Set waiting states for steps requiring user actions
    if (lifecycle === 'complete') {
      if (index === 7) {
        // Wait for quest completion (which triggers evolution)
        setWaitingForAction(true);
      }
    }
  }, []);

  // Lock body scroll during tutorial
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
      continuous={false}
      showProgress={false}
      showSkipButton={false}
      disableOverlayClose
      disableCloseOnEsc
      hideCloseButton
      disableScrolling
      scrollToFirstStep={false}
      spotlightPadding={0}
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
        },
        tooltipContent: {
          fontSize: '1rem',
          lineHeight: '1.6',
          padding: '0.5rem 0',
        },
        buttonNext: {
          display: 'none',
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
      disableOverlay
      locale={{
        back: 'Back',
        close: '',
        last: 'Begin Your Adventure',
        next: 'Next',
      }}
    />
  );
};
