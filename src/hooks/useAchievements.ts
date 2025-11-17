import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { playAchievementUnlock } from "@/utils/soundEffects";

interface AchievementData {
  type: string;
  title: string;
  description: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  metadata?: Record<string, any>;
}

export const useAchievements = () => {
  const { user } = useAuth();

  const awardAchievement = async (achievement: AchievementData) => {
    if (!user) return;

    try {
      // Check if already earned
      const { data: existing } = await supabase
        .from("achievements")
        .select("id")
        .eq("user_id", user.id)
        .eq("achievement_type", achievement.type)
        .maybeSingle();

      if (existing) return; // Already earned

      const { error } = await supabase
        .from("achievements")
        .insert({
          user_id: user.id,
          achievement_type: achievement.type,
          title: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
          tier: achievement.tier,
          metadata: achievement.metadata || {},
        });

      if (!error) {
        toast.success("🏆 Achievement Unlocked!", {
          description: achievement.title,
        });
        playAchievementUnlock();
      }
    } catch (error) {
      console.error("Error awarding achievement:", error);
    }
  };

  const checkStreakAchievements = async (streak: number) => {
    if (streak === 7) {
      await awardAchievement({
        type: "week_streak",
        title: "Week Warrior",
        description: "Maintained a 7-day streak",
        icon: "trophy",
        tier: "bronze",
        metadata: { streak },
      });
    } else if (streak === 30) {
      await awardAchievement({
        type: "month_streak",
        title: "Monthly Master",
        description: "Maintained a 30-day streak",
        icon: "trophy",
        tier: "silver",
        metadata: { streak },
      });
    } else if (streak === 100) {
      await awardAchievement({
        type: "century_streak",
        title: "Century Champion",
        description: "Maintained a 100-day streak",
        icon: "crown",
        tier: "gold",
        metadata: { streak },
      });
    } else if (streak === 365) {
      await awardAchievement({
        type: "year_streak",
        title: "Year Legend",
        description: "Maintained a full year streak",
        icon: "crown",
        tier: "platinum",
        metadata: { streak },
      });
    }
  };

  const checkChallengeAchievements = async (completedCount: number) => {
    if (completedCount === 1) {
      await awardAchievement({
        type: "first_challenge",
        title: "Challenge Accepted",
        description: "Completed your first challenge",
        icon: "target",
        tier: "bronze",
      });
    } else if (completedCount === 5) {
      await awardAchievement({
        type: "challenge_veteran",
        title: "Challenge Veteran",
        description: "Completed 5 challenges",
        icon: "target",
        tier: "silver",
      });
    } else if (completedCount === 10) {
      await awardAchievement({
        type: "challenge_master",
        title: "Challenge Master",
        description: "Completed 10 challenges",
        icon: "target",
        tier: "gold",
      });
    }
  };

  return {
    awardAchievement,
    checkStreakAchievements,
    checkChallengeAchievements,
  };
};
