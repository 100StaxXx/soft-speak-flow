import { useEffect, useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Quote, Sparkles } from "lucide-react";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";

interface QuoteData {
  id: string;
  text: string;
  author: string | null;
  category: string | null;
}

interface Mentor {
  name: string;
  avatar_url: string | null;
  slug: string;
}

export const HeroQuoteBanner = () => {
  const { profile } = useProfile();
  const personality = useMentorPersonality();
  const [todaysQuote, setTodaysQuote] = useState<QuoteData | null>(null);
  const [mentor, setMentor] = useState<Mentor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.selected_mentor_id) return;

      const today = new Date().toISOString().split("T")[0];

      // Get mentor details
      const { data: mentorData } = await supabase
        .from("mentors")
        .select("name, avatar_url, slug")
        .eq("id", profile.selected_mentor_id)
        .maybeSingle();

      if (!mentorData) {
        setLoading(false);
        return;
      }

      setMentor(mentorData);

      // Get today's pep talk to find related quote
      const { data: dailyPepTalk } = await supabase
        .from("daily_pep_talks")
        .select("emotional_triggers, topic_category")
        .eq("for_date", today)
        .eq("mentor_slug", mentorData.slug)
        .maybeSingle();

      if (dailyPepTalk) {
        // Fetch a quote that matches the pep talk's themes
        const { data: quote } = await supabase
          .from("quotes")
          .select("*")
          .or(`emotional_triggers.ov.{${dailyPepTalk.emotional_triggers?.join(',') || ''}},category.eq.${dailyPepTalk.topic_category}`)
          .limit(1)
          .maybeSingle();

        if (quote) {
          setTodaysQuote(quote);
        }
      }
      
      setLoading(false);
    };

    fetchData();
  }, [profile?.selected_mentor_id]);

  if (loading || !todaysQuote || !mentor) return null;

  return (
    <div className="relative w-full h-[75vh] min-h-[500px] overflow-hidden rounded-3xl mb-6 shadow-hard">
      {/* Mentor Background Image - Dimmed */}
      {mentor.avatar_url && (
        <div className="absolute inset-0">
          <img 
            src={mentor.avatar_url} 
            alt={mentor.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/60 to-background/90" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50" />
        </div>
      )}

      {/* Animated Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/20 animate-gradient-shift" />
      
      {/* Floating Particles */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-3 h-3 bg-primary/60 rounded-full animate-float-slow" />
        <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-accent/60 rounded-full animate-float-medium" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-1/3 left-1/3 w-2.5 h-2.5 bg-primary/50 rounded-full animate-float-fast" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/3 w-2 h-2 bg-accent/50 rounded-full animate-float-slow" style={{ animationDelay: '1.5s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-3 h-3 bg-primary/40 rounded-full animate-float-medium" style={{ animationDelay: '2s' }} />
      </div>

      {/* Sparkles */}
      <div className="absolute inset-0">
        <Sparkles className="absolute top-20 left-20 h-4 w-4 text-primary/60 animate-sparkle" />
        <Sparkles className="absolute top-1/3 right-32 h-3 w-3 text-accent/60 animate-sparkle" style={{ animationDelay: '0.7s' }} />
        <Sparkles className="absolute bottom-32 left-1/4 h-3 w-3 text-primary/50 animate-sparkle" style={{ animationDelay: '1.4s' }} />
      </div>

      {/* Glow orbs */}
      <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-primary/20 blur-3xl rounded-full animate-pulse-slow" />
      <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-accent/20 blur-3xl rounded-full animate-pulse-slow" style={{ animationDelay: '1.5s' }} />

      {/* Quote Content - Adventurous Layout */}
      <div className="relative h-full flex flex-col items-center justify-center p-6 md:p-12">
        <div className="max-w-4xl w-full space-y-6 md:space-y-8">
          {/* Adventure Badge */}
          <div className="flex justify-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary/30 to-accent/30 backdrop-blur-sm border-2 border-primary/50 shadow-glow">
              <Quote className="h-5 w-5 text-primary" />
              <span className="text-sm font-bold text-foreground uppercase tracking-wider">
                {personality?.name ? `${personality.name}'s Daily Wisdom` : "Quote of the Day"}
              </span>
              <Sparkles className="h-4 w-4 text-accent animate-pulse" />
            </div>
          </div>

          {/* Main Quote - Cinematic Style */}
          <div className="relative animate-fade-in" style={{ animationDelay: '0.2s' }}>
            {/* Decorative corners */}
            <div className="absolute -top-4 -left-4 w-12 h-12 border-t-4 border-l-4 border-primary/60 rounded-tl-2xl" />
            <div className="absolute -top-4 -right-4 w-12 h-12 border-t-4 border-r-4 border-accent/60 rounded-tr-2xl" />
            <div className="absolute -bottom-4 -left-4 w-12 h-12 border-b-4 border-l-4 border-primary/60 rounded-bl-2xl" />
            <div className="absolute -bottom-4 -right-4 w-12 h-12 border-b-4 border-r-4 border-accent/60 rounded-br-2xl" />

            <blockquote className="relative p-8 md:p-12 rounded-2xl bg-gradient-to-br from-background/40 to-background/20 backdrop-blur-xl border-2 border-primary/30 shadow-glow-lg">
              {/* Glow effect behind text */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 animate-pulse-slow rounded-2xl" />
              
              <p className="relative text-2xl md:text-4xl lg:text-5xl font-bold leading-relaxed text-center">
                <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/90 bg-clip-text text-transparent">
                  "{todaysQuote.text}"
                </span>
              </p>
            </blockquote>
          </div>

          {/* Author - Adventure Style */}
          {todaysQuote.author && (
            <div className="flex justify-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="relative px-8 py-4 rounded-full bg-gradient-to-r from-card/60 to-card/40 backdrop-blur-sm border border-border/50 shadow-soft">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 rounded-full" />
                <p className="relative text-lg md:text-xl font-medium text-foreground/90">
                  — {todaysQuote.author}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom fade for content below */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
};
