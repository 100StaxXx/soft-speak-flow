import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { QuoteCard } from "@/components/QuoteCard";
import { QuoteImageGenerator } from "@/components/QuoteImageGenerator";
import { SeedQuotesButton } from "@/components/SeedQuotesButton";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Sparkles, Filter } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { EMOTIONAL_TRIGGERS } from "@/config/categories";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Quotes = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);
  const [selectedIntensity, setSelectedIntensity] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: quotes, isLoading, refetch } = useQuery({
    queryKey: ["quotes", selectedCategory, selectedTrigger, selectedIntensity, searchTerm],
    queryFn: async () => {
      let query = supabase.from("quotes").select("*").order("created_at", { ascending: false });

      if (selectedCategory) {
        query = query.eq("category", selectedCategory);
      }

      if (selectedIntensity) {
        query = query.eq("intensity", selectedIntensity);
      }

      if (selectedTrigger) {
        query = query.contains("emotional_triggers", [selectedTrigger]);
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

  const categories = ["discipline", "confidence", "physique", "focus", "mindset", "business"];
  const intensityLevels = ["gentle", "moderate", "intense"];

  const handleClearFilters = () => {
    setSelectedCategory(null);
    setSelectedTrigger(null);
    setSelectedIntensity(null);
    setSearchTerm("");
  };

  const hasActiveFilters = selectedCategory || selectedTrigger || selectedIntensity || searchTerm;

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
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="font-display text-4xl text-warm-charcoal mb-1">
              Quote Search
            </h1>
            <p className="text-warm-charcoal/70 text-sm">
              Find the perfect quote for your moment
            </p>
          </div>
          <SeedQuotesButton />
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-warm-charcoal/40" />
          <Input
            type="text"
            placeholder="Search by text or author..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 border-petal-pink/30 focus:border-blush-rose rounded-3xl py-6"
          />
        </div>

        {/* Filters Section */}
        <Card className="p-6 mb-6 bg-white/60 backdrop-blur-sm border-petal-pink/20">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-5 w-5 text-blush-rose" />
            <h3 className="font-semibold text-warm-charcoal">Filter Quotes</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Emotional Trigger Filter */}
            <div>
              <label className="text-xs text-warm-charcoal/70 mb-2 block font-medium">
                Emotional State
              </label>
              <Select
                value={selectedTrigger || "all"}
                onValueChange={(value) => setSelectedTrigger(value === "all" ? null : value)}
              >
                <SelectTrigger className="rounded-2xl border-petal-pink/30">
                  <SelectValue placeholder="Any emotion" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All emotions</SelectItem>
                  {EMOTIONAL_TRIGGERS.map((trigger) => (
                    <SelectItem key={trigger} value={trigger}>
                      {trigger}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="text-xs text-warm-charcoal/70 mb-2 block font-medium">
                Category
              </label>
              <Select
                value={selectedCategory || "all"}
                onValueChange={(value) => setSelectedCategory(value === "all" ? null : value)}
              >
                <SelectTrigger className="rounded-2xl border-petal-pink/30">
                  <SelectValue placeholder="Any category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Intensity Filter */}
            <div>
              <label className="text-xs text-warm-charcoal/70 mb-2 block font-medium">
                Intensity
              </label>
              <Select
                value={selectedIntensity || "all"}
                onValueChange={(value) => setSelectedIntensity(value === "all" ? null : value)}
              >
                <SelectTrigger className="rounded-2xl border-petal-pink/30">
                  <SelectValue placeholder="Any intensity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All intensities</SelectItem>
                  {intensityLevels.map((intensity) => (
                    <SelectItem key={intensity} value={intensity}>
                      {intensity.charAt(0).toUpperCase() + intensity.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasActiveFilters && (
            <Button
              onClick={handleClearFilters}
              variant="ghost"
              size="sm"
              className="mt-4 text-blush-rose hover:bg-blush-rose/10"
            >
              Clear all filters
            </Button>
          )}
        </Card>

        {/* Results Count */}
        {!isLoading && quotes && (
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-warm-charcoal/70">
              {quotes.length} {quotes.length === 1 ? "quote" : "quotes"} found
            </p>
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
                  category={quote.category || selectedCategory || "motivation"}
                  intensity={quote.intensity || selectedIntensity || "moderate"}
                  emotionalTrigger={
                    quote.emotional_triggers?.[0] || selectedTrigger || undefined
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
              Try adjusting your filters or search term
            </p>
            {hasActiveFilters && (
              <Button
                onClick={handleClearFilters}
                variant="outline"
                className="border-blush-rose/30 hover:bg-blush-rose/10"
              >
                Clear filters
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
