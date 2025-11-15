import { useEffect, useState } from "react";
import { getRandomQuote } from "@/utils/quoteSelector";
import { Loader2 } from "lucide-react";

interface LoadingQuoteProps {
  message?: string;
}

export const LoadingQuote = ({ message = "Loading..." }: LoadingQuoteProps) => {
  const [quote, setQuote] = useState<{ text: string; author: string | null } | null>(null);

  useEffect(() => {
    const loadQuote = async () => {
      const randomQuote = await getRandomQuote();
      if (randomQuote) {
        setQuote({ text: randomQuote.text, author: randomQuote.author });
      }
    };
    loadQuote();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] px-6">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-8" />
      <p className="text-lg text-muted-foreground mb-6">{message}</p>
      {quote && (
        <div className="max-w-md text-center">
          <blockquote className="border-l-4 border-primary pl-4 italic text-foreground/80">
            "{quote.text}"
            {quote.author && (
              <footer className="text-sm text-muted-foreground mt-2 not-italic">
                — {quote.author}
              </footer>
            )}
          </blockquote>
        </div>
      )}
    </div>
  );
};
