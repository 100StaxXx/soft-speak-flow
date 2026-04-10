import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { useResilience } from "@/contexts/ResilienceContext";
import { supabase } from "@/integrations/supabase/client";
import type { DailyTask } from "@/services/dailyTasksRemote";
import {
  getPlannerRecord,
  getLocalSubtasksForTask,
  removePlannerRecords,
  upsertPlannerRecord,
  upsertPlannerRecords,
} from "@/utils/plannerLocalStore";
import {
  dispatchPlannerSyncFinished,
  withPlannerRemoteSyncLock,
} from "@/utils/plannerSync";
import {
  normalizeRitualSchedule,
  reconcileHabitLinkedTasks,
  type HabitTaskTemplate,
  type NormalizedRitualSchedule,
} from "@/hooks/habitTaskReconciliation";

interface LocalHabitRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  difficulty: string | null;
  frequency: string;
  estimated_minutes: number | null;
  preferred_time: string | null;
  category: string | null;
  custom_days: number[] | null;
  custom_month_days: number[] | null;
  reminder_enabled: boolean | null;
  reminder_minutes_before: number | null;
  is_active: boolean | null;
  current_streak: number | null;
  longest_streak: number | null;
  created_at: string | null;
  sort_order?: number | null;
}

type DailyTaskWritePayload = Pick<
  DailyTask,
  | "id"
  | "task_text"
  | "difficulty"
  | "xp_reward"
  | "task_date"
  | "completed"
  | "completed_at"
  | "is_main_quest"
  | "scheduled_time"
  | "estimated_duration"
  | "recurrence_pattern"
  | "recurrence_days"
  | "recurrence_month_days"
  | "recurrence_custom_period"
  | "recurrence_end_date"
  | "is_recurring"
  | "reminder_enabled"
  | "reminder_minutes_before"
  | "category"
  | "notes"
  | "contact_id"
  | "auto_log_interaction"
  | "image_url"
  | "location"
  | "source"
  | "habit_source_id"
  | "epic_id"
  | "parent_template_id"
  | "sort_order"
> & {
  user_id: string;
};

export interface RitualUpdateInput {
  habitId: string;
  title: string;
  description?: string | null;
  difficulty: string;
  frequency: string;
  estimatedMinutes?: number | null;
  preferredTime?: string | null;
  category?: string | null;
  customDays?: number[] | null;
  customMonthDays?: number[] | null;
  customPeriod?: "week" | "month" | null;
  reminderEnabled?: boolean | null;
  reminderMinutesBefore?: number | null;
}

export interface RitualUpdateResult {
  queued: boolean;
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
  normalizedSchedule: NormalizedRitualSchedule;
}

function buildTaskCreatePayload(task: DailyTask): DailyTaskWritePayload {
  return {
    id: task.id,
    user_id: task.user_id,
    task_text: task.task_text,
    difficulty: task.difficulty,
    xp_reward: task.xp_reward,
    task_date: task.task_date,
    completed: task.completed,
    completed_at: task.completed_at,
    is_main_quest: task.is_main_quest,
    scheduled_time: task.scheduled_time,
    estimated_duration: task.estimated_duration,
    recurrence_pattern: task.recurrence_pattern,
    recurrence_days: task.recurrence_days,
    recurrence_month_days: task.recurrence_month_days,
    recurrence_custom_period: task.recurrence_custom_period,
    recurrence_end_date: task.recurrence_end_date ?? null,
    is_recurring: task.is_recurring,
    reminder_enabled: task.reminder_enabled,
    reminder_minutes_before: task.reminder_minutes_before,
    category: task.category,
    notes: task.notes,
    contact_id: task.contact_id,
    auto_log_interaction: task.auto_log_interaction,
    image_url: task.image_url,
    location: task.location,
    source: task.source,
    habit_source_id: task.habit_source_id,
    epic_id: task.epic_id,
    parent_template_id: task.parent_template_id,
    sort_order: task.sort_order ?? null,
  };
}

async function removeLocalTasksAndSubtasks(tasks: DailyTask[]): Promise<void> {
  if (tasks.length === 0) return;

  for (const task of tasks) {
    const subtasks = await getLocalSubtasksForTask<{ id: string; task_id: string }>(task.id);
    if (subtasks.length > 0) {
      await removePlannerRecords("subtasks", subtasks.map((subtask) => subtask.id));
    }
  }

  await removePlannerRecords("daily_tasks", tasks.map((task) => task.id));
}

export function useRitualUpdate() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { queueAction, queueTaskAction, shouldQueueWrites, retryNow } = useResilience();

  const saveRitual = useCallback(async (input: RitualUpdateInput): Promise<RitualUpdateResult> => {
    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    return withPlannerRemoteSyncLock(user.id, async () => {
      const normalizedSchedule = normalizeRitualSchedule({
        frequency: input.frequency,
        customDays: input.customDays,
        customMonthDays: input.customMonthDays,
        customPeriod: input.customPeriod,
      });

      const existingHabit = await getPlannerRecord<LocalHabitRow>("habits", input.habitId);
      const habitUpdatePayload = {
        title: input.title.trim(),
        description: input.description?.trim() ? input.description.trim() : null,
        difficulty: input.difficulty,
        frequency: normalizedSchedule.frequency,
        estimated_minutes: input.estimatedMinutes ?? null,
        preferred_time: input.preferredTime ?? null,
        category: input.category ?? null,
        custom_days: normalizedSchedule.custom_days,
        custom_month_days: normalizedSchedule.custom_month_days,
        reminder_enabled: input.reminderEnabled ?? false,
        reminder_minutes_before: input.reminderMinutesBefore ?? 15,
      };

      const nextHabit: LocalHabitRow = {
        id: input.habitId,
        user_id: user.id,
        title: habitUpdatePayload.title,
        description: habitUpdatePayload.description,
        difficulty: habitUpdatePayload.difficulty,
        frequency: habitUpdatePayload.frequency,
        estimated_minutes: habitUpdatePayload.estimated_minutes,
        preferred_time: habitUpdatePayload.preferred_time,
        category: habitUpdatePayload.category,
        custom_days: habitUpdatePayload.custom_days,
        custom_month_days: habitUpdatePayload.custom_month_days,
        reminder_enabled: habitUpdatePayload.reminder_enabled,
        reminder_minutes_before: habitUpdatePayload.reminder_minutes_before,
        is_active: existingHabit?.is_active ?? true,
        current_streak: existingHabit?.current_streak ?? 0,
        longest_streak: existingHabit?.longest_streak ?? 0,
        created_at: existingHabit?.created_at ?? new Date().toISOString(),
        sort_order: existingHabit?.sort_order ?? null,
      };

      await upsertPlannerRecord("habits", nextHabit);

      const taskTemplate: HabitTaskTemplate = {
        habitId: input.habitId,
        userId: user.id,
        title: nextHabit.title,
        difficulty: nextHabit.difficulty,
        estimated_minutes: nextHabit.estimated_minutes,
        preferred_time: nextHabit.preferred_time,
        category: nextHabit.category,
        reminder_enabled: nextHabit.reminder_enabled,
        reminder_minutes_before: nextHabit.reminder_minutes_before,
        frequency: nextHabit.frequency,
        custom_days: nextHabit.custom_days,
        custom_month_days: nextHabit.custom_month_days,
        customPeriod: normalizedSchedule.customPeriod,
      };

      const reconciliation = await reconcileHabitLinkedTasks(taskTemplate);
      const nextTasks = [
        ...reconciliation.createdTasks,
        ...reconciliation.updatedTasks.map(({ nextTask }) => nextTask),
      ];

      if (nextTasks.length > 0) {
        await upsertPlannerRecords("daily_tasks", nextTasks);
      }
      await removeLocalTasksAndSubtasks(reconciliation.deletedTasks);

      let queued = false;
      let queuedFromFallback = false;

      const queueHabitUpdate = async () => {
        await queueAction({
          actionKind: "HABIT_UPDATE",
          entityType: "habit",
          entityId: input.habitId,
          payload: {
            habitId: input.habitId,
            updates: habitUpdatePayload,
          },
        });
        queued = true;
      };

      const queueTaskWrites = async () => {
        await Promise.all([
          ...reconciliation.createdTasks.map((task) =>
            queueTaskAction("CREATE_TASK", buildTaskCreatePayload(task)),
          ),
          ...reconciliation.updatedTasks.map(({ existingTask, updates }) =>
            queueTaskAction("UPDATE_TASK", {
              taskId: existingTask.id,
              updates,
            }),
          ),
          ...reconciliation.deletedTasks.map((task) =>
            queueTaskAction("DELETE_TASK", {
              taskId: task.id,
            }),
          ),
        ]);
        if (
          reconciliation.createdTasks.length > 0
          || reconciliation.updatedTasks.length > 0
          || reconciliation.deletedTasks.length > 0
        ) {
          queued = true;
        }
      };

      if (shouldQueueWrites) {
        await queueHabitUpdate();
        await queueTaskWrites();
      } else {
        const { error: habitError } = await supabase
          .from("habits")
          .update(habitUpdatePayload)
          .eq("id", input.habitId)
          .eq("user_id", user.id);

        if (habitError) {
          await queueHabitUpdate();
          queuedFromFallback = true;
        }

        for (const task of reconciliation.createdTasks) {
          const { error } = await supabase
            .from("daily_tasks")
            .upsert(buildTaskCreatePayload(task), {
              onConflict: "user_id,task_date,habit_source_id",
              ignoreDuplicates: true,
            });

          if (!error) continue;

          await queueTaskAction("CREATE_TASK", buildTaskCreatePayload(task));
          queued = true;
          queuedFromFallback = true;
        }

        for (const { existingTask, updates } of reconciliation.updatedTasks) {
          const { error } = await supabase
            .from("daily_tasks")
            .update(updates)
            .eq("id", existingTask.id)
            .eq("user_id", user.id);

          if (!error) continue;

          await queueTaskAction("UPDATE_TASK", {
            taskId: existingTask.id,
            updates,
          });
          queued = true;
          queuedFromFallback = true;
        }

        for (const task of reconciliation.deletedTasks) {
          const { error } = await supabase
            .from("daily_tasks")
            .delete()
            .eq("id", task.id)
            .eq("user_id", user.id);

          if (!error) continue;

          await queueTaskAction("DELETE_TASK", {
            taskId: task.id,
          });
          queued = true;
          queuedFromFallback = true;
        }
      }

      if (queuedFromFallback) {
        void retryNow();
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["habits"] }),
        queryClient.invalidateQueries({ queryKey: ["epics"] }),
        queryClient.invalidateQueries({ queryKey: ["epic-progress"] }),
        queryClient.invalidateQueries({ queryKey: ["habit-surfacing"] }),
        queryClient.invalidateQueries({ queryKey: ["daily-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ]);
      dispatchPlannerSyncFinished();

      return {
        queued,
        createdCount: reconciliation.createdTasks.length,
        updatedCount: reconciliation.updatedTasks.length,
        deletedCount: reconciliation.deletedTasks.length,
        normalizedSchedule,
      };
    });
  }, [queryClient, queueAction, queueTaskAction, retryNow, shouldQueueWrites, user?.id]);

  return { saveRitual };
}
