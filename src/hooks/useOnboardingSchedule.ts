import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/utils/storage";

/**
 * First-day onboarding schedule for new users
 * Total: 10 XP (triggers first companion evolution)
 */
export const ONBOARDING_TASKS = [
  {
    task_text: "Meet Your Companion ✨",
    xp_reward: 2,
    difficulty: "easy",
    sort_order: 0,
  },
  {
    task_text: "Morning Check-in 🌅",
    xp_reward: 3,
    difficulty: "easy",
    sort_order: 1,
  },
  {
    task_text: "Create Your First Campaign 🚀",
    xp_reward: 3,
    difficulty: "easy",
    sort_order: 2,
  },
  {
    task_text: "Create Your First Quest 🎯",
    xp_reward: 2,
    difficulty: "easy",
    sort_order: 3,
  },
];

/**
 * Hook to create onboarding tasks for new users
 * @param userId - The user's ID
 * @param hasCompletedWalkthrough - Whether the user completed the main onboarding walkthrough
 * @param isProfileLoading - Whether the profile is still loading
 */
export function useOnboardingSchedule(
  userId: string | undefined,
  hasCompletedWalkthrough: boolean,
  isProfileLoading: boolean = false
) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    // Wait for profile to load before making any decisions
    if (isProfileLoading) {
      console.log("[Onboarding] Waiting for profile to load...");
      return;
    }

    // Only create tasks for authenticated users who completed the walkthrough
    if (!userId || !hasCompletedWalkthrough) {
      console.log("[Onboarding] Skipping schedule creation:", {
        hasUserId: !!userId,
        hasCompletedWalkthrough,
        isProfileLoading,
      });
      return;
    }

    // Prevent concurrent creation attempts
    if (isCreating) {
      console.log("[Onboarding] Already creating tasks, skipping...");
      return;
    }

    const scheduleKey = `onboarding_schedule_created_${userId}`;
    const alreadyCreated = safeLocalStorage.getItem(scheduleKey) === "true";

    if (alreadyCreated) {
      console.log("[Onboarding] Schedule already created for user (localStorage)");
      return;
    }

    console.log("[Onboarding] Creating onboarding schedule for new user");

    const createOnboardingSchedule = async () => {
      setIsCreating(true);
      
      try {
        // Check if any onboarding tasks already exist
        const { data: existingTasks } = await supabase
          .from("daily_tasks")
          .select("id, task_text")
          .eq("user_id", userId)
          .in("task_text", ONBOARDING_TASKS.map((t) => t.task_text));

        if (existingTasks && existingTasks.length > 0) {
          console.log("[Onboarding] Onboarding tasks already exist, marking as created");
          safeLocalStorage.setItem(scheduleKey, "true");
          setIsCreating(false);
          return;
        }

        // Also check for old "Join Cosmiq" quest and skip if found (legacy users)
        const { data: legacyTask } = await supabase
          .from("daily_tasks")
          .select("id")
          .eq("user_id", userId)
          .eq("task_text", "Join Cosmiq")
          .maybeSingle();

        if (legacyTask) {
          console.log("[Onboarding] Legacy user detected, skipping onboarding tasks");
          safeLocalStorage.setItem(scheduleKey, "true");
          setIsCreating(false);
          return;
        }

        const today = format(new Date(), "yyyy-MM-dd");

        // Create all onboarding tasks
        const tasksToInsert = ONBOARDING_TASKS.map((task) => ({
          user_id: userId,
          task_text: task.task_text,
          xp_reward: task.xp_reward,
          difficulty: task.difficulty,
          task_date: today,
          is_main_quest: false,
          sort_order: task.sort_order,
          source: "onboarding",
        }));

        const { error } = await supabase
          .from("daily_tasks")
          .insert(tasksToInsert);

        if (error) {
          console.error("[Onboarding] Failed to create onboarding schedule:", error);
          setIsCreating(false);
          return;
        }

        console.log("[Onboarding] Successfully created", tasksToInsert.length, "onboarding tasks");
        safeLocalStorage.setItem(scheduleKey, "true");
        queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      } catch (error) {
        console.error("[Onboarding] Error creating onboarding schedule:", error);
      } finally {
        setIsCreating(false);
      }
    };

    createOnboardingSchedule();
  }, [userId, hasCompletedWalkthrough, isProfileLoading, queryClient, isCreating]);
}

/**
 * Check if a task is an onboarding task
 */
export function isOnboardingTask(taskText: string): boolean {
  return ONBOARDING_TASKS.some((t) => t.task_text === taskText);
}

/**
 * Get the onboarding task identifiers
 */
export const ONBOARDING_TASK_TEXTS = ONBOARDING_TASKS.map((t) => t.task_text);
