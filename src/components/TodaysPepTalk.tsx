import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Play, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const TodaysPepTalk = () => {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [pepTalk, setPepTalk] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDailyPepTalk = async () => {
      if (!profile?.selected_mentor_id) return;

      const today = new Date().toISOString().split("T")[0];

      const { data: mentor } = await supabase
        .from("mentors")
        .select("slug, name")
        .eq("id", profile.selected_mentor_id)
        .single();

      if (!mentor) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("daily_pep_talks")
        .select("*")
        .eq("for_date", today)
        .eq("mentor_slug", mentor.slug)
        .single();

      if (data) {
        setPepTalk({ ...data, mentor_name: mentor.name });
      }
      setLoading(false);
    };

    fetchDailyPepTalk();
  }, [profile?.selected_mentor_id]);

  if (loading) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="space-y-4">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-20 bg-muted rounded" />
        </div>
      </Card>
    );
  }

  if (!pepTalk) return null;

  return (
    <Card className="relative overflow-hidden group animate-fade-in">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-background opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/30 via-transparent to-accent/20 opacity-40" />
      
      {/* Animated glows */}
      <div className="absolute -top-1/3 -right-1/3 w-2/3 h-2/3 bg-primary/20 blur-3xl rounded-full animate-pulse" />
      <div className="absolute -bottom-1/3 -left-1/3 w-2/3 h-2/3 bg-accent/20 blur-3xl rounded-full animate-pulse" style={{ animationDelay: "1s" }} />
      
      <div className="relative p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          <h2 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Today's Pep Talk
          </h2>
        </div>

        {/* Content */}
        <div className="space-y-3 p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 hover:border-primary/30 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <h3 className="font-bold text-foreground line-clamp-2">
                {pepTalk.title}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {pepTalk.summary}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="shrink-0 h-10 w-10 rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/30"
              onClick={() => {
                // Play audio logic or navigate to detail
                const audio = new Audio(pepTalk.audio_url);
                audio.play();
              }}
            >
              <Play className="h-5 w-5 text-primary" />
            </Button>
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            className="w-full"
            onClick={() => navigate(`/inspire`)}
          >
            Browse More Pep Talks
          </Button>
        </div>
      </div>
    </Card>
  );
};
