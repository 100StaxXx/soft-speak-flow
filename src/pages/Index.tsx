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
import { MessageCircle, Target, Calendar } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { PageTransition, SlideUp } from "@/components/PageTransition";
import { OnboardingTour } from "@/components/OnboardingTour";

const Index = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { isTransitioning } = useTheme();
  const navigate = useNavigate();
  const [showIntro, setShowIntro] = useState(() => {
    return !sessionStorage.getItem('hasVisitedHome');
  });
  const [hasActiveHabits, setHasActiveHabits] = useState(false);

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
    <PageTransition>
      <OnboardingTour />
      <div className="min-h-screen bg-background pb-20">
          {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Home
            </h1>
            <p className="text-sm text-muted-foreground">Your daily motivation hub</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* Proactive Nudges */}
          <MentorNudges />

          {/* Morning Check-in */}
          <SlideUp delay={0.1}>
            <MorningCheckIn />
          </SlideUp>

          {/* Today's Pep Talk */}
          <SlideUp delay={0.2}>
            <div data-tour="daily-content">
              <TodaysPepTalk />
            </div>
          </SlideUp>

          {/* Quote of the Day */}
          <SlideUp delay={0.3}>
            <QuoteOfTheDay />
          </SlideUp>

          {/* Weekly Insights */}
          <WeeklyInsights />

          {/* Mentor Quick Chat */}
          <SlideUp delay={0.4}>
            <MentorQuickChat />
          </SlideUp>

          {/* Activity Timeline */}
          <SlideUp delay={0.5}>
            <div data-tour="activity-feed">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-primary" />
                <h2 className="font-bold text-lg">Your Journey</h2>
              </div>
              <ActivityTimeline />
            </div>
          </SlideUp>

          {/* Quick Actions */}
          <SlideUp delay={0.6}>
            <div className="grid grid-cols-2 gap-4">
              <Card 
                className="p-6 cursor-pointer hover:shadow-glow transition-all hover:scale-105"
                onClick={() => navigate("/habits")}
              >
                <div className="flex flex-col items-center text-center space-y-3">
                  <Target className="h-8 w-8 text-primary" />
                  <div>
                    <h3 className="font-bold">Habits</h3>
                    <p className="text-xs text-muted-foreground">
                      {hasActiveHabits ? "Track your progress" : "Start building"}
                    </p>
                  </div>
                </div>
              </Card>

              <Card 
                className="p-6 cursor-pointer hover:shadow-glow transition-all hover:scale-105"
                onClick={() => navigate("/mentor-chat")}
              >
                <div className="flex flex-col items-center text-center space-y-3">
                  <MessageCircle className="h-8 w-8 text-primary" />
                  <div>
                    <h3 className="font-bold">Chat</h3>
                    <p className="text-xs text-muted-foreground">Talk to your mentor</p>
                  </div>
                </div>
              </Card>
            </div>
          </SlideUp>

        </div>

        {/* Bottom Navigation */}
        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default Index;
