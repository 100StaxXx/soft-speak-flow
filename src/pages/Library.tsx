import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, Download, Clock, Quote, Headphones, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { PepTalkCard } from "@/components/PepTalkCard";
import { QuoteCard } from "@/components/QuoteCard";
import { toast } from "sonner";
import { PageTransition } from "@/components/PageTransition";
import { StarfieldBackground } from "@/components/StarfieldBackground";

type LibraryTab = "favorites" | "downloads" | "history";

export default function Library() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<LibraryTab>("favorites");

  // Fetch favorites
  const { data: favorites, isLoading: loadingFavorites } = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from("favorites")
        .select(`
          id,
          content_type,
          content_id,
          created_at
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch downloads
  const { data: downloads, isLoading: loadingDownloads } = useQuery({
    queryKey: ["downloads", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from("downloads")
        .select(`
          id,
          content_type,
          content_id,
          created_at
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch quote favorites with quote details
  const { data: favoriteQuotes } = useQuery({
    queryKey: ["favorite-quotes", favorites],
    enabled: !!favorites && favorites.filter(f => f.content_type === "quote").length > 0,
    queryFn: async () => {
      const quoteIds = favorites?.filter(f => f.content_type === "quote").map(f => f.content_id) || [];
      if (quoteIds.length === 0) return [];

      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .in("id", quoteIds);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch pep talk favorites with details
  const { data: favoritePepTalks } = useQuery({
    queryKey: ["favorite-pep-talks", favorites],
    enabled: !!favorites && favorites.filter(f => f.content_type === "pep_talk").length > 0,
    queryFn: async () => {
      const pepTalkIds = favorites?.filter(f => f.content_type === "pep_talk").map(f => f.content_id) || [];
      if (pepTalkIds.length === 0) return [];

      const { data, error } = await supabase
        .from("pep_talks")
        .select("*")
        .in("id", pepTalkIds);

      if (error) throw error;
      return data || [];
    },
  });

  const handleRemoveFavorite = async (favoriteId: string) => {
    try {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("id", favoriteId);

      if (error) throw error;
      toast.success("Removed from favorites");
    } catch (error) {
      toast.error("Failed to remove favorite");
      console.error(error);
    }
  };

  return (
    <PageTransition>
      <StarfieldBackground />
      <div className="min-h-screen pb-nav-safe pt-safe relative z-10">
        <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/profile")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="font-heading text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            My Library
          </h1>
          <p className="text-muted-foreground text-lg mt-2">
            Your saved content and history
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LibraryTab)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8 bg-card/50 backdrop-blur-xl border border-border/50">
            <TabsTrigger value="favorites" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground">
              <Heart className="h-4 w-4 mr-2" />
              Favorites
            </TabsTrigger>
            <TabsTrigger value="downloads" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground">
              <Download className="h-4 w-4 mr-2" />
              Downloads
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground">
              <Clock className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Favorites Tab */}
          <TabsContent value="favorites" className="space-y-6">
            {loadingFavorites ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : favorites && favorites.length > 0 ? (
              <>
                {/* Favorite Quotes */}
                {favoriteQuotes && favoriteQuotes.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Quote className="h-5 w-5 text-primary" />
                      <h2 className="text-xl font-semibold">Quotes</h2>
                    </div>
                    <div className="grid gap-4">
                      {favoriteQuotes.map((quote) => (
                        <QuoteCard
                          key={quote.id}
                          quote={{
                            id: quote.id,
                            text: quote.text,
                            author: quote.author || "Unknown",
                            is_premium: quote.is_premium || false
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Favorite Pep Talks */}
                {favoritePepTalks && favoritePepTalks.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Headphones className="h-5 w-5 text-primary" />
                      <h2 className="text-xl font-semibold">Pep Talks</h2>
                    </div>
                    <div className="grid gap-4">
                      {favoritePepTalks.map((pepTalk) => (
                        <PepTalkCard
                          key={pepTalk.id}
                          id={pepTalk.id}
                          title={pepTalk.title}
                          category={pepTalk.category}
                          quote={pepTalk.quote}
                          description={pepTalk.description}
                          isPremium={pepTalk.is_premium || false}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Card className="p-12 text-center bg-card/50 backdrop-blur-sm border-border/50">
                <Heart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No favorites yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start favoriting quotes and pep talks to build your collection
                </p>
                <Button onClick={() => navigate("/inspire")}>
                  Explore Content
                </Button>
              </Card>
            )}
          </TabsContent>

          {/* Downloads Tab */}
          <TabsContent value="downloads" className="space-y-6">
            {loadingDownloads ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : downloads && downloads.length > 0 ? (
              <div className="space-y-4">
                {downloads.map((download) => (
                  <Card key={download.id} className="p-4 bg-card/50 backdrop-blur-sm border-border/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium capitalize">{download.content_type}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(download.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Download className="h-5 w-5 text-primary" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center bg-card/50 backdrop-blur-sm border-border/50">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Download className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">No downloads yet</h3>
                    <p className="text-muted-foreground text-sm">
                      Download pep talks and quotes for offline access. Your downloaded content will appear here.
                    </p>
                  </div>
                  <Button onClick={() => navigate("/pep-talks")} className="mt-4">
                    <Headphones className="h-4 w-4 mr-2" />
                    Browse Pep Talks
                  </Button>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card className="p-12 text-center bg-card/50 backdrop-blur-sm border-border/50">
              <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
              <p className="text-muted-foreground">
                View your content history and recently played items
              </p>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </div>

      <BottomNav />
    </PageTransition>
  );
}
