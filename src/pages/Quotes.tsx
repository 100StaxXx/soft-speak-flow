import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { QuoteCard } from "@/components/QuoteCard";
import { QuoteImageGenerator } from "@/components/QuoteImageGenerator";
import { FloatingBubbles } from "@/components/FloatingBubbles";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";

const Quotes = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBubble, setSelectedBubble] = useState<string | null>(null);
  const [bubbleType, setBubbleType] = useState<"trigger" | "category" | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleBubbleClick = (value: string, type: "trigger" | "category") => {
    if (selectedBubble === value) {
      // Deselect if clicking the same bubble
      setSelectedBubble(null);
      setBubbleType(null);
    } else {
      setSelectedBubble(value);
      setBubbleType(type);
    }
  };

  const { data: quotes, isLoading, refetch } = useQuery({
    queryKey: ["quotes", selectedBubble, bubbleType, searchTerm],
    queryFn: async () => {
      let query = supabase.from("quotes").select("*").order("created_at", { ascending: false });

      if (selectedBubble && bubbleType === "category") {
        query = query.eq("category", selectedBubble);
      }

      if (selectedBubble && bubbleType === "trigger") {
        query = query.contains("emotional_triggers", [selectedBubble]);
      }

      if (searchTerm) {
        query = query.or(`text.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Get user's favorites
  const { data: favorites } = useQuery({
    queryKey: ["quote-favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("favorites")
        .select("content_id")
        .eq("user_id", user!.id)
        .eq("content_type", "quote");

      return data?.map((f) => f.content_id) || [];
    },
  });

  const handleClearSelection = () => {
    setSelectedBubble(null);
    setBubbleType(null);
    setSearchTerm("");
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-glow via-petal-pink/20 to-lavender-mist/30 pb-24">
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="text-center py-12">
            <h2 className="font-display text-3xl text-warm-charcoal mb-4">
              Sign in to explore quotes
            </h2>
            <p className="text-warm-charcoal/70 mb-8">
              Create an account to save your favorite quotes and affirmations
            </p>
            <Button
              onClick={() => navigate("/auth")}
              className="bg-gradient-to-r from-blush-rose to-soft-mauve hover:opacity-90 text-white font-medium px-8 py-6 rounded-3xl shadow-soft"
            >
              Sign In
            </Button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-glow via-petal-pink/20 to-lavender-mist/30 pb-24">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-2">
          <h1 className="font-display text-4xl text-warm-charcoal text-center">
            Quotes & Affirmations
          </h1>
        </div>
        <p className="text-warm-charcoal/70 text-center mb-8">
          Daily wisdom for your journey
        </p>

        {/* Floating Bubbles */}
        <FloatingBubbles 
          onBubbleClick={handleBubbleClick}
          selectedValue={selectedBubble}
        />

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-warm-charcoal/40" />
          <Input
            type="text"
            placeholder="Search quotes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 border-petal-pink/30 focus:border-blush-rose rounded-3xl py-6"
          />
        </div>

        {/* Active Selection & Results Count */}
        {!isLoading && quotes && (
          <div className="mb-4 flex items-center justify-between">
            <div>
              {selectedBubble && (
                <p className="text-sm text-blush-rose font-medium mb-1">
                  Showing: {selectedBubble}
                </p>
              )}
              <p className="text-sm text-warm-charcoal/70">
                {quotes.length} {quotes.length === 1 ? "quote" : "quotes"} found
              </p>
            </div>
            {(selectedBubble || searchTerm) && (
              <Button
                onClick={handleClearSelection}
                variant="ghost"
                size="sm"
                className="text-blush-rose hover:bg-blush-rose/10"
              >
                Clear selection
              </Button>
            )}
          </div>
        )}

        {/* Quotes Grid */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blush-rose" />
          </div>
        ) : quotes && quotes.length > 0 ? (
          <div className="space-y-6">
            {quotes.map((quote) => (
              <Card key={quote.id} className="p-6 space-y-4 bg-white/80 backdrop-blur-sm border-petal-pink/20 hover:shadow-lg transition-shadow">
                <QuoteCard
                  quote={quote}
                  isFavorited={favorites?.includes(quote.id)}
                  onFavoriteChange={() => refetch()}
                />
                <QuoteImageGenerator
                  quoteText={quote.text}
                  author={quote.author}
                  category={quote.category || (bubbleType === "category" ? selectedBubble : null) || "motivation"}
                  intensity={quote.intensity || "moderate"}
                  emotionalTrigger={
                    quote.emotional_triggers?.[0] || (bubbleType === "trigger" ? selectedBubble : undefined) || undefined
                  }
                />
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Sparkles className="h-16 w-16 text-blush-rose/40 mx-auto mb-4" />
            <p className="text-warm-charcoal/60 mb-2 font-medium">No quotes found</p>
            <p className="text-sm text-warm-charcoal/50 mb-4">
              Try selecting a different bubble or adjusting your search
            </p>
            {(selectedBubble || searchTerm) && (
              <Button
                onClick={handleClearSelection}
                variant="outline"
                className="border-blush-rose/30 hover:bg-blush-rose/10"
              >
                Clear selection
              </Button>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Quotes;
