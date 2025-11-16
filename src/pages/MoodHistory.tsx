import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, Calendar } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { format, formatDistanceToNow, startOfDay, subDays } from "date-fns";

const moodEmojis: Record<string, string> = {
  'Unmotivated': '😴',
  'Overthinking': '🤯',
  'Stressed': '😰',
  'Low Energy': '🔋',
  'Content': '😌',
  'Disciplined': '💪',
  'Focused': '🎯',
  'Inspired': '✨'
};

export default function MoodHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: moodLogs = [], isLoading } = useQuery({
    queryKey: ['moodLogs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mood_logs')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Calculate mood frequency for the last 7 days
  const last7Days = subDays(new Date(), 7);
  const recentMoods = moodLogs.filter(log => new Date(log.created_at) >= last7Days);
  const moodCounts = recentMoods.reduce((acc, log) => {
    acc[log.mood] = (acc[log.mood] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-4xl font-heading text-foreground">Mood History</h1>
        </div>

        {/* Summary Card */}
        {topMood && (
          <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/20">
            <div className="flex items-center gap-4">
              <TrendingUp className="w-8 h-8 text-primary" />
              <div>
                <div className="text-sm text-muted-foreground">Most common this week</div>
                <div className="text-2xl font-heading text-foreground flex items-center gap-2">
                  <span>{moodEmojis[topMood[0]]}</span>
                  <span>{topMood[0]}</span>
                  <span className="text-sm text-muted-foreground">({topMood[1]}x)</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Mood Logs */}
        <div className="space-y-3">
          <h2 className="text-xl font-heading text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Recent Check-ins
          </h2>

          {moodLogs.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No mood logs yet.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Start tracking by selecting how you feel on the home page.
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {moodLogs.map((log) => (
                <Card key={log.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{moodEmojis[log.mood]}</span>
                      <div>
                        <div className="font-medium text-foreground">{log.mood}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), 'MMM d, h:mm a')}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}