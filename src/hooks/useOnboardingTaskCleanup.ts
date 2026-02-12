import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/utils/storage";

const ONBOARDING_TASK_CLEANUP_VERSION = 1;

const getCleanupKey = (userId: string) =>
  `onboarding_task_cleanup_version_${ONBOARDING_TASK_CLEANUP_VERSION}_${userId}`;

export function useOnboardingTaskCleanup(
  userId: string | undefined,
  hasCompletedWalkthrough: boolean,
  isProfileLoading = false
) {
  const queryClient = useQueryClient();
  const cleanupInFlightRef = useRef(false);

  useEffect(() => {
    if (isProfileLoading || !userId || !hasCompletedWalkthrough) {
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
        const { error } = await supabase
          .from("daily_tasks")
          .delete()
          .eq("user_id", userId)
          .eq("source", "onboarding");

        if (error) {
          console.error("[OnboardingCleanup] Failed to delete onboarding tasks:", error);
          return;
        }

        safeLocalStorage.setItem(cleanupKey, "true");
        queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
        queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      } finally {
        cleanupInFlightRef.current = false;
      }
    })();
  }, [hasCompletedWalkthrough, isProfileLoading, queryClient, userId]);
}

