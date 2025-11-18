import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Sparkles, RefreshCw } from "lucide-react";
import { EMOTIONAL_TRIGGERS, TOPIC_CATEGORIES } from "@/config/categories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export const InspireSection = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);

  // Fetch matching quotes from database
  const { data: matchingQuotes, isLoading } = useQuery({
    queryKey: ['inspire-quotes', selectedCategory, selectedTrigger],
    queryFn: async () => {
      let query = supabase
        .from('quotes')
        .select('*');

      if (selectedCategory) {
        query = query.eq('category', selectedCategory);
      }

      if (selectedTrigger) {
        query = query.contains('emotional_triggers', [selectedTrigger]);
      }

      const { data, error } = await query.limit(20);
      
      if (error) throw error;
      return data || [];
    },
  });

  const getNextQuote = () => {
    if (!matchingQuotes || matchingQuotes.length === 0) {
      toast.error("No quotes found for this combination");
      return;
    }

    // Cycle to next quote
    setCurrentQuoteIndex((prev) => (prev + 1) % matchingQuotes.length);
  };

  const currentQuote = matchingQuotes?.[currentQuoteIndex];


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
          disabled={isLoading || !matchingQuotes || matchingQuotes.length === 0}
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

        {!isLoading && matchingQuotes && matchingQuotes.length === 0 && (
          <Card className="p-6 text-center bg-muted/50">
            <p className="text-sm text-muted-foreground">
              No quotes found for this combination. Try different filters!
            </p>
          </Card>
        )}
      </div>
    </Card>
  );
};
