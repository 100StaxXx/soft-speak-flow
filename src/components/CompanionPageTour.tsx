import { useEffect, useState } from "react";
import Joyride, { Step, CallBackProps, STATUS } from "react-joyride";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "react-router-dom";

const tourSteps: Step[] = [
  {
    target: 'body',
    content: '🐾 Welcome to your companion dashboard! Your companion grows alongside you as you complete habits and achieve goals.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="companion-display"]',
    content: '✨ This is your companion! Watch it evolve through multiple stages as you earn XP from completing habits and missions.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="habits-tab"]',
    content: '📋 Track your daily habits here. Completing habits earns XP for your companion and helps you build consistency.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="progress-tab"]',
    content: '📊 View your progress, streaks, and XP breakdown to see how you\'re doing.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="achievements-tab"]',
    content: '🏆 Unlock achievements as you reach milestones on your journey.',
    placement: 'bottom',
  },
];

export const CompanionPageTour = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    // CRITICAL: Don't show this tour if the main app walkthrough is active or pending
    const hasSeenAppWalkthrough = localStorage.getItem('hasSeenAppWalkthrough');
    const onboardingComplete = localStorage.getItem('onboardingComplete');
    
    // If onboarding is complete but they haven't seen the app walkthrough yet, the main tutorial is running
    if (onboardingComplete === 'true' && !hasSeenAppWalkthrough) {
      console.log('CompanionPageTour: Skipping because AppWalkthrough is active');
      return; // AppWalkthrough will handle companion page tutorial
    }
    
    // Only show this separate tour if:
    // 1. User has completed the main AppWalkthrough
    // 2. They haven't seen this specific companion tour yet
    // 3. They're on the companion page
    const tourCompleted = localStorage.getItem('companionPageTourComplete') === 'true';
    if (
      user && 
      !tourCompleted && 
      location.pathname === '/companion' &&
      hasSeenAppWalkthrough === 'true' // Must have fully completed main tutorial
    ) {
      const timer = setTimeout(() => {
        setRun(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [user, location.pathname]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, index, type } = data;

    if (type === 'step:after') {
      setStepIndex(index + 1);
    }

    // Tour completed or skipped
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      localStorage.setItem('companionPageTourComplete', 'true');
    }
  };

  if (!user) return null;

  return (
    <Joyride
      steps={tourSteps}
      run={run}
      stepIndex={stepIndex}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: 'hsl(var(--primary))',
          textColor: 'hsl(var(--foreground))',
          backgroundColor: 'hsl(var(--card))',
          overlayColor: 'rgba(0, 0, 0, 0.6)',
          arrowColor: 'hsl(var(--card))',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: '1.25rem',
          padding: '2rem',
          border: '1px solid hsl(var(--border))',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
        },
        tooltipContent: {
          fontSize: '0.95rem',
          lineHeight: '1.6',
          padding: '0.5rem 0',
        },
        buttonNext: {
          backgroundColor: 'hsl(var(--primary))',
          borderRadius: '0.75rem',
          padding: '0.75rem 1.5rem',
          fontSize: '0.9rem',
          fontWeight: '600',
        },
        buttonBack: {
          color: 'hsl(var(--muted-foreground))',
          marginRight: '1rem',
        },
        buttonSkip: {
          color: 'hsl(var(--muted-foreground))',
        },
      }}
      floaterProps={{
        styles: {
          arrow: {
            length: 8,
            spread: 16,
          },
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip tour',
      }}
    />
  );
};
