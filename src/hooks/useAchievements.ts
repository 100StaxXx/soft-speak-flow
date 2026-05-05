import { useCallback, useRef } from "react";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { playAchievementUnlock } from "@/utils/soundEffects";
import { AdversaryTheme } from "@/types/astralEncounters";
import { STORY_TYPE_BADGES } from "@/types/epicRewards";
import {
  getAchievementTypeVariants,
  normalizeAchievementType,
} from "@/lib/achievementTypes";
import { isSupabaseMissingRelationError } from "@/utils/supabaseSchemaErrors";

import { useAuth } from "./useAuth";

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
    [key: string]: string | number | boolean | undefined;
  };
}

export const useAchievements = () => {
  const { user } = useAuth();

  // Track achievements already handled this session to prevent duplicate toasts and writes.
  const notifiedAchievements = useRef<Set<string>>(new Set());
  const achievementsTableUnavailable = useRef(false);

  const awardAchievement = useCallback(async (achievement: AchievementData) => {
    if (!user) return;
    if (achievementsTableUnavailable.current) return;

    const canonicalType = normalizeAchievementType(achievement.type);
    if (!canonicalType) return;
    if (notifiedAchievements.current.has(canonicalType)) return;

    try {
      let existingAchievements: Array<{ id: string }> | null = null;

      if (canonicalType === "story_chapter") {
        const { data, error } = await supabase
          .from("achievements")
          .select("id")
          .eq("user_id", user.id)
          .or("achievement_type.eq.story_chapter,achievement_type.like.story_chapter_%")
          .limit(1);

        if (error) {
          if (isSupabaseMissingRelationError(error, "achievements")) {
            achievementsTableUnavailable.current = true;
            return;
          }
          throw error;
        }
        existingAchievements = data;
      } else {
        const { data, error } = await supabase
          .from("achievements")
          .select("id")
          .eq("user_id", user.id)
          .in("achievement_type", getAchievementTypeVariants(canonicalType))
          .limit(1);

        if (error) {
          if (isSupabaseMissingRelationError(error, "achievements")) {
            achievementsTableUnavailable.current = true;
            return;
          }
          throw error;
        }
        existingAchievements = data;
      }

      if (existingAchievements && existingAchievements.length > 0) {
        notifiedAchievements.current.add(canonicalType);
        return;
      }

      const { data, error } = await supabase
        .from("achievements")
        .upsert({
          user_id: user.id,
          achievement_type: canonicalType,
          title: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
          tier: achievement.tier,
          metadata: achievement.metadata || {},
        }, {
          onConflict: "user_id,achievement_type",
          ignoreDuplicates: true,
        })
        .select("id")
        .maybeSingle();

      if (error) {
        if (isSupabaseMissingRelationError(error, "achievements")) {
          achievementsTableUnavailable.current = true;
          return;
        }
        throw error;
      }

      notifiedAchievements.current.add(canonicalType);

      if (data) {
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
    if (streak >= 3) {
      await awardAchievement({
        type: "streak_3_day",
        title: "Getting Started",
        description: "3 days of consistency",
        icon: "flame",
        tier: "bronze",
        metadata: {
          streak,
          pepTalkDuration: "2-3 min",
          pepTalkMessage: "You're showing effort today. Keep that energy.",
          pepTalkCategory: "encouragement",
        },
      });
    }

    if (streak >= 7) {
      await awardAchievement({
        type: "streak_7_day",
        title: "Week of Discipline",
        description: "7 days of unwavering commitment",
        icon: "trophy",
        tier: "silver",
        metadata: {
          streak,
          pepTalkDuration: "4-5 min",
          pepTalkMessage: "You're not who you were last week. You're growing.",
          pepTalkCategory: "discipline",
        },
      });
    }

    if (streak >= 14) {
      await awardAchievement({
        type: "streak_14_day",
        title: "Fortnight Force",
        description: "14 days of unwavering discipline",
        icon: "trophy",
        tier: "gold",
        metadata: {
          streak,
          pepTalkDuration: "4-5 min",
          pepTalkMessage: "Two weeks of showing up. That's the discipline talking.",
          pepTalkCategory: "discipline",
        },
      });
    }

    if (streak >= 30) {
      await awardAchievement({
        type: "streak_30_day",
        title: "Monthly Master",
        description: "Maintained a 30-day streak",
        icon: "crown",
        tier: "platinum",
        metadata: {
          streak,
          pepTalkDuration: "7-10 min",
          pepTalkMessage: "A month ago, you started. Today, you're different. This is transformation.",
          pepTalkCategory: "breakthrough",
        },
      });
    }
  };

  const checkChallengeAchievements = async (completedCount: number) => {
    if (completedCount >= 1) {
      await awardAchievement({
        type: "challenge_complete",
        title: "Challenge Accepted",
        description: "Completed a challenge",
        icon: "target",
        tier: "silver",
      });
    }

    if (completedCount >= 5) {
      await awardAchievement({
        type: "challenge_5_complete",
        title: "Challenge Seeker",
        description: "Completed 5 challenges",
        icon: "target",
        tier: "gold",
      });
    }
  };

  const checkFirstTimeAchievements = async (
    type: "habit" | "checkin" | "peptalk" | "mission" | "epic",
  ) => {
    const achievementMap = {
      habit: {
        type: "first_habit",
        title: "Habit Starter",
        description: "Completed your first habit",
        icon: "check",
        tier: "bronze" as const,
        metadata: {
          pepTalkDuration: "1 min",
          pepTalkMessage: "Welcome. Every journey starts with one step.",
          pepTalkCategory: "welcome",
        },
      },
      checkin: {
        type: "first_check_in",
        title: "Self Aware",
        description: "Completed your first check-in",
        icon: "sunrise",
        tier: "bronze" as const,
        metadata: {
          pepTalkDuration: "1 min",
          pepTalkMessage: "You showed up today. That matters.",
          pepTalkCategory: "welcome",
        },
      },
      peptalk: {
        type: "first_pep_talk",
        title: "First Listen",
        description: "Listened to your first pep talk",
        icon: "headphones",
        tier: "bronze" as const,
        metadata: {
          pepTalkDuration: "1 min",
          pepTalkMessage: "You're here. You're listening. Keep going.",
          pepTalkCategory: "welcome",
        },
      },
      mission: {
        type: "first_quest",
        title: "Quest Beginner",
        description: "Completed your first quest",
        icon: "target",
        tier: "bronze" as const,
        metadata: {
          pepTalkDuration: "1 min",
          pepTalkMessage: "One quest down. This is how change happens.",
          pepTalkCategory: "welcome",
        },
      },
      epic: {
        type: "first_epic",
        title: "Epic Starter",
        description: "Created your first epic",
        icon: "rocket",
        tier: "bronze" as const,
        metadata: {
          pepTalkDuration: "1 min",
          pepTalkMessage: "A new campaign begins. This is the first page of something bigger.",
          pepTalkCategory: "welcome",
        },
      },
    };

    await awardAchievement(achievementMap[type]);
  };

  const checkCompanionAchievements = async (stage: number) => {
    if (stage >= 5) {
      await awardAchievement({
        type: "companion_level_5",
        title: "Growing Together",
        description: "Your companion reached Stage 5 • Initiate",
        icon: "sparkles",
        tier: "bronze",
        metadata: {
          stage,
          pepTalkDuration: "2-3 min",
          pepTalkMessage: "Watch how your companion changes as you do.",
          pepTalkCategory: "growth",
        },
      });
    }

    if (stage >= 21) {
      await awardAchievement({
        type: "companion_level_21",
        title: "Deep Bond",
        description: "Your companion reached Stage 21 • Guardian",
        icon: "sparkles",
        tier: "silver",
        metadata: {
          stage,
          pepTalkDuration: "4-5 min",
          pepTalkMessage: "Guardian tier. The bond is undeniable now.",
          pepTalkCategory: "discipline",
        },
      });
    }

    if (stage >= 56) {
      await awardAchievement({
        type: "companion_level_56",
        title: "Champion Bond",
        description: "Your companion reached Stage 56 • Mythic",
        icon: "star",
        tier: "gold",
        metadata: {
          stage,
          pepTalkDuration: "4-5 min",
          pepTalkMessage: "Mythic tier. This is discipline and consistency made visible.",
          pepTalkCategory: "discipline",
        },
      });
    }

    if (stage >= 100) {
      await awardAchievement({
        type: "companion_level_100",
        title: "Ultimate Bond",
        description: "Your companion reached Stage 100 • Ascended",
        icon: "crown",
        tier: "platinum",
        metadata: {
          stage,
          pepTalkDuration: "7-10 min",
          pepTalkMessage: "Stage 100. This bond has become legend.",
          pepTalkCategory: "breakthrough",
        },
      });
    }
  };

  const checkAttributeAchievements = async (attribute: "mind" | "body" | "soul", value: number) => {
    if (value < 100) return;

    const attrName = attribute.charAt(0).toUpperCase() + attribute.slice(1);
    const icon = attribute === "mind" ? "brain" : attribute === "body" ? "dumbbell" : "sparkles";

    await awardAchievement({
      type: `attribute_master_${attribute}`,
      title: `${attrName} Master`,
      description: `Reached 100 ${attrName} attribute`,
      icon,
      tier: "gold",
      metadata: {
        attribute,
        value,
        pepTalkDuration: "7-10 min",
        pepTalkMessage: `${attrName} is fully lit up now. You earned this.`,
        pepTalkCategory: "breakthrough",
      },
    });
  };

  const checkTotalAttributesAchievement = async (total: number) => {
    if (total < 250) return;

    await awardAchievement({
      type: "total_attributes_250",
      title: "Well Rounded",
      description: "Reached 250 total attributes",
      icon: "crown",
      tier: "platinum",
      metadata: {
        total,
        pepTalkDuration: "7-10 min",
        pepTalkMessage: "Mind, Body, Soul - all growing together. This is true transformation.",
        pepTalkCategory: "breakthrough",
      },
    });
  };

  const checkPepTalkListeningAchievements = async (count: number) => {
    if (count >= 10) {
      await awardAchievement({
        type: "pep_talk_listener_10",
        title: "Avid Listener",
        description: "Listened to 10 pep talks",
        icon: "headphones",
        tier: "silver",
        metadata: {
          count,
          pepTalkDuration: "4-5 min",
          pepTalkMessage: "Ten talks. You're committed to this growth.",
          pepTalkCategory: "discipline",
        },
      });
    }

    if (count >= 50) {
      await awardAchievement({
        type: "pep_talk_listener_50",
        title: "Wisdom Seeker",
        description: "Listened to 50 pep talks",
        icon: "headphones",
        tier: "gold",
        metadata: {
          count,
          pepTalkDuration: "7-10 min",
          pepTalkMessage: "You've built a real library of encouragement inside yourself now.",
          pepTalkCategory: "breakthrough",
        },
      });
    }
  };

  const checkDailyCompletionAchievement = useCallback(async (date?: string) => {
    if (!user?.id) return;

    const effectiveDate = date ?? new Date().toISOString().split("T")[0];
    const [
      { count: habitCount },
      { count: habitCompletionCount },
      { count: checkInCount },
      { count: missionCount },
      { count: completedMissionCount },
    ] = await Promise.all([
      supabase
        .from("habits")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_active", true),
      supabase
        .from("habit_completions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("date", effectiveDate),
      supabase
        .from("daily_check_ins")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("check_in_date", effectiveDate),
      supabase
        .from("daily_missions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("mission_date", effectiveDate),
      supabase
        .from("daily_missions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("mission_date", effectiveDate)
        .eq("completed", true),
    ]);

    const activeHabits = habitCount ?? 0;
    const completedHabits = habitCompletionCount ?? 0;
    const completedCheckIns = checkInCount ?? 0;
    const missionsForDay = missionCount ?? 0;
    const completedMissions = completedMissionCount ?? 0;

    if (activeHabits === 0 || completedHabits < activeHabits || completedCheckIns === 0) {
      return;
    }

    if (missionsForDay > 0 && completedMissions < missionsForDay) {
      return;
    }

    await awardAchievement({
      type: "perfect_day",
      title: "Perfect Day",
      description: "Completed all daily activities",
      icon: "check-circle",
      tier: "gold",
      metadata: {
        pepTalkDuration: "2-3 min",
        pepTalkMessage: "You did it all today. Every. Single. Thing.",
        pepTalkCategory: "encouragement",
      },
    });
  }, [awardAchievement, user?.id]);

  const checkStoryChapterAchievement = async () => {
    await awardAchievement({
      type: "story_chapter",
      title: "Story Lover",
      description: "Read a companion story chapter",
      icon: "book",
      tier: "bronze",
      metadata: {
        chapterUnlocked: true,
        pepTalkDuration: "4-5 min",
        pepTalkMessage: "Another chapter. Your story is unfolding.",
        pepTalkCategory: "discipline",
      },
    });
  };

  const checkFullStorylineAchievement = async () => {
    await awardAchievement({
      type: "full_storyline",
      title: "Lore Master",
      description: "Read all available story chapters",
      icon: "crown",
      tier: "platinum",
      metadata: {
        pepTalkDuration: "7-10 min",
        pepTalkMessage: "The full story. From beginning to now. Look at how far you've come.",
        pepTalkCategory: "breakthrough",
      },
    });
  };

  const checkComebackAchievement = async (daysInactive: number = 0) => {
    if (daysInactive < 7) return;

    await awardAchievement({
      type: "comeback",
      title: "Comeback King",
      description: "Returned after a break",
      icon: "crown",
      tier: "silver",
      metadata: {
        daysInactive,
        pepTalkDuration: "7-10 min",
        pepTalkMessage: "You came back. That's what matters. Welcome home.",
        pepTalkCategory: "breakthrough",
      },
    });
  };

  const checkArcadeDiscovery = useCallback(async () => {
    await awardAchievement({
      type: "arcade_explorer",
      title: "Arcade Explorer",
      description: "Discovered the hidden Astral Arcade",
      icon: "gamepad-2",
      tier: "silver",
      metadata: {
        pepTalkMessage: "You found the secret arcade. Nice work, explorer.",
        pepTalkCategory: "discovery",
      },
    });
  }, [awardAchievement]);

  const checkAdversaryDefeatAchievements = useCallback(async (
    theme: AdversaryTheme,
    timesDefeated: number,
  ): Promise<{ shouldRollLoot: boolean; lootTier: "rare" | "epic" | "legendary" | null }> => {
    const themeNames: Record<AdversaryTheme, { prefix: string; icon: string }> = {
      distraction: { prefix: "Focus", icon: "target" },
      stagnation: { prefix: "Momentum", icon: "waves" },
      anxiety: { prefix: "Serenity", icon: "heart" },
      doubt: { prefix: "Confidence", icon: "shield" },
      chaos: { prefix: "Order", icon: "zap" },
      laziness: { prefix: "Drive", icon: "flame" },
      overthinking: { prefix: "Clarity", icon: "brain" },
      fear: { prefix: "Courage", icon: "shield" },
      confusion: { prefix: "Wisdom", icon: "sparkles" },
      vulnerability: { prefix: "Resilience", icon: "gem" },
      imbalance: { prefix: "Harmony", icon: "scale" },
    };

    const { prefix, icon } = themeNames[theme];
    let shouldRollLoot = false;
    let lootTier: "rare" | "epic" | "legendary" | null = null;

    if (timesDefeated === 3) {
      await awardAchievement({
        type: `astral_${theme}_3`,
        title: `${prefix} Initiate`,
        description: `Defeated 3 ${theme} adversaries`,
        icon,
        tier: "bronze",
        metadata: { theme, count: 3 },
      });
    } else if (timesDefeated === 10) {
      await awardAchievement({
        type: `astral_${theme}_10`,
        title: `${prefix} Warrior`,
        description: `Defeated 10 ${theme} adversaries`,
        icon,
        tier: "silver",
        metadata: { theme, count: 10 },
      });
      shouldRollLoot = true;
      lootTier = "rare";
    } else if (timesDefeated === 25) {
      await awardAchievement({
        type: `astral_${theme}_25`,
        title: `${prefix} Champion`,
        description: `Defeated 25 ${theme} adversaries`,
        icon,
        tier: "gold",
        metadata: { theme, count: 25 },
      });
      shouldRollLoot = true;
      lootTier = "epic";
    } else if (timesDefeated === 50) {
      await awardAchievement({
        type: `astral_${theme}_50`,
        title: `${prefix} Transcendent`,
        description: `Defeated 50 ${theme} adversaries`,
        icon,
        tier: "platinum",
        metadata: { theme, count: 50 },
      });
      shouldRollLoot = true;
      lootTier = "legendary";
    }

    return { shouldRollLoot, lootTier };
  }, [awardAchievement]);

  const checkStoryCompletionAchievement = useCallback(async (storyTypeSlug: string | null | undefined) => {
    if (!storyTypeSlug) return;

    const badgeInfo = STORY_TYPE_BADGES[storyTypeSlug];
    if (!badgeInfo) return;

    await awardAchievement({
      type: badgeInfo.achievementType,
      title: badgeInfo.title,
      description: badgeInfo.description,
      icon: badgeInfo.icon,
      tier: badgeInfo.tier,
      metadata: {
        storyTypeSlug,
      },
    });
  }, [awardAchievement]);

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
    checkArcadeDiscovery,
    checkAdversaryDefeatAchievements,
    checkStoryCompletionAchievement,
  };
};
