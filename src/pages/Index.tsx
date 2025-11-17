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
            <MentorNudges />
            <MorningCheckIn />
            <TodaysPepTalk />

            {/* Secondary Content - Collapsible */}
            <details className="group" open>
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <span className="font-medium text-sm">More insights</span>
                  <svg className="h-5 w-5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </summary>
              <div className="mt-4 space-y-6">
                <QuoteOfTheDay />
                <WeeklyInsights />
                <ActivityTimeline />
              </div>
            </details>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-6 hover:shadow-lg transition-all cursor-pointer group" onClick={() => navigate('/habits')}>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <CheckCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Habits</h3>
                    <p className="text-sm text-muted-foreground">
                      {hasActiveHabits ? 'Track progress' : 'Get started'}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 hover:shadow-lg transition-all cursor-pointer group" onClick={() => navigate('/mentor-chat')}>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <MessageSquare className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Chat</h3>
                    <p className="text-sm text-muted-foreground">Ask anything</p>
                  </div>
                </div>
              </Card>

              <MentorQuickChat />
            </div>
          </div>
        </div>
      </PageTransition>
      <BottomNav />
    </>
  );
};

export default Index;
