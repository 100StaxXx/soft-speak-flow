import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Play, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { getResolvedMentorId } from "@/utils/mentor";

interface DailyPepTalk {
  id: string;
  title: string;
  summary: string;
  for_date: string;
  mentor_name?: string;
  topic_category?: string;
  intensity?: string;
}

export const TodaysPush = () => {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [todaysPepTalk, setTodaysPepTalk] = useState<DailyPepTalk | null>(null);
  const resolvedMentorId = getResolvedMentorId(profile);

  useEffect(() => {
    const fetchTodaysPepTalk = async () => {
      if (!resolvedMentorId) return;

      const today = format(new Date(), 'yyyy-MM-dd');

      // Get mentor details
      const { data: mentor } = await supabase
        .from("mentors")
        .select("slug, name")
        .eq("id", resolvedMentorId)
        .maybeSingle();

      if (!mentor) return;

      // Check if there's a daily pep talk for today
      const { data: dailyPepTalk } = await supabase
        .from("daily_pep_talks")
        .select("*")
        .eq("for_date", today)
        .eq("mentor_slug", mentor.slug)
        .maybeSingle();

      if (dailyPepTalk) {
        setTodaysPepTalk({ ...dailyPepTalk, mentor_name: mentor.name });
      }
    };

    fetchTodaysPepTalk();
  }, [resolvedMentorId]);

  if (!todaysPepTalk) return null;

  return (
    <Card className="relative overflow-hidden group animate-fade-in">
      {/* Cinematic Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-background opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/30 via-transparent to-transparent opacity-40" />
      
      {/* Animated Glow */}
      <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-primary/20 blur-3xl rounded-full animate-pulse" />
      
      <div className="relative p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/30 blur-md rounded-full animate-pulse" />
            <div className="relative p-3 bg-gradient-to-br from-primary/30 to-primary/10 rounded-full border border-primary/20">
              <Bell className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-xs font-medium text-primary uppercase tracking-wider">Today&apos;s Push</span>
            </div>
            <h3 className="font-semibold text-sm text-muted-foreground">From {todaysPepTalk.mentor_name}</h3>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3">
          <h2 className="text-2xl font-bold leading-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
            {todaysPepTalk.title}
          </h2>
          <p className="text-muted-foreground leading-relaxed line-clamp-2">
            {todaysPepTalk.summary}
          </p>
        </div>

        {/* Action Button */}
        <Button 
          onClick={() => navigate(`/library`)}
          className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20 group-hover:shadow-xl group-hover:shadow-primary/30 transition-all duration-300"
        >
          <Play className="h-4 w-4 mr-2" />
          Listen Now
        </Button>

        {/* Category Badge */}
        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
            {todaysPepTalk.topic_category}
          </span>
          <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground">
            {todaysPepTalk.intensity}
          </span>
        </div>
      </div>
    </Card>
  );
};
