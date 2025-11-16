import { useEffect, useState } from "react";
import Joyride, { Step, CallBackProps, STATUS } from "react-joyride";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

const tourSteps: Step[] = [
  {
    target: 'body',
    content: '🎉 Welcome! Let\'s take a quick tour to show you how to get the most out of your personalized motivation app.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="daily-content"]',
    content: '🎯 Start your day with a personalized pep talk from your mentor tailored to your needs.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="search"]',
    content: '🔍 Search across all your content - quotes, pep talks, and challenges in one place.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="habits"]',
    content: '✅ Track your daily habits and build lasting routines. Earn achievements as you progress!',
    placement: 'top',
  },
  {
    target: '[data-tour="library"]',
    content: '📚 Access your favorites and downloads anytime in your personal library.',
    placement: 'top',
  },
  {
    target: '[data-tour="achievements"]',
    content: '🏆 View your achievements and milestones as you grow on your journey.',
    placement: 'top',
  },
  {
    target: '[data-tour="profile"]',
    content: '⚙️ Customize your experience, manage notifications, and switch mentors anytime.',
    placement: 'top',
  },
  {
    target: 'body',
    content: '✨ You\'re all set! Start building better habits and let your mentor guide you to success.',
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
