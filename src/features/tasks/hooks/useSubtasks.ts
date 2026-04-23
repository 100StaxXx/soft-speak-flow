import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/sonner";
import { useResilience } from "@/contexts/ResilienceContext";
import {
  getTaskSubtasksQueryKey,
  invalidateTaskQueryFamilies,
  invalidateTaskSubtasksQuery,
  taskQueryFamilyGroups,
} from "@/lib/taskQueryCache";
import {
  createOfflinePlannerId,
  getLocalSubtasksForTask,
  removePlannerRecord,
  upsertPlannerRecord,
} from "@/utils/plannerLocalStore";
import { normalizeUuidLikeId } from "@/utils/offlineId";
import { PLANNER_SYNC_EVENT } from "@/utils/plannerSync";
import {
  applySubtaskTitlePlan,
  type QueueSubtaskAction,
} from "@/features/tasks/lib/subtaskWrites";

export interface Subtask {
  id: string;
  task_id: string;
  user_id: string;
  title: string;
  completed: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
}

export const useSubtasks = (parentTaskId: string | null) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { queueAction, shouldQueueWrites, retryNow } = useResilience();
  const normalizedParentTaskId = parentTaskId ? normalizeUuidLikeId(parentTaskId) : null;
  const subtasksQueryKey = useMemo(
    () => getTaskSubtasksQueryKey(normalizedParentTaskId),
    [normalizedParentTaskId],
  );

  const loadSubtasksForTask = async (): Promise<Subtask[]> => {
    if (!normalizedParentTaskId) return [];

    const taskIds = normalizedParentTaskId === parentTaskId
      ? [normalizedParentTaskId]
      : [parentTaskId, normalizedParentTaskId].filter((taskId): taskId is string => Boolean(taskId));

    const seenIds = new Set<string>();
    const subtaskGroups = await Promise.all(
      taskIds.map((taskId) => getLocalSubtasksForTask<Subtask>(taskId)),
    );

    return subtaskGroups
      .flat()
      .filter((subtask) => {
        const canonicalId = normalizeUuidLikeId(subtask.id);
        if (seenIds.has(canonicalId)) return false;
        seenIds.add(canonicalId);
        return true;
      })
      .slice()
      .sort((a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER));
  };

  const findExistingSubtask = (subtaskId: string) => {
    const normalizedSubtaskId = normalizeUuidLikeId(subtaskId);
    return subtasks.find((subtask) => normalizeUuidLikeId(subtask.id) === normalizedSubtaskId) ?? null;
  };

  const query = useQuery({
    queryKey: subtasksQueryKey,
    queryFn: async () => {
      if (!user?.id || !normalizedParentTaskId) return [];
      return loadSubtasksForTask();
    },
    enabled: !!user?.id && !!normalizedParentTaskId,
  });

  useEffect(() => {
    if (!normalizedParentTaskId) return;

    const handlePlannerSync = () => {
      void invalidateTaskSubtasksQuery(queryClient, normalizedParentTaskId);
    };

    window.addEventListener(PLANNER_SYNC_EVENT, handlePlannerSync);
    return () => {
      window.removeEventListener(PLANNER_SYNC_EVENT, handlePlannerSync);
    };
  }, [normalizedParentTaskId, queryClient, subtasksQueryKey]);

  const subtasks = query.data ?? [];

  const addSubtask = useMutation({
    mutationFn: async (title: string) => {
      if (!user?.id || !normalizedParentTaskId) throw new Error("Missing required data");

      const maxOrder = subtasks.length > 0
        ? Math.max(...subtasks.map((subtask) => subtask.sort_order)) + 1
        : 0;

      const subtaskRow: Subtask = {
        id: normalizeUuidLikeId(createOfflinePlannerId("subtask")),
        task_id: normalizedParentTaskId,
        user_id: user.id,
        title,
        completed: false,
        completed_at: null,
        sort_order: maxOrder,
        created_at: new Date().toISOString(),
      };

      await upsertPlannerRecord("subtasks", subtaskRow);

      if (shouldQueueWrites) {
        await queueAction({
          actionKind: "SUBTASK_CREATE",
          entityType: "subtask",
          entityId: subtaskRow.id,
          payload: subtaskRow as unknown as Record<string, unknown>,
        });
        return;
      }

      const { error } = await supabase
        .from("subtasks")
        .insert(subtaskRow);

      if (error) {
        await queueAction({
          actionKind: "SUBTASK_CREATE",
          entityType: "subtask",
          entityId: subtaskRow.id,
          payload: subtaskRow as unknown as Record<string, unknown>,
        });
        void retryNow();
      }
    },
    onSuccess: () => {
      void invalidateTaskSubtasksQuery(queryClient, normalizedParentTaskId);
      void invalidateTaskQueryFamilies(queryClient, taskQueryFamilyGroups.plannerAndInboxTasks);
    },
    onError: () => {
      toast.error("Failed to add subtask");
    },
  });

  const toggleSubtask = useMutation({
    mutationFn: async ({ subtaskId, completed }: { subtaskId: string; completed: boolean }) => {
      const normalizedSubtaskId = normalizeUuidLikeId(subtaskId);
      const existing = findExistingSubtask(subtaskId);
      if (!existing) throw new Error("Subtask not found");

      const updated = {
        ...existing,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      };

      await upsertPlannerRecord("subtasks", updated);

      if (shouldQueueWrites) {
        await queueAction({
          actionKind: "SUBTASK_UPDATE",
          entityType: "subtask",
          entityId: normalizedSubtaskId,
          payload: {
            subtaskId: normalizedSubtaskId,
            updates: {
              completed,
              completed_at: updated.completed_at,
            },
          },
        });
        return;
      }

      const { error } = await supabase
        .from("subtasks")
        .update({
          completed,
          completed_at: updated.completed_at,
        })
        .eq("id", normalizedSubtaskId);

      if (error) {
        await queueAction({
          actionKind: "SUBTASK_UPDATE",
          entityType: "subtask",
          entityId: normalizedSubtaskId,
          payload: {
            subtaskId: normalizedSubtaskId,
            updates: {
              completed,
              completed_at: updated.completed_at,
            },
          },
        });
        void retryNow();
      }
    },
    onSuccess: () => {
      void invalidateTaskSubtasksQuery(queryClient, normalizedParentTaskId);
      void invalidateTaskQueryFamilies(queryClient, taskQueryFamilyGroups.plannerAndInboxTasks);
    },
  });

  const deleteSubtask = useMutation({
    mutationFn: async (subtaskId: string) => {
      const normalizedSubtaskId = normalizeUuidLikeId(subtaskId);
      const existing = findExistingSubtask(subtaskId);
      const localSubtaskId = existing?.id ?? normalizedSubtaskId;

      await removePlannerRecord("subtasks", localSubtaskId);

      if (shouldQueueWrites) {
        await queueAction({
          actionKind: "SUBTASK_DELETE",
          entityType: "subtask",
          entityId: normalizedSubtaskId,
          payload: { subtaskId: normalizedSubtaskId },
        });
        return;
      }

      const { error } = await supabase
        .from("subtasks")
        .delete()
        .eq("id", normalizedSubtaskId);

      if (error) {
        await queueAction({
          actionKind: "SUBTASK_DELETE",
          entityType: "subtask",
          entityId: normalizedSubtaskId,
          payload: { subtaskId: normalizedSubtaskId },
        });
        void retryNow();
      }
    },
    onSuccess: () => {
      void invalidateTaskSubtasksQuery(queryClient, normalizedParentTaskId);
      void invalidateTaskQueryFamilies(queryClient, taskQueryFamilyGroups.plannerAndInboxTasks);
    },
  });

  const updateSubtask = useMutation({
    mutationFn: async ({ subtaskId, title }: { subtaskId: string; title: string }) => {
      const normalizedSubtaskId = normalizeUuidLikeId(subtaskId);
      const existing = findExistingSubtask(subtaskId);
      if (!existing) throw new Error("Subtask not found");

      await upsertPlannerRecord("subtasks", {
        ...existing,
        title,
      });

      if (shouldQueueWrites) {
        await queueAction({
          actionKind: "SUBTASK_UPDATE",
          entityType: "subtask",
          entityId: normalizedSubtaskId,
          payload: {
            subtaskId: normalizedSubtaskId,
            updates: { title },
          },
        });
        return;
      }

      const { error } = await supabase
        .from("subtasks")
        .update({ title })
        .eq("id", normalizedSubtaskId);

      if (error) {
        await queueAction({
          actionKind: "SUBTASK_UPDATE",
          entityType: "subtask",
          entityId: normalizedSubtaskId,
          payload: {
            subtaskId: normalizedSubtaskId,
            updates: { title },
          },
        });
        void retryNow();
      }
    },
    onSuccess: () => {
      void invalidateTaskSubtasksQuery(queryClient, normalizedParentTaskId);
      void invalidateTaskQueryFamilies(queryClient, taskQueryFamilyGroups.plannerAndInboxTasks);
    },
    onError: () => {
      toast.error("Failed to update subtask");
    },
  });

  const bulkAddSubtasks = useMutation({
    mutationFn: async (titles: string[]) => {
      if (!user?.id || !normalizedParentTaskId) throw new Error("Missing required data");
      await applySubtaskTitlePlan({
        mode: "append",
        taskId: normalizedParentTaskId,
        userId: user.id,
        titles,
        shouldQueueWrites,
        queueAction: queueAction as QueueSubtaskAction,
        retryNow,
      });
    },
    onSuccess: () => {
      void invalidateTaskSubtasksQuery(queryClient, normalizedParentTaskId);
      void invalidateTaskQueryFamilies(queryClient, taskQueryFamilyGroups.plannerAndInboxTasks);
      toast.success("Subtasks added!");
    },
    onError: () => {
      toast.error("Failed to add subtasks");
    },
  });

  const completedCount = subtasks.filter((subtask) => subtask.completed).length;
  const totalCount = subtasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return {
    subtasks,
    isLoading: query.isLoading,
    addSubtask: addSubtask.mutate,
    toggleSubtask: toggleSubtask.mutate,
    deleteSubtask: deleteSubtask.mutate,
    updateSubtask: updateSubtask.mutate,
    bulkAddSubtasks: bulkAddSubtasks.mutateAsync,
    isAdding: addSubtask.isPending,
    isBulkAdding: bulkAddSubtasks.isPending,
    completedCount,
    totalCount,
    progressPercent,
  };
};
