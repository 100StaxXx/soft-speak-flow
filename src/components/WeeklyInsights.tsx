import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getDocuments } from "@/lib/firebase/firestore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/SkeletonCard";
import { TrendingUp, Sunrise, CheckCircle2, Swords } from "lucide-react";
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
    queryKey: ['weekly-insights', user?.uid],
    queryFn: async () => {
      if (!user) return null;
      
      const { start, end } = getWeekRange();
      
      // Get habits completed this week
      const habitCompletions = await getDocuments(
        'habit_completions',
        [
          ['user_id', '==', user.uid],
          ['completed_at', '>=', start],
          ['completed_at', '<=', end]
        ],
        'completed_at',
        'desc'
      );
      
      // Get check-ins this week
      const checkIns = await getDocuments(
        'daily_check_ins',
        [
          ['user_id', '==', user.uid],
          ['created_at', '>=', start],
          ['created_at', '<=', end]
        ],
        'created_at',
        'desc'
      );
      
      // Get completed quests (daily_missions) this week - filter by mission_date instead of completed_at
      // This ensures missions completed during onboarding/tutorial show up if they're for this week
      const quests = await getDocuments(
        'daily_missions',
        [
          ['user_id', '==', user.uid],
          ['completed', '==', true],
          ['mission_date', '>=', start.split('T')[0]],
          ['mission_date', '<=', end.split('T')[0]]
        ],
        'mission_date',
        'desc'
      );

      // Get activity feed for insights
      const activities = await getDocuments(
        'activity_feed',
        [
          ['user_id', '==', user.uid],
          ['created_at', '>=', start],
          ['created_at', '<=', end]
        ],
        'created_at',
        'desc'
      );
      
      return {
        habitCompletions: habitCompletions || [],
        checkIns: checkIns || [],
        quests: quests || [],
        activities: activities || [],
        aiInsight: null as string | null
      };
    },
    enabled: !!user,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });


  if (!weeklyData) return <SkeletonCard />;

  const stats = [
    {
      icon: CheckCircle2,
      label: "Habits Completed",
      value: weeklyData.habitCompletions.length,
      color: "text-red-500"
    },
    {
      icon: Sunrise,
      label: "Check-Ins",
      value: weeklyData.checkIns.length,
      color: "text-orange-500"
    },
    {
      icon: Swords,
      label: "Quests",
      value: weeklyData.quests.length,
      color: "text-amber-500"
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
