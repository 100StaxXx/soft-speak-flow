import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCallback, useEffect } from "react";
import { toast } from "@/components/ui/sonner";
import type { DailyTask } from "@/services/dailyTasksRemote";
import { normalizeTaskSchedulingState } from "@/utils/taskSchedulingRules";
import { useResilience } from "@/contexts/ResilienceContext";
import { isQueueableWriteError } from "@/utils/networkErrors";
import { normalizeUuidLikeId } from "@/utils/offlineId";
import { useCompletionFeedback } from "@/hooks/useCompletionFeedback";
import { getDailyTasksQueryKey } from "@/utils/plannerSync";
import {
  buildCompletionFeedbackDaySignals,
  getCompletionFeedbackDaySignalTasksQueryKey,
  getCompletionFeedbackInboxTasksQueryKey,
  getCompletionFeedbackLocalCompletionsQueryKey,
  getCompletionFeedbackTaskDate,
  mergeCompletionFeedbackDaySignalTasks,
  type CompletionFeedbackDaySignalTask,
  type CompletionFeedbackDaySignals,
} from "@/utils/completionFeedbackDaySignals";
import { fetchCompletionFeedbackDaySignalTasks } from "@/utils/completionFeedbackDaySignalQueries";

export const INBOX_TASKS_QUERY_KEY = "inbox-tasks";
export const INBOX_COUNT_QUERY_KEY = "inbox-count";

interface InboxTasksOptions {
  enabled?: boolean;
}

export const getInboxTasksQueryKey = (userId: string | undefined) =>
  [INBOX_TASKS_QUERY_KEY, userId] as const;

export const getInboxCountQueryKey = (userId: string | undefined) =>
  [INBOX_COUNT_QUERY_KEY, userId] as const;

export const fetchInboxTasks = async (userId: string) => {
  const { data, error } = await supabase
    .from("daily_tasks")
    .select("*")
    .eq("user_id", userId)
    .is("task_date", null)
    .eq("completed", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as DailyTask[];
};

export const fetchInboxCount = async (userId: string) => {
  const { count, error } = await supabase
    .from("daily_tasks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("task_date", null)
    .eq("completed", false);

  if (error) throw error;
  return count ?? 0;
};

export const useInboxTasks = (options: InboxTasksOptions = {}) => {
  const { user } = useAuth();
  const { shouldQueueWrites, queueTaskAction, reportApiFailure } = useResilience();
  const queryClient = useQueryClient();
  const { triggerCompletionFeedback } = useCompletionFeedback();
  const { enabled = true } = options;
  const invalidateInboxQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [INBOX_TASKS_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: [INBOX_COUNT_QUERY_KEY] });
  }, [queryClient]);
  const getRemoteTaskId = useCallback((taskId: string) => normalizeUuidLikeId(taskId), []);

  const warmCompletionFeedbackDaySignalTasks = useCallback((taskDate: string) => {
    const userId = user?.id;
    if (!userId) return;

    void queryClient.prefetchQuery({
      queryKey: getCompletionFeedbackDaySignalTasksQueryKey(userId, taskDate),
      queryFn: () => fetchCompletionFeedbackDaySignalTasks({
        userId,
        taskDate,
        normalizeTaskId: getRemoteTaskId,
      }),
      staleTime: 30 * 1000,
    }).catch((error) => {
      console.warn("[InboxTasks] Completion feedback day signals failed to warm:", error);
    });
  }, [getRemoteTaskId, queryClient, user?.id]);

  useEffect(() => {
    if (!enabled || !user?.id) return;
    warmCompletionFeedbackDaySignalTasks(getCompletionFeedbackTaskDate(null, null));
  }, [enabled, user?.id, warmCompletionFeedbackDaySignalTasks]);

  const getCompletionFeedbackDaySignals = (
    completedTaskId: string | null | undefined,
    completedTaskDate: string | null | undefined,
    completedAt: string | null | undefined,
  ): CompletionFeedbackDaySignals => {
    if (!completedTaskId || !user?.id) return {};

    const resolvedTaskDate = getCompletionFeedbackTaskDate(completedTaskDate, completedAt);
    const cachedDaySignalTasks = queryClient.getQueryData<CompletionFeedbackDaySignalTask[]>(
      getCompletionFeedbackDaySignalTasksQueryKey(user.id, resolvedTaskDate),
    );
    const cachedInboxCompletions = queryClient.getQueryData<CompletionFeedbackDaySignalTask[]>(
      getCompletionFeedbackInboxTasksQueryKey(user.id, resolvedTaskDate),
    );
    const cachedLocalCompletions = queryClient.getQueryData<CompletionFeedbackDaySignalTask[]>(
      getCompletionFeedbackLocalCompletionsQueryKey(user.id, resolvedTaskDate),
    );
    const cachedInboxTasks = Array.isArray(cachedInboxCompletions) ? cachedInboxCompletions : [];
    const cachedLocalTasks = mergeCompletionFeedbackDaySignalTasks(
      [
        ...cachedInboxTasks,
        ...(Array.isArray(cachedLocalCompletions) ? cachedLocalCompletions : []),
      ],
      getRemoteTaskId,
    );

    if (Array.isArray(cachedDaySignalTasks)) {
      return buildCompletionFeedbackDaySignals({
        completedTaskId,
        tasks: mergeCompletionFeedbackDaySignalTasks(
          [...cachedDaySignalTasks, ...cachedLocalTasks],
          getRemoteTaskId,
        ),
        normalizeTaskId: getRemoteTaskId,
      });
    }

    const cachedTasks = queryClient.getQueryData<DailyTask[]>(
      getDailyTasksQueryKey(user.id, resolvedTaskDate),
    );
    if (!Array.isArray(cachedTasks)) return {};

    const cachedSignals = buildCompletionFeedbackDaySignals({
      completedTaskId,
      tasks: mergeCompletionFeedbackDaySignalTasks(
        [...cachedTasks, ...cachedLocalTasks],
        getRemoteTaskId,
      ),
      normalizeTaskId: getRemoteTaskId,
    });

    return {
      ...(cachedSignals.isBuildingMomentum === true ? { isBuildingMomentum: true } : {}),
      ...(cachedSignals.isOverloaded === true ? { isOverloaded: true } : {}),
    };
  };

  const rememberCompletionFeedbackInboxCompletion = (
    completedTaskId: string | null | undefined,
    completedTaskDate: string | null | undefined,
    completedAt: string | null | undefined,
  ) => {
    if (!completedTaskId || !user?.id) return;

    const resolvedTaskDate = getCompletionFeedbackTaskDate(completedTaskDate, completedAt);
    const normalizedCompletedTaskId = getRemoteTaskId(completedTaskId);
    queryClient.setQueryData<CompletionFeedbackDaySignalTask[]>(
      getCompletionFeedbackInboxTasksQueryKey(user.id, resolvedTaskDate),
      (current) => {
        const existingTasks = Array.isArray(current) ? current : [];
        const withoutCurrentTask = existingTasks.filter((task) =>
          getRemoteTaskId(task.id) !== normalizedCompletedTaskId);

        return [
          ...withoutCurrentTask,
          {
            id: completedTaskId,
            completed: true,
            completed_at: completedAt ?? new Date().toISOString(),
          },
        ];
      },
    );
  };

  const forgetCompletionFeedbackInboxCompletion = (
    completedTaskId: string | null | undefined,
    completedTaskDate: string | null | undefined,
    completedAt: string | null | undefined,
  ) => {
    if (!completedTaskId || !user?.id) return;

    const resolvedTaskDate = getCompletionFeedbackTaskDate(completedTaskDate, completedAt);
    const normalizedCompletedTaskId = getRemoteTaskId(completedTaskId);
    queryClient.setQueryData<CompletionFeedbackDaySignalTask[]>(
      getCompletionFeedbackInboxTasksQueryKey(user.id, resolvedTaskDate),
      (current) => {
        if (!Array.isArray(current)) return current;
        return current.filter((task) => getRemoteTaskId(task.id) !== normalizedCompletedTaskId);
      },
    );
  };

  const syncQueuedCompletionFeedbackInboxCompletion = (
    completedTaskId: string,
    completed: boolean,
    completedTaskDate: string | null | undefined,
    completedAt: string | null,
  ) => {
    if (completed) {
      rememberCompletionFeedbackInboxCompletion(completedTaskId, completedTaskDate, completedAt);
    } else {
      forgetCompletionFeedbackInboxCompletion(completedTaskId, completedTaskDate, completedAt);
    }
  };

  const { data: inboxTasks = [], isLoading } = useQuery({
    queryKey: getInboxTasksQueryKey(user?.id),
    queryFn: async () => {
      if (!user?.id) return [];
      return fetchInboxTasks(user.id);
    },
    enabled: enabled && !!user?.id,
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
  });

  const scheduleTask = useMutation({
    mutationFn: async ({ taskId, targetDate }: { taskId: string; targetDate: string }) => {
      const remoteTaskId = getRemoteTaskId(taskId);
      if (shouldQueueWrites) {
        await queueTaskAction("UPDATE_TASK", {
          taskId,
          updates: {
            task_date: targetDate,
          },
        });
        return { queued: true };
      }

      const { data: task, error: fetchError } = await supabase
        .from("daily_tasks")
        .select("task_date, scheduled_time, habit_source_id, source")
        .eq("id", remoteTaskId)
        .maybeSingle();
      if (fetchError) {
        if (isQueueableWriteError(fetchError)) {
          await queueTaskAction("UPDATE_TASK", {
            taskId,
            updates: {
              task_date: targetDate,
            },
          });
          return { queued: true };
        }
        reportApiFailure(fetchError, { source: "inbox_schedule_fetch" });
        throw fetchError;
      }
      if (!task) throw new Error("Task not found");

      const normalized = normalizeTaskSchedulingState({
        task_date: targetDate,
        scheduled_time: task.scheduled_time,
        habit_source_id: task.habit_source_id,
        source: task.source,
      });

      const updateData: Record<string, unknown> = {
        task_date: normalized.task_date,
        scheduled_time: normalized.scheduled_time,
      };
      if (normalized.source !== task.source) {
        updateData.source = normalized.source;
      }

      const { error } = await supabase
        .from("daily_tasks")
        .update(updateData)
        .eq("id", remoteTaskId);
      if (error) {
        if (isQueueableWriteError(error)) {
          await queueTaskAction("UPDATE_TASK", { taskId, updates: updateData });
          return { queued: true };
        }
        reportApiFailure(error, { source: "inbox_schedule_update" });
        throw error;
      }
      return normalized;
    },
    onSuccess: (data) => {
      invalidateInboxQueries();
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      if ((data as { queued?: boolean } | undefined)?.queued) {
        toast("Action schedule queued. It will sync when connection is restored.");
        return;
      }
      if (
        data
        && "normalizedToInbox" in data
        && data.normalizedToInbox
      ) {
        toast("Actions without a time stay in Inbox.");
      }
    },
  });

  const toggleInboxTask = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      const remoteTaskId = getRemoteTaskId(taskId);
      const completedAt = completed ? new Date().toISOString() : null;
      if (shouldQueueWrites) {
        await queueTaskAction("COMPLETE_TASK", {
          taskId,
          completed,
          completedAt,
        });
        syncQueuedCompletionFeedbackInboxCompletion(taskId, completed, null, completedAt);
        return { queued: true };
      }

      if (!user?.id) throw new Error("User not authenticated");

      let taskDetails: {
        id: string;
        task_text: string | null;
        task_date: string | null;
        scheduled_time: string | null;
        difficulty: string | null;
        category: string | null;
        habit_source_id: string | null;
        epic_id: string | null;
        completed: boolean | null;
        completed_at: string | null;
        epics?: { title?: string | null } | null;
      } | null = null;

      if (completed) {
        const { data: task, error: fetchError } = await supabase
          .from("daily_tasks")
          .select(`
            id, task_text, task_date, scheduled_time, difficulty, category,
            habit_source_id, epic_id, completed, completed_at,
            epics(title)
          `)
          .eq("id", remoteTaskId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (fetchError) {
          if (isQueueableWriteError(fetchError)) {
            await queueTaskAction("COMPLETE_TASK", { taskId, completed, completedAt });
            syncQueuedCompletionFeedbackInboxCompletion(taskId, completed, null, completedAt);
            return { queued: true };
          }
          reportApiFailure(fetchError, { source: "inbox_toggle_fetch" });
          throw fetchError;
        }

        if (!task) throw new Error("Task not found");
        taskDetails = task as NonNullable<typeof taskDetails>;

        if (taskDetails.completed === true || taskDetails.completed_at) {
          return {
            queued: false,
            completed,
            wasAlreadyCompleted: true,
          };
        }
      }

      let updateQuery = supabase
        .from("daily_tasks")
        .update({ completed, completed_at: completedAt })
        .eq("id", remoteTaskId)
        .eq("user_id", user.id);

      if (completed) {
        updateQuery = updateQuery
          .eq("completed", false)
          .is("completed_at", null);
      }

      const { data: updatedTask, error } = await updateQuery
        .select("id")
        .maybeSingle();

      if (error) {
        if (isQueueableWriteError(error)) {
          await queueTaskAction("COMPLETE_TASK", {
            taskId,
            completed,
            completedAt,
          });
          syncQueuedCompletionFeedbackInboxCompletion(
            taskId,
            completed,
            taskDetails?.task_date ?? null,
            completedAt,
          );
          return { queued: true };
        }
        reportApiFailure(error, { source: "inbox_toggle" });
        throw error;
      }

      if (completed && !updatedTask) {
        return {
          queued: false,
          completed,
          wasAlreadyCompleted: true,
        };
      }

      return {
        queued: false,
        completed,
        completedAt,
        wasAlreadyCompleted: false,
        taskId: taskDetails?.id ?? remoteTaskId,
        taskText: taskDetails?.task_text ?? "Action",
        taskDate: taskDetails?.task_date ?? null,
        scheduledTime: taskDetails?.scheduled_time ?? null,
        difficulty: taskDetails?.difficulty ?? null,
        category: taskDetails?.category ?? null,
        habitSourceId: taskDetails?.habit_source_id ?? null,
        epicId: taskDetails?.epic_id ?? null,
        epicTitle: taskDetails?.epics?.title ?? null,
      };
    },
    onSuccess: (data) => {
      invalidateInboxQueries();
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      if ((data as { queued?: boolean } | undefined)?.queued) {
        toast("Action completion queued. It will sync when connection is restored.");
        return;
      }

      if (data.completed && !data.wasAlreadyCompleted) {
        const completionFeedbackDaySignals = getCompletionFeedbackDaySignals(
          data.taskId,
          data.taskDate,
          data.completedAt,
        );
        rememberCompletionFeedbackInboxCompletion(data.taskId, data.taskDate, data.completedAt);
        void triggerCompletionFeedback({
          taskId: data.taskId,
          taskTitle: data.taskText,
          completionSource: data.habitSourceId ? "ritual" : "inbox",
          completedAt: data.completedAt ?? undefined,
          taskDate: data.taskDate,
          scheduledTime: data.scheduledTime,
          difficulty: data.difficulty,
          category: data.category,
          habitSourceId: data.habitSourceId,
          epicId: data.epicId,
          epicTitle: data.epicTitle,
          ...completionFeedbackDaySignals,
        }).catch((feedbackError) => {
          console.warn("[InboxTasks] Completion feedback failed:", feedbackError);
        });
      }
    },
  });

  const deleteInboxTask = useMutation({
    mutationFn: async (taskId: string) => {
      const remoteTaskId = getRemoteTaskId(taskId);
      if (shouldQueueWrites) {
        await queueTaskAction("DELETE_TASK", { taskId });
        return { queued: true };
      }
      const { error } = await supabase
        .from("daily_tasks")
        .delete()
        .eq("id", remoteTaskId);
      if (error) {
        if (isQueueableWriteError(error)) {
          await queueTaskAction("DELETE_TASK", { taskId });
          return { queued: true };
        }
        reportApiFailure(error, { source: "inbox_delete" });
        throw error;
      }
      return { queued: false };
    },
    onSuccess: (data) => {
      invalidateInboxQueries();
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      if ((data as { queued?: boolean } | undefined)?.queued) {
        toast("Action deletion queued. It will sync when connection is restored.");
      }
    },
  });

  return {
    inboxTasks,
    inboxCount: inboxTasks.length,
    isLoading,
    scheduleTask: scheduleTask.mutate,
    toggleInboxTask: toggleInboxTask.mutate,
    deleteInboxTask: deleteInboxTask.mutate,
  };
};

export const useInboxCount = () => {
  const { user } = useAuth();

  const { data: inboxCount = 0 } = useQuery({
    queryKey: getInboxCountQueryKey(user?.id),
    queryFn: async () => {
      if (!user?.id) return 0;
      return fetchInboxCount(user.id);
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
  });

  return { inboxCount };
};
