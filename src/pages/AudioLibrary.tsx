import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Music } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";

export default function AudioLibrary() {
  const navigate = useNavigate();

  const { data: audioClips = [] } = useQuery({
    queryKey: ['audio-clips'],
    queryFn: async () => {
      const { data } = await supabase.from('audio_clips').select('*');
      return data || [];
    },
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-4xl font-heading text-foreground">Audio Library</h1>
        </div>

        <div className="grid gap-4">
          {audioClips.length === 0 ? (
            <Card className="p-12 text-center">
              <Music className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No audio clips available yet.</p>
            </Card>
          ) : (
            audioClips.map((clip) => (
              <Card key={clip.id} className="p-6 hover:border-primary/40 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-heading text-foreground">{clip.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{clip.description}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary">{clip.category}</Badge>
                      {clip.duration_seconds && (
                        <Badge variant="outline">{Math.floor(clip.duration_seconds / 60)}:{(clip.duration_seconds % 60).toString().padStart(2, '0')}</Badge>
                      )}
                    </div>
                  </div>
                  <Button size="icon" className="h-12 w-12 rounded-full">
                    <Play className="w-5 h-5" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
