import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { VideoCard } from "@/components/VideoCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PepTalkCard } from "@/components/PepTalkCard";
import { Loader2 } from "lucide-react";

const Videos = () => {
  const { data: videos, isLoading: videosLoading } = useQuery({
    queryKey: ["videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: pepTalks, isLoading: pepTalksLoading } = useQuery({
    queryKey: ["pep-talks-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pep_talks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-glow via-petal-pink/20 to-lavender-mist/30 pb-24">
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="font-display text-4xl text-warm-charcoal mb-2 text-center">
          Library
        </h1>
        <p className="text-warm-charcoal/70 text-center mb-8">
          Browse all content
        </p>

        <Tabs defaultValue="videos" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="videos">Videos</TabsTrigger>
            <TabsTrigger value="audio">Audio</TabsTrigger>
          </TabsList>

          <TabsContent value="videos" className="space-y-6">
            {videosLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blush-rose" />
              </div>
            ) : videos && videos.length > 0 ? (
              <div className="grid grid-cols-1 gap-6">
                {videos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center text-warm-charcoal/60 py-12">
                No videos yet
              </p>
            )}
          </TabsContent>

          <TabsContent value="audio" className="space-y-4">
            {pepTalksLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blush-rose" />
              </div>
            ) : pepTalks && pepTalks.length > 0 ? (
              pepTalks.map((talk) => (
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
                No pep talks yet
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
};

export default Videos;
