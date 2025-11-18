import { useEffect, useState, useCallback } from "react";
import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from "react-joyride";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { haptics } from "@/utils/haptics";
import confetti from "canvas-confetti";

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
    spotlightClicks: true,
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
    target: '[data-tour="add-task-input"]',
    content: "✍️ Type your first quest here. Try something like 'Complete Tutorial Quest'!",
    placement: "top",
    spotlightClicks: true,
  },
  {
    target: '[data-tour="task-difficulty"]',
    content: "⚡ Select Medium difficulty (15 XP) for your quest.",
    placement: "top",
    spotlightClicks: true,
  },
  {
    target: '[data-tour="add-task-button"]',
    content: "➕ Now click Add Quest to create it!",
    placement: "left",
    spotlightClicks: true,
  },
  {
    target: '[data-tour="first-task"]',
    content: "✅ Great! Now complete your quest by clicking the checkbox. This will give you enough XP to evolve your companion!",
    placement: "bottom",
    spotlightClicks: true,
  },
  {
    target: 'body',
    content: "🎉 Your companion is evolving! Check-in (5 XP) + Quest (15 XP) = 20 XP total!",
    placement: "center",
    disableBeacon: true,
  },
  {
    target: '[data-tour="habits-tab"]',
    content: "🔄 Finally, let's create your first habit! Click the Habits tab.",
    placement: "bottom",
    spotlightClicks: true,
  },
  {
    target: 'body',
    content: "💡 Choose a template or create a custom habit. Habits help you build daily consistency and earn XP!",
    placement: "center",
    spotlightClicks: true,
  },
  {
    target: 'body',
    content: "🎓 Tutorial complete! You've learned the basics: daily check-ins, quests, and habits. Keep completing them to evolve your companion to higher stages. Remember: consistency is key! 🚀",
    placement: "center",
  },
];

export const AppWalkthrough = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [waitingForAction, setWaitingForAction] = useState(false);

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
    const target = WALKTHROUGH_STEPS[idx]?.target as string | undefined;
    if (target && target !== 'body') {
      await waitForSelector(target, 6000);
    }
    setStepIndex(idx);
  }, [waitForSelector]);

  useEffect(() => {
    const checkWalkthroughStatus = async () => {
      if (!user) return;

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
          await waitForSelector((WALKTHROUGH_STEPS[0].target as string) || 'body', 8000);
          setTimeout(() => {
            setRun(true);
          }, 300);
        }
      }
    };

    checkWalkthroughStatus();
  }, [user, location.pathname]);

  // Guard: Stop tutorial if user navigates to auth or unexpected route
  useEffect(() => {
    if (!run) return;

    // Define expected routes for each step range
    const expectedRoute = (() => {
      if (stepIndex <= 3) return '/';
      if (stepIndex >= 4) return '/tasks';
      return '/';
    })();

    // If user is on auth page or wrong route, navigate them back
    if (location.pathname === '/auth' || (location.pathname !== expectedRoute && stepIndex <= 3)) {
      console.log('Tutorial: User on wrong route, navigating to home');
      navigate('/');
    }
  }, [location.pathname, stepIndex, run, navigate]);

  // Listen for check-in completion
  useEffect(() => {
    const handleCheckInComplete = () => {
      if (run && stepIndex === 1 && waitingForAction) {
        haptics.success(); // Celebratory feedback for check-in
        setWaitingForAction(false);
        safeSetStep(2);
      }
    };

    window.addEventListener('checkin-complete', handleCheckInComplete);
    return () => window.removeEventListener('checkin-complete', handleCheckInComplete);
  }, [stepIndex, waitingForAction, run]);

  // Listen for quest creation to move from input/difficulty to first quest step
  useEffect(() => {
    const handleTaskAdded = () => {
      if (run && stepIndex === 7) {
        haptics.medium();
        setTimeout(() => safeSetStep(8), 400);
      }
    };

    window.addEventListener('task-added', handleTaskAdded);
    return () => window.removeEventListener('task-added', handleTaskAdded);
  }, [run, stepIndex, safeSetStep]);

  // Listen for companion evolution after completing first quest
  useEffect(() => {
    const handleEvolution = () => {
      if (run && stepIndex === 8 && waitingForAction) {
        haptics.heavy();
        setWaitingForAction(false);
        setTimeout(() => safeSetStep(9), 2000);
      }
    };

    window.addEventListener('companion-evolved', handleEvolution);
    return () => window.removeEventListener('companion-evolved', handleEvolution);
  }, [run, stepIndex, waitingForAction, safeSetStep]);

  // Listen for route changes to progress tutorial
  useEffect(() => {
    if (!run) return;
    
    if (stepIndex === 4 && location.pathname === '/tasks') {
      // User clicked Quests tab, progress to next step
      haptics.medium();
      setTimeout(() => safeSetStep(5), 500);
    } else if (stepIndex === 10 && location.pathname === '/tasks') {
      // User clicked Habits tab, progress to next step
      haptics.medium();
      setTimeout(() => safeSetStep(11), 500);
    }
  }, [location.pathname, stepIndex, run]);


  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { status, action, index, type, lifecycle } = data;

    // Only allow finishing when tutorial is complete, prevent skipping
    if (status === STATUS.FINISHED) {
      haptics.success(); // Celebratory feedback for completing entire tutorial
      
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
        
        // Confetti from left side
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        
        // Confetti from right side
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);
      
      setRun(false);
      localStorage.setItem('hasSeenAppWalkthrough', 'true');
      localStorage.removeItem('onboardingComplete');
      return;
    }

    // Handle step progression
    if (type === EVENTS.STEP_AFTER) {
      const nextStepIndex = index + (action === ACTIONS.PREV ? -1 : 1);

      // Light haptic feedback for regular step progression
      if (action === ACTIONS.NEXT) {
        haptics.light();
      }

      // Navigate between sections
      if (index === 3 && action === ACTIONS.NEXT) {
        // After Ask Mentor, show step to click Quests tab
        setStepIndex(4);
      } else if (index === 4 && action === ACTIONS.NEXT) {
        // Don't allow "Next" button on tasks-tab step - user must click the tab
        return;
      } else if ((index === 7 || index === 10) && action === ACTIONS.NEXT) {
        // Don't allow "Next" button on add quest or habits-tab steps
        return;
      } else if (index === 1 && lifecycle === 'complete') {
        // Wait for check-in submission
        setWaitingForAction(true);
      } else if (index === 8 && lifecycle === 'complete') {
        // Wait for quest completion (which triggers evolution)
        setWaitingForAction(true);
      } else {
        setStepIndex(nextStepIndex);
      }
    }
  }, [navigate, location.pathname]);

  if (!user) return null;

  return (
    <Joyride
      steps={WALKTHROUGH_STEPS}
      run={run}
      stepIndex={stepIndex}
      callback={handleJoyrideCallback}
      continuous
      showProgress
      showSkipButton={false}
      disableOverlayClose
      disableCloseOnEsc
      hideCloseButton
      disableScrolling
      styles={{
        options: {
          primaryColor: 'hsl(var(--primary))',
          textColor: 'hsl(var(--foreground))',
          backgroundColor: 'hsl(var(--card))',
          overlayColor: 'rgba(0, 0, 0, 0.9)',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: '1.25rem',
          padding: '2rem',
          border: '1px solid hsl(var(--border))',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
        },
        tooltipContent: {
          fontSize: '1rem',
          lineHeight: '1.6',
          padding: '0.5rem 0',
        },
        buttonNext: {
          backgroundColor: 'hsl(var(--primary))',
          borderRadius: '0.75rem',
          padding: '0.75rem 1.5rem',
          fontSize: '0.95rem',
          fontWeight: '600',
        },
        buttonBack: {
          color: 'hsl(var(--muted-foreground))',
          marginRight: '1rem',
        },
        overlay: {
          mixBlendMode: 'normal',
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
      }}
    />
  );
};
