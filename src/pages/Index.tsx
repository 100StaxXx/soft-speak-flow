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
import { useMentorPersonality } from "@/hooks/useMentorPersonality";
import { Play, MessageCircle } from "lucide-react";

const Index = () => {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { companion, isLoading: companionLoading } = useCompanion();
  const { isTransitioning } = useTheme();
  const personality = useMentorPersonality();
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

  // Show intro first, before any checks
  if (showIntro) {
    return <IntroScreen onComplete={() => setShowIntro(false)} />;
  }

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
        <div className="min-h-screen bg-gradient-to-br from-[#E8F5E9] via-[#F3E5F5] to-[#E1F5FE] dark:from-background dark:via-background/95 dark:to-accent/10 pb-24 sm:pb-24">
          {/* Hero Banner */}
          <div className="relative overflow-hidden bg-gradient-to-r from-[#66BB6A] via-[#AB47BC] to-[#7E57C2] dark:from-primary/60 dark:via-accent/60 dark:to-primary/40 px-6 py-12 mb-6">
            {/* Sparkles Background */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-[10%] left-[15%] w-3 h-3 bg-white/60 rounded-full animate-sparkle" />
              <div className="absolute top-[25%] right-[20%] w-2 h-2 bg-white/70 rounded-full animate-sparkle" style={{ animationDelay: '0.5s' }} />
              <div className="absolute bottom-[30%] left-[30%] w-2.5 h-2.5 bg-white/50 rounded-full animate-sparkle" style={{ animationDelay: '1s' }} />
              <div className="absolute bottom-[15%] right-[25%] w-2 h-2 bg-white/60 rounded-full animate-sparkle" style={{ animationDelay: '1.5s' }} />
              <div className="absolute top-[40%] right-[40%] w-3 h-3 bg-white/40 rounded-full animate-sparkle" style={{ animationDelay: '0.8s' }} />
            </div>
            
            <div className="relative z-10 text-center space-y-3">
              <h1 className="text-4xl md:text-5xl font-heading font-black text-white drop-shadow-lg animate-bounce-gentle">
                Your Growth Journey Begins
              </h1>
              <p className="text-lg text-white/90 font-medium">Start your adventure with {personality?.name || 'your mentor'}!</p>
            </div>
          </div>

          <div className="max-w-4xl mx-auto px-3 sm:px-4 space-y-6">
            {/* Main Action Tiles */}
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => document.querySelector('[data-tour="todays-pep-talk"]')?.scrollIntoView({ behavior: 'smooth' })}
                className="group bg-gradient-to-br from-[#FFE082] to-[#FFD54F] dark:from-primary/80 dark:to-primary/60 rounded-3xl p-6 shadow-[0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.15)] hover:scale-105 transition-all duration-300"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-white/40 dark:bg-white/20 rounded-full flex items-center justify-center group-hover:animate-bounce">
                    <Play className="w-8 h-8 text-[#F57C00] dark:text-white" fill="currentColor" />
                  </div>
                  <span className="font-bold text-[#F57C00] dark:text-white text-lg">Daily Pep Talk</span>
                </div>
              </button>

              <button 
                onClick={() => navigate('/mentor-chat')}
                className="group bg-gradient-to-br from-[#CE93D8] to-[#BA68C8] dark:from-accent/80 dark:to-accent/60 rounded-3xl p-6 shadow-[0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.15)] hover:scale-105 transition-all duration-300"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-white/40 dark:bg-white/20 rounded-full flex items-center justify-center group-hover:animate-bounce">
                    <MessageCircle className="w-8 h-8 text-[#7B1FA2] dark:text-white" />
                  </div>
                  <span className="font-bold text-[#7B1FA2] dark:text-white text-lg">Ask {personality?.name || 'Mentor'}</span>
                </div>
              </button>
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
