import { useEffect, useState, memo } from "react";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { loadMentorImage } from "@/utils/mentorImageLoader";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";
import { getResolvedMentorId } from "@/utils/mentor";

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

export const HeroQuoteBanner = memo(() => {
  const { profile } = useProfile();
  const [todaysQuote, setTodaysQuote] = useState<QuoteData | null>(null);
  const [mentor, setMentor] = useState<Mentor | null>(null);
  const [mentorImageUrl, setMentorImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const resolvedMentorId = getResolvedMentorId(profile);

  useEffect(() => {
    const fetchData = async () => {
      if (!resolvedMentorId) {
        setLoading(false);
        return;
      }

      const today = format(new Date(), 'yyyy-MM-dd');

      // Get mentor details
      const { data: mentorData } = await supabase
        .from("mentors")
        .select("name, avatar_url, slug")
        .eq("id", resolvedMentorId)
        .maybeSingle();

      if (!mentorData) {
        setLoading(false);
        return;
      }

      setMentor(mentorData);
      
      // Dynamically load only the needed mentor image
      const imageUrl = mentorData.avatar_url || await loadMentorImage(mentorData.slug || 'darius');
      setMentorImageUrl(imageUrl);

      // Get today's pep talk to find related quote
      const { data: dailyPepTalk } = await supabase
        .from("daily_pep_talks")
        .select("emotional_triggers, topic_category")
        .eq("for_date", today)
        .eq("mentor_slug", mentorData.slug)
        .maybeSingle();

      if (dailyPepTalk) {
        // Fetch a quote that matches the pep talk's themes
        // Build the query safely - first try matching by category, then fall back
        let quoteQuery = supabase.from("quotes").select("*");
        
        if (dailyPepTalk.topic_category) {
          quoteQuery = quoteQuery.eq("category", dailyPepTalk.topic_category);
        }
        
        const { data: quotes } = await quoteQuery.limit(10);
        
        if (quotes && quotes.length > 0) {
          // If we have emotional triggers, try to find a matching quote
          const triggers = dailyPepTalk.emotional_triggers || [];
          const matchingQuote = quotes.find(q => 
            q.emotional_triggers?.some((t: string) => triggers.includes(t))
          ) || quotes[0];
          
          setTodaysQuote(matchingQuote);
        }
      }
      
      setLoading(false);
    };

    fetchData();
  }, [resolvedMentorId]);

  if (loading || !todaysQuote || !mentor || !mentorImageUrl) return null;

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Mentor Background Image - Dimmed */}
      <div className="absolute inset-0">
        <img
          src={mentorImageUrl}
          alt={mentor.name}
          className="w-full h-full object-cover object-center"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-background/80" />
      </div>

      {/* Quote Content */}
      <div className="relative h-full flex items-end justify-end p-8 md:p-12">
        <blockquote className="max-w-2xl text-right">
          <p className="font-serif italic text-xl md:text-2xl lg:text-3xl text-foreground/70 leading-relaxed">
            "{todaysQuote.text}"
          </p>
          {todaysQuote.author && (
            <footer className="mt-4 font-serif italic text-base md:text-lg text-foreground/60">
              — {todaysQuote.author}
            </footer>
          )}
        </blockquote>
      </div>
    </div>
  );
});
