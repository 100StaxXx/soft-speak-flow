import { useEffect, useState, memo } from "react";
import { useProfile } from "@/hooks/useProfile";
import { format } from "date-fns";
import { loadMentorImage } from "@/utils/mentorImageLoader";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";
import { getMentor } from "@/lib/firebase/mentors";
import { getQuotes } from "@/lib/firebase/quotes";

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

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.selected_mentor_id) {
        setLoading(false);
        return;
      }

      const today = format(new Date(), 'yyyy-MM-dd');

      // Get mentor details
      const mentorData = await getDocument("mentors", profile.selected_mentor_id);

      if (!mentorData) {
        setLoading(false);
        return;
      }

      setMentor({
        name: mentorData.name,
        avatar_url: mentorData.avatar_url || null,
        slug: mentorData.slug
      });
      
      // Dynamically load only the needed mentor image
      const imageUrl = mentorData.avatar_url || await loadMentorImage(mentorData.slug || 'darius');
      setMentorImageUrl(imageUrl);

      // Get today's pep talk to find related quote
      const dailyPepTalks = await getDocuments("daily_pep_talks", [
        ["for_date", "==", today],
        ["mentor_slug", "==", mentorData.slug]
      ]);

      const dailyPepTalk = dailyPepTalks.length > 0 ? dailyPepTalks[0] : null;

      if (dailyPepTalk) {
        // Fetch quotes that match the pep talk's themes
        const filters: Array<[string, any, any]> = [];
        
        if (dailyPepTalk.topic_category) {
          filters.push(["category", "==", dailyPepTalk.topic_category]);
        }
        
        const quotes = await getDocuments("quotes", filters.length > 0 ? filters : undefined, undefined, undefined, 10);
        
        if (quotes && quotes.length > 0) {
          // If we have emotional triggers, try to find a matching quote
          const triggers = dailyPepTalk.emotional_triggers || [];
          const matchingQuote = quotes.find((q: any) => 
            q.emotional_triggers?.some((t: string) => triggers.includes(t))
          ) || quotes[0];
          
          setTodaysQuote(matchingQuote);
        }
      }
      
      setLoading(false);
    };

    fetchData();
  }, [profile?.selected_mentor_id]);

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
