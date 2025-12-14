import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { Bell, Play, Sparkles, AlertCircle } from "lucide-react";
import { getMentor } from "@/lib/firebase/mentors";
import { getDailyPepTalk, getDailyPepTalks } from "@/lib/firebase/dailyPepTalks";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTodaysPepTalk = async () => {
      if (!profile?.selected_mentor_id) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const today = format(new Date(), 'yyyy-MM-dd');

        // Get mentor details
        const mentor = await getMentor(profile.selected_mentor_id);
        if (!mentor || !mentor.slug) {
          setIsLoading(false);
          return;
        }

        // Check if there's a daily pep talk for today
        let dailyPepTalk = await getDailyPepTalk(today, mentor.slug);
        
        // If no daily pep talk exists, get the most recent one for this mentor
        if (!dailyPepTalk) {
          try {
            const recentPepTalks = await getDailyPepTalks(mentor.slug, 1);
            dailyPepTalk = recentPepTalks[0] || null;
          } catch (err) {
            console.error("Error fetching recent pep talk:", err);
          }
        }

        if (dailyPepTalk) {
          setTodaysPepTalk({ 
            ...dailyPepTalk, 
            mentor_name: mentor.name,
            topic_category: Array.isArray(dailyPepTalk.topic_category) 
              ? dailyPepTalk.topic_category[0] 
              : dailyPepTalk.topic_category || undefined,
          });
        }
      } catch (err) {
        console.error("Error fetching today's pep talk:", err);
        setError("Unable to load pep talk");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTodaysPepTalk();
  }, [profile?.selected_mentor_id]);

  // Show loading skeleton
  if (isLoading) {
    return (
      <Card className="relative overflow-hidden animate-pulse">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-6 w-3/4 bg-muted rounded" />
            <div className="h-4 w-full bg-muted rounded" />
          </div>
          <div className="h-10 w-full bg-muted rounded" />
        </div>
      </Card>
    );
  }

  // Show placeholder when no pep talk available
  if (!todaysPepTalk || error) {
    return (
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-muted/50 via-muted/30 to-background opacity-60" />
        <div className="relative p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-muted/50 rounded-full border border-border/20">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Today's Push</span>
              </div>
              <h3 className="font-semibold text-sm text-muted-foreground">No pep talk available</h3>
            </div>
          </div>
          <p className="text-muted-foreground text-sm">
            Check back later for your daily motivation from your mentor.
          </p>
          <Button 
            onClick={() => navigate('/library')}
            variant="outline"
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            Browse Library
          </Button>
        </div>
      </Card>
    );
  }

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