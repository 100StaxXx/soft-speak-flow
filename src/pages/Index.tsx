import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useCompanion } from "@/hooks/useCompanion";
import { IntroScreen } from "@/components/IntroScreen";
import { BottomNav } from "@/components/BottomNav";
import { useTheme } from "@/contexts/ThemeContext";
import { PageTransition } from "@/components/PageTransition";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { QuoteOfTheDay } from "@/components/QuoteOfTheDay";
import { MentorQuickChat } from "@/components/MentorQuickChat";
import { TodaysPepTalk } from "@/components/TodaysPepTalk";
import { MorningCheckIn } from "@/components/MorningCheckIn";
import { MentorNudges } from "@/components/MentorNudges";
import { OnboardingTour } from "@/components/OnboardingTour";
import { OnboardingFlow } from "@/components/OnboardingFlow";

const Index = () => {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { companion, isLoading: companionLoading } = useCompanion();
  const { isTransitioning } = useTheme();
  const navigate = useNavigate();
  const [showIntro, setShowIntro] = useState(() => {
    return !localStorage.getItem('hasSeenIntro');
  });
  const [hasActiveHabits, setHasActiveHabits] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    localStorage.setItem('hasSeenIntro', 'true');
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const checkHabits = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("habits")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1);
      setHasActiveHabits(!!data && data.length > 0);
    };
    checkHabits();
  }, [user]);

  // Wait for all critical data to load before marking ready
  useEffect(() => {
    if (!user) return;
    
    // Wait for both profile and companion to finish loading
    if (!profileLoading && !companionLoading) {
      setIsReady(true);
    }
  }, [user, profileLoading, companionLoading]);

  // Show intro first, before any checks
  if (showIntro) {
    return <IntroScreen onComplete={() => setShowIntro(false)} />;
  }

  // Check for incomplete onboarding and redirect (only after data is ready)
  useEffect(() => {
    if (!user || !isReady) return;
    
    // Check localStorage first to avoid race conditions with profile updates
    const onboardingComplete = localStorage.getItem('onboardingComplete') === 'true';
    
    if (profile && !onboardingComplete) {
      // If onboarding is not complete or user has no mentor, redirect to onboarding
      if (!profile.onboarding_completed || !profile.selected_mentor_id) {
        navigate("/onboarding");
      }
    }
  }, [user, isReady, profile, navigate]);

  // Show loading state while critical data loads
  if (isTransitioning || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground">
            {isTransitioning ? "Switching mentor..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  // Simple loading fallback
  const ComponentLoader = () => <div className="h-20" />;

  return (
    <>
      <ErrorBoundary>
        <OnboardingFlow 
          open={showOnboarding} 
          onComplete={() => {
            setShowOnboarding(false);
          }} 
        />
      </ErrorBoundary>
      <PageTransition>
        <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-accent/10 pb-24 sm:pb-24">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 py-5 sm:py-7 md:py-9 space-y-4 sm:space-y-6 md:space-y-8">
            {/* Header */}
            <div className="mb-3 sm:mb-4 md:mb-6">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-heading font-black bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent mb-2">
                Mentor
              </h1>
              <p className="text-xs sm:text-sm md:text-base text-muted-foreground">Your personal growth journey starts here</p>
            </div>

            {/* Priority Content */}
            <ErrorBoundary>
              <MentorNudges />
            </ErrorBoundary>
            
            <ErrorBoundary>
              <MorningCheckIn />
            </ErrorBoundary>
            
            <div data-tour="todays-pep-talk">
              <ErrorBoundary>
                <TodaysPepTalk />
              </ErrorBoundary>
            </div>

            <ErrorBoundary>
              <QuoteOfTheDay />
            </ErrorBoundary>
            
            <div data-tour="ask-mentor">
              <ErrorBoundary>
                <MentorQuickChat />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </PageTransition>
      <BottomNav />
      <ErrorBoundary>
        <OnboardingTour />
      </ErrorBoundary>
    </>
  );
};

export default Index;
