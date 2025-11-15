import { useEffect, useState } from "react";
import { fetchContextualQuotes, getRandomQuote } from "@/utils/quoteSelector";

interface QuoteDisplayProps {
  category?: string;
  emotionalTriggers?: string[];
  mentorId?: string;
  intensity?: string;
  className?: string;
  variant?: "default" | "minimal" | "card";
  random?: boolean;
}

export const QuoteDisplay = ({
  category,
  emotionalTriggers,
  mentorId,
  intensity,
  className = "",
  variant = "default",
  random = false,
}: QuoteDisplayProps) => {
  const [quote, setQuote] = useState<{
    text: string;
    author: string | null;
  } | null>(null);

  useEffect(() => {
    const loadQuote = async () => {
      if (random) {
        const randomQuote = await getRandomQuote();
        if (randomQuote) {
          setQuote({ text: randomQuote.text, author: randomQuote.author });
        }
      } else {
        const quotes = await fetchContextualQuotes({
          category,
          emotionalTriggers,
          mentorId,
          intensity,
          limit: 1,
        });
        if (quotes.length > 0) {
          setQuote({ text: quotes[0].text, author: quotes[0].author });
        }
      }
    };

    loadQuote();
  }, [category, emotionalTriggers, mentorId, intensity, random]);

  if (!quote) return null;

  if (variant === "minimal") {
    return (
      <div className={`text-sm italic text-muted-foreground ${className}`}>
        "{quote.text}"
        {quote.author && <span className="block mt-1 text-xs">— {quote.author}</span>}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className={`bg-card border border-border rounded-xl p-6 ${className}`}>
        <p className="text-base md:text-lg font-medium leading-relaxed italic mb-3">
          "{quote.text}"
        </p>
        {quote.author && (
          <p className="text-sm text-muted-foreground">— {quote.author}</p>
        )}
      </div>
    );
  }

  return (
    <blockquote className={`border-l-4 border-primary pl-4 ${className}`}>
      <p className="text-base italic mb-2">"{quote.text}"</p>
      {quote.author && (
        <footer className="text-sm text-muted-foreground">— {quote.author}</footer>
      )}
    </blockquote>
  );
};
