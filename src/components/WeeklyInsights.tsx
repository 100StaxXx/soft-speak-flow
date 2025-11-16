import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/SkeletonCard";
import { TrendingUp, Calendar, Heart, Target } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SlideUp } from "./PageTransition";

export const WeeklyInsights = () => {
  const { user } = useAuth();

  const getWeekRange = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return { start: startOfWeek.toISOString(), end: endOfWeek.toISOString() };
  };

  const { data: weeklyData, refetch } = useQuery({
    queryKey: ['weekly-insights', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { start, end } = getWeekRange();
      
      // Get habits completed this week
      const { data: habitCompletions } = await supabase
        .from('habit_completions')
        .select('*, habits(title)')
        .eq('user_id', user.id)
        .gte('completed_at', start)
        .lte('completed_at', end);
      
      // Get check-ins this week
      const { data: checkIns } = await supabase
        .from('daily_check_ins')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', start)
        .lte('created_at', end);
      
      // Get mood logs this week
      const { data: moodLogs } = await supabase
        .from('mood_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', start)
        .lte('created_at', end);

      // Get activity feed for insights
      const { data: activities } = await supabase
        .from('activity_feed')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });
      
      return {
        habitCompletions: habitCompletions || [],
        checkIns: checkIns || [],
        moodLogs: moodLogs || [],
        activities: activities || [],
        aiInsight: null as string | null
      };
    },
    enabled: !!user,
  });


  if (!weeklyData) return <SkeletonCard />;

  const stats = [
    {
      icon: Target,
      label: "Habits Completed",
      value: weeklyData.habitCompletions.length,
      color: "text-primary"
    },
    {
      icon: Calendar,
      label: "Check-Ins",
      value: weeklyData.checkIns.length,
      color: "text-accent"
    },
    {
      icon: Heart,
      label: "Mood Logs",
      value: weeklyData.moodLogs.length,
      color: "text-pink-500"
    }
  ];

  return (
    <SlideUp>
      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">This Week's Journey</h2>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="text-center space-y-2">
              <div className="mx-auto w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* AI Insight */}
        {weeklyData.aiInsight && (
          <div className="bg-primary/5 rounded-lg p-4 border-l-2 border-primary">
            <p className="text-sm italic text-foreground">{weeklyData.aiInsight}</p>
          </div>
        )}
      </Card>
    </SlideUp>
  );
};
