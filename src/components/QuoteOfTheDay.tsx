import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { SkeletonQuote } from "@/components/SkeletonCard";
import { useProfile } from "@/hooks/useProfile";
import { Quote as QuoteIcon, Sparkles } from "lucide-react";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";
import { format } from "date-fns";
import { getMentor } from "@/lib/firebase/mentors";
import { getQuotes } from "@/lib/firebase/quotes";
import { getDocuments } from "@/lib/firebase/firestore";

interface QuoteData {
  id: string;
  text: string;
  author: string | null;
  category: string | null;
}

export const QuoteOfTheDay = () => {
  const { profile } = useProfile();
  const personality = useMentorPersonality();
  const [todaysQuote, setTodaysQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTodaysQuote = async () => {
      if (!profile?.selected_mentor_id) {
        setLoading(false);
        return;
      }

      const today = format(new Date(), 'yyyy-MM-dd');

      // Get mentor details
      const mentor = await getMentor(profile.selected_mentor_id);
      if (!mentor || !mentor.slug) {
        setLoading(false);
        return;
      }

      // Get today's pep talk to find related quote
      const dailyPepTalks = await getDocuments<{ emotional_triggers?: string[]; topic_category?: string | string[] }>(
        "daily_pep_talks",
        [
          ["for_date", "==", today],
          ["mentor_slug", "==", mentor.slug]
        ],
        undefined,
        undefined,
        1
      );

      const dailyPepTalk = dailyPepTalks[0];
      if (dailyPepTalk) {
        // Fetch quotes
        const quotes = await getQuotes(undefined, 10);
        
        if (quotes && quotes.length > 0) {
          // If we have emotional triggers, try to find a matching quote
          const triggers = dailyPepTalk.emotional_triggers || [];
          const topicCategory = Array.isArray(dailyPepTalk.topic_category) 
            ? dailyPepTalk.topic_category[0] 
            : dailyPepTalk.topic_category;
          
          // Try to find a matching quote by category or triggers
          const matchingQuote = quotes.find(q => {
            // Note: quotes might not have emotional_triggers field in Firestore
            // This is a simplified matching - you may need to adjust based on your schema
            return true; // For now, just return first quote
          }) || quotes[0];
          
          setTodaysQuote({
            id: matchingQuote.id,
            text: matchingQuote.quote,
            author: matchingQuote.author || null,
            category: topicCategory || null,
          });
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
              <QuoteIcon className="h-6 w-6 text-accent" />
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
