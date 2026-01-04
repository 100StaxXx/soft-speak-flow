import { memo } from "react";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, TrendingUp, Flame } from "lucide-react";
import { useStreakMultiplier } from "@/hooks/useStreakMultiplier";
import { XPBreakdownInfoTooltip } from "./XPBreakdownInfoTooltip";

export const XPBreakdown = memo(() => {
  const { user } = useAuth();
  const { currentStreak = 0, multiplier = 1, nextMilestone } = useStreakMultiplier();
  const now = new Date();
  const today = now.toLocaleDateString('en-CA');
  const startOfTodayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { data: todayXP } = useQuery({
    queryKey: ['xp-breakdown', today, user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data } = await supabase
        .from('xp_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startOfTodayIso)
        .order('created_at', { ascending: false });

      if (!data) return { total: 0, byType: {} };

      const byType = data.reduce((acc, event) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + event.xp_earned;
        return acc;
      }, {} as Record<string, number>);

      const total = data.reduce((sum, event) => sum + event.xp_earned, 0);

      return { total, byType, events: data };
    },
    enabled: !!user,
    staleTime: 60 * 1000, // 1 minute - XP data should be relatively fresh
  });

  const typeLabels: Record<string, string> = {
    habit_complete: "Habits",
    task_complete: "Quests",
    check_in: "Check-in",
    pep_talk: "Pep Talk",
    pep_talk_listen: "Pep Talk Listen",
    all_habits_complete: "All Habits Bonus",
    mission_check_in: "Mission",
    mission_pep_talk: "Mission",
    mission_habits_3: "Mission",
    mission_all_habits: "Mission",
    mission_profile_update: "Profile Update",
  };

  return (
    <Card className="p-5 md:p-6 bg-card/25 backdrop-blur-2xl border-primary/20">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-heading font-black text-lg">Today's XP</h3>
              <p className="text-2xl font-bold text-primary">{todayXP?.total || 0} XP</p>
            </div>
          </div>
          <XPBreakdownInfoTooltip />
        </div>

        {/* Streak Info */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-accent/10 border border-accent/20">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-sm font-bold">{currentStreak} Day Streak</p>
              <p className="text-xs text-muted-foreground">{multiplier}x XP Multiplier</p>
            </div>
          </div>
          {nextMilestone.daysRemaining > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Next milestone</p>
              <p className="text-sm font-bold">{nextMilestone.daysRemaining} days</p>
            </div>
          )}
        </div>

        {/* XP Sources */}
        {todayXP && Object.keys(todayXP.byType).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground">XP Sources</p>
            {Object.entries(todayXP.byType).map(([type, xp]) => (
              <div key={type} className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{typeLabels[type] || type}</span>
                <span className="font-bold text-primary">+{xp} XP</span>
              </div>
            ))}
          </div>
        )}

        {/* Projection */}
        {todayXP && todayXP.total > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <TrendingUp className="h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground">
              Keep this up for 7 days = {(todayXP.total * 7).toFixed(0)} XP
            </p>
          </div>
        )}
      </div>
    </Card>
  );
});

XPBreakdown.displayName = 'XPBreakdown';
