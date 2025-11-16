import { useEffect, useState } from "react";
import Joyride, { Step, CallBackProps, STATUS } from "react-joyride";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

const tourSteps: Step[] = [
  {
    target: 'body',
    content: 'Welcome! Let\'s take a quick tour to show you how to get the most out of your personalized motivation app.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="daily-content"]',
    content: 'Your daily pep talk and quote from your mentor. Start each day with personalized motivation.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="habits"]',
    content: 'Track your habits here. Build streaks and celebrate milestones as you progress.',
    placement: 'top',
  },
  {
    target: '[data-tour="activity-feed"]',
    content: 'Your mentor responds to your actions with encouraging comments. Stay engaged!',
    placement: 'top',
  },
  {
    target: '[data-tour="mentor-chat"]',
    content: 'Need guidance? Chat directly with your AI mentor anytime for personalized advice.',
    placement: 'top',
  },
  {
    target: '[data-tour="profile"]',
    content: 'Access your profile here to view analytics, manage notifications, and change mentors.',
    placement: 'top',
  },
  {
    target: 'body',
    content: 'You\'re all set! Start building better habits and let your mentor guide you to success.',
    placement: 'center',
  },
];

export const OnboardingTour = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const location = useLocation();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    // Only show tour on home page for first-time users
    const onboardingCompleted = (profile as any)?.onboarding_completed;
    if (
      user && 
      profile && 
      !onboardingCompleted && 
      location.pathname === '/'
    ) {
      // Small delay to ensure elements are rendered
      const timer = setTimeout(() => {
        setRun(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, profile, location.pathname]);

  const handleJoyrideCallback = async (data: CallBackProps) => {
    const { status, index, type } = data;

    if (type === 'step:after') {
      setStepIndex(index + 1);
    }

    // Tour completed or skipped
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      
      // Mark onboarding as completed
      if (user) {
        await supabase
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', user.id);
      }
    }
  };

  const onboardingCompleted = (profile as any)?.onboarding_completed;
  if (!user || !profile || onboardingCompleted) {
    return null;
  }

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
          overlayColor: 'rgba(0, 0, 0, 0.5)',
          arrowColor: 'hsl(var(--card))',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: '16px',
          padding: '20px',
        },
        buttonNext: {
          backgroundColor: 'hsl(var(--primary))',
          borderRadius: '12px',
          padding: '10px 20px',
        },
        buttonBack: {
          color: 'hsl(var(--muted-foreground))',
          marginRight: '10px',
        },
        buttonSkip: {
          color: 'hsl(var(--muted-foreground))',
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
