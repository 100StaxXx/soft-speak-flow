import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Sparkles, RefreshCw } from "lucide-react";
import { EMOTIONAL_TRIGGERS, TOPIC_CATEGORIES } from "@/config/categories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const InspireSection = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [matchingQuotes, setMatchingQuotes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Reset results when filters change so next click fetches fresh set
  useEffect(() => {
    setMatchingQuotes([]);
    setCurrentQuoteIndex(0);
  }, [selectedCategory, selectedTrigger]);

  const getNextQuote = async () => {
    // If we already have quotes, just cycle to the next one
    if (matchingQuotes.length > 0) {
      setCurrentQuoteIndex((prev) => (prev + 1) % matchingQuotes.length);
      return;
    }

    setIsLoading(true);

    const fetchQuotes = async (
      useCategory: boolean,
      useTrigger: boolean,
      requireAuthor = true
    ) => {
      let query = supabase
        .from('quotes')
        .select('*');

      if (requireAuthor) {
        query = query.not('author', 'is', null);
      }

      if (useCategory && selectedCategory) {
        query = query.eq('category', selectedCategory);
      }
      if (useTrigger && selectedTrigger) {
        query = query.contains('emotional_triggers', [selectedTrigger]);
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data || [];
    };
    try {
      // Try exact match first
      let data = await fetchQuotes(true, true);
      let fellBack = false;

      // Fall back to category only
      if (!data.length && selectedCategory) {
        fellBack = true;
        data = await fetchQuotes(true, false);
      }
      // Fall back to trigger only
      if (!data.length && selectedTrigger) {
        fellBack = true;
        data = await fetchQuotes(false, true);
      }
      // Fall back to any recent quotes with authors
      if (!data.length) {
        fellBack = true;
        data = await fetchQuotes(false, false);
      }
      // Last resort: ignore author requirement
      if (!data.length) {
        fellBack = true;
        data = await fetchQuotes(false, false, false);
      }

      if (!data.length) {
        toast.error("No quotes found. Try different filters.");
        return;
      }

      if (fellBack) {
        toast.info("Showing the closest matches we found.");
      }

      setMatchingQuotes(data);
      setCurrentQuoteIndex(0);
    } catch (error) {
      console.error('Error fetching quotes:', error);
      toast.error("Failed to fetch quotes");
    } finally {
      setIsLoading(false);
    }
  };

  const currentQuote = matchingQuotes[currentQuoteIndex];

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-heading font-black text-xl">Inspire</h3>
            <p className="text-sm text-muted-foreground">
              Get a personalized quote for how you're feeling
            </p>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="space-y-4">
          {/* Emotional Triggers */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              How are you feeling?
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={!selectedTrigger ? "default" : "outline"}
                className="cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setSelectedTrigger(null)}
              >
                Any
              </Badge>
              {EMOTIONAL_TRIGGERS.map((trigger) => (
                <Badge
                  key={trigger}
                  variant={selectedTrigger === trigger ? "default" : "outline"}
                  className="cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setSelectedTrigger(trigger)}
                >
                  {trigger}
                </Badge>
              ))}
            </div>
          </div>

          {/* Topic Categories */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              What do you need?
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={!selectedCategory ? "default" : "outline"}
                className="cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setSelectedCategory(null)}
              >
                All Topics
              </Badge>
              {TOPIC_CATEGORIES.map((cat) => (
                <Badge
                  key={cat.value}
                  variant={selectedCategory === cat.value ? "default" : "outline"}
                  className="cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setSelectedCategory(cat.value)}
                >
                  {cat.label}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Get Quote Button */}
        <Button
          onClick={getNextQuote}
          disabled={isLoading}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              {currentQuote ? 'Next Quote' : 'Get Quote'}
            </>
          )}
        </Button>

        {/* Quote Display */}
        {currentQuote && (
          <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-lg font-medium leading-relaxed italic mb-2">
                    "{currentQuote.text}"
                  </p>
                  {currentQuote.author && (
                    <p className="text-sm text-muted-foreground">
                      — {currentQuote.author}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {selectedTrigger && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedTrigger}
                  </Badge>
                )}
                {selectedCategory && (
                  <Badge variant="secondary" className="text-xs">
                    {TOPIC_CATEGORIES.find(c => c.value === selectedCategory)?.label}
                  </Badge>
                )}
              </div>
            </div>
          </Card>
        )}

      </div>
    </Card>
  );
};
