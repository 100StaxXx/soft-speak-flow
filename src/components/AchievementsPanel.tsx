import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AchievementBadge } from "./AchievementBadge";
import { Trophy, TrendingUp } from "lucide-react";
import { Card } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { EmptyState } from "./EmptyState";

interface AchievementsPanelProps {
  showEmptyState?: boolean;
}

export const AchievementsPanel = ({ showEmptyState = false }: AchievementsPanelProps) => {
  const { user } = useAuth();

  const { data: achievements, isLoading } = useQuery({
    queryKey: ["achievements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .eq("user_id", user!.id)
        .order("earned_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["achievement-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_achievement_stats")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return data || { total_achievements: 0, bronze_count: 0, silver_count: 0, gold_count: 0, platinum_count: 0 };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Card */}
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="h-6 w-6 text-primary" />
          <h3 className="text-lg font-semibold">Your Achievements</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">
              {stats?.total_achievements || 0}
            </div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-500">
              {stats?.platinum_count || 0}
            </div>
            <div className="text-xs text-muted-foreground">Platinum</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-500">
              {stats?.gold_count || 0}
            </div>
            <div className="text-xs text-muted-foreground">Gold</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-400">
              {stats?.silver_count || 0}
            </div>
            <div className="text-xs text-muted-foreground">Silver</div>
          </div>
        </div>
      </Card>

      {/* Achievement List */}
      <div className="space-y-3">
        {achievements && achievements.length > 0 ? (
          achievements.map((achievement) => (
            <AchievementBadge
              key={achievement.id}
              tier={achievement.tier as any}
              title={achievement.title}
              description={achievement.description}
              icon={achievement.icon}
              earnedAt={achievement.earned_at}
            />
          ))
        ) : showEmptyState ? (
          <EmptyState
            icon={Trophy}
            title="No Achievements Yet"
            description="Complete habits, maintain streaks, and finish challenges to unlock achievement badges and level up your progress!"
          />
        ) : (
          <Card className="p-8 text-center">
            <TrendingUp className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <h4 className="font-semibold mb-2">No Achievements Yet</h4>
            <p className="text-sm text-muted-foreground">
              Complete habits, challenges, and engage with content to earn your first achievement!
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};
