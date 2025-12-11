import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getAchievements } from "@/lib/firebase/achievements";
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
    queryKey: ["achievements", user?.uid],
    enabled: !!user,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    queryFn: async () => {
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }
      
      return await getAchievements(user.uid);
    },
  });

  // Calculate stats from achievements
  const stats = {
    total_achievements: achievements?.length || 0,
    bronze_count: achievements?.filter(a => a.tier === 'bronze').length || 0,
    silver_count: achievements?.filter(a => a.tier === 'silver').length || 0,
    gold_count: achievements?.filter(a => a.tier === 'gold').length || 0,
    platinum_count: achievements?.filter(a => a.tier === 'platinum').length || 0,
  };

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
            <div className="text-2xl font-bold bg-gradient-to-br from-purple-400 to-purple-600 bg-clip-text text-transparent">
              {stats.platinum_count}
            </div>
            <div className="text-xs text-muted-foreground">Platinum</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold bg-gradient-to-br from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
              {stats.gold_count}
            </div>
            <div className="text-xs text-muted-foreground">Gold</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold bg-gradient-to-br from-gray-300 to-gray-500 bg-clip-text text-transparent">
              {stats.silver_count}
            </div>
            <div className="text-xs text-muted-foreground">Silver</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold bg-gradient-to-br from-orange-500 to-orange-700 bg-clip-text text-transparent">
              {stats.bronze_count}
            </div>
            <div className="text-xs text-muted-foreground">Bronze</div>
          </div>
        </div>
      </Card>

      {/* Achievement List */}
      <div className="space-y-3">
        {achievements && achievements.length > 0 ? (
          achievements.map((achievement) => (
            <AchievementBadge
              key={achievement.id}
              tier={achievement.tier as "bronze" | "silver" | "gold" | "platinum"}
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
