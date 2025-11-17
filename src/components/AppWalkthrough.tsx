import { useEffect, useState, useCallback } from "react";
import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from "react-joyride";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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
    content: "📋 Let's explore the Tasks section! Here you can manage your daily tasks and habits.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="add-task-input"]',
    content: "✍️ Add a task you want to complete today. Make it specific and achievable!",
    placement: "top",
    spotlightClicks: true,
  },
  {
    target: '[data-tour="task-difficulty"]',
    content: "⚡ Choose the difficulty. Easy = 5 XP, Medium = 15 XP, Hard = 25 XP. Start with medium!",
    placement: "top",
    spotlightClicks: true,
  },
  {
    target: '[data-tour="first-task"]',
    content: "✅ Great! Now complete your task by clicking the checkbox. You'll earn XP for your companion!",
    placement: "bottom",
    spotlightClicks: true,
  },
  {
    target: '[data-tour="habits-tab"]',
    content: "🔄 The Habits tab shows recurring activities. Let's create your first habit!",
    placement: "bottom",
    spotlightClicks: true,
  },
  
  // COMPANION PAGE
  {
    target: '[data-tour="companion-display"]',
    content: "✨ Meet your companion! This little creature grows as you complete habits and build consistency.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="create-habit-button"]',
    content: "🎯 Let's create your first habit! Click here to get started.",
    placement: "bottom",
    spotlightClicks: true,
  },
  {
    target: '[data-tour="habit-templates"]',
    content: "💡 Choose something you already did today or a positive habit. This first one should be an easy win!",
    placement: "top",
    spotlightClicks: true,
  },
  {
    target: '[data-tour="habit-difficulty"]',
    content: "⚡ Select 'Easy' difficulty for your first habit - we want to build momentum!",
    placement: "top",
    spotlightClicks: true,
  },
  {
    target: '[data-tour="first-habit-checkbox"]',
    content: "✅ Now complete your habit by tapping this checkbox. Watch what happens!",
    placement: "bottom",
    spotlightClicks: true,
  },
  {
    target: 'body',
    content: "🎉 Your companion is evolving! Check-in (5 XP) + task (15 XP) + habit (5 XP) = 25 XP. You've passed Stage 1!",
    placement: "center",
    disableBeacon: true,
  },
  {
    target: '[data-tour="progress-tab"]',
    content: "📊 The Progress tab shows your companion's XP, daily missions, and weekly insights.",
    placement: "bottom",
  },
  {
    target: '[data-tour="xp-breakdown"]',
    content: "💎 Here's your XP breakdown showing all the ways you've earned experience today!",
    placement: "top",
  },
  {
    target: '[data-tour="daily-missions"]',
    content: "🎯 Daily missions give you personalized goals. Complete them for bonus XP!",
    placement: "top",
  },
  {
    target: '[data-tour="achievements-tab"]',
    content: "🏆 Track your achievements and milestones here. Every accomplishment matters!",
    placement: "bottom",
  },
  {
    target: '[data-tour="evolution-tab"]',
    content: "📜 View your companion's evolution history - a visual timeline of your growth!",
    placement: "bottom",
  },
  {
    target: '[data-tour="companion-display"]',
    content: "⚠️ Important limits: Max 5 habits, max 3 tasks per day. Quality over quantity!",
    placement: "bottom",
  },
  
  // INSPIRE PAGE
  {
    target: '[data-tour="daily-affirmations"]',
    content: "📜 Start your day with powerful affirmations tailored to your mindset.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tour="pep-talks-library"]',
    content: "🎧 Browse your full library of motivational pep talks. Filter by category or emotional state!",
    placement: "top",
  },
  {
    target: 'body',
    content: "🎓 Tutorial complete! You're all set to start your growth journey. Remember: consistency is key! 🚀",
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
          .single();

        if (companion && location.pathname === '/') {
          // Small delay to ensure DOM is ready
          setTimeout(() => {
            setRun(true);
          }, 1000);
        }
      }
    };

    checkWalkthroughStatus();
  }, [user, location.pathname]);

  // Listen for check-in completion
  useEffect(() => {
    const handleCheckInComplete = () => {
      if (stepIndex === 1 && waitingForAction) {
        setWaitingForAction(false);
        setStepIndex(2);
      }
    };

    window.addEventListener('checkin-complete', handleCheckInComplete);
    return () => window.removeEventListener('checkin-complete', handleCheckInComplete);
  }, [stepIndex, waitingForAction]);

  // Listen for task completion
  useEffect(() => {
    const handleTaskComplete = () => {
      if (stepIndex === 7 && waitingForAction) {
        setWaitingForAction(false);
        setStepIndex(8);
      }
    };

    window.addEventListener('task-complete', handleTaskComplete);
    return () => window.removeEventListener('task-complete', handleTaskComplete);
  }, [stepIndex, waitingForAction]);

  // Listen for habit creation
  useEffect(() => {
    const handleHabitCreated = () => {
      if (stepIndex === 12 && waitingForAction) {
        setWaitingForAction(false);
        setStepIndex(13);
      }
    };

    window.addEventListener('habit-created', handleHabitCreated);
    return () => window.removeEventListener('habit-created', handleHabitCreated);
  }, [stepIndex, waitingForAction]);

  // Listen for companion evolution
  useEffect(() => {
    const handleEvolution = () => {
      if (stepIndex === 14 && !waitingForAction) {
        // Wait for evolution animation to complete
        setTimeout(() => {
          setStepIndex(15);
        }, 8000); // Evolution animation duration
      }
    };

    window.addEventListener('companion-evolved', handleEvolution);
    return () => window.removeEventListener('companion-evolved', handleEvolution);
  }, [stepIndex, waitingForAction]);

  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { status, action, index, type, lifecycle } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      localStorage.setItem('hasSeenAppWalkthrough', 'true');
      localStorage.removeItem('onboardingComplete');
      return;
    }

    // Handle step progression
    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const nextStepIndex = index + (action === ACTIONS.PREV ? -1 : 1);

      // Navigate between pages
      if (index === 3 && action === ACTIONS.NEXT) {
        // After Ask Mentor, navigate to Tasks
        navigate('/tasks');
        setTimeout(() => setStepIndex(4), 500);
      } else if (index === 8 && action === ACTIONS.NEXT) {
        // After habits tab intro, navigate to Companion
        navigate('/companion');
        setTimeout(() => setStepIndex(9), 500);
      } else if (index === 20 && action === ACTIONS.NEXT) {
        // After companion limits warning, navigate to Inspire
        navigate('/inspire');
        setTimeout(() => setStepIndex(21), 500);
      } else if (index === 1 && lifecycle === 'complete') {
        // Wait for check-in submission
        setWaitingForAction(true);
      } else if (index === 7 && lifecycle === 'complete') {
        // Wait for task completion
        setWaitingForAction(true);
      } else if (index === 12 && lifecycle === 'complete') {
        // Wait for habit creation
        setWaitingForAction(true);
      } else if (index === 13 && lifecycle === 'complete') {
        // Wait for habit completion (evolution will trigger automatically)
        setWaitingForAction(true);
      } else {
        setStepIndex(nextStepIndex);
      }
    }
  }, [navigate]);

  if (!user) return null;

  return (
    <Joyride
      steps={WALKTHROUGH_STEPS}
      run={run}
      stepIndex={stepIndex}
      callback={handleJoyrideCallback}
      continuous
      showProgress
      showSkipButton
      disableOverlayClose
      disableCloseOnEsc
      hideCloseButton
      styles={{
        options: {
          primaryColor: 'hsl(var(--primary))',
          textColor: 'hsl(var(--foreground))',
          backgroundColor: 'hsl(var(--card))',
          overlayColor: 'rgba(0, 0, 0, 0.7)',
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
        buttonSkip: {
          color: 'hsl(var(--muted-foreground))',
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip Tutorial',
      }}
    />
  );
};
