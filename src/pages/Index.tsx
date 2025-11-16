import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { IntroScreen } from "@/components/IntroScreen";
import { AudioPlayer } from "@/components/AudioPlayer";
import { BottomNav } from "@/components/BottomNav";
import { PepTalkCard } from "@/components/PepTalkCard";
import { QuoteOfTheDay } from "@/components/QuoteOfTheDay";
import { AskMentorChat } from "@/components/AskMentorChat";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, MessageCircle, Target } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";

const Index = () => {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { isTransitioning } = useTheme();
  const navigate = useNavigate();
  const [mentor, setMentor] = useState<any>(null);
  const [dailyPepTalk, setDailyPepTalk] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(() => {
    return !sessionStorage.getItem('hasVisitedHome');
  });
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    sessionStorage.setItem('hasVisitedHome', 'true');
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    const timer = setTimeout(() => {
      setIsInitializing(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!user || profileLoading) {
      fetchGeneralContent();
      return;
    }

    fetchContent();
  }, [user, profile, profileLoading]);

  const fetchGeneralContent = async () => {
    try {
      const { data: pepTalks } = await supabase
        .from("pep_talks")
        .select("*")
        .eq("is_featured", true)
        .limit(1)
        .single();
      
      if (pepTalks) setDailyPepTalk(pepTalks);
    } catch (error) {
      console.error("Error fetching content:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContent = async () => {
    try {
      setLoading(true);

      if (profile?.selected_mentor_id) {
        const { data: mentorData } = await supabase
          .from("mentors")
          .select("*")
          .eq("id", profile.selected_mentor_id)
          .single();

        if (mentorData) setMentor(mentorData);
      }

      // Fetch today's pep talk for this mentor
      const today = new Date().toISOString().split('T')[0];
      const { data: dailyTalk } = await supabase
        .from("daily_pep_talks")
        .select("*")
        .eq("for_date", today)
        .eq("mentor_slug", mentor?.slug || "default")
        .single();

      if (dailyTalk) {
        setDailyPepTalk(dailyTalk);
      } else {
        // Fallback to any featured pep talk
        const { data: pepTalk } = await supabase
          .from("pep_talks")
          .select("*")
          .eq("is_featured", true)
          .limit(1)
          .single();
        
        if (pepTalk) setDailyPepTalk(pepTalk);
      }

    } catch (error) {
      console.error("Error fetching content:", error);
      toast.error("Failed to load content");
    } finally {
      setLoading(false);
    }
  };

  if (showIntro) {
    return <IntroScreen onComplete={() => setShowIntro(false)} />;
  }

  if (loading || isTransitioning || isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading your experience...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background overflow-auto pb-24">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="font-heading text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Welcome Back
          </h1>
          {mentor && (
            <p className="text-muted-foreground">
              Your mentor {mentor.name} is here for you
            </p>
          )}
        </div>

        {/* Daily Pep Talk */}
        {dailyPepTalk && (
          <Card className="p-6 space-y-4 bg-gradient-to-br from-card via-card to-accent/5 border-border/50 shadow-elegant">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-heading text-xl font-bold">Today's Pep Talk</h2>
            </div>
            <PepTalkCard
              id={dailyPepTalk.id}
              title={dailyPepTalk.title}
              category={dailyPepTalk.topic_category?.[0] || dailyPepTalk.category || "Motivation"}
              description={dailyPepTalk.summary || dailyPepTalk.description}
              quote={dailyPepTalk.script || dailyPepTalk.quote}
              isPremium={false}
              onClick={() => navigate(`/pep-talk/${dailyPepTalk.id}`)}
            />
            {dailyPepTalk.audio_url && (
              <div className="pt-4">
                <AudioPlayer
                  audioUrl={dailyPepTalk.audio_url}
                  title={dailyPepTalk.title}
                />
              </div>
            )}
          </Card>
        )}

        {/* Quote of the Day */}
        <Card className="p-6 space-y-4 bg-gradient-to-br from-card via-card to-primary/5 border-border/50 shadow-elegant">
          <QuoteOfTheDay />
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Card 
            className="p-6 cursor-pointer hover:shadow-glow transition-all duration-300 hover:scale-105"
            onClick={() => navigate("/inspire")}
          >
            <div className="space-y-2 text-center">
              <Sparkles className="h-8 w-8 mx-auto text-primary" />
              <h3 className="font-heading font-bold">Get Inspired</h3>
              <p className="text-sm text-muted-foreground">Browse quotes & pep talks</p>
            </div>
          </Card>

          <Card 
            className="p-6 cursor-pointer hover:shadow-glow transition-all duration-300 hover:scale-105"
            onClick={() => navigate("/habits")}
          >
            <div className="space-y-2 text-center">
              <Target className="h-8 w-8 mx-auto text-accent" />
              <h3 className="font-heading font-bold">My Habits</h3>
              <p className="text-sm text-muted-foreground">Track your progress</p>
            </div>
          </Card>
        </div>

        {/* Ask Mentor */}
        {mentor && (
          <Card className="p-6 space-y-4 bg-gradient-to-br from-card via-card to-secondary/5 border-border/50 shadow-elegant">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-accent" />
              <h2 className="font-heading text-xl font-bold">Ask Your Mentor</h2>
            </div>
            <AskMentorChat mentorName={mentor.name} mentorTone={mentor.tone_description} />
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Index;
