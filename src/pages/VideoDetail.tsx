import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart, Download } from "lucide-react";
import { PremiumBadge } from "@/components/PremiumBadge";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const VideoDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isFavorited, setIsFavorited] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);

  const { data: video, isLoading } = useQuery({
    queryKey: ["video", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Check if favorited
  useQuery({
    queryKey: ["video-favorite", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", user!.id)
        .eq("content_type", "video")
        .eq("content_id", id!)
        .maybeSingle();

      setIsFavorited(!!data);
      return data;
    },
  });

  // Check if downloaded
  useQuery({
    queryKey: ["video-download", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("downloads")
        .select("id")
        .eq("user_id", user!.id)
        .eq("content_type", "video")
        .eq("content_id", id!)
        .maybeSingle();

      setIsDownloaded(!!data);
      return data;
    },
  });

  const toggleFavorite = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    try {
      if (isFavorited) {
        await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("content_type", "video")
          .eq("content_id", id!);
        setIsFavorited(false);
      } else {
        await supabase
          .from("favorites")
          .insert({
            user_id: user.id,
            content_type: "video",
            content_id: id!,
          });
        setIsFavorited(true);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleDownload = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    if (!profile?.is_premium) {
      navigate("/premium");
      return;
    }

    try {
      if (isDownloaded) {
        await supabase
          .from("downloads")
          .delete()
          .eq("user_id", user.id)
          .eq("content_type", "video")
          .eq("content_id", id!);
        setIsDownloaded(false);
        toast({
          title: "Removed from downloads",
        });
      } else {
        await supabase
          .from("downloads")
          .insert({
            user_id: user.id,
            content_type: "video",
            content_id: id!,
          });
        setIsDownloaded(true);
        toast({
          title: "Added to downloads",
          description: "This video is now available offline",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-glow via-petal-pink/20 to-lavender-mist/30 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blush-rose" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-glow via-petal-pink/20 to-lavender-mist/30 flex items-center justify-center">
        <p className="text-warm-charcoal/60">Video not found</p>
      </div>
    );
  }

  // Check premium access
  if (video.is_premium && !profile?.is_premium) {
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
            Premium Content
          </h2>
          <p className="text-warm-charcoal/70 mb-8">
            Upgrade to premium to access this video and unlock all content
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

        <VideoPlayer
          videoUrl={video.video_url}
          thumbnailUrl={video.thumbnail_url}
          className="mb-6"
        />

        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="font-display text-3xl text-warm-charcoal mb-2">
              {video.title}
            </h1>
            {video.category && (
              <p className="text-warm-charcoal/60 capitalize">{video.category}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={toggleFavorite}
              variant="ghost"
              size="icon"
              className="rounded-full"
            >
              <Heart className={`h-5 w-5 ${isFavorited ? "fill-blush-rose text-blush-rose" : "text-warm-charcoal/40"}`} />
            </Button>
            {profile?.is_premium && (
              <Button
                onClick={toggleDownload}
                variant="ghost"
                size="icon"
                className="rounded-full"
              >
                <Download className={`h-5 w-5 ${isDownloaded ? "fill-blush-rose text-blush-rose" : "text-warm-charcoal/40"}`} />
              </Button>
            )}
          </div>
        </div>

        {video.description && (
          <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-6 shadow-soft border border-petal-pink/20">
            <p className="text-warm-charcoal/80 leading-relaxed">
              {video.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoDetail;
