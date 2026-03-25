import { useState, useEffect, useCallback, useRef } from "react";
import {
  discardQueuedAction,
  enqueueAction,
  getActiveQueuedActions,
  getQueuedActionCount,
  getQueuedActions,
  initOfflineDB,
  retryQueuedAction,
  type QueueActionKind,
  type QueueEntityType,
  type QueuedAction,
  updateQueuedAction,
} from "@/utils/offlineStorage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { extractErrorMessage } from "@/utils/networkErrors";
import { trackResilienceEvent } from "@/utils/resilienceTelemetry";
import { dispatchPlannerSyncFinished } from "@/utils/plannerSync";

export type SyncStatus = "idle" | "syncing" | "success" | "error";

const MAX_AUTO_RETRIES = 3;

interface OfflineQueueState {
  pendingCount: number;
  syncStatus: SyncStatus;
  lastSyncError: string | null;
  receipts: QueuedAction[];
}

interface QueueActionInput {
  actionKind: QueueActionKind;
  entityType?: QueueEntityType;
  entityId?: string | null;
  payload: Record<string, unknown>;
}

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const MONTHLY_RECURRENCE_SCHEMA_MESSAGE = "Monthly recurrence is temporarily unavailable until backend update completes.";

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

function isMonthBasedRecurrencePayload(payload: Record<string, unknown>): boolean {
  const recurrencePattern = typeof payload.recurrence_pattern === "string"
    ? payload.recurrence_pattern.toLowerCase()
    : null;
  const recurrenceCustomPeriod = typeof payload.recurrence_custom_period === "string"
    ? payload.recurrence_custom_period.toLowerCase()
    : null;
  const recurrenceMonthDays = Array.isArray(payload.recurrence_month_days) ? payload.recurrence_month_days : [];

  return recurrencePattern === "monthly"
    || (recurrencePattern === "custom" && (recurrenceCustomPeriod === "month" || recurrenceMonthDays.length > 0));
}

function stripUnsupportedRecurrenceColumns(payload: Record<string, unknown>): Record<string, unknown> {
  const nextPayload = { ...payload };
  delete nextPayload.recurrence_month_days;
  delete nextPayload.recurrence_custom_period;
  return nextPayload;
}

async function executeQueuedAction(userId: string, action: QueuedAction): Promise<void> {
  switch (action.action_kind) {
    case "TASK_COMPLETE": {
      const { taskId, completed, completedAt } = action.payload as {
        taskId: string;
        completed: boolean;
        completedAt: string | null;
      };

      const { error } = await supabase
        .from("daily_tasks")
        .update({ completed, completed_at: completedAt })
        .eq("id", taskId)
        .eq("user_id", userId);

      if (error) throw error;
      return;
    }

    case "TASK_CREATE": {
      const taskData = action.payload as Record<string, unknown>;
      const insertPayload = {
        id: (taskData.id as string | undefined) ?? undefined,
        task_text: taskData.task_text as string,
        difficulty: (taskData.difficulty as string | null) ?? null,
        xp_reward: Number(taskData.xp_reward ?? 0),
        task_date: (taskData.task_date as string | null) ?? null,
        user_id: userId,
        completed: (taskData.completed as boolean | null) ?? false,
        completed_at: (taskData.completed_at as string | null) ?? null,
        is_main_quest: (taskData.is_main_quest as boolean | null) ?? false,
        scheduled_time: (taskData.scheduled_time as string | null) ?? null,
        estimated_duration: (taskData.estimated_duration as number | null) ?? null,
        recurrence_pattern: (taskData.recurrence_pattern as string | null) ?? null,
        recurrence_days: (taskData.recurrence_days as number[] | null) ?? null,
        recurrence_month_days: (taskData.recurrence_month_days as number[] | null) ?? null,
        recurrence_custom_period: (taskData.recurrence_custom_period as string | null) ?? null,
        recurrence_end_date: (taskData.recurrence_end_date as string | null) ?? null,
        is_recurring: (taskData.is_recurring as boolean | null) ?? Boolean(taskData.recurrence_pattern),
        reminder_enabled: (taskData.reminder_enabled as boolean | null) ?? false,
        reminder_minutes_before: (taskData.reminder_minutes_before as number | null) ?? 15,
        category: (taskData.category as string | null) ?? null,
        notes: (taskData.notes as string | null) ?? null,
        contact_id: (taskData.contact_id as string | null) ?? null,
        auto_log_interaction: (taskData.auto_log_interaction as boolean | null) ?? true,
        image_url: (taskData.image_url as string | null) ?? null,
        location: (taskData.location as string | null) ?? null,
        source: (taskData.source as string | null) ?? ((taskData.task_date as string | null) === null ? "inbox" : "manual"),
        habit_source_id: (taskData.habit_source_id as string | null) ?? null,
        epic_id: (taskData.epic_id as string | null) ?? null,
        parent_template_id: (taskData.parent_template_id as string | null) ?? null,
        sort_order: (taskData.sort_order as number | null) ?? null,
      };

      const runInsert = async (payload: typeof insertPayload) => {
        if (payload.parent_template_id) {
          return supabase
            .from("daily_tasks")
            .upsert(payload, {
              onConflict: "user_id,task_date,parent_template_id",
              ignoreDuplicates: true,
            });
        }

        if (payload.habit_source_id) {
          return supabase
            .from("daily_tasks")
            .upsert(payload, {
              onConflict: "user_id,task_date,habit_source_id",
              ignoreDuplicates: true,
            });
        }

        return supabase
          .from("daily_tasks")
          .insert([payload]);
      };

      let { error } = await runInsert(insertPayload);

      if (isDailyTasksRecurrenceColumnsMissingError(error)) {
        if (isMonthBasedRecurrencePayload(insertPayload)) {
          throw new Error(MONTHLY_RECURRENCE_SCHEMA_MESSAGE);
        }

        ({ error } = await runInsert(stripUnsupportedRecurrenceColumns(insertPayload) as typeof insertPayload));
      }

      if (error) throw error;

      const subtasks = Array.isArray(taskData.subtasks) ? taskData.subtasks as Array<Record<string, unknown>> : [];
      if (subtasks.length > 0) {
        const { error: subtasksError } = await supabase
          .from("subtasks")
          .insert(
            subtasks.map((subtask, index) => ({
              id: (subtask.id as string | undefined) ?? undefined,
              task_id: ((taskData.id as string | null) ?? (taskData.task_id as string | null)) as string,
              user_id: userId,
              title: subtask.title as string,
              completed: Boolean(subtask.completed),
              completed_at: (subtask.completed_at as string | null) ?? null,
              sort_order: (subtask.sort_order as number | null) ?? index,
            })),
          );

        if (subtasksError) throw subtasksError;
      }
      return;
    }

    case "TASK_UPDATE": {
      const { taskId, updates } = action.payload as {
        taskId: string;
        updates: Record<string, unknown>;
      };

      const safeUpdates = { ...updates };
      delete safeUpdates.attachments;

      if (Object.keys(safeUpdates).length === 0) {
        return;
      }

      let { error } = await supabase
        .from("daily_tasks")
        .update(safeUpdates)
        .eq("id", taskId)
        .eq("user_id", userId);

      if (isDailyTasksRecurrenceColumnsMissingError(error)) {
        if (isMonthBasedRecurrencePayload(safeUpdates)) {
          throw new Error(MONTHLY_RECURRENCE_SCHEMA_MESSAGE);
        }

        const fallbackUpdates = stripUnsupportedRecurrenceColumns(safeUpdates);
        if (Object.keys(fallbackUpdates).length === 0) {
          return;
        }

        ({ error } = await supabase
          .from("daily_tasks")
          .update(fallbackUpdates)
          .eq("id", taskId)
          .eq("user_id", userId));
      }

      if (error) throw error;
      return;
    }

    case "TASK_DELETE": {
      const { taskId } = action.payload as { taskId: string };

      const { error } = await supabase
        .from("daily_tasks")
        .delete()
        .eq("id", taskId)
        .eq("user_id", userId);

      if (error) throw error;
      return;
    }

    case "TASK_SET_MAIN_QUEST": {
      const { taskId, taskDate } = action.payload as { taskId: string; taskDate: string | null };

      const resetQuery = supabase
        .from("daily_tasks")
        .update({ is_main_quest: false })
        .eq("user_id", userId);

      const { error: resetError } = taskDate === null
        ? await resetQuery.is("task_date", null)
        : await resetQuery.eq("task_date", taskDate);
      if (resetError) throw resetError;

      const { error } = await supabase
        .from("daily_tasks")
        .update({ is_main_quest: true })
        .eq("id", taskId)
        .eq("user_id", userId);

      if (error) throw error;
      return;
    }

    case "SUBTASK_CREATE": {
      const payload = action.payload as Record<string, unknown>;
      const { error } = await supabase
        .from("subtasks")
        .insert({
          id: payload.id as string,
          task_id: payload.task_id as string,
          user_id: userId,
          title: payload.title as string,
          completed: Boolean(payload.completed),
          completed_at: (payload.completed_at as string | null) ?? null,
          sort_order: (payload.sort_order as number | null) ?? 0,
        });

      if (error) throw error;
      return;
    }

    case "SUBTASK_UPDATE": {
      const { subtaskId, updates } = action.payload as {
        subtaskId: string;
        updates: Record<string, unknown>;
      };

      const { error } = await supabase
        .from("subtasks")
        .update(updates)
        .eq("id", subtaskId)
        .eq("user_id", userId);

      if (error) throw error;
      return;
    }

    case "SUBTASK_DELETE": {
      const { subtaskId } = action.payload as { subtaskId: string };

      const { error } = await supabase
        .from("subtasks")
        .delete()
        .eq("id", subtaskId)
        .eq("user_id", userId);

      if (error) throw error;
      return;
    }

    case "HABIT_CREATE": {
      const payload = action.payload as Record<string, unknown>;
      const { error } = await supabase
        .from("habits")
        .insert(payload);

      if (error) throw error;
      return;
    }

    case "HABIT_UPDATE": {
      const { habitId, updates } = action.payload as {
        habitId: string;
        updates: Record<string, unknown>;
      };

      const { error } = await supabase
        .from("habits")
        .update(updates)
        .eq("id", habitId)
        .eq("user_id", userId);

      if (error) throw error;
      return;
    }

    case "HABIT_DELETE": {
      const { habitId } = action.payload as { habitId: string };

      const { error } = await supabase
        .from("habits")
        .delete()
        .eq("id", habitId)
        .eq("user_id", userId);

      if (error) throw error;
      return;
    }

    case "HABIT_COMPLETION_SET": {
      const {
        completionId,
        habitId,
        date,
        completed,
      } = action.payload as {
        completionId?: string;
        habitId: string;
        date: string;
        completed: boolean;
      };

      if (!completed) {
        const { error } = await supabase
          .from("habit_completions")
          .delete()
          .eq("habit_id", habitId)
          .eq("user_id", userId)
          .eq("date", date);

        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("habit_completions")
        .upsert({
          id: completionId,
          habit_id: habitId,
          user_id: userId,
          date,
        }, { onConflict: "user_id,habit_id,date" });

      if (error) throw error;
      return;
    }

    case "EPIC_CREATE": {
      const payload = action.payload as {
        epic: Record<string, unknown>;
        habits: Record<string, unknown>[];
        epicHabits: Record<string, unknown>[];
        phases: Record<string, unknown>[];
        milestones: Record<string, unknown>[];
      };

      if (payload.habits.length > 0) {
        const { error } = await supabase
          .from("habits")
          .upsert(payload.habits);
        if (error) throw error;
      }

      const { error: epicError } = await supabase
        .from("epics")
        .upsert(payload.epic);
      if (epicError) throw epicError;

      if (payload.epicHabits.length > 0) {
        const { error } = await supabase
          .from("epic_habits")
          .upsert(payload.epicHabits);
        if (error) throw error;
      }

      if (payload.phases.length > 0) {
        const { error } = await supabase
          .from("journey_phases")
          .upsert(payload.phases);
        if (error) throw error;
      }

      if (payload.milestones.length > 0) {
        const { error } = await supabase
          .from("epic_milestones")
          .upsert(payload.milestones);
        if (error) throw error;
      }

      return;
    }

    case "EPIC_STATUS_UPDATE": {
      const { epicId, status } = action.payload as {
        epicId: string;
        status: "completed" | "abandoned";
      };

      const { error } = await supabase
        .from("epics")
        .update({
          status,
          completed_at: status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", epicId)
        .eq("user_id", userId);

      if (error) throw error;

      if (status === "abandoned") {
        const { data: epicHabits } = await supabase
          .from("epic_habits")
          .select("id, habit_id")
          .eq("epic_id", epicId);

        const habitIds = epicHabits?.map((row) => row.habit_id) ?? [];

        if (habitIds.length > 0) {
          const { error: habitsError } = await supabase
            .from("habits")
            .update({ is_active: false })
            .in("id", habitIds)
            .eq("user_id", userId);
          if (habitsError) throw habitsError;

          const today = new Date().toISOString().split("T")[0];
          const { error: tasksError } = await supabase
            .from("daily_tasks")
            .delete()
            .in("habit_source_id", habitIds)
            .gte("task_date", today)
            .eq("completed", false)
            .eq("user_id", userId);
          if (tasksError) throw tasksError;

          const linkIds = epicHabits?.map((row) => row.id) ?? [];
          if (linkIds.length > 0) {
            const { error: linksError } = await supabase
              .from("epic_habits")
              .delete()
              .in("id", linkIds);
            if (linksError) throw linksError;
          }
        }

        const { error: milestonesError } = await supabase
          .from("epic_milestones")
          .delete()
          .eq("epic_id", epicId)
          .eq("user_id", userId);
        if (milestonesError) throw milestonesError;
      }

      return;
    }

    case "MENTOR_FEEDBACK": {
      const { message_content, feedback_type } = action.payload as {
        message_content: string;
        feedback_type: string;
      };

      const { error } = await supabase
        .from("mentor_chat_feedback")
        .insert({
          user_id: userId,
          message_content,
          feedback_type,
        });

      if (error) throw error;
      return;
    }

    case "SUPPORT_REPORT": {
      const { error } = await supabase.functions.invoke("submit-support-report", {
        body: action.payload,
      });

      if (error) throw error;
      return;
    }

    default:
      throw new Error(`Unsupported queued action kind: ${action.action_kind}`);
  }
}

export function useOfflineQueue() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<OfflineQueueState>({
    pendingCount: 0,
    syncStatus: "idle",
    lastSyncError: null,
    receipts: [],
  });

  const isSyncingRef = useRef(false);

  const refreshQueueState = useCallback(async () => {
    if (!user?.id) {
      setState((prev) => ({ ...prev, pendingCount: 0, receipts: [] }));
      return;
    }

    const [pendingCount, receipts] = await Promise.all([
      getQueuedActionCount(user.id),
      getQueuedActions(user.id),
    ]);

    setState((prev) => ({
      ...prev,
      pendingCount,
      receipts,
    }));
  }, [user?.id]);

  useEffect(() => {
    let disposed = false;

    const init = async () => {
      try {
        await initOfflineDB();
        if (!disposed) {
          await refreshQueueState();
        }
      } catch (error) {
        console.error("Failed to initialize offline queue:", error);
      }
    };

    void init();

    return () => {
      disposed = true;
    };
  }, [refreshQueueState]);

  const queueAction = useCallback(
    async ({ actionKind, entityType, entityId, payload }: QueueActionInput): Promise<string> => {
      if (!user?.id) throw new Error("User not authenticated");

      const id = await enqueueAction({
        userId: user.id,
        actionKind,
        entityType,
        entityId,
        payload,
      });

      trackResilienceEvent("queued_action_created", {
        actionKind,
        entityType,
        entityId,
      });

      await refreshQueueState();
      return id;
    },
    [refreshQueueState, user?.id],
  );

  const queueTaskAction = useCallback(
    async (
      type: "COMPLETE_TASK" | "CREATE_TASK" | "UPDATE_TASK" | "DELETE_TASK",
      payload: Record<string, unknown>,
    ): Promise<string> => {
      const actionKind: QueueActionKind =
        type === "COMPLETE_TASK"
          ? "TASK_COMPLETE"
          : type === "CREATE_TASK"
            ? "TASK_CREATE"
            : type === "DELETE_TASK"
              ? "TASK_DELETE"
              : "TASK_UPDATE";

      return queueAction({
        actionKind,
        entityType: "task",
        entityId: typeof payload.taskId === "string" ? payload.taskId : null,
        payload,
      });
    },
    [queueAction],
  );

  const syncPendingActions = useCallback(async (): Promise<{ success: number; failed: number }> => {
    if (isSyncingRef.current || !navigator.onLine || !user?.id) {
      return { success: 0, failed: 0 };
    }

    isSyncingRef.current = true;
    setState((prev) => ({ ...prev, syncStatus: "syncing", lastSyncError: null }));

    let successCount = 0;
    let failedCount = 0;

    try {
      const actions = await getActiveQueuedActions(user.id);

      for (const action of actions) {
        if (action.status === "failed" && action.retry_count >= MAX_AUTO_RETRIES) {
          continue;
        }

        await updateQueuedAction(action.id, { status: "syncing" });

        try {
          await executeQueuedAction(user.id, action);
          await updateQueuedAction(action.id, {
            status: "synced",
            last_error: null,
          });
          successCount += 1;

          trackResilienceEvent("queued_action_synced", {
            actionKind: action.action_kind,
            entityType: action.entity_type,
            id: action.id,
          });
        } catch (error) {
          const errorMessage = extractErrorMessage(error);
          await updateQueuedAction(action.id, {
            status: "failed",
            retry_count: action.retry_count + 1,
            last_error: errorMessage,
          });
          failedCount += 1;

          trackResilienceEvent("queued_action_failed", {
            actionKind: action.action_kind,
            entityType: action.entity_type,
            id: action.id,
            error: errorMessage,
          });
        }
      }

      await refreshQueueState();

      setState((prev) => ({
        ...prev,
        syncStatus: failedCount === 0 ? "success" : "error",
        lastSyncError: failedCount > 0 ? `${failedCount} queued action${failedCount > 1 ? "s" : ""} failed to sync` : null,
      }));

      if (successCount > 0) {
        toast({
          title: "Queued actions synced",
          description: `${successCount} action${successCount > 1 ? "s" : ""} synced successfully`,
        });
        dispatchPlannerSyncFinished();
      }

      window.setTimeout(() => {
        setState((prev) => ({ ...prev, syncStatus: "idle" }));
      }, 3000);

      return { success: successCount, failed: failedCount };
    } catch (error) {
      console.error("Failed to sync queued actions:", error);
      const message = extractErrorMessage(error);

      setState((prev) => ({
        ...prev,
        syncStatus: "error",
        lastSyncError: message,
      }));

      return { success: successCount, failed: failedCount };
    } finally {
      isSyncingRef.current = false;
    }
  }, [refreshQueueState, toast, user?.id]);

  useEffect(() => {
    const handleOnline = () => {
      void syncPendingActions();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncPendingActions]);

  const retryAction = useCallback(
    async (id: string) => {
      await retryQueuedAction(id);
      await refreshQueueState();
      await syncPendingActions();
    },
    [refreshQueueState, syncPendingActions],
  );

  const discardAction = useCallback(
    async (id: string) => {
      await discardQueuedAction(id);
      await refreshQueueState();
    },
    [refreshQueueState],
  );

  const retryAllFailed = useCallback(async () => {
    if (!user?.id) return;
    const receipts = await getQueuedActions(user.id);
    const failed = receipts.filter((receipt) => receipt.status === "failed");

    await Promise.all(failed.map((receipt) => retryQueuedAction(receipt.id)));
    await refreshQueueState();
    await syncPendingActions();
  }, [refreshQueueState, syncPendingActions, user?.id]);

  const triggerSync = useCallback(async () => {
    if (!user?.id) return;
    if (!navigator.onLine) {
      toast({
        title: "You're offline",
        description: "Sync will resume automatically when connection is restored",
        variant: "destructive",
      });
      return;
    }

    return syncPendingActions();
  }, [syncPendingActions, toast, user?.id]);

  return {
    pendingCount: state.pendingCount,
    syncStatus: state.syncStatus,
    lastSyncError: state.lastSyncError,
    receipts: state.receipts,
    queueAction,
    queueTaskAction,
    retryAction,
    retryAllFailed,
    discardAction,
    refreshQueueState,
    triggerSync,
    syncPendingActions,
  };
}
