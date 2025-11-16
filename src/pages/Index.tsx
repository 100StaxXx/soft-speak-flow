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
import { MoodSelector } from "@/components/MoodSelector";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, MessageCircle, Target, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

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
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);

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

        {/* Daily Pep Talk - Top of page with expandable transcript */}
        {dailyPepTalk && (
          <Card className="p-6 space-y-4 bg-gradient-to-br from-primary/10 via-card to-accent/10 border-primary/20 shadow-glow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                <h2 className="font-heading text-2xl font-bold">Today&apos;s Pep Talk</h2>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-heading text-xl font-semibold mb-2">{dailyPepTalk.title}</h3>
                <p className="text-sm text-primary font-medium mb-3">
                  {dailyPepTalk.topic_category?.[0] || dailyPepTalk.category || "Motivation"}
                </p>
                {dailyPepTalk.summary && (
                  <p className="text-muted-foreground">{dailyPepTalk.summary}</p>
                )}
              </div>

              {/* Audio Player */}
              {dailyPepTalk.audio_url && (
                <div className="py-2">
                  <AudioPlayer
                    audioUrl={dailyPepTalk.audio_url}
                    title={dailyPepTalk.title}
                  />
                </div>
              )}

              {/* Expandable Transcript */}
              {dailyPepTalk.script && (
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsTranscriptExpanded(!isTranscriptExpanded)}
                    className="w-full flex items-center justify-between hover:bg-primary/10"
                  >
                    <span className="font-medium">Read Transcript</span>
                    {isTranscriptExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>

                  <div 
                    className={cn(
                      "overflow-hidden transition-all duration-300 ease-in-out",
                      isTranscriptExpanded ? "max-h-[600px] opacity-100" : "max-h-24 opacity-70"
                    )}
                  >
                    <div className="bg-background/50 backdrop-blur-sm rounded-lg p-4 border border-border/50">
                      <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">
                        {dailyPepTalk.script}
                      </p>
                    </div>
                  </div>

                  {!isTranscriptExpanded && dailyPepTalk.script.length > 200 && (
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
                  )}
                </div>
              )}

              <Button 
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
                onClick={() => navigate(`/pep-talk/${dailyPepTalk.id}`)}
              >
                View Full Details
              </Button>
            </div>
          </Card>
        )}

        {/* Quote of the Day */}
        <Card className="p-6 space-y-4 bg-gradient-to-br from-card via-card to-primary/5 border-border/50 shadow-elegant">
          <QuoteOfTheDay />
        </Card>

        {/* Journal & Mood */}
        <MoodSelector />

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
