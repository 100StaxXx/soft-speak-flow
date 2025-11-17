import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { SkeletonQuote } from "@/components/SkeletonCard";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Quote, Sparkles } from "lucide-react";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";

interface Quote {
  id: string;
  text: string;
  author: string | null;
  category: string | null;
}

export const QuoteOfTheDay = () => {
  const { profile } = useProfile();
  const personality = useMentorPersonality();
  const [todaysQuote, setTodaysQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTodaysQuote = async () => {
      if (!profile?.selected_mentor_id) return;

      const today = new Date().toISOString().split("T")[0];

      // Get mentor details
      const { data: mentor } = await supabase
        .from("mentors")
        .select("slug")
        .eq("id", profile.selected_mentor_id)
        .single();

      if (!mentor) {
        setLoading(false);
        return;
      }

      // Get today's pep talk to find related quote
      const { data: dailyPepTalk } = await supabase
        .from("daily_pep_talks")
        .select("emotional_triggers, topic_category")
        .eq("for_date", today)
        .eq("mentor_slug", mentor.slug)
        .single();

      if (dailyPepTalk) {
        // Fetch a quote that matches the pep talk's themes
        const { data: quote } = await supabase
          .from("quotes")
          .select("*")
          .or(`emotional_triggers.ov.{${dailyPepTalk.emotional_triggers?.join(',') || ''}},category.eq.${dailyPepTalk.topic_category}`)
          .limit(1)
          .single();

        if (quote) {
          setTodaysQuote(quote);
        }
      }
      
      setLoading(false);
    };

    fetchTodaysQuote();
  }, [profile?.selected_mentor_id]);

  if (loading) return <SkeletonQuote />;
  if (!todaysQuote) return null;

  return (
    <Card className="relative overflow-hidden group animate-fade-in">
      {/* Cinematic Background */}
      <div className="absolute inset-0 bg-gradient-to-bl from-accent/20 via-accent/10 to-background opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-accent/30 via-transparent to-transparent opacity-40" />
      
      {/* Animated Glow */}
      <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-accent/20 blur-3xl rounded-full animate-pulse" />
      
      <div className="relative p-6">
        <div className="flex items-start gap-4">
          {/* Quote Icon */}
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 bg-accent/30 blur-md rounded-full animate-pulse" />
            <div className="relative p-3 bg-gradient-to-br from-accent/30 to-accent/10 rounded-full border border-accent/20">
              <Quote className="h-6 w-6 text-accent" />
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1 space-y-3 pt-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-accent animate-pulse" />
              <h3 className="text-xs font-medium text-accent uppercase tracking-wider">
                {personality?.name ? `${personality.name}'s Pick` : "Quote of the Day"}
              </h3>
            </div>
            
            <blockquote className="relative">
              <p className="text-lg font-medium italic leading-relaxed bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                "{todaysQuote.text}"
              </p>
            </blockquote>
            
            {todaysQuote.author && (
              <p className="text-sm text-muted-foreground font-medium">
                — {todaysQuote.author}
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
