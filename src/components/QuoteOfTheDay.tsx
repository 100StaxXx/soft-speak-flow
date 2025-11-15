import { useEffect, useState } from "react";
import { getQuoteOfTheDay } from "@/utils/quoteSelector";
import { QuoteImageGenerator } from "@/components/QuoteImageGenerator";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";

export const QuoteOfTheDay = () => {
  const { profile } = useProfile();
  const [quote, setQuote] = useState<{
    id: string;
    text: string;
    author: string | null;
    category: string | null;
    intensity: string | null;
    emotional_triggers: string[] | null;
  } | null>(null);

  useEffect(() => {
    const loadQuote = async () => {
      const dailyQuote = await getQuoteOfTheDay();
      if (dailyQuote) {
        setQuote(dailyQuote);
      }
    };
    loadQuote();
  }, []);

  if (!quote) return null;

  // Determine category based on user's mentor tags or default to quote category
  const displayCategory = profile?.selected_mentor_id 
    ? quote.category || "motivation"
    : quote.category || "motivation";

  const displayIntensity = quote.intensity || "moderate";

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/80 border-2 border-primary/20">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="font-heading text-xl font-bold text-foreground">
          Quote of the Day
        </h2>
      </div>
      
      <div className="space-y-4">
        <blockquote className="border-l-4 border-primary pl-4 py-2">
          <p className="text-lg italic text-foreground/90 leading-relaxed mb-2">
            "{quote.text}"
          </p>
          {quote.author && (
            <footer className="text-sm text-muted-foreground">
              — {quote.author}
            </footer>
          )}
        </blockquote>

        <QuoteImageGenerator
          quoteText={quote.text}
          author={quote.author}
          category={displayCategory}
          intensity={displayIntensity}
          emotionalTrigger={quote.emotional_triggers?.[0]}
        />
      </div>
    </Card>
  );
};
