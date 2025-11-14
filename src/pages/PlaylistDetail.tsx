import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play } from "lucide-react";
import { PremiumBadge } from "@/components/PremiumBadge";
import { useProfile } from "@/hooks/useProfile";
import { Loader2 } from "lucide-react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { VideoPlayer } from "@/components/VideoPlayer";

const PlaylistDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();

  const { data: playlist, isLoading: playlistLoading } = useQuery({
    queryKey: ["playlist", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["playlist-items", id],
    enabled: !!playlist,
    queryFn: async () => {
      const { data: itemsData, error } = await supabase
        .from("playlist_items")
        .select("*")
        .eq("playlist_id", id!)
        .order("position", { ascending: true });

      if (error) throw error;

      // Fetch full content for each item
      const fullItems = await Promise.all(
        (itemsData || []).map(async (item) => {
          if (item.content_type === "pep_talk") {
            const { data } = await supabase
              .from("pep_talks")
              .select("*")
              .eq("id", item.content_id)
              .single();
            return { ...item, content: data };
          } else {
            const { data } = await supabase
              .from("videos")
              .select("*")
              .eq("id", item.content_id)
              .single();
            return { ...item, content: data };
          }
        })
      );

      return fullItems.filter((item) => item.content);
    },
  });

  if (playlistLoading || itemsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-glow via-petal-pink/20 to-lavender-mist/30 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blush-rose" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-glow via-petal-pink/20 to-lavender-mist/30 flex items-center justify-center">
        <p className="text-warm-charcoal/60">Playlist not found</p>
      </div>
    );
  }

  // Check premium access
  if (playlist.is_premium && !profile?.is_premium) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-glow via-petal-pink/20 to-lavender-mist/30 px-4 py-8">
        <Button
          onClick={() => navigate(-1)}
          variant="ghost"
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="max-w-lg mx-auto text-center py-12">
          <PremiumBadge />
          <h2 className="font-display text-3xl text-warm-charcoal mt-6 mb-4">
            Premium Playlist
          </h2>
          <p className="text-warm-charcoal/70 mb-8">
            Upgrade to premium to access this playlist and unlock all content
          </p>
          <Button
            onClick={() => navigate("/premium")}
            className="bg-gradient-to-r from-blush-rose to-soft-mauve hover:opacity-90 text-white font-medium px-8 py-6 rounded-3xl shadow-soft"
          >
            Go Premium
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-glow via-petal-pink/20 to-lavender-mist/30 pb-24">
      <div className="max-w-lg mx-auto px-4 py-8">
        <Button
          onClick={() => navigate(-1)}
          variant="ghost"
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="mb-8">
          <h1 className="font-display text-4xl text-warm-charcoal mb-2">
            {playlist.title}
          </h1>
          {playlist.description && (
            <p className="text-warm-charcoal/70">{playlist.description}</p>
          )}
          {playlist.category && (
            <p className="text-warm-charcoal/60 capitalize text-sm mt-2">
              {playlist.category}
            </p>
          )}
        </div>

        {items && items.length > 0 ? (
          <div className="space-y-6">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="bg-white/50 backdrop-blur-sm rounded-3xl p-6 shadow-soft border border-petal-pink/20"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-gradient-to-br from-blush-rose/20 to-lavender-mist/20 w-8 h-8 rounded-full flex items-center justify-center text-warm-charcoal font-medium text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-warm-charcoal">
                      {item.content?.title}
                    </h3>
                    <p className="text-sm text-warm-charcoal/60 capitalize">
                      {item.content_type === "pep_talk" ? "Audio" : "Video"}
                    </p>
                  </div>
                </div>

                {item.content_type === "pep_talk" && "audio_url" in item.content ? (
                  <AudioPlayer
                    audioUrl={item.content.audio_url}
                    title={item.content.title}
                  />
                ) : item.content_type === "video" && "video_url" in item.content ? (
                  <VideoPlayer
                    videoUrl={item.content.video_url}
                    thumbnailUrl={item.content.thumbnail_url}
                  />
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-warm-charcoal/60 py-12">
            This playlist is empty
          </p>
        )}
      </div>
    </div>
  );
};

export default PlaylistDetail;
