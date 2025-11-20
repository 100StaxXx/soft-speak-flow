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

  const checkFirstTimeAchievements = async (type: 'habit' | 'checkin' | 'peptalk' | 'mission') => {
    const achievementMap = {
      habit: {
        type: "first_habit",
        title: "Habit Builder",
        description: "Created your first habit",
        icon: "check",
        tier: "bronze" as const,
      },
      checkin: {
        type: "first_checkin",
        title: "Morning Person",
        description: "Completed your first check-in",
        icon: "sunrise",
        tier: "bronze" as const,
      },
      peptalk: {
        type: "first_peptalk",
        title: "Mentor's Student",
        description: "Listened to your first pep talk",
        icon: "headphones",
        tier: "bronze" as const,
      },
      mission: {
        type: "first_mission",
        title: "Mission Started",
        description: "Completed your first mission",
        icon: "target",
        tier: "bronze" as const,
      },
    };

    await awardAchievement(achievementMap[type]);
  };

  const checkCompanionAchievements = async (stage: number) => {
    if (stage === 5) {
      await awardAchievement({
        type: "companion_stage_5",
        title: "Growth Guardian",
        description: "Evolved companion to Stage 5",
        icon: "sparkles",
        tier: "silver",
      });
    } else if (stage === 10) {
      await awardAchievement({
        type: "companion_stage_10",
        title: "Evolution Master",
        description: "Evolved companion to Stage 10",
        icon: "star",
        tier: "gold",
      });
    } else if (stage === 20) {
      await awardAchievement({
        type: "companion_max",
        title: "Legendary Bond",
        description: "Reached maximum companion evolution",
        icon: "crown",
        tier: "platinum",
      });
    }
  };

  return {
    awardAchievement,
    checkStreakAchievements,
    checkChallengeAchievements,
    checkFirstTimeAchievements,
    checkCompanionAchievements,
  };
};
