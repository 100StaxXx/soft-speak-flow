import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/utils/storage";

/**
 * First-day onboarding schedule for new users
 * Total: 10 XP (triggers first companion evolution)
 */
const ONBOARDING_TASKS = [
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

export function useOnboardingSchedule(userId: string | undefined, hasSeenTutorial: boolean) {
  const queryClient = useQueryClient();
  const creationRef = useRef(false);

  useEffect(() => {
    if (!userId || hasSeenTutorial || creationRef.current) return;

    const scheduleKey = `onboarding_schedule_created_${userId}`;
    const alreadyCreated = safeLocalStorage.getItem(scheduleKey) === "true";

    if (alreadyCreated) return;

    creationRef.current = true;

    const createOnboardingSchedule = async () => {
      try {
        // Check if any onboarding tasks already exist
        const { data: existingTasks } = await supabase
          .from("daily_tasks")
          .select("id, task_text")
          .eq("user_id", userId)
          .in("task_text", ONBOARDING_TASKS.map((t) => t.task_text));

        if (existingTasks && existingTasks.length > 0) {
          safeLocalStorage.setItem(scheduleKey, "true");
          creationRef.current = false;
          return;
        }

        // Also check for old "Join Cosmiq" quest and skip if found
        const { data: legacyTask } = await supabase
          .from("daily_tasks")
          .select("id")
          .eq("user_id", userId)
          .eq("task_text", "Join Cosmiq")
          .maybeSingle();

        if (legacyTask) {
          safeLocalStorage.setItem(scheduleKey, "true");
          creationRef.current = false;
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
          console.error("Failed to create onboarding schedule:", error);
          creationRef.current = false;
          return;
        }

        safeLocalStorage.setItem(scheduleKey, "true");
        queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      } catch (error) {
        console.error("Error creating onboarding schedule:", error);
      } finally {
        creationRef.current = false;
      }
    };

    createOnboardingSchedule();
  }, [userId, hasSeenTutorial, queryClient]);
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
