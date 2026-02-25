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
      const { error } = await supabase
        .from("daily_tasks")
        .insert([
          {
            task_text: taskData.task_text as string,
            difficulty: taskData.difficulty as string,
            xp_reward: taskData.xp_reward as number,
            task_date: (taskData.task_date as string | null) ?? null,
            user_id: userId,
            is_main_quest: (taskData.is_main_quest as boolean | null) ?? false,
            scheduled_time: (taskData.scheduled_time as string | null) ?? null,
            estimated_duration: (taskData.estimated_duration as number | null) ?? null,
            recurrence_pattern: (taskData.recurrence_pattern as string | null) ?? null,
            recurrence_days: (taskData.recurrence_days as number[] | null) ?? null,
            recurrence_end_date: (taskData.recurrence_end_date as string | null) ?? null,
            is_recurring: Boolean(taskData.recurrence_pattern),
            reminder_enabled: (taskData.reminder_enabled as boolean | null) ?? false,
            reminder_minutes_before: (taskData.reminder_minutes_before as number | null) ?? 15,
            category: (taskData.category as string | null) ?? null,
            notes: (taskData.notes as string | null) ?? null,
            contact_id: (taskData.contact_id as string | null) ?? null,
            auto_log_interaction: (taskData.auto_log_interaction as boolean | null) ?? true,
            image_url: (taskData.image_url as string | null) ?? null,
            location: (taskData.location as string | null) ?? null,
            source: (taskData.source as string | null) ?? ((taskData.task_date as string | null) === null ? "inbox" : "manual"),
          },
        ]);

      if (error) throw error;
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

      const { error } = await supabase
        .from("daily_tasks")
        .update(safeUpdates)
        .eq("id", taskId)
        .eq("user_id", userId);

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
