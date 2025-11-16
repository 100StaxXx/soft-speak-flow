import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface Achievement {
  id: string;
  user_id: string;
  achievement_type: string;
  title: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  earned_at: string;
  metadata: Record<string, any>;
}

export const useAchievements = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: achievements = [], isLoading } = useQuery({
    queryKey: ["achievements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .eq("user_id", user!.id)
        .order("earned_at", { ascending: false });

      if (error) throw error;
      return data as Achievement[];
    },
  });

  const addAchievement = useMutation({
    mutationFn: async (achievement: Omit<Achievement, 'id' | 'user_id' | 'earned_at' | 'created_at'>) => {
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("achievements")
        .insert({
          user_id: user.id,
          ...achievement,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["achievements"] });
      toast.success(`🏆 ${data.title}!`, {
        description: data.description,
      });
    },
  });

  const checkAndAwardAchievement = async (type: string, metadata: Record<string, any>) => {
    const existingAchievement = achievements.find(a => 
      a.achievement_type === type && 
      JSON.stringify(a.metadata) === JSON.stringify(metadata)
    );

    if (existingAchievement) return null;

    return addAchievement.mutateAsync(getAchievementConfig(type, metadata));
  };

  return {
    achievements,
    isLoading,
    addAchievement: addAchievement.mutateAsync,
    checkAndAwardAchievement,
  };
};

function getAchievementConfig(type: string, metadata: Record<string, any>): Omit<Achievement, 'id' | 'user_id' | 'earned_at' | 'created_at'> {
  const configs: Record<string, (meta: any) => Omit<Achievement, 'id' | 'user_id' | 'earned_at' | 'created_at'>> = {
    'first_habit': () => ({
      achievement_type: 'first_habit',
      title: 'First Step',
      description: 'Created your first habit',
      icon: '🎯',
      tier: 'bronze',
      metadata,
    }),
    'streak_7': () => ({
      achievement_type: 'streak_7',
      title: 'Week Warrior',
      description: 'Maintained a 7-day streak',
      icon: '🔥',
      tier: 'bronze',
      metadata,
    }),
    'streak_30': () => ({
      achievement_type: 'streak_30',
      title: 'Month Master',
      description: 'Maintained a 30-day streak',
      icon: '⚡',
      tier: 'silver',
      metadata,
    }),
    'streak_100': () => ({
      achievement_type: 'streak_100',
      title: 'Centurion',
      description: 'Maintained a 100-day streak',
      icon: '👑',
      tier: 'gold',
      metadata,
    }),
    'first_challenge': () => ({
      achievement_type: 'first_challenge',
      title: 'Challenge Accepted',
      description: 'Completed your first challenge',
      icon: '💪',
      tier: 'bronze',
      metadata,
    }),
    'challenge_streak_3': () => ({
      achievement_type: 'challenge_streak_3',
      title: 'Challenge Champion',
      description: 'Completed 3 challenges in a row',
      icon: '🏅',
      tier: 'silver',
      metadata,
    }),
    'morning_warrior': () => ({
      achievement_type: 'morning_warrior',
      title: 'Morning Warrior',
      description: 'Completed 7 morning check-ins',
      icon: '🌅',
      tier: 'bronze',
      metadata,
    }),
  };

  return configs[type]?.(metadata) || {
    achievement_type: type,
    title: 'Achievement Unlocked',
    description: 'You earned an achievement!',
    icon: '⭐',
    tier: 'bronze',
    metadata,
  };
}
