import { useEffect, useState, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useCompanion } from "@/hooks/useCompanion";
import { IntroScreen } from "@/components/IntroScreen";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/contexts/ThemeContext";
import { PageTransition } from "@/components/PageTransition";
import { LoadingQuote } from "@/components/LoadingQuote";
import { AppWalkthrough } from "@/components/AppWalkthrough";
import { InspireSection } from "@/components/InspireSection";

// Lazy load heavy components
const QuoteOfTheDay = lazy(() => import("@/components/QuoteOfTheDay").then(m => ({ default: m.QuoteOfTheDay })));
const MentorQuickChat = lazy(() => import("@/components/MentorQuickChat").then(m => ({ default: m.MentorQuickChat })));
const TodaysPepTalk = lazy(() => import("@/components/TodaysPepTalk").then(m => ({ default: m.TodaysPepTalk })));
const MorningCheckIn = lazy(() => import("@/components/MorningCheckIn").then(m => ({ default: m.MorningCheckIn })));
const MentorNudges = lazy(() => import("@/components/MentorNudges").then(m => ({ default: m.MentorNudges })));
const OnboardingTour = lazy(() => import("@/components/OnboardingTour").then(m => ({ default: m.OnboardingTour })));
const OnboardingFlow = lazy(() => import("@/components/OnboardingFlow").then(m => ({ default: m.OnboardingFlow })));

const Index = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { companion, isLoading: companionLoading } = useCompanion();
  const { isTransitioning } = useTheme();
  const navigate = useNavigate();
  const [showIntro, setShowIntro] = useState(() => {
    return !sessionStorage.getItem('hasVisitedHome');
  });
  const [hasActiveHabits, setHasActiveHabits] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    sessionStorage.setItem('hasVisitedHome', 'true');
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

  // Only redirect to onboarding if user has no mentor selected
  useEffect(() => {
    if (user && profile && !profile.selected_mentor_id && !companionLoading) {
      navigate("/onboarding");
    }
  }, [user, profile, companionLoading, navigate]);

  if (showIntro) {
    return <IntroScreen onComplete={() => setShowIntro(false)} />;
  }

  if (isTransitioning) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground">Switching mentor...</p>
        </div>
      </div>
    );
  }

  // Loading fallback component
  const ComponentLoader = () => (
    <Card className="p-4 animate-pulse">
      <div className="h-20 bg-muted/50 rounded" />
    </Card>
  );

  return (
    <>
      <Suspense fallback={<ComponentLoader />}>
        <OnboardingFlow 
          open={showOnboarding} 
          onComplete={() => {
            setShowOnboarding(false);
          }} 
        />
      </Suspense>
      <PageTransition>
        <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-accent/10 pb-24">
          <div className="max-w-4xl mx-auto px-4 py-7 md:py-9 space-y-6 md:space-y-8">
            {/* Header */}
            <div className="mb-4 md:mb-6">
              <h1 className="text-3xl md:text-4xl font-heading font-black bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent mb-2">
                Mentor
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">Your personal growth journey starts here</p>
            </div>

            {/* Priority Content - Load with Suspense for better UX */}
            <Suspense fallback={<ComponentLoader />}>
              <MentorNudges />
            </Suspense>
            
            <Suspense fallback={<ComponentLoader />}>
              <MorningCheckIn />
            </Suspense>
            
            {/* Today's Pep Talk */}
            <div data-tour="todays-pep-talk">
              <Suspense fallback={<ComponentLoader />}>
                <TodaysPepTalk />
              </Suspense>
            </div>

            <Suspense fallback={<ComponentLoader />}>
              <QuoteOfTheDay />
            </Suspense>
            
            <div data-tour="ask-mentor">
              <Suspense fallback={<ComponentLoader />}>
                <MentorQuickChat />
              </Suspense>
            </div>

            {/* Inspire Section - Browse by category and emotion */}
            <Suspense fallback={<ComponentLoader />}>
              <InspireSection />
            </Suspense>
          </div>
        </div>
      </PageTransition>
      <BottomNav />
      <Suspense fallback={null}>
        <OnboardingTour />
      </Suspense>
      <AppWalkthrough />
    </>
  );
};

export default Index;
