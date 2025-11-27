import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { playAchievementUnlock } from "@/utils/soundEffects";
import { useCallback } from "react";

interface AchievementData {
  type: string;
  title: string;
  description: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  metadata?: {
    pepTalkDuration?: string;
    pepTalkMessage?: string;
    pepTalkCategory?: string;
    [key: string]: any;
  };
}

export const useAchievements = () => {
  const { user } = useAuth();

  const awardAchievement = useCallback(async (achievement: AchievementData) => {
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
  }, [user]);

  const checkStreakAchievements = async (streak: number) => {
    // Silver: 3-day streak (early effort)
    if (streak === 3) {
      await awardAchievement({
        type: "three_day_streak",
        title: "Getting Started",
        description: "3 days of consistency",
        icon: "flame",
        tier: "silver",
        metadata: { 
          streak,
          pepTalkDuration: "2-3 min",
          pepTalkMessage: "You're showing effort today. Keep that energy.",
          pepTalkCategory: "encouragement"
        },
      });
    } 
    // Gold: 7-day streak (discipline)
    else if (streak === 7) {
      await awardAchievement({
        type: "week_streak",
        title: "Week of Discipline",
        description: "7 days of unwavering commitment",
        icon: "trophy",
        tier: "gold",
        metadata: { 
          streak,
          pepTalkDuration: "4-5 min",
          pepTalkMessage: "You're not who you were last week. You're growing.",
          pepTalkCategory: "discipline"
        },
      });
    } 
    // Gold: 14-day streak (sustained discipline)
    else if (streak === 14) {
      await awardAchievement({
        type: "two_week_streak",
        title: "Fortnight Fighter",
        description: "14 days of unwavering discipline",
        icon: "trophy",
        tier: "gold",
        metadata: { 
          streak,
          pepTalkDuration: "4-5 min",
          pepTalkMessage: "Two weeks of showing up. That's the discipline talking.",
          pepTalkCategory: "discipline"
        },
      });
    }
    // Platinum: 30-day streak (transformation)
    else if (streak === 30) {
      await awardAchievement({
        type: "month_streak",
        title: "Transformed",
        description: "30 days - You're not the same person anymore",
        icon: "crown",
        tier: "platinum",
        metadata: { 
          streak,
          pepTalkDuration: "7-10 min",
          pepTalkMessage: "A month ago, you started. Today, you're different. This is transformation.",
          pepTalkCategory: "breakthrough"
        },
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
        title: "First Step",
        description: "Created your first habit",
        icon: "check",
        tier: "bronze" as const,
        metadata: {
          pepTalkDuration: "1 min",
          pepTalkMessage: "Welcome. Every journey starts with one step.",
          pepTalkCategory: "welcome"
        }
      },
      checkin: {
        type: "first_checkin",
        title: "Good Morning",
        description: "Completed your first check-in",
        icon: "sunrise",
        tier: "bronze" as const,
        metadata: {
          pepTalkDuration: "1 min",
          pepTalkMessage: "You showed up today. That matters.",
          pepTalkCategory: "welcome"
        }
      },
      peptalk: {
        type: "first_peptalk",
        title: "Listening",
        description: "Listened to your first pep talk",
        icon: "headphones",
        tier: "bronze" as const,
        metadata: {
          pepTalkDuration: "1 min",
          pepTalkMessage: "You're here. You're listening. Keep going.",
          pepTalkCategory: "welcome"
        }
      },
      mission: {
        type: "first_mission",
        title: "Mission Accepted",
        description: "Completed your first mission",
        icon: "target",
        tier: "bronze" as const,
        metadata: {
          pepTalkDuration: "1 min",
          pepTalkMessage: "One mission down. This is how change happens.",
          pepTalkCategory: "welcome"
        }
      },
    };

    await awardAchievement(achievementMap[type]);
  };

  const checkCompanionAchievements = async (stage: number) => {
    // Silver: Stage 3 (early bonding)
    if (stage === 3) {
      await awardAchievement({
        type: "companion_stage_3",
        title: "Growing Together",
        description: "Your companion reached Stage 3",
        icon: "sparkles",
        tier: "silver",
        metadata: {
          stage,
          pepTalkDuration: "2-3 min",
          pepTalkMessage: "Watch how your companion changes as you do.",
          pepTalkCategory: "growth"
        }
      });
    }
    // Gold: Stage 5 (meaningful progress)
    else if (stage === 5) {
      await awardAchievement({
        type: "companion_stage_5",
        title: "Deep Bond",
        description: "Your companion reached Stage 5",
        icon: "sparkles",
        tier: "gold",
        metadata: {
          stage,
          pepTalkDuration: "4-5 min",
          pepTalkMessage: "Stage 5. You're both different now.",
          pepTalkCategory: "discipline"
        }
      });
    } 
    // Gold: Stage 10 (major milestone)
    else if (stage === 10) {
      await awardAchievement({
        type: "companion_stage_10",
        title: "Evolution Master",
        description: "Your companion reached Stage 10",
        icon: "star",
        tier: "gold",
        metadata: {
          stage,
          pepTalkDuration: "4-5 min",
          pepTalkMessage: "Stage 10. This is discipline and consistency made visible.",
          pepTalkCategory: "discipline"
        }
      });
    } 
    // Platinum: Stage 15+ (transformation)
    else if (stage === 15) {
      await awardAchievement({
        type: "companion_stage_15",
        title: "Transcendent Bond",
        description: "Your companion reached Stage 15",
        icon: "crown",
        tier: "platinum",
        metadata: {
          stage,
          pepTalkDuration: "7-10 min",
          pepTalkMessage: "You've come so far together. This bond is real.",
          pepTalkCategory: "breakthrough"
        }
      });
    }
    // Platinum: Stage 20 (ultimate achievement)
    else if (stage === 20) {
      await awardAchievement({
        type: "companion_max",
        title: "Legendary Bond",
        description: "Your companion reached maximum evolution",
        icon: "crown",
        tier: "platinum",
        metadata: {
          stage,
          pepTalkDuration: "7-10 min",
          pepTalkMessage: "Stage 20. You didn't just evolve your companion. You evolved yourself.",
          pepTalkCategory: "breakthrough"
        }
      });
    }
  };

  // New: Attribute-based achievements
  const checkAttributeAchievements = async (attribute: 'mind' | 'body' | 'soul', value: number) => {
    const attrName = attribute.charAt(0).toUpperCase() + attribute.slice(1);
    
    // Silver: Attribute reaches 5
    if (value === 5) {
      await awardAchievement({
        type: `${attribute}_5`,
        title: `${attrName} Awakening`,
        description: `${attrName} attribute reached 5`,
        icon: "zap",
        tier: "silver",
        metadata: {
          attribute,
          value,
          pepTalkDuration: "2-3 min",
          pepTalkMessage: `Your ${attribute} is growing. You're feeling it, aren't you?`,
          pepTalkCategory: "growth"
        }
      });
    }
    // Gold: Attribute reaches 10
    else if (value === 10) {
      await awardAchievement({
        type: `${attribute}_10`,
        title: `${attrName} Mastery`,
        description: `${attrName} attribute reached 10`,
        icon: "zap",
        tier: "gold",
        metadata: {
          attribute,
          value,
          pepTalkDuration: "4-5 min",
          pepTalkMessage: `${attrName} at 10. This is what discipline looks like.`,
          pepTalkCategory: "discipline"
        }
      });
    }
    // Platinum: Attribute reaches 15
    else if (value === 15) {
      await awardAchievement({
        type: `${attribute}_15`,
        title: `${attrName} Transcendence`,
        description: `${attrName} attribute reached 15`,
        icon: "crown",
        tier: "platinum",
        metadata: {
          attribute,
          value,
          pepTalkDuration: "7-10 min",
          pepTalkMessage: `${attrName} at 15. You're operating at a different level now.`,
          pepTalkCategory: "breakthrough"
        }
      });
    }
  };

  // New: Total attributes achievement (Platinum)
  const checkTotalAttributesAchievement = async (total: number) => {
    if (total >= 50) {
      await awardAchievement({
        type: "total_attributes_50",
        title: "Balanced Transformation",
        description: "Total attributes reached 50",
        icon: "crown",
        tier: "platinum",
        metadata: {
          total,
          pepTalkDuration: "7-10 min",
          pepTalkMessage: "Mind, Body, Soul - all growing together. This is true transformation.",
          pepTalkCategory: "breakthrough"
        }
      });
    }
  };

  // New: Pep talk listening achievements
  const checkPepTalkListeningAchievements = async (count: number) => {
    // Silver: 3 pep talks in a week
    if (count === 3) {
      await awardAchievement({
        type: "peptalk_listener_3",
        title: "Active Listener",
        description: "Listened to 3 pep talks this week",
        icon: "headphones",
        tier: "silver",
        metadata: {
          count,
          pepTalkDuration: "2-3 min",
          pepTalkMessage: "You're not just listening. You're absorbing.",
          pepTalkCategory: "encouragement"
        }
      });
    }
    // Gold: Complete a themed set (tracked separately)
    else if (count === 10) {
      await awardAchievement({
        type: "peptalk_listener_10",
        title: "Devoted Student",
        description: "Listened to 10 pep talks",
        icon: "headphones",
        tier: "gold",
        metadata: {
          count,
          pepTalkDuration: "4-5 min",
          pepTalkMessage: "Ten talks. You're committed to this growth.",
          pepTalkCategory: "discipline"
        }
      });
    }
  };

  // New: Daily completion achievement (Silver)
  const checkDailyCompletionAchievement = async () => {
    await awardAchievement({
      type: "all_tasks_complete",
      title: "Perfect Day",
      description: "Completed every task today",
      icon: "check-circle",
      tier: "silver",
      metadata: {
        pepTalkDuration: "2-3 min",
        pepTalkMessage: "You did it all today. Every. Single. Thing.",
        pepTalkCategory: "encouragement"
      }
    });
  };

  // New: Story chapter completion (Gold)
  const checkStoryChapterAchievement = async (chapter: number) => {
    await awardAchievement({
      type: `story_chapter_${chapter}`,
      title: `Chapter ${chapter} Complete`,
      description: `Finished story chapter ${chapter}`,
      icon: "book",
      tier: "gold",
      metadata: {
        chapter,
        pepTalkDuration: "4-5 min",
        pepTalkMessage: "Another chapter. Your story is unfolding.",
        pepTalkCategory: "discipline"
      }
    });
  };

  // New: Full storyline completion (Platinum)
  const checkFullStorylineAchievement = async () => {
    await awardAchievement({
      type: "full_storyline",
      title: "Story Complete",
      description: "Completed the entire companion storyline",
      icon: "crown",
      tier: "platinum",
      metadata: {
        pepTalkDuration: "7-10 min",
        pepTalkMessage: "The full story. From beginning to now. Look at how far you've come.",
        pepTalkCategory: "breakthrough"
      }
    });
  };

  // New: Comeback achievement (Platinum) - simplified version
  const checkComebackAchievement = async () => {
    await awardAchievement({
      type: "comeback_arc",
      title: "The Comeback",
      description: "Returned stronger after a break",
      icon: "crown",
      tier: "platinum",
      metadata: {
        pepTalkDuration: "7-10 min",
        pepTalkMessage: "You came back. That's what matters. Welcome home.",
        pepTalkCategory: "breakthrough"
      }
    });
  };

  return {
    awardAchievement,
    checkStreakAchievements,
    checkChallengeAchievements,
    checkFirstTimeAchievements,
    checkCompanionAchievements,
    checkAttributeAchievements,
    checkTotalAttributesAchievement,
    checkPepTalkListeningAchievements,
    checkDailyCompletionAchievement,
    checkStoryChapterAchievement,
    checkFullStorylineAchievement,
    checkComebackAchievement,
  };
};
