import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { PlaylistCard } from "@/components/PlaylistCard";
import { Loader2 } from "lucide-react";

const Playlists = () => {
  const { data: playlists, isLoading } = useQuery({
    queryKey: ["playlists"],
    queryFn: async () => {
      const { data: playlistsData, error: playlistsError } = await supabase
        .from("playlists")
        .select("*")
        .order("created_at", { ascending: false });

      if (playlistsError) throw playlistsError;

      // Get item counts for each playlist
      const playlistsWithCounts = await Promise.all(
        (playlistsData || []).map(async (playlist) => {
          const { count } = await supabase
            .from("playlist_items")
            .select("*", { count: "exact", head: true })
            .eq("playlist_id", playlist.id);

          return {
            ...playlist,
            itemCount: count || 0,
          };
        })
      );

      return playlistsWithCounts;
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-glow via-petal-pink/20 to-lavender-mist/30 pb-24">
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="font-display text-4xl text-warm-charcoal mb-2 text-center">
          Playlists
        </h1>
        <p className="text-warm-charcoal/70 text-center mb-8">
          Curated collections for every mood
        </p>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blush-rose" />
          </div>
        ) : playlists && playlists.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {playlists.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
              />
            ))}
          </div>
        ) : (
          <p className="text-center text-warm-charcoal/60 py-12">
            No playlists yet
          </p>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Playlists;
