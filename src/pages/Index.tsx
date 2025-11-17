import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { IntroScreen } from "@/components/IntroScreen";
import { AudioPlayer } from "@/components/AudioPlayer";
import { BottomNav } from "@/components/BottomNav";
import { QuoteOfTheDay } from "@/components/QuoteOfTheDay";
import { AskMentorChat } from "@/components/AskMentorChat";
import { MentorQuickChat } from "@/components/MentorQuickChat";
import { TodaysPepTalk } from "@/components/TodaysPepTalk";
import { MorningCheckIn } from "@/components/MorningCheckIn";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { MentorNudges } from "@/components/MentorNudges";
import { WeeklyInsights } from "@/components/WeeklyInsights";
import { CompanionDisplay } from "@/components/CompanionDisplay";
import { Card } from "@/components/ui/card";
import { MessageSquare, CheckCircle } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { PageTransition, SlideUp } from "@/components/PageTransition";
import { OnboardingTour } from "@/components/OnboardingTour";
import { OnboardingFlow } from "@/components/OnboardingFlow";

const Index = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
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

  useEffect(() => {
    // Show onboarding if user has mentor but hasn't completed the feature tour
    const hasSeenOnboarding = localStorage.getItem('onboardingFlowCompleted');
    if (user && profile?.selected_mentor_id && !hasSeenOnboarding) {
      setTimeout(() => setShowOnboarding(true), 1000);
    }
  }, [user, profile]);

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

  return (
    <>
      <OnboardingFlow 
        open={showOnboarding} 
        onComplete={() => {
          setShowOnboarding(false);
          localStorage.setItem('onboardingFlowCompleted', 'true');
        }} 
      />
      <PageTransition>
        <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-accent/10 pb-24">
          <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent mb-2">
                Home
              </h1>
              <p className="text-muted-foreground">Your personal growth journey starts here</p>
            </div>

            {/* Priority Content */}
            <CompanionDisplay />
            <MentorNudges />
            <MorningCheckIn />
            <TodaysPepTalk />

            <QuoteOfTheDay />
            <MentorQuickChat />
          </div>
        </div>
      </PageTransition>
      <BottomNav />
    </>
  );
};

export default Index;
