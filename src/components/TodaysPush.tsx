import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Calendar, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface DailyPepTalk {
  id: string;
  mentor_slug: string;
  topic_category: string;
  emotional_triggers: string[];
  intensity: string;
  title: string;
  summary: string;
  audio_url: string;
  for_date: string;
}

export const TodaysPush = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [todaysPush, setTodaysPush] = useState<DailyPepTalk | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTodaysPush = async () => {
      if (!user || !profile?.selected_mentor_id) {
        setLoading(false);
        return;
      }

      try {
        // Get mentor details
        const { data: mentor } = await supabase
          .from("mentors")
          .select("slug")
          .eq("id", profile.selected_mentor_id)
          .single();

        if (!mentor) {
          setLoading(false);
          return;
        }

        // Get today's date in YYYY-MM-DD format
        const today = format(new Date(), "yyyy-MM-dd");

        // Fetch today's pep talk for this mentor
        const { data, error } = await supabase
          .from("daily_pep_talks")
          .select("*")
          .eq("mentor_slug", mentor.slug)
          .eq("for_date", today)
          .single();

        if (error) {
          console.error("Error fetching today's push:", error);
        } else {
          setTodaysPush(data);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTodaysPush();
  }, [user, profile]);

  const handlePlay = () => {
    if (todaysPush) {
      // Find the pep talk in the main library by matching title and date
      navigate("/pushes");
    }
  };

  if (loading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="py-8">
          <div className="animate-pulse text-center text-muted-foreground">
            Loading today's push...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!todaysPush) {
    return (
      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Today's Push
          </CardTitle>
          <CardDescription>
            No push available for today yet. Check back soon!
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-background to-primary/5">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Today's Push
            </CardTitle>
            <CardDescription>
              {format(new Date(todaysPush.for_date), "MMMM d, yyyy")}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="capitalize">
            {todaysPush.intensity}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold text-lg mb-2">{todaysPush.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {todaysPush.summary}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="capitalize">
            {todaysPush.topic_category}
          </Badge>
          {todaysPush.emotional_triggers.slice(0, 2).map((trigger) => (
            <Badge key={trigger} variant="outline" className="text-xs">
              {trigger}
            </Badge>
          ))}
        </div>

        <Button onClick={handlePlay} className="w-full" size="lg">
          <Play className="w-4 h-4 mr-2" />
          Listen Now
        </Button>
      </CardContent>
    </Card>
  );
};
