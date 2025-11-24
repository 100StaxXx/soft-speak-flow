import { useEffect, useState, useCallback } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { useAuth } from "@/hooks/useAuth";

const tourSteps: Step[] = [
  {
    target: '[data-tour="first-habit-checkbox"]',
    content: "Tap here to check off your habit and earn XP! Completing habits grows your companion and builds your streak.",
    placement: "bottom",
    disableBeacon: true,
  },
];

export const HabitsPageTour = () => {
  const { user } = useAuth();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!user) return;
    
    let timeoutId: NodeJS.Timeout | undefined;
    
    const checkAndRunTour = () => {
      const hasSeenHabitsTour = localStorage.getItem('hasSeenHabitsTour');
      const hasHabits = localStorage.getItem('userHasCreatedFirstHabit');
      
      if (!hasSeenHabitsTour && hasHabits === 'true') {
        // Small delay to ensure DOM is ready
        timeoutId = setTimeout(() => {
          setRun(true);
        }, 500);
      }
    };
    
    // Check initially
    checkAndRunTour();
    
    // Listen for custom event since storage event doesn't work in same window
    const handleHabitCreated = () => {
      checkAndRunTour();
    };
    
    window.addEventListener('firstHabitCreated', handleHabitCreated);
    
    return () => {
      window.removeEventListener('firstHabitCreated', handleHabitCreated);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user]);

  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { status, index, action } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      localStorage.setItem('hasSeenHabitsTour', 'true');
      // Clear the flag so tour doesn't show again
      localStorage.removeItem('userHasCreatedFirstHabit');
    }

    if (action === 'next' || action === 'prev') {
      setStepIndex(index + (action === 'next' ? 1 : -1));
    }
  }, []);

  if (!user) return null;

  return (
    <Joyride
      steps={tourSteps}
      run={run}
      stepIndex={stepIndex}
      callback={handleJoyrideCallback}
      continuous
      showProgress
      showSkipButton
      disableOverlayClose
      styles={{
        options: {
          primaryColor: 'hsl(var(--primary))',
          textColor: 'hsl(var(--foreground))',
          backgroundColor: 'hsl(var(--card))',
          overlayColor: 'transparent',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: '12px',
          padding: '20px',
        },
        buttonNext: {
          backgroundColor: 'hsl(var(--primary))',
          borderRadius: '8px',
          padding: '10px 20px',
        },
        buttonBack: {
          color: 'hsl(var(--muted-foreground))',
        },
        spotlight: {
          boxShadow: 'none',
          backgroundColor: 'transparent',
        },
      }}
      disableOverlay
      locale={{
        last: 'Got it!',
        skip: 'Skip',
      }}
    />
  );
};
