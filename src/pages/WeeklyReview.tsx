import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, Target, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";

export default function WeeklyReview() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: habits = [] } = useQuery({
    queryKey: ['habits', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!user,
  });

  const totalStreak = habits.reduce((sum, h) => sum + h.current_streak, 0);
  const avgStreak = habits.length > 0 ? Math.round(totalStreak / habits.length) : 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-4xl font-heading text-foreground">Weekly Review</h1>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card className="p-6 text-center">
            <Flame className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-3xl font-heading text-foreground">{totalStreak}</p>
            <p className="text-sm text-muted-foreground">Total Streak Days</p>
          </Card>

          <Card className="p-6 text-center">
            <Target className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-3xl font-heading text-foreground">{habits.length}</p>
            <p className="text-sm text-muted-foreground">Active Habits</p>
          </Card>

          <Card className="p-6 text-center">
            <TrendingUp className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-3xl font-heading text-foreground">{avgStreak}</p>
            <p className="text-sm text-muted-foreground">Avg Streak</p>
          </Card>
        </div>

        <Card className="p-6">
          <h2 className="text-2xl font-heading text-foreground mb-4">This Week's Progress</h2>
          <div className="space-y-4">
            {habits.map((habit) => (
              <div key={habit.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-heading text-foreground">{habit.title}</p>
                  <p className="text-sm text-muted-foreground">Current: {habit.current_streak} days</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Best: {habit.longest_streak}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          <h3 className="text-xl font-heading text-foreground mb-2">Mentor's Feedback</h3>
          <p className="text-foreground/80">
            Strong work this week. Your consistency is building momentum. Keep showing up, stay locked in, and the results will follow.
          </p>
        </Card>
      </div>
      <BottomNav />
    </div>
  );
}
