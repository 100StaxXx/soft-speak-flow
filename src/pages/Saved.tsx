import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { PepTalkCard } from "@/components/PepTalkCard";
import { QuoteCard } from "@/components/QuoteCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Heart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Saved = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: favorites, isLoading, refetch } = useQuery({
    queryKey: ["all-favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by content type and fetch full content
      const grouped = {
        pep_talks: [] as any[],
        quotes: [] as any[],
      };

      for (const fav of data || []) {
        if (fav.content_type === "pep_talk") {
          const { data: content } = await supabase
            .from("pep_talks")
            .select("*")
            .eq("id", fav.content_id)
            .single();
          if (content) grouped.pep_talks.push(content);
        } else if (fav.content_type === "quote") {
          const { data: content } = await supabase
            .from("quotes")
            .select("*")
            .eq("id", fav.content_id)
            .single();
          if (content) grouped.quotes.push(content);
        }
      }

      return grouped;
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-glow via-petal-pink/20 to-lavender-mist/30 pb-24">
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="text-center py-12">
            <Heart className="h-16 w-16 text-blush-rose/40 mx-auto mb-4" />
            <h2 className="font-display text-3xl text-warm-charcoal mb-4">
              Sign in to save favorites
            </h2>
            <p className="text-warm-charcoal/70 mb-8">
              Create an account to save your favorite content
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
          Saved
        </h1>
        <p className="text-warm-charcoal/70 text-center mb-8">
          Your favorite content
        </p>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blush-rose" />
          </div>
        ) : (
          <Tabs defaultValue="pep_talks" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="pep_talks">Audio</TabsTrigger>
              <TabsTrigger value="videos">Videos</TabsTrigger>
              <TabsTrigger value="quotes">Quotes</TabsTrigger>
              <TabsTrigger value="playlists">Playlists</TabsTrigger>
            </TabsList>

            <TabsContent value="pep_talks" className="space-y-4">
              {favorites?.pep_talks && favorites.pep_talks.length > 0 ? (
                favorites.pep_talks.map((talk) => (
                  <PepTalkCard
                    key={talk.id}
                    id={talk.id}
                    title={talk.title}
                    category={talk.category}
                    description={talk.description}
                    isPremium={talk.is_premium}
                  />
                ))
              ) : (
                <p className="text-center text-warm-charcoal/60 py-12">
                  No saved pep talks yet
                </p>
              )}
            </TabsContent>

            <TabsContent value="quotes" className="space-y-4">
              {favorites?.quotes && favorites.quotes.length > 0 ? (
                favorites.quotes.map((quote) => (
                  <QuoteCard
                    key={quote.id}
                    quote={quote}
                    isFavorited={true}
                    onFavoriteChange={() => refetch()}
                  />
                ))
              ) : (
                <p className="text-center text-warm-charcoal/60 py-12">
                  No saved quotes yet
                </p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Saved;
