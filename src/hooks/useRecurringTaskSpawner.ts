import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useResilience } from "@/contexts/ResilienceContext";
import {
  differenceInCalendarDays,
  format,
  getDay,
  isAfter,
  isValid,
  lastDayOfMonth,
  parseISO,
  startOfDay,
} from "date-fns";
import { toast } from "sonner";
import { getClampedMonthDays } from "@/utils/habitSchedule";
import { hasScheduledTimeValue } from "@/utils/recurrenceValidation";
import type { DailyTask } from "@/services/dailyTasksRemote";
import {
  PLANNER_SYNC_EVENT,
  canSyncPlannerFromRemote,
  loadLocalDailyTasks,
  syncLocalDailyTasksFromRemote,
} from "@/utils/plannerSync";
import {
  createOfflinePlannerId,
  getAllLocalTasksForUser,
  removePlannerRecords,
  upsertPlannerRecords,
} from "@/utils/plannerLocalStore";

export interface RecurringTask {
  id: string;
  task_text: string;
  difficulty: string | null;
  task_date: string | null;
  created_at: string | null;
  scheduled_time: string | null;
  estimated_duration: number | null;
  category: string | null;
  recurrence_pattern: string | null;
  recurrence_days: number[] | null;
  recurrence_month_days: number[] | null;
  recurrence_custom_period: "week" | "month" | null;
  recurrence_end_date: string | null;
  xp_reward: number;
  epic_id: string | null;
  reminder_enabled: boolean | null;
  reminder_minutes_before: number | null;
  sort_order?: number | null;
}

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

interface SpawnRecurringResult {
  data: { id: string }[];
  skippedMissingTimeCount: number;
  attemptedTemplateCount: number;
  failedTemplateCount: number;
  usedRowByRowFallback: boolean;
  usedArbiterInsertFallback: boolean;
  queuedCount: number;
}

interface RecurringTaskInsertPayload {
  id: string;
  user_id: string;
  task_text: string;
  task_date: string;
  difficulty: string | null;
  scheduled_time: string | null;
  estimated_duration: number | null;
  category: string | null;
  xp_reward: number;
  epic_id: string | null;
  reminder_enabled: boolean | null;
  reminder_minutes_before: number | null;
  parent_template_id: string;
  source: "recurring";
  is_recurring: false;
  sort_order: number | null;
}

interface SpawnFailure {
  templateId: string;
  code: string | null;
  message: string | null;
}

const RECURRING_TEMPLATE_SELECT_WITH_MONTH_RECURRENCE = `
  id,
  task_text,
  difficulty,
  task_date,
  created_at,
  scheduled_time,
  estimated_duration,
  category,
  recurrence_pattern,
  recurrence_days,
  recurrence_month_days,
  recurrence_custom_period,
  recurrence_end_date,
  xp_reward,
  epic_id,
  reminder_enabled,
  reminder_minutes_before,
  sort_order
`;
const RECURRING_TEMPLATE_SELECT_LEGACY_RECURRENCE = `
  id,
  task_text,
  difficulty,
  task_date,
  created_at,
  scheduled_time,
  estimated_duration,
  category,
  recurrence_pattern,
  recurrence_days,
  recurrence_end_date,
  xp_reward,
  epic_id,
  reminder_enabled,
  reminder_minutes_before,
  sort_order
`;

function isDailyTasksRecurrenceColumnsMissingError(error: SupabaseLikeError | null | undefined): boolean {
  if (!error) return false;

  const code = (error.code ?? "").toUpperCase();
  const haystack = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  const mentionsRecurrenceColumns = haystack.includes("recurrence_custom_period") || haystack.includes("recurrence_month_days");

  if (code === "42703" && mentionsRecurrenceColumns) return true;

  return mentionsRecurrenceColumns
    && (
      code.startsWith("PGRST")
      || haystack.includes("schema cache")
      || haystack.includes("does not exist")
      || haystack.includes("could not find the")
      || haystack.includes("column")
    );
}

function isOnConflictArbiterError(error: SupabaseLikeError | null | undefined): boolean {
  if (!error) return false;

  const code = (error.code ?? "").toUpperCase();
  const haystack = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();

  if (code === "42P10") return true;

  return haystack.includes("no unique or exclusion constraint matching the on conflict specification")
    || (haystack.includes("on conflict") && haystack.includes("arbiter"));
}

function isUniqueViolationError(error: SupabaseLikeError | null | undefined): boolean {
  if (!error) return false;

  const code = (error.code ?? "").toUpperCase();
  const haystack = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();

  if (code === "23505") return true;

  return haystack.includes("duplicate key")
    || haystack.includes("already exists")
    || haystack.includes("unique constraint");
}

async function fetchRecurringTemplatesRemote(userId: string): Promise<RecurringTask[]> {
  const fetchTemplates = (selectClause: string) => supabase
    .from("daily_tasks")
    .select(selectClause)
    .eq("user_id", userId)
    .eq("is_recurring", true)
    .not("recurrence_pattern", "is", null);

  let { data: templates, error } = await fetchTemplates(RECURRING_TEMPLATE_SELECT_WITH_MONTH_RECURRENCE);

  if (isDailyTasksRecurrenceColumnsMissingError(error)) {
    const fallback = await fetchTemplates(RECURRING_TEMPLATE_SELECT_LEGACY_RECURRENCE);
    templates = (fallback.data || []).map((template) => ({
      ...template,
      recurrence_month_days: null,
      recurrence_custom_period: null,
    }));
    error = fallback.error;
  }

  if (error) throw error;

  return (templates ?? []) as RecurringTask[];
}

function toLocalRecurringTemplateRow(userId: string, template: RecurringTask): DailyTask {
  return {
    id: template.id,
    user_id: userId,
    task_text: template.task_text,
    difficulty: template.difficulty,
    xp_reward: template.xp_reward,
    task_date: template.task_date,
    completed: false,
    completed_at: null,
    is_main_quest: false,
    scheduled_time: template.scheduled_time,
    estimated_duration: template.estimated_duration,
    recurrence_pattern: template.recurrence_pattern,
    recurrence_days: template.recurrence_days,
    recurrence_month_days: template.recurrence_month_days,
    recurrence_custom_period: template.recurrence_custom_period,
    is_recurring: true,
    reminder_enabled: template.reminder_enabled,
    reminder_minutes_before: template.reminder_minutes_before,
    reminder_sent: false,
    parent_template_id: null,
    category: template.category,
    is_bonus: false,
    created_at: template.created_at,
    priority: null,
    is_top_three: null,
    actual_time_spent: null,
    ai_generated: null,
    context_id: null,
    source: "manual",
    habit_source_id: null,
    epic_id: template.epic_id,
    sort_order: template.sort_order ?? null,
    contact_id: null,
    auto_log_interaction: true,
    contact: null,
    image_url: null,
    attachments: [],
    notes: null,
    location: null,
    subtasks: [],
  };
}

async function syncLocalRecurringTemplatesFromRemote(userId: string): Promise<void> {
  if (!(await canSyncPlannerFromRemote(userId))) {
    return;
  }

  const [remoteTemplates, localTasks] = await Promise.all([
    fetchRecurringTemplatesRemote(userId),
    getAllLocalTasksForUser<DailyTask>(userId),
  ]);

  const localRecurringIds = localTasks
    .filter((task) => task.is_recurring && task.recurrence_pattern)
    .map((task) => task.id);
  const remoteTemplateIds = new Set(remoteTemplates.map((template) => template.id));
  const idsToDelete = localRecurringIds.filter((taskId) => !remoteTemplateIds.has(taskId));

  await upsertPlannerRecords(
    "daily_tasks",
    remoteTemplates.map((template) => toLocalRecurringTemplateRow(userId, template)),
  );

  if (idsToDelete.length > 0) {
    await removePlannerRecords("daily_tasks", idsToDelete);
  }
}

async function loadPendingRecurringTemplates(
  userId: string,
  today: string,
  appDayOfWeek: number,
  targetDate: Date,
): Promise<RecurringTask[]> {
  const [allTasks, existingToday] = await Promise.all([
    getAllLocalTasksForUser<DailyTask>(userId),
    loadLocalDailyTasks(userId, today),
  ]);

  const templates = allTasks
    .filter((task) => task.is_recurring && task.recurrence_pattern)
    .map((task) => ({
      id: task.id,
      task_text: task.task_text,
      difficulty: task.difficulty,
      task_date: task.task_date,
      created_at: task.created_at,
      scheduled_time: task.scheduled_time,
      estimated_duration: task.estimated_duration,
      category: task.category,
      recurrence_pattern: task.recurrence_pattern,
    recurrence_days: task.recurrence_days,
    recurrence_month_days: task.recurrence_month_days,
    recurrence_custom_period: task.recurrence_custom_period,
    recurrence_end_date: task.recurrence_end_date ?? null,
      xp_reward: task.xp_reward,
      epic_id: task.epic_id,
      reminder_enabled: task.reminder_enabled,
      reminder_minutes_before: task.reminder_minutes_before,
      sort_order: task.sort_order ?? null,
    })) satisfies RecurringTask[];

  const existingTemplateIds = new Set(
    existingToday
      .map((task) => task.parent_template_id)
      .filter((templateId): templateId is string => typeof templateId === "string" && templateId.length > 0),
  );
  const existingTaskTexts = new Set(existingToday.map((task) => task.task_text.toLowerCase()));

  return templates.filter((template) => {
    if (existingTemplateIds.has(template.id)) return false;
    if (existingTaskTexts.has(template.task_text.toLowerCase())) return false;

    if (template.recurrence_end_date) {
      const endDate = parseISO(template.recurrence_end_date);
      if (isValid(endDate) && isAfter(startOfDay(targetDate), startOfDay(endDate))) return false;
    }

    return shouldSpawnToday(template, appDayOfWeek, targetDate);
  });
}

function buildSpawnedTaskRow(
  userId: string,
  today: string,
  template: RecurringTask,
  sortOrder: number,
): DailyTask {
  return {
    id: createOfflinePlannerId("task"),
    user_id: userId,
    task_text: template.task_text,
    difficulty: template.difficulty,
    xp_reward: template.xp_reward,
    task_date: today,
    completed: false,
    completed_at: null,
    is_main_quest: false,
    scheduled_time: template.scheduled_time,
    estimated_duration: template.estimated_duration,
    recurrence_pattern: null,
    recurrence_days: null,
    recurrence_month_days: null,
    recurrence_custom_period: null,
    is_recurring: false,
    reminder_enabled: template.reminder_enabled,
    reminder_minutes_before: template.reminder_minutes_before,
    reminder_sent: false,
    parent_template_id: template.id,
    category: template.category,
    is_bonus: false,
    created_at: new Date().toISOString(),
    priority: null,
    is_top_three: null,
    actual_time_spent: null,
    ai_generated: null,
    context_id: null,
    source: "recurring",
    habit_source_id: null,
    epic_id: template.epic_id,
    sort_order: sortOrder,
    contact_id: null,
    auto_log_interaction: true,
    contact: null,
    image_url: null,
    attachments: [],
    notes: null,
    location: null,
    subtasks: [],
  };
}

/**
 * Hook to spawn recurring tasks for the current day.
 */
export function useRecurringTaskSpawner(selectedDate?: Date) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { queueTaskAction, shouldQueueWrites, retryNow } = useResilience();
  const targetDate = selectedDate ?? new Date();
  const today = format(targetDate, "yyyy-MM-dd");
  const targetDateMs = selectedDate ? startOfDay(selectedDate).getTime() : startOfDay(parseISO(today)).getTime();
  const effectiveTargetDate = new Date(targetDateMs);
  const appDayOfWeek = toAppDayIndex(getDay(effectiveTargetDate));

  const query = useQuery({
    queryKey: ["recurring-templates", user?.id, today],
    queryFn: async () => {
      if (!user?.id) return [];
      return loadPendingRecurringTemplates(user.id, today, appDayOfWeek, effectiveTargetDate);
    },
    enabled: !!user?.id,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!user?.id) return;

    let disposed = false;

    const refreshFromRemote = async () => {
      try {
        await Promise.all([
          syncLocalRecurringTemplatesFromRemote(user.id),
          syncLocalDailyTasksFromRemote(user.id, today),
        ]);

        if (disposed) return;

        queryClient.setQueryData(
          ["recurring-templates", user.id, today],
          await loadPendingRecurringTemplates(user.id, today, appDayOfWeek, effectiveTargetDate),
        );
      } catch (error) {
        console.warn("[RecurringSpawner] Failed to refresh local recurring templates:", error);
      }
    };

    void refreshFromRemote();

    const handlePlannerSync = () => {
      void refreshFromRemote();
    };

    window.addEventListener(PLANNER_SYNC_EVENT, handlePlannerSync);
    return () => {
      disposed = true;
      window.removeEventListener(PLANNER_SYNC_EVENT, handlePlannerSync);
    };
  }, [appDayOfWeek, queryClient, targetDateMs, today, user?.id]);

  const pendingRecurring = query.data ?? [];

  const spawnMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || pendingRecurring.length === 0) {
        return {
          data: [],
          skippedMissingTimeCount: 0,
          attemptedTemplateCount: 0,
          failedTemplateCount: 0,
          usedRowByRowFallback: false,
          usedArbiterInsertFallback: false,
          queuedCount: 0,
        } satisfies SpawnRecurringResult;
      }

      const missingTimeTemplates = pendingRecurring.filter((template) => !hasScheduledTimeValue(template.scheduled_time));
      const templatesToSpawn = pendingRecurring.filter((template) => hasScheduledTimeValue(template.scheduled_time));

      if (templatesToSpawn.length === 0) {
        return {
          data: [],
          skippedMissingTimeCount: missingTimeTemplates.length,
          attemptedTemplateCount: 0,
          failedTemplateCount: 0,
          usedRowByRowFallback: false,
          usedArbiterInsertFallback: false,
          queuedCount: 0,
        } satisfies SpawnRecurringResult;
      }

      const existingTasks = await loadLocalDailyTasks(user.id, today);
      const localTasksToCreate = templatesToSpawn.map((template, index) =>
        buildSpawnedTaskRow(user.id, today, template, existingTasks.length + index),
      );

      await upsertPlannerRecords("daily_tasks", localTasksToCreate);

      const tasksToCreate: RecurringTaskInsertPayload[] = localTasksToCreate.map((task) => ({
        id: task.id,
        user_id: user.id,
        task_text: task.task_text,
        task_date: today,
        difficulty: task.difficulty,
        scheduled_time: task.scheduled_time,
        estimated_duration: task.estimated_duration,
        category: task.category,
        xp_reward: task.xp_reward,
        epic_id: task.epic_id,
        reminder_enabled: task.reminder_enabled,
        reminder_minutes_before: task.reminder_minutes_before,
        parent_template_id: task.parent_template_id as string,
        source: "recurring",
        is_recurring: false,
        sort_order: task.sort_order ?? null,
      }));

      if (shouldQueueWrites) {
        await Promise.all(
          tasksToCreate.map((task) =>
            queueTaskAction("CREATE_TASK", {
              id: task.id,
              task_text: task.task_text,
              difficulty: task.difficulty,
              xp_reward: task.xp_reward,
              task_date: task.task_date,
              scheduled_time: task.scheduled_time,
              estimated_duration: task.estimated_duration,
              category: task.category,
              reminder_enabled: task.reminder_enabled,
              reminder_minutes_before: task.reminder_minutes_before,
              parent_template_id: task.parent_template_id,
              epic_id: task.epic_id,
              source: task.source,
              is_recurring: task.is_recurring,
              sort_order: task.sort_order,
            }),
          ),
        );

        return {
          data: localTasksToCreate.map((task) => ({ id: task.id })),
          skippedMissingTimeCount: missingTimeTemplates.length,
          attemptedTemplateCount: templatesToSpawn.length,
          failedTemplateCount: 0,
          usedRowByRowFallback: false,
          usedArbiterInsertFallback: false,
          queuedCount: localTasksToCreate.length,
        } satisfies SpawnRecurringResult;
      }

      const runBulkUpsert = () => supabase
        .from("daily_tasks")
        .upsert(tasksToCreate, {
          onConflict: "user_id,task_date,parent_template_id",
          ignoreDuplicates: true,
        })
        .select("id");

      const runRowByRow = async (mode: "upsert" | "insert") => {
        const spawnedIds: { id: string }[] = [];
        const failures: SpawnFailure[] = [];

        for (const task of tasksToCreate) {
          const result = mode === "insert"
            ? await supabase.from("daily_tasks").insert(task).select("id")
            : await supabase
              .from("daily_tasks")
              .upsert(task, {
                onConflict: "user_id,task_date,parent_template_id",
                ignoreDuplicates: true,
              })
              .select("id");

          if (result.error) {
            if (mode === "insert" && isUniqueViolationError(result.error)) continue;

            failures.push({
              templateId: task.parent_template_id,
              code: result.error.code ?? null,
              message: result.error.message ?? null,
            });
            continue;
          }

          if (result.data && result.data.length > 0) {
            spawnedIds.push(...result.data.map((row) => ({ id: row.id })));
          }
        }

        return { spawnedIds, failures };
      };

      const { data, error } = await runBulkUpsert();
      if (!error) {
        return {
          data: data ?? localTasksToCreate.map((task) => ({ id: task.id })),
          skippedMissingTimeCount: missingTimeTemplates.length,
          attemptedTemplateCount: templatesToSpawn.length,
          failedTemplateCount: 0,
          usedRowByRowFallback: false,
          usedArbiterInsertFallback: false,
          queuedCount: 0,
        } satisfies SpawnRecurringResult;
      }

      const useArbiterInsertFallback = isOnConflictArbiterError(error);
      const rowResult = await runRowByRow(useArbiterInsertFallback ? "insert" : "upsert");

      if (rowResult.failures.length > 0) {
        await Promise.all(
          tasksToCreate
            .filter((task) => rowResult.failures.some((failure) => failure.templateId === task.parent_template_id))
            .map((task) =>
              queueTaskAction("CREATE_TASK", {
                id: task.id,
                task_text: task.task_text,
                difficulty: task.difficulty,
                xp_reward: task.xp_reward,
                task_date: task.task_date,
                scheduled_time: task.scheduled_time,
                estimated_duration: task.estimated_duration,
                category: task.category,
                reminder_enabled: task.reminder_enabled,
                reminder_minutes_before: task.reminder_minutes_before,
                parent_template_id: task.parent_template_id,
                epic_id: task.epic_id,
                source: task.source,
                is_recurring: task.is_recurring,
                sort_order: task.sort_order,
              }),
            ),
        );
        void retryNow();
      }

      return {
        data: rowResult.spawnedIds.length > 0 ? rowResult.spawnedIds : localTasksToCreate.map((task) => ({ id: task.id })),
        skippedMissingTimeCount: missingTimeTemplates.length,
        attemptedTemplateCount: templatesToSpawn.length,
        failedTemplateCount: rowResult.failures.length,
        usedRowByRowFallback: true,
        usedArbiterInsertFallback: useArbiterInsertFallback,
        queuedCount: rowResult.failures.length,
      } satisfies SpawnRecurringResult;
    },
    onSuccess: ({
      data,
      skippedMissingTimeCount,
      failedTemplateCount,
      queuedCount,
    }) => {
      queryClient.invalidateQueries({ queryKey: ["recurring-templates"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });

      if (skippedMissingTimeCount > 0) {
        toast.error("Set a time on recurring quest templates to resume auto-creation.");
      }

      if (failedTemplateCount > 0) {
        if (data.length > 0) {
          toast.error("Some recurring quests were not created. Open and re-save those templates.");
        } else {
          toast.error("Failed to create recurring quests. Open and re-save recurring templates, then try again.");
        }
        return;
      }

      if (queuedCount > 0) {
        toast.success(
          queuedCount === data.length
            ? "Recurring quests saved offline"
            : "Recurring quests created, with some queued for sync",
        );
      }
    },
    onError: (error: Error) => {
      console.error("[RecurringSpawner] Failed to spawn recurring tasks:", error);
      toast.error("Failed to create recurring quests");
    },
  });

  return {
    pendingRecurringCount: pendingRecurring.length,
    isLoading: query.isLoading,
    spawnRecurringTasks: spawnMutation.mutate,
    isSpawning: spawnMutation.isPending,
  };
}

/**
 * Determine if a recurring task should spawn today based on its pattern.
 */
export function shouldSpawnToday(
  template: RecurringTask,
  appDayOfWeek: number,
  targetDateInput: Date = new Date(),
): boolean {
  const pattern = template.recurrence_pattern?.toLowerCase();
  const targetDate = startOfDay(targetDateInput);
  const anchorDate = getAnchorDate(template);

  if (!pattern) return false;

  switch (pattern) {
    case "daily":
      return true;

    case "weekly":
      if (template.recurrence_days && template.recurrence_days.length > 0) {
        return template.recurrence_days.includes(appDayOfWeek);
      }
      return anchorDate ? toAppDayIndex(getDay(anchorDate)) === appDayOfWeek : true;

    case "weekdays":
      return appDayOfWeek >= 0 && appDayOfWeek <= 4;

    case "weekends":
      return appDayOfWeek === 5 || appDayOfWeek === 6;

    case "biweekly": {
      const recurrenceDay = template.recurrence_days?.[0] ?? (anchorDate ? toAppDayIndex(getDay(anchorDate)) : appDayOfWeek);
      if (recurrenceDay !== appDayOfWeek) return false;
      if (!anchorDate) return false;

      const diffDays = differenceInCalendarDays(targetDate, anchorDate);
      return diffDays >= 0 && diffDays % 14 === 0;
    }

    case "monthly": {
      const configuredMonthDays = getClampedMonthDays(template.recurrence_month_days, targetDate);
      if (configuredMonthDays.length > 0) {
        return configuredMonthDays.includes(targetDate.getDate());
      }

      if (!anchorDate) return false;
      const desiredDayOfMonth = anchorDate.getDate();
      const runDayOfMonth = Math.min(desiredDayOfMonth, lastDayOfMonth(targetDate).getDate());
      return targetDate.getDate() === runDayOfMonth;
    }

    case "custom": {
      const customPeriod = template.recurrence_custom_period ?? "week";
      if (customPeriod === "month") {
        const configuredMonthDays = getClampedMonthDays(template.recurrence_month_days, targetDate);
        if (configuredMonthDays.length > 0) {
          return configuredMonthDays.includes(targetDate.getDate());
        }
        if (!anchorDate) return false;
        const fallbackDay = Math.min(anchorDate.getDate(), lastDayOfMonth(targetDate).getDate());
        return targetDate.getDate() === fallbackDay;
      }

      if (template.recurrence_days && template.recurrence_days.length > 0) {
        return template.recurrence_days.includes(appDayOfWeek);
      }
      return false;
    }

    default:
      if (pattern.includes("daily") || pattern.includes("day")) {
        return true;
      }
      return false;
  }
}

function getAnchorDate(template: RecurringTask): Date | null {
  if (template.task_date) {
    const parsedTaskDate = parseISO(template.task_date);
    if (isValid(parsedTaskDate)) return startOfDay(parsedTaskDate);
  }

  if (template.created_at) {
    const parsedCreatedAt = parseISO(template.created_at);
    if (isValid(parsedCreatedAt)) return startOfDay(parsedCreatedAt);
  }

  return null;
}

export function toAppDayIndex(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}
