import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/utils/storage";

const ONBOARDING_TASK_CLEANUP_VERSION = 2;
const LEGACY_TUTORIAL_TASK_TITLES = [
  "Create Your First Quest 🎯",
  "Create Your First Quest",
  "Complete Your First Quest ✅",
  "Complete Your First Quest",
  "Meet Your Companion ✨",
  "Meet Your Companion",
  "Morning Check-in 🌅",
  "Morning Check-in",
  "Create Your First Campaign 🚀",
  "Create Your First Campaign",
  "Listen to Your Mentor 🎧",
  "Listen to Your Mentor",
] as const;
const LEGACY_TUTORIAL_XP_REWARDS = [2, 3, 4] as const;

const getCleanupKey = (userId: string) =>
  `onboarding_task_cleanup_version_${ONBOARDING_TASK_CLEANUP_VERSION}_${userId}`;

export function useOnboardingTaskCleanup(
  userId: string | undefined,
  cleanupEligible: boolean,
  isProfileLoading = false
) {
  const queryClient = useQueryClient();
  const cleanupInFlightRef = useRef(false);

  useEffect(() => {
    if (isProfileLoading || !userId || !cleanupEligible) {
      return;
    }

    const cleanupKey = getCleanupKey(userId);
    const hasRunCleanup = safeLocalStorage.getItem(cleanupKey) === "true";
    if (hasRunCleanup || cleanupInFlightRef.current) {
      return;
    }

    cleanupInFlightRef.current = true;

    void (async () => {
      try {
        const { error: sourceCleanupError } = await supabase
          .from("daily_tasks")
          .delete()
          .eq("user_id", userId)
          .eq("source", "onboarding");

        if (sourceCleanupError) {
          console.error(
            "[OnboardingCleanup] Failed to delete onboarding-source tasks:",
            sourceCleanupError
          );
          return;
        }

        const { error: titleCleanupError } = await supabase
          .from("daily_tasks")
          .delete()
          .eq("user_id", userId)
          .in("task_text", [...LEGACY_TUTORIAL_TASK_TITLES])
          .eq("difficulty", "easy")
          .eq("is_main_quest", false)
          .in("xp_reward", [...LEGACY_TUTORIAL_XP_REWARDS]);

        if (titleCleanupError) {
          console.error(
            "[OnboardingCleanup] Failed to delete legacy tutorial-title tasks:",
            titleCleanupError
          );
          return;
        }

        safeLocalStorage.setItem(cleanupKey, "true");
        queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
        queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      } finally {
        cleanupInFlightRef.current = false;
      }
    })();
  }, [cleanupEligible, isProfileLoading, queryClient, userId]);
}
