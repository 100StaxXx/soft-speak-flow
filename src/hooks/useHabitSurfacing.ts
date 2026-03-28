import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, getDay, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getHabitXP } from "@/config/xpRewards";
import { useResilience } from "@/contexts/ResilienceContext";
import { categorizeQuest } from "@/utils/questCategorization";
import { isHabitScheduledForDate } from "@/utils/habitSchedule";
import { getEffectiveDayOfWeek, getEffectiveMissionDate } from "@/utils/timezone";
import type { DailyTask } from "@/services/dailyTasksRemote";
import {
  PLANNER_SYNC_EVENT,
  getDailyTasksQueryKey,
  loadLocalDailyTasks,
  loadLocalEpics,
  syncLocalDailyTasksFromRemote,
  syncLocalEpicsFromRemote,
  syncLocalHabitsFromRemote,
  withPlannerRemoteSyncLock,
} from "@/utils/plannerSync";
import {
  createOfflinePlannerId,
  getLocalHabits,
  upsertPlannerRecord,
} from "@/utils/plannerLocalStore";

interface LocalHabitRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  difficulty: string | null;
  category: string | null;
  frequency: string;
  estimated_minutes: number | null;
  preferred_time: string | null;
  custom_days: number[] | null;
  custom_month_days: number[] | null;
  is_active: boolean | null;
  reminder_enabled?: boolean | null;
  reminder_minutes_before?: number | null;
  sort_order?: number | null;
  created_at?: string | null;
}

interface SurfacedTaskWriteResult {
  id: string;
  queued: boolean;
}

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const habitSurfacingWriteChains = new Map<string, Promise<void>>();

async function withHabitSurfacingWriteLock<T>(
  userId: string,
  taskDate: string,
  operation: () => Promise<T>,
): Promise<T> {
  const key = `${userId}:${taskDate}`;
  const previous = habitSurfacingWriteChains.get(key) ?? Promise.resolve();
  const waitForPrevious = previous.catch(() => undefined);

  let releaseCurrent!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const currentChain = waitForPrevious.then(() => current);

  habitSurfacingWriteChains.set(key, currentChain);

  await waitForPrevious;

  try {
    return await operation();
  } finally {
    releaseCurrent();
    if (habitSurfacingWriteChains.get(key) === currentChain) {
      habitSurfacingWriteChains.delete(key);
    }
  }
}

export interface SurfacedHabit {
  id: string;
  habit_id: string;
  habit_name: string;
  habit_description: string | null;
  difficulty: string | null;
  frequency: string;
  estimated_minutes: number | null;
  preferred_time: string | null;
  epic_id: string | null;
  epic_title: string | null;
  task_id: string | null;
  is_completed: boolean;
  category: string | null;
  custom_days: number[] | null;
  custom_month_days: number[] | null;
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

function shouldSurfaceToday(habit: SurfacedHabit, dayOfWeek: number, targetDate: Date): boolean {
  return isHabitScheduledForDate(habit, targetDate, dayOfWeek);
}

async function buildSurfacedHabits(userId: string, taskDate: string): Promise<SurfacedHabit[]> {
  const [habits, epics, existingTasks] = await Promise.all([
    getLocalHabits<LocalHabitRow>(userId),
    loadLocalEpics(userId),
    loadLocalDailyTasks(userId, taskDate),
  ]);

  const activeHabits = habits
    .filter((habit) => habit.is_active !== false)
    .slice()
    .sort((a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER));

  const tasksByHabit = new Map<string, DailyTask>();
  existingTasks.forEach((task) => {
    if (task.habit_source_id && !tasksByHabit.has(task.habit_source_id)) {
      tasksByHabit.set(task.habit_source_id, task);
    }
  });

  const linkedHabitIds = new Set<string>();
  const activeEpicByHabitId = new Map<string, { id: string; title: string | null }>();

  epics.forEach((epic) => {
    (epic.epic_habits ?? []).forEach((link) => {
      linkedHabitIds.add(link.habit_id);
      if (epic.status === "active") {
        activeEpicByHabitId.set(link.habit_id, {
          id: epic.id,
          title: typeof epic.title === "string" ? epic.title : null,
        });
      }
    });
  });

  return activeHabits
    .filter((habit) => !linkedHabitIds.has(habit.id) || activeEpicByHabitId.has(habit.id))
    .map((habit) => {
      const linkedEpic = activeEpicByHabitId.get(habit.id) ?? null;
      const existingTask = tasksByHabit.get(habit.id) ?? null;

      return {
        id: habit.id,
        habit_id: habit.id,
        habit_name: habit.title,
        habit_description: habit.description ?? null,
        difficulty: habit.difficulty ?? null,
        frequency: habit.frequency || "daily",
        estimated_minutes: habit.estimated_minutes ?? null,
        preferred_time: habit.preferred_time ?? null,
        epic_id: linkedEpic?.id ?? null,
        epic_title: linkedEpic?.title ?? null,
        task_id: existingTask?.id ?? null,
        is_completed: existingTask?.completed === true,
        category: habit.category ?? categorizeQuest(habit.title),
        custom_days: habit.custom_days ?? null,
        custom_month_days: habit.custom_month_days ?? null,
      } satisfies SurfacedHabit;
    });
}

function getTaskDate(selectedDate?: Date): string {
  return selectedDate ? format(selectedDate, "yyyy-MM-dd") : getEffectiveMissionDate();
}

function getPlannerDayOfWeek(selectedDate: Date | undefined, taskDate: string): number {
  if (!selectedDate) {
    const jsDay = getEffectiveDayOfWeek();
    return jsDay === 0 ? 6 : jsDay - 1;
  }

  const jsDay = getDay(selectedDate);
  return jsDay === 0 ? 6 : jsDay - 1;
}

function getEffectiveTargetDate(selectedDate: Date | undefined, taskDate: string): Date {
  return selectedDate ? selectedDate : parseISO(taskDate);
}

function buildSurfacedTaskRow(
  userId: string,
  taskDate: string,
  habit: SurfacedHabit,
  sortOrder: number,
): DailyTask {
  const difficulty = (habit.difficulty ?? "easy") as "easy" | "medium" | "hard";

  return {
    id: createOfflinePlannerId("task"),
    user_id: userId,
    task_text: habit.habit_name,
    difficulty: habit.difficulty ?? "easy",
    xp_reward: getHabitXP(difficulty),
    task_date: taskDate,
    completed: false,
    completed_at: null,
    is_main_quest: false,
    scheduled_time: habit.preferred_time ?? null,
    estimated_duration: habit.estimated_minutes ?? null,
    recurrence_pattern: null,
    recurrence_days: null,
    recurrence_month_days: null,
    recurrence_custom_period: null,
    is_recurring: false,
    reminder_enabled: false,
    reminder_minutes_before: 15,
    reminder_sent: false,
    parent_template_id: null,
    category: habit.category ?? categorizeQuest(habit.habit_name),
    is_bonus: false,
    created_at: new Date().toISOString(),
    priority: null,
    is_top_three: null,
    actual_time_spent: null,
    ai_generated: null,
    context_id: null,
    source: "recurring",
    habit_source_id: habit.habit_id,
    epic_id: habit.epic_id,
    epic_title: habit.epic_title,
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

function toSurfacedTaskInsertPayload(userId: string, task: DailyTask) {
  return {
    id: task.id,
    user_id: userId,
    task_text: task.task_text,
    difficulty: task.difficulty,
    xp_reward: task.xp_reward,
    task_date: task.task_date,
    completed: false,
    completed_at: null,
    is_main_quest: false,
    scheduled_time: task.scheduled_time,
    estimated_duration: task.estimated_duration,
    category: task.category,
    source: task.source,
    habit_source_id: task.habit_source_id,
    epic_id: task.epic_id,
    sort_order: task.sort_order,
  };
}

function toSurfacedTaskQueuePayload(task: DailyTask) {
  return {
    id: task.id,
    task_text: task.task_text,
    difficulty: task.difficulty,
    xp_reward: task.xp_reward,
    task_date: task.task_date,
    scheduled_time: task.scheduled_time,
    estimated_duration: task.estimated_duration,
    category: task.category,
    source: task.source,
    habit_source_id: task.habit_source_id,
    epic_id: task.epic_id,
    sort_order: task.sort_order,
  };
}

async function queueSurfacedTaskCreates(
  tasks: DailyTask[],
  queueTaskAction: (
    actionKind: "CREATE_TASK",
    payload: Record<string, unknown>,
  ) => Promise<unknown>,
): Promise<void> {
  await Promise.all(
    tasks.map((task) =>
      queueTaskAction("CREATE_TASK", toSurfacedTaskQueuePayload(task)),
    ),
  );
}

async function persistSurfacedTasks(
  userId: string,
  localTasks: DailyTask[],
  options: {
    shouldQueueWrites: boolean;
    queueTaskAction: (
      actionKind: "CREATE_TASK",
      payload: Record<string, unknown>,
    ) => Promise<unknown>;
    retryNow: () => void | Promise<unknown>;
  },
): Promise<SurfacedTaskWriteResult[]> {
  if (localTasks.length === 0) {
    return [];
  }

  await Promise.all(localTasks.map((task) => upsertPlannerRecord("daily_tasks", task)));

  if (options.shouldQueueWrites) {
    await queueSurfacedTaskCreates(localTasks, options.queueTaskAction);

    return localTasks.map((task) => ({ id: task.id, queued: true }));
  }

  const { error } = await supabase
    .from("daily_tasks")
    .upsert(
      localTasks.map((task) => toSurfacedTaskInsertPayload(userId, task)),
      {
        onConflict: "user_id,task_date,habit_source_id",
        ignoreDuplicates: true,
      },
    );

  if (!error) {
    return localTasks.map((task) => ({ id: task.id, queued: false }));
  }

  if (isOnConflictArbiterError(error)) {
    const results = await Promise.all(localTasks.map(async (task) => {
      const insertResult = await supabase
        .from("daily_tasks")
        .insert(toSurfacedTaskInsertPayload(userId, task));

      if (!insertResult.error || isUniqueViolationError(insertResult.error)) {
        return { id: task.id, queued: false } satisfies SurfacedTaskWriteResult;
      }

      await options.queueTaskAction("CREATE_TASK", toSurfacedTaskQueuePayload(task));
      return { id: task.id, queued: true } satisfies SurfacedTaskWriteResult;
    }));

    if (results.some((result) => result.queued)) {
      void options.retryNow();
    }

    return results;
  }

  await queueSurfacedTaskCreates(localTasks, options.queueTaskAction);
  void options.retryNow();
  return localTasks.map((task) => ({ id: task.id, queued: true }));
}

async function ensureSurfacedHabitTasksForDate(
  userId: string,
  taskDate: string,
  targetDate: Date,
  dayOfWeek: number,
  options: {
    shouldQueueWrites: boolean;
    queueTaskAction: (
      actionKind: "CREATE_TASK",
      payload: Record<string, unknown>,
    ) => Promise<unknown>;
    retryNow: () => void | Promise<unknown>;
    surfacedHabits?: SurfacedHabit[];
  },
): Promise<{
  surfacedHabits: SurfacedHabit[];
  tasks: DailyTask[];
  results: SurfacedTaskWriteResult[];
}> {
  const initialSurfacedHabits = options.surfacedHabits ?? await buildSurfacedHabits(userId, taskDate);
  const habitsToSurface = initialSurfacedHabits.filter(
    (habit) => !habit.task_id && shouldSurfaceToday(habit, dayOfWeek, targetDate),
  );

  const existingTasks = await loadLocalDailyTasks(userId, taskDate);
  if (habitsToSurface.length === 0) {
    return {
      surfacedHabits: initialSurfacedHabits,
      tasks: existingTasks,
      results: [],
    };
  }

  const existingHabitIds = new Set(
    existingTasks
      .map((task) => task.habit_source_id)
      .filter((habitId): habitId is string => typeof habitId === "string" && habitId.length > 0),
  );

  const localTasks = habitsToSurface
    .filter((habit) => !existingHabitIds.has(habit.habit_id))
    .map((habit, index) => buildSurfacedTaskRow(userId, taskDate, habit, existingTasks.length + index));

  if (localTasks.length === 0) {
    return {
      surfacedHabits: await buildSurfacedHabits(userId, taskDate),
      tasks: await loadLocalDailyTasks(userId, taskDate),
      results: [],
    };
  }

  const results = await persistSurfacedTasks(userId, localTasks, options);

  return {
    surfacedHabits: await buildSurfacedHabits(userId, taskDate),
    tasks: await loadLocalDailyTasks(userId, taskDate),
    results,
  };
}

export function useHabitSurfacing(selectedDate?: Date) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { queueTaskAction, shouldQueueWrites, retryNow } = useResilience();

  const taskDate = getTaskDate(selectedDate);
  const dayOfWeek = getPlannerDayOfWeek(selectedDate, taskDate);
  const effectiveDate = getEffectiveTargetDate(selectedDate, taskDate);
  const effectiveDateKey = effectiveDate.getTime();

  const query = useQuery({
    queryKey: ["habit-surfacing", user?.id, taskDate],
    queryFn: async () => {
      if (!user?.id) return [];
      return buildSurfacedHabits(user.id, taskDate);
    },
    enabled: !!user?.id,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!user?.id) return;

    let disposed = false;

    const refreshFromRemote = async () => {
      try {
        const refreshed = await withHabitSurfacingWriteLock(user.id, taskDate, async () =>
          withPlannerRemoteSyncLock(user.id, async () => {
            await Promise.all([
              syncLocalHabitsFromRemote(user.id, taskDate),
              syncLocalEpicsFromRemote(user.id),
              syncLocalDailyTasksFromRemote(user.id, taskDate),
            ]);

            return ensureSurfacedHabitTasksForDate(
              user.id,
              taskDate,
              new Date(effectiveDateKey),
              dayOfWeek,
              {
                shouldQueueWrites,
                queueTaskAction,
                retryNow,
              },
            );
          }),
        );

        if (disposed) return;

        queryClient.setQueryData(
          getDailyTasksQueryKey(user.id, taskDate),
          refreshed.tasks,
        );
        queryClient.setQueryData(
          ["habit-surfacing", user.id, taskDate],
          refreshed.surfacedHabits,
        );
      } catch (error) {
        console.warn("Failed to refresh local habit surfacing data:", error);
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
  }, [
    dayOfWeek,
    effectiveDateKey,
    queryClient,
    queueTaskAction,
    retryNow,
    shouldQueueWrites,
    taskDate,
    user?.id,
  ]);

  const surfacedHabits = query.data ?? [];

  const surfaceHabitMutation = useMutation({
    mutationFn: async (habitId: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      return withHabitSurfacingWriteLock(user.id, taskDate, async () =>
        withPlannerRemoteSyncLock(user.id, async () => {
          const habit = surfacedHabits.find((candidate) => candidate.habit_id === habitId);
          if (!habit) throw new Error("Habit not found");
          if (habit.task_id) {
            return { id: habit.task_id, queued: false };
          }

          const existingTasks = await loadLocalDailyTasks(user.id, taskDate);
          const existingTask = existingTasks.find((task) => task.habit_source_id === habitId);
          if (existingTask) {
            return { id: existingTask.id, queued: false };
          }

          const localTask = buildSurfacedTaskRow(user.id, taskDate, habit, existingTasks.length);
          await upsertPlannerRecord("daily_tasks", localTask);

          if (shouldQueueWrites) {
            await queueTaskAction("CREATE_TASK", toSurfacedTaskQueuePayload(localTask));
            return { id: localTask.id, queued: true };
          }

          const insertPayload = toSurfacedTaskInsertPayload(user.id, localTask);
          const { error } = await supabase
            .from("daily_tasks")
            .upsert(insertPayload, {
              onConflict: "user_id,task_date,habit_source_id",
              ignoreDuplicates: true,
            });

          if (!error) {
            return { id: localTask.id, queued: false };
          }

          if (isOnConflictArbiterError(error)) {
            const insertResult = await supabase
              .from("daily_tasks")
              .insert(insertPayload);

            if (!insertResult.error || isUniqueViolationError(insertResult.error)) {
              return { id: localTask.id, queued: false };
            }
          }

          await queueTaskAction("CREATE_TASK", toSurfacedTaskQueuePayload(localTask));
          void retryNow();
          return { id: localTask.id, queued: true };
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habit-surfacing"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
    },
  });

  const surfaceAllHabitsMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      return withHabitSurfacingWriteLock(user.id, taskDate, async () =>
        withPlannerRemoteSyncLock(user.id, async () => {
          const { results } = await ensureSurfacedHabitTasksForDate(
            user.id,
            taskDate,
            new Date(effectiveDateKey),
            dayOfWeek,
            {
              shouldQueueWrites,
              queueTaskAction,
              retryNow,
              surfacedHabits,
            },
          );

          return results;
        }),
      );
    },
    onSuccess: (rows) => {
      queryClient.invalidateQueries({ queryKey: ["habit-surfacing"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });

      if (rows.length > 0) {
        const queuedCount = rows.filter((row) => row.queued).length;
        toast.success(
          queuedCount > 0
            ? `${rows.length} ritual${rows.length > 1 ? "s" : ""} saved offline`
            : `${rows.length} ritual${rows.length > 1 ? "s" : ""} added to today's quests`,
        );
      }
    },
    onError: (error: Error) => {
      console.error("[Habit Surfacing] Mutation error:", error);
      toast.error("Failed to surface habits as quests");
    },
  });

  const unsurfacedCount = surfacedHabits.filter(
    (habit) => !habit.task_id && shouldSurfaceToday(habit, dayOfWeek, effectiveDate),
  ).length;

  return {
    surfacedHabits,
    isLoading: query.isLoading,
    error: query.error,
    surfaceHabit: surfaceHabitMutation.mutate,
    surfaceAllEpicHabits: surfaceAllHabitsMutation.mutate,
    surfaceAllHabits: surfaceAllHabitsMutation.mutate,
    unsurfacedEpicHabitsCount: unsurfacedCount,
    unsurfacedHabitsCount: unsurfacedCount,
  };
}
