import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import confetti from "canvas-confetti";
import { useEvolution } from "@/contexts/EvolutionContext";
import { OnboardingData } from "@/types/profile";
import { TutorialModal } from "./TutorialModal";
import { Button } from "./ui/button";

interface TutorialStep {
  id: string;
  title: string;
  content: string;
  action: string;
  illustration: string;
  requiresAction: boolean;
}

const WALKTHROUGH_STEPS: TutorialStep[] = [
  {
    id: "home-checkin",
    title: "Welcome to Your Journey!",
    content: "Let's start with your morning check-in. This helps you reflect on your current state and set intentions for the day.",
    action: "Select how you're feeling right now by clicking a mood button below.",
    illustration: "👋",
    requiresAction: true,
  },
  {
    id: "checkin-intention",
    title: "Set Your Daily Intention",
    content: "What's your main focus for today? Setting an intention gives your day direction and purpose.",
    action: "Enter your intention in the text field and submit the form.",
    illustration: "💭",
    requiresAction: true,
  },
  {
    id: "xp-celebration",
    title: "You Earned XP!",
    content: "Nice! You just earned +5 XP for completing your check-in. XP helps your companion grow and evolve.",
    action: "Tap the Companion tab at the bottom to meet your companion.",
    illustration: "🎉",
    requiresAction: true,
  },
  {
    id: "companion-intro",
    title: "Meet Your Companion",
    content: "This is your companion! They'll grow and evolve as you earn XP by completing quests and building habits. Your companion is a reflection of your personal growth.",
    action: "Tap the Quests tab at the bottom to create your first quest.",
    illustration: "✨",
    requiresAction: true,
  },
  {
    id: "tasks-create-quest",
    title: "Create Your First Quest",
    content: "Quests are your daily goals. Completing them earns XP and helps your companion evolve. Let's create your very first quest!",
    action: "Type 'Start my Journey', select Medium difficulty (10 XP), tap Add Quest, then CHECK IT OFF to trigger your companion's first evolution!",
    illustration: "✍️",
    requiresAction: true,
  },
];

const STEP_INDEX = {
  HOME_CHECKIN: 0,
  CHECKIN_INTENTION: 1,
  XP_CELEBRATION: 2,
  COMPANION_VIEW: 3,
  QUEST_CREATION: 4,
} as const;

const DELAYS = {
  POST_CHECKIN_CONFETTI: 1500,
  POST_NAV: 1000, // Reduced from separate 1500ms delays
  POST_EVOLUTION: 300,
  SCROLL_DELAY: 50,
} as const;

const TIMEOUTS = {
  EVOLUTION_COMPLETE: 15000, // 15 seconds fallback if evolution doesn't complete
  ELEMENT_WAIT: 6000, // Max time to wait for DOM elements
} as const;

export const AppWalkthrough = () => {
  const { user, session } = useAuth();
  const { profile } = useProfile();
  const { setOnEvolutionComplete } = useEvolution();

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [isWalkthroughCompleted, setIsWalkthroughCompleted] = useState<boolean | null>(null);
  const [showCompletionButton, setShowCompletionButton] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Track and clear timeouts & intervals so scheduled actions don't fire after unmount or pause
  const activeTimeouts = useRef<Set<number>>(new Set());
  const activeIntervals = useRef<Set<number>>(new Set());

  const createTrackedTimeout = useCallback((cb: () => void, delay: number) => {
    if (typeof window === 'undefined') return -1;
    const id = window.setTimeout(() => {
      activeTimeouts.current.delete(id);
      try { cb(); } catch (e) { console.warn('tracked timeout callback error', e); }
    }, delay) as unknown as number;
    activeTimeouts.current.add(id);
    return id;
  }, []);

  const clearAllTimers = useCallback(() => {
    activeTimeouts.current.forEach((id) => clearTimeout(id));
    activeTimeouts.current.clear();
    activeIntervals.current.forEach((id) => clearInterval(id));
    activeIntervals.current.clear();
  }, []);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  // waitForSelector using MutationObserver for efficiency
  const waitForSelector = useCallback((selector: string, timeout = TIMEOUTS.ELEMENT_WAIT) => {
    if (typeof window === 'undefined') return Promise.resolve(false);
    if (!selector || selector === 'body') return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      if (document.querySelector(selector)) return resolve(true);
      
      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          // Clear timeout when element found
          if (timeoutId) clearTimeout(timeoutId);
          activeTimeouts.current.delete(timeoutId);
          resolve(true);
        }
      });
      
      observer.observe(document.body, { childList: true, subtree: true });
      
      const timeoutId = window.setTimeout(() => {
        observer.disconnect(); // Ensure observer is disconnected on timeout
        activeTimeouts.current.delete(timeoutId);
        resolve(false);
      }, timeout) as unknown as number;
      
      activeTimeouts.current.add(timeoutId);
    });
  }, []);

  const currentStep = WALKTHROUGH_STEPS[stepIndex];
  
  // Get mentor slug from profile, with better loading state handling
  const getMentorSlug = () => {
    if (!profile) return 'atlas'; // Default while loading
    
    // Try to get from selected_mentor_id
    if (profile.selected_mentor_id) {
      // Extract slug from mentor ID if it's a full ID
      const mentorId = profile.selected_mentor_id;
      // If it's already a slug (lowercase, no UUID), use it
      if (mentorId && !mentorId.includes('-') && mentorId.length < 20) {
        return mentorId;
      }
      // Otherwise it might be a UUID, default to atlas
      return 'atlas';
    }
    
    return 'atlas';
  };
  
  const mentorSlug = getMentorSlug();

  const advanceStep = useCallback(() => {
    if (stepIndex < WALKTHROUGH_STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
      setShowModal(true);
    }
  }, [stepIndex]);

  // Check walkthrough status once on mount and set state
  useEffect(() => {
    if (!user || !session) return;

    const checkStatus = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_data')
        .eq('id', user.id)
        .maybeSingle();

      const walkthroughData = profile?.onboarding_data as OnboardingData | null;
      const completed = walkthroughData?.walkthrough_completed === true;
      
      setIsWalkthroughCompleted(completed);
      
      // Dispatch ready event for other components
      window.dispatchEvent(new CustomEvent('walkthrough-ready', { 
        detail: { shouldRun: !completed } 
      }));
    };

    checkStatus();
  }, [user, session]);

  // Listen for onboarding completion event to start walkthrough
  useEffect(() => {
    if (!user || !session || isWalkthroughCompleted === null) return;
    if (isWalkthroughCompleted) return;

    let hasStarted = false;
    
    const handleOnboardingComplete = () => {
      if (hasStarted) return;
      hasStarted = true;
      console.log('[AppWalkthrough] Onboarding complete, starting walkthrough');
      setStepIndex(0);
      setShowModal(true);
      setRun(true);
    };

    window.addEventListener('onboarding-complete', handleOnboardingComplete, { once: true });
    return () => {
      window.removeEventListener('onboarding-complete', handleOnboardingComplete);
    };
  }, [user, session, isWalkthroughCompleted]);

  // Step 0: Listen for mood selection
  useEffect(() => {
    if (stepIndex !== STEP_INDEX.HOME_CHECKIN || !run || !showModal) return;

    const moodButtons = document.querySelectorAll('[data-tour="checkin-mood"] button');
    let hasAdvanced = false;
    
    const handleMoodClick = () => {
      if (hasAdvanced) return;
      hasAdvanced = true;
      console.log('[Tutorial] Mood selected, advancing to intention step');
      setShowModal(false);
      createTrackedTimeout(() => advanceStep(), 300);
    };

    moodButtons.forEach(btn => btn.addEventListener('click', handleMoodClick));
    return () => {
      moodButtons.forEach(btn => btn.removeEventListener('click', handleMoodClick));
    };
  }, [stepIndex, run, showModal, advanceStep, createTrackedTimeout]);

  // Step 1: Listen for intention submission
  useEffect(() => {
    if (stepIndex !== STEP_INDEX.CHECKIN_INTENTION || !run) return;

    let hasAdvanced = false;
    
    const handleCheckInComplete = () => {
      if (hasAdvanced) return;
      hasAdvanced = true;
      console.log('[Tutorial] Check-in completed, advancing to XP celebration step');
      setShowModal(false);
      createTrackedTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        advanceStep();
      }, DELAYS.POST_CHECKIN_CONFETTI);
    };

    window.addEventListener('checkin-complete', handleCheckInComplete);
    return () => {
      window.removeEventListener('checkin-complete', handleCheckInComplete);
    };
  }, [stepIndex, run, advanceStep, createTrackedTimeout]);

  // Step 2: Listen for companion tab click
  useEffect(() => {
    if (stepIndex !== STEP_INDEX.XP_CELEBRATION || !run) return;

    let hasAdvanced = false;
    
    const handleNavClick = () => {
      if (hasAdvanced) return;
      hasAdvanced = true;
      setShowModal(false);
      createTrackedTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        advanceStep();
      }, DELAYS.POST_NAV);
    };

    const navCompanion = document.querySelector('a[href="/companion"]');
    if (navCompanion) {
      navCompanion.addEventListener('click', handleNavClick);
    }
    
    return () => {
      const navCompanion = document.querySelector('a[href="/companion"]');
      if (navCompanion) {
        navCompanion.removeEventListener('click', handleNavClick);
      }
    };
  }, [stepIndex, run, advanceStep, createTrackedTimeout]);

  // Step 3: Listen for tasks/quests tab click
  useEffect(() => {
    if (stepIndex !== STEP_INDEX.COMPANION_VIEW || !run) return;

    let hasAdvanced = false;
    
    const handleNavClick = () => {
      if (hasAdvanced) return;
      hasAdvanced = true;
      setShowModal(false);
      createTrackedTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        advanceStep();
      }, DELAYS.POST_NAV);
    };

    const navTasks = document.querySelector('a[href="/tasks"]');
    if (navTasks) {
      navTasks.addEventListener('click', handleNavClick);
    }
    
    return () => {
      const navTasks = document.querySelector('a[href="/tasks"]');
      if (navTasks) {
        navTasks.removeEventListener('click', handleNavClick);
      }
    };
  }, [stepIndex, run, advanceStep, createTrackedTimeout]);

  // Step 4: Set callback for when evolution completes
  useEffect(() => {
    if (stepIndex !== STEP_INDEX.QUEST_CREATION) {
      setOnEvolutionComplete(null);
      return;
    }

    let hasHandledLoading = false;
    
    const handleEvolutionLoadingStart = () => {
      if (hasHandledLoading) return;
      hasHandledLoading = true;
      console.log('[Tutorial] Evolution loading started, hiding modal.');
      setShowModal(false);
      setRun(false);
    };

    setOnEvolutionComplete(() => () => {
      console.log('[Tutorial] Evolution completion callback triggered!');
      setRun(false);
      setShowModal(false);
      setShowCompletionButton(true);
    });

    window.addEventListener('evolution-loading-start', handleEvolutionLoadingStart, { once: true });
    
    return () => {
      window.removeEventListener('evolution-loading-start', handleEvolutionLoadingStart);
      setOnEvolutionComplete(null);
    };
  }, [stepIndex, setOnEvolutionComplete]);

  const [isSaving, setIsSaving] = useState(false);
  
  const handleWalkthroughComplete = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    console.log('[Tutorial] Tutorial completed');
    setRun(false);
    
    if (user) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_data')
          .eq('id', user.id)
          .maybeSingle();

        const existingData = (profile?.onboarding_data as OnboardingData) || {};

        const { error } = await supabase
          .from('profiles')
          .update({
            onboarding_data: {
              ...existingData,
              walkthrough_completed: true
            }
          })
          .eq('id', user.id);

        if (error) {
          console.error('[Tutorial] Failed to save walkthrough completion:', error);
          setIsSaving(false);
          const { toast } = await import('@/hooks/use-toast');
          toast({
            title: "Save Failed",
            description: "Failed to save progress. Please try again.",
            variant: "destructive"
          });
          return;
        }

        console.log('[Tutorial] Saved walkthrough_completed to database');
        
        // Only hide button after successful save
        setShowCompletionButton(false);
        
        // Reload the page to start fresh
        window.location.reload();
      } catch (error) {
        console.error('[Tutorial] Error during walkthrough completion:', error);
        setIsSaving(false);
        const { toast } = await import('@/hooks/use-toast');
        toast({
          title: "Error",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive"
        });
      }
    } else {
      // No user - still hide button and reload as fallback
      setShowCompletionButton(false);
      window.location.reload();
    }
  }, [user, isSaving]);

  if (!user) return null;

  return (
    <>
      {/* Tutorial Modal */}
      {showModal && currentStep && (
        <TutorialModal
          step={currentStep}
          currentStep={stepIndex}
          totalSteps={WALKTHROUGH_STEPS.length}
          mentorSlug={mentorSlug}
          onAction={() => setShowModal(false)}
        />
      )}
      {/* Completion Modal */}
      {showCompletionButton && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
          <div className="flex flex-col items-center gap-6 max-w-2xl mx-4">
            <div className="bg-gradient-to-r from-primary/20 to-accent/20 backdrop-blur-sm border-4 border-primary/50 rounded-3xl p-12 shadow-2xl">
              <div className="text-center space-y-4">
                <div className="text-9xl animate-bounce-slow mb-4">🎉</div>
                <h2 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Congratulations!
                </h2>
                <p className="text-2xl leading-relaxed text-foreground">
                  Your companion has evolved to Stage 1! You've learned the basics—now your real journey begins. Complete quests, build habits, and watch your companion grow stronger alongside you.
                </p>
              </div>
            </div>
            <Button
              onClick={handleWalkthroughComplete}
              size="lg"
              disabled={isSaving}
              className="text-xl px-12 py-8 font-bold shadow-2xl hover:shadow-3xl transition-all"
            >
              {isSaving ? 'Saving...' : 'Start Your Journey'}
            </Button>
          </div>
        </div>
      )}
    </>
  );
};
