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
    category: "soul",
    estimated_duration: 2,
    notes:
      "1. Tap COMPANION in the bottom navigation bar.\n2. Wait for the companion page to load.\n3. Check your bond/progress panel.\nDone when this step auto-completes.",
  },
  {
    task_text: "Morning Check-in 🌅",
    xp_reward: 3,
    difficulty: "easy",
    sort_order: 1,
    category: "mind",
    estimated_duration: 3,
    notes:
      "1. Tap MENTOR in the bottom navigation bar.\n2. Open the Morning Check-in card.\n3. Submit your reflection.\nDone when this step auto-completes after submit.",
  },
  {
    task_text: "Create Your First Campaign 🚀",
    xp_reward: 3,
    difficulty: "easy",
    sort_order: 2,
    category: "mind",
    estimated_duration: 5,
    notes:
      "1. Tap QUESTS in the bottom navigation bar.\n2. Tap + in the lower-right corner.\n3. Choose \"Or create a Campaign\".\n4. Complete the campaign setup.\nDone when this step auto-completes.",
  },
  {
    task_text: "Create Your First Quest 🎯",
    xp_reward: 2,
    difficulty: "easy",
    sort_order: 3,
    category: "mind",
    estimated_duration: 2,
    notes:
      "1. Stay on QUESTS.\n2. Tap + in the lower-right corner.\n3. Enter your quest title.\n4. Save the quest.\nDone when this step auto-completes after save.",
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

    const createOnboardingSchedule = async () => {
      const alreadyCreated = safeLocalStorage.getItem(scheduleKey) === "true";

      // Recovery: verify tasks actually exist if flag is set
      if (alreadyCreated) {
        const { data: verification } = await supabase
          .from("daily_tasks")
          .select("id")
          .eq("user_id", userId)
          .eq("source", "onboarding")
          .limit(1);

        if (verification?.length) {
          console.log("[Onboarding] Schedule already created (verified)");
          return;
        }
        // Stale flag - clear and continue to create tasks
        console.log("[Onboarding] Stale flag detected - clearing for retry");
        safeLocalStorage.removeItem(scheduleKey);
      }

      setIsCreating(true);
      console.log("[Onboarding] Creating onboarding schedule for new user");

      try {
        // Check if any onboarding tasks already exist
        const { data: existingTasks } = await supabase
          .from("daily_tasks")
          .select("id, task_text")
          .eq("user_id", userId)
          .in("task_text", ONBOARDING_TASKS.map((t) => t.task_text));

        if (existingTasks && existingTasks.length > 0) {
          // Keep onboarding copy/metadata up to date for returning users
          await Promise.all(
            ONBOARDING_TASKS.map((task) =>
              supabase
                .from("daily_tasks")
                .update({
                  notes: task.notes,
                  xp_reward: task.xp_reward,
                  difficulty: task.difficulty,
                  sort_order: task.sort_order,
                  category: task.category,
                  estimated_duration: task.estimated_duration,
                })
                .eq("user_id", userId)
                .eq("source", "onboarding")
                .eq("task_text", task.task_text)
            )
          );

          console.log("[Onboarding] Onboarding tasks already exist, synced latest guidance");
          safeLocalStorage.setItem(scheduleKey, "true");
          queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
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
          notes: task.notes,
          category: task.category,
          estimated_duration: task.estimated_duration,
        }));

        const { data, error } = await supabase
          .from("daily_tasks")
          .insert(tasksToInsert)
          .select();

        if (error || !data?.length) {
          console.error("[Onboarding] Failed to create onboarding schedule:", error);
          // DON'T set localStorage - allow retry on next load
          setIsCreating(false);
          return;
        }

        console.log("[Onboarding] Successfully created", data.length, "onboarding tasks");
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
