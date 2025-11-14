import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { QuoteCard } from "@/components/QuoteCard";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Quotes = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: quotes, isLoading, refetch } = useQuery({
    queryKey: ["quotes", selectedCategory, searchTerm],
    queryFn: async () => {
      let query = supabase.from("quotes").select("*").order("created_at", { ascending: false });

      if (selectedCategory) {
        query = query.eq("category", selectedCategory);
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

  const categories = ["self-love", "confidence", "healing", "motivation", "growth", "gratitude"];

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
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="font-display text-4xl text-warm-charcoal mb-2 text-center">
          Quotes & Affirmations
        </h1>
        <p className="text-warm-charcoal/70 text-center mb-8">
          Daily wisdom for your journey
        </p>

        {/* Search */}
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

        {/* Category filters */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full whitespace-nowrap transition-all ${
              selectedCategory === null
                ? "bg-gradient-to-r from-blush-rose to-soft-mauve text-white shadow-soft"
                : "bg-white/50 text-warm-charcoal/70 hover:bg-white/80"
            }`}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full whitespace-nowrap capitalize transition-all ${
                selectedCategory === category
                  ? "bg-gradient-to-r from-blush-rose to-soft-mauve text-white shadow-soft"
                  : "bg-white/50 text-warm-charcoal/70 hover:bg-white/80"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Quotes grid */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blush-rose" />
          </div>
        ) : quotes && quotes.length > 0 ? (
          <div className="space-y-4">
            {quotes.map((quote) => (
              <QuoteCard
                key={quote.id}
                id={quote.id}
                text={quote.text}
                author={quote.author}
                isPremium={quote.is_premium}
                isFavorited={favorites?.includes(quote.id)}
                onFavoriteChange={() => refetch()}
              />
            ))}
          </div>
        ) : (
          <p className="text-center text-warm-charcoal/60 py-12">
            No quotes found
          </p>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Quotes;
