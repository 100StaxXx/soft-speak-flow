import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
}

const WALKTHROUGH_STEPS: TutorialStep[] = [
  {
    id: "home-checkin",
    title: "Welcome to Your Journey!",
    content: "Let's start with your morning check-in. This helps you reflect on your current state and set intentions for the day.",
    action: "Click 'Got It' to begin your check-in. Select a mood and enter your daily intention.",
    illustration: "👋",
  },
  {
    id: "xp-celebration",
    title: "You Earned XP!",
    content: "Nice! You just earned +5 XP for completing your check-in. XP helps your companion grow and evolve.",
    action: "Tap the Companion tab at the bottom to meet your companion.",
    illustration: "🎉",
  },
  {
    id: "companion-intro",
    title: "Meet Your Companion",
    content: "This is your companion! They'll grow and evolve as you earn XP by completing quests and building habits. Your companion is a reflection of your personal growth.",
    action: "Tap the Quests tab at the bottom to create your first quest.",
    illustration: "✨",
  },
  {
    id: "tasks-create-quest",
    title: "Create Your First Quest",
    content: "Quests are your daily goals. Completing them earns XP and helps your companion evolve. Let's create your very first quest!",
    action: "Create a quest with any name and difficulty, then complete it to trigger your companion's first evolution!",
    illustration: "✍️",
  },
];

const STEP_INDEX = {
  HOME_CHECKIN: 0,
  XP_CELEBRATION: 1,
  COMPANION_VIEW: 2,
  QUEST_CREATION: 3,
} as const;

const DELAYS = {
  POST_CHECKIN_CONFETTI: 1500,
  POST_NAV: 1000, // Delay after navigation tab click
} as const;

const TIMEOUTS = {
  EVOLUTION_COMPLETE: 15000, // 15 seconds fallback if evolution doesn't complete
  EVOLUTION_FALLBACK_DELAY: 500, // Small delay before fallback timer
} as const;

const SCROLL_LOCK_CLASS = 'walkthrough-scroll-locked';

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

  // Cleanup on unmount - clear timers and localStorage if walkthrough is still active
  useEffect(() => {
    return () => {
      clearAllTimers();
      
      // If walkthrough is still active on unmount, clean up localStorage
      // This handles cases where user navigates away during tutorial
      if (run && localStorage.getItem('appWalkthroughActive')) {
        console.log('[Tutorial] Cleaning up walkthrough state on unmount');
        localStorage.removeItem('appWalkthroughActive');
        window.dispatchEvent(new CustomEvent('tutorial-step-change', { 
          detail: { step: null } 
        }));
      }
    };
  }, [run, clearAllTimers]);

  const currentStep = WALKTHROUGH_STEPS[stepIndex];
  
  // Get mentor slug with improved validation - memoized to prevent changes during walkthrough
  const mentorSlug = useMemo(() => {
    if (!profile?.selected_mentor_id) return 'atlas';
    
    const mentorId = profile.selected_mentor_id.toLowerCase();
    
    // Known mentor slugs
    const validSlugs = ['atlas', 'darius', 'eli', 'kai', 'lumi', 'nova', 'sienna', 'solace', 'stryker'];
    
    // If it's a known slug, use it
    if (validSlugs.includes(mentorId)) {
      return mentorId;
    }
    
    // Otherwise default to atlas
    return 'atlas';
  }, [profile?.selected_mentor_id]);

  const advanceStep = useCallback(() => {
    setStepIndex((prevIndex) => {
      if (prevIndex < WALKTHROUGH_STEPS.length - 1) {
        const newStepIndex = prevIndex + 1;
        setShowModal(true);
        // Dispatch event for other components to track tutorial progress
        window.dispatchEvent(new CustomEvent('tutorial-step-change', { 
          detail: { step: newStepIndex } 
        }));
        return newStepIndex;
      }
      return prevIndex;
    });
  }, []);

  // Check walkthrough status once on mount and set state
  useEffect(() => {
    if (!user || !session) return;

    let isMounted = true;

    const checkStatus = async () => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_data')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('[AppWalkthrough] Error fetching walkthrough status:', error);
          // Default to not completed on error
          if (isMounted) {
            setIsWalkthroughCompleted(false);
          }
          return;
        }

        const walkthroughData = profile?.onboarding_data as OnboardingData | null;
        const completed = walkthroughData?.walkthrough_completed === true;
        
        // Only update state if component is still mounted
        if (isMounted) {
          setIsWalkthroughCompleted(completed);
          
          // Dispatch ready event for other components
          window.dispatchEvent(new CustomEvent('walkthrough-ready', { 
            detail: { shouldRun: !completed } 
          }));
        }
      } catch (error) {
        console.error('[AppWalkthrough] Unexpected error checking walkthrough status:', error);
        if (isMounted) {
          setIsWalkthroughCompleted(false);
        }
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
    };
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
      
      // Set localStorage flag to indicate walkthrough is active
      localStorage.setItem('appWalkthroughActive', 'true');
      
      setStepIndex(0);
      setShowModal(true);
      setRun(true);
      
      // Dispatch initial step event
      window.dispatchEvent(new CustomEvent('tutorial-step-change', { 
        detail: { step: 0 } 
      }));
    };

    window.addEventListener('onboarding-complete', handleOnboardingComplete, { once: true });
    return () => {
      // Listener is automatically removed by { once: true }
    };
  }, [user, session, isWalkthroughCompleted]);

  // Lock scrolling during entire walkthrough
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const html = document.documentElement;
    const body = document.body;

    if (run) {
      console.log('[Tutorial] Locking scroll - walkthrough active');
      // Lock both body and html to prevent all scrolling
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      console.log('[Tutorial] Unlocking scroll - walkthrough inactive');
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [run]);

  // Step 0: Listen for check-in completion (user dismissed modal and completed check-in)
  useEffect(() => {
    if (stepIndex !== STEP_INDEX.HOME_CHECKIN || !run) return;

    try {
      let hasAdvanced = false;
      
      const handleCheckInComplete = () => {
        if (hasAdvanced) return;
        hasAdvanced = true;
        console.log('[Tutorial] Check-in completed, advancing to XP celebration step');
        createTrackedTimeout(() => {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
          setShowModal(true);
          advanceStep();
        }, DELAYS.POST_CHECKIN_CONFETTI);
      };

      window.addEventListener('checkin-complete', handleCheckInComplete, { once: true });
      return () => {
        window.removeEventListener('checkin-complete', handleCheckInComplete);
      };
    } catch (error) {
      console.error('[Tutorial] Error setting up check-in completion listener:', error);
    }
  }, [stepIndex, run, advanceStep, createTrackedTimeout]);

  // Auto-scroll target elements into view when modal is dismissed
  useEffect(() => {
    if (showModal || !run) return;

    const scrollTargetIntoView = () => {
      let targetSelector: string | null = null;

      switch (stepIndex) {
        case STEP_INDEX.XP_CELEBRATION:
          targetSelector = 'a[href="/companion"]';
          break;
        case STEP_INDEX.COMPANION_VIEW:
          targetSelector = 'a[href="/tasks"]';
          break;
        case STEP_INDEX.QUEST_CREATION:
          // Scroll to the main content area of tasks page
          targetSelector = 'main';
          break;
      }

      if (targetSelector) {
        const element = document.querySelector(targetSelector);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          console.log('[Tutorial] Scrolled target element into view:', targetSelector);
        }
      }
    };

    // Small delay to ensure DOM is ready after modal dismissal
    createTrackedTimeout(scrollTargetIntoView, 300);
  }, [stepIndex, showModal, run, createTrackedTimeout]);

  // Step 1: Listen for companion tab click
  useEffect(() => {
    if (stepIndex !== STEP_INDEX.XP_CELEBRATION || !run) return;

    try {
      let hasAdvanced = false;
      const navCompanion = document.querySelector('a[href="/companion"]');
      
      if (!navCompanion) {
        console.warn('[Tutorial] Companion navigation link not found');
        return;
      }
      
      const handleNavClick = () => {
        if (hasAdvanced) return;
        hasAdvanced = true;
        createTrackedTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'instant' });
          advanceStep();
        }, DELAYS.POST_NAV);
      };

      navCompanion.addEventListener('click', handleNavClick, { once: true });
      
      return () => {
        // Listener is automatically removed by { once: true }
      };
    } catch (error) {
      console.error('[Tutorial] Error setting up companion nav listener:', error);
    }
  }, [stepIndex, run, advanceStep, createTrackedTimeout]);

  // Step 2: Listen for tasks/quests tab click
  useEffect(() => {
    if (stepIndex !== STEP_INDEX.COMPANION_VIEW || !run) return;

    try {
      let hasAdvanced = false;
      const navTasks = document.querySelector('a[href="/tasks"]');
      
      if (!navTasks) {
        console.warn('[Tutorial] Tasks navigation link not found');
        return;
      }
      
      const handleNavClick = () => {
        if (hasAdvanced) return;
        hasAdvanced = true;
        createTrackedTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'instant' });
          advanceStep();
        }, DELAYS.POST_NAV);
      };

      navTasks.addEventListener('click', handleNavClick, { once: true });
      
      return () => {
        // Listener is automatically removed by { once: true }
      };
    } catch (error) {
      console.error('[Tutorial] Error setting up tasks nav listener:', error);
    }
  }, [stepIndex, run, advanceStep, createTrackedTimeout]);

  // Step 3: Set callback for when evolution completes
  useEffect(() => {
    if (stepIndex !== STEP_INDEX.QUEST_CREATION) {
      setOnEvolutionComplete(null);
      return;
    }

    let hasHandledLoading = false;
    let hasCompleted = false;
    let fallbackTimeoutId: number | null = null;
    
    const handleEvolutionLoadingStart = () => {
      if (hasHandledLoading) return;
      hasHandledLoading = true;
      console.log('[Tutorial] Evolution loading started, hiding modal.');
      setShowModal(false);
      setRun(false);
      
      // Set fallback timeout in case evolution never completes
      fallbackTimeoutId = createTrackedTimeout(() => {
        if (!hasCompleted) {
          console.warn('[Tutorial] Evolution timeout - showing completion button as fallback');
          setRun(false);
          setShowModal(false);
          setShowCompletionButton(true);
        }
      }, TIMEOUTS.EVOLUTION_COMPLETE) as number;
    };

    setOnEvolutionComplete(() => () => {
      if (hasCompleted) return;
      hasCompleted = true;
      console.log('[Tutorial] Evolution completion callback triggered!');
      
      // Clear fallback timeout if evolution completed successfully
      if (fallbackTimeoutId) {
        clearTimeout(fallbackTimeoutId);
      }
      
      setRun(false);
      setShowModal(false);
      setShowCompletionButton(true);
    });

    window.addEventListener('evolution-loading-start', handleEvolutionLoadingStart, { once: true });
    
    return () => {
      // Listener is automatically removed by { once: true }
      setOnEvolutionComplete(null);
      
      // Clean up fallback timeout on unmount
      if (fallbackTimeoutId) {
        clearTimeout(fallbackTimeoutId);
      }
    };
  }, [stepIndex, setOnEvolutionComplete, createTrackedTimeout]);

  const [isSaving, setIsSaving] = useState(false);
  
  const handleWalkthroughComplete = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    console.log('[Tutorial] Tutorial completed');
    setRun(false);
    
    // Clear localStorage flag
    localStorage.removeItem('appWalkthroughActive');
    
    // Clear tutorial step event
    window.dispatchEvent(new CustomEvent('tutorial-step-change', { 
      detail: { step: null } 
    }));
    
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
