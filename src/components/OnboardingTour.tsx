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
          backgroundColor: 'transparent',
          overlayColor: 'rgba(0, 0, 0, 0.75)',
          arrowColor: 'rgba(255, 255, 255, 0.1)',
          zIndex: 10000,
        },
        overlay: {
          mixBlendMode: 'normal',
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '32px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 80px rgba(var(--primary-rgb), 0.3)',
          animation: 'slideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        tooltipContainer: {
          textAlign: 'left',
        },
        tooltipTitle: {
          color: 'hsl(var(--foreground))',
          fontSize: '24px',
          fontWeight: '700',
          marginBottom: '12px',
          fontFamily: 'var(--font-heading)',
        },
        tooltipContent: {
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize: '16px',
          lineHeight: '1.6',
          padding: '0',
        },
        buttonNext: {
          backgroundColor: 'rgba(var(--primary-rgb), 0.9)',
          backdropFilter: 'blur(8px)',
          borderRadius: '16px',
          padding: '14px 28px',
          fontSize: '15px',
          fontWeight: '600',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 4px 16px rgba(var(--primary-rgb), 0.4)',
          transition: 'all 0.3s ease',
        },
        buttonBack: {
          color: 'rgba(255, 255, 255, 0.7)',
          marginRight: '12px',
          fontSize: '15px',
          fontWeight: '500',
        },
        buttonSkip: {
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: '14px',
        },
        buttonClose: {
          color: 'rgba(255, 255, 255, 0.7)',
          width: '32px',
          height: '32px',
        },
        spotlight: {
          backgroundColor: 'transparent',
          border: '2px solid rgba(var(--primary-rgb), 0.6)',
          borderRadius: '16px',
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75), 0 0 40px rgba(var(--primary-rgb), 0.5)',
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
