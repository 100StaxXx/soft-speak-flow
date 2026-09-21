import { useMemo } from "react";
import { format } from "date-fns";

import { useAdaptiveDailyFormation } from "@/hooks/useAdaptiveDailyFormation";
import { useAuth } from "@/hooks/useAuth";
import type { DailyTask } from "@/hooks/useTasksQuery";
import { useWidgetSync } from "@/hooks/useWidgetSync";

interface GlobalWidgetSyncOptions {
  enabled?: boolean;
  profileWallpaper?: {
    imageUrl: string;
    dateKey: string;
  } | null;
}

const buildPreparedPracticeTask = (
  userId: string,
  taskDate: string,
  action: string,
  category: string,
  options: {
    id?: string | null;
    completed?: boolean;
    completedAt?: string | null;
    xpReward?: number;
    notes?: string | null;
  } = {},
): DailyTask => ({
  id: options.id ?? `prepared-practice-${taskDate}`,
  user_id: userId,
  task_text: action,
  difficulty: "easy",
  xp_reward: options.xpReward ?? 10,
  task_date: taskDate,
  completed: options.completed ?? false,
  completed_at: options.completedAt ?? null,
  is_main_quest: true,
  scheduled_time: null,
  estimated_duration: null,
  recurrence_pattern: null,
  recurrence_days: null,
  is_recurring: false,
  reminder_enabled: false,
  reminder_minutes_before: null,
  reminder_sent: false,
  parent_template_id: null,
  category,
  is_bonus: false,
  created_at: null,
  priority: null,
  is_top_three: false,
  actual_time_spent: null,
  ai_generated: true,
  context_id: null,
  source: "faithful_step",
  habit_source_id: null,
  epic_id: null,
  contact_id: null,
  auto_log_interaction: false,
  image_url: null,
  notes: options.notes ?? null,
  location: null,
});

export const useGlobalWidgetSync = (options: GlobalWidgetSyncOptions = {}): void => {
  const { enabled = true, profileWallpaper = null } = options;
  const { user } = useAuth();

  const syncEnabled = enabled && !!user;
  const { assignment, isLoading } = useAdaptiveDailyFormation({
    enabled: syncEnabled,
    category: "Soul",
  });
  const taskDate = assignment?.practiceDate ?? format(new Date(), "yyyy-MM-dd");
  const dailyPracticeTasks = useMemo(() => {
    if (!user || !assignment) return [];

    return [buildPreparedPracticeTask(
      user.id,
      taskDate,
      assignment.practice.action,
      assignment.practice.category.toLowerCase(),
      {
        id: assignment.taskId,
        completed: Boolean(assignment.completedAt),
        completedAt: assignment.completedAt,
        xpReward: assignment.practice.xpReward,
        notes: `${assignment.practice.title} · ${assignment.practice.benefit}`,
      },
    )];
  }, [assignment, taskDate, user]);

  useWidgetSync(dailyPracticeTasks, taskDate, {
    enabled: syncEnabled && !isLoading && Boolean(assignment),
    profileWallpaper,
  });
};
