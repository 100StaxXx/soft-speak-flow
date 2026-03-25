import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useResilience } from "@/contexts/ResilienceContext";
import {
  createOfflinePlannerId,
  getLocalSubtasksForTask,
  removePlannerRecord,
  upsertPlannerRecord,
} from "@/utils/plannerLocalStore";
import { PLANNER_SYNC_EVENT } from "@/utils/plannerSync";

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

  const query = useQuery({
    queryKey: ["subtasks", parentTaskId],
    queryFn: async () => {
      if (!user?.id || !parentTaskId) return [];
      const localSubtasks = await getLocalSubtasksForTask<Subtask>(parentTaskId);
      return localSubtasks
        .slice()
        .sort((a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER));
    },
    enabled: !!user?.id && !!parentTaskId,
  });

  useEffect(() => {
    if (!parentTaskId) return;

    const handlePlannerSync = () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks", parentTaskId] });
    };

    window.addEventListener(PLANNER_SYNC_EVENT, handlePlannerSync);
    return () => {
      window.removeEventListener(PLANNER_SYNC_EVENT, handlePlannerSync);
    };
  }, [parentTaskId, queryClient]);

  const subtasks = query.data ?? [];

  const addSubtask = useMutation({
    mutationFn: async (title: string) => {
      if (!user?.id || !parentTaskId) throw new Error("Missing required data");

      const maxOrder = subtasks.length > 0
        ? Math.max(...subtasks.map((subtask) => subtask.sort_order)) + 1
        : 0;

      const subtaskRow: Subtask = {
        id: createOfflinePlannerId("subtask"),
        task_id: parentTaskId,
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
          payload: subtaskRow,
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
          payload: subtaskRow,
        });
        void retryNow();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks", parentTaskId] });
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
    },
    onError: () => {
      toast.error("Failed to add subtask");
    },
  });

  const toggleSubtask = useMutation({
    mutationFn: async ({ subtaskId, completed }: { subtaskId: string; completed: boolean }) => {
      const existing = subtasks.find((subtask) => subtask.id === subtaskId);
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
          entityId: subtaskId,
          payload: {
            subtaskId,
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
        .eq("id", subtaskId);

      if (error) {
        await queueAction({
          actionKind: "SUBTASK_UPDATE",
          entityType: "subtask",
          entityId: subtaskId,
          payload: {
            subtaskId,
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
      queryClient.invalidateQueries({ queryKey: ["subtasks", parentTaskId] });
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
    },
  });

  const deleteSubtask = useMutation({
    mutationFn: async (subtaskId: string) => {
      await removePlannerRecord("subtasks", subtaskId);

      if (shouldQueueWrites) {
        await queueAction({
          actionKind: "SUBTASK_DELETE",
          entityType: "subtask",
          entityId: subtaskId,
          payload: { subtaskId },
        });
        return;
      }

      const { error } = await supabase
        .from("subtasks")
        .delete()
        .eq("id", subtaskId);

      if (error) {
        await queueAction({
          actionKind: "SUBTASK_DELETE",
          entityType: "subtask",
          entityId: subtaskId,
          payload: { subtaskId },
        });
        void retryNow();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks", parentTaskId] });
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
    },
  });

  const updateSubtask = useMutation({
    mutationFn: async ({ subtaskId, title }: { subtaskId: string; title: string }) => {
      const existing = subtasks.find((subtask) => subtask.id === subtaskId);
      if (!existing) throw new Error("Subtask not found");

      await upsertPlannerRecord("subtasks", {
        ...existing,
        title,
      });

      if (shouldQueueWrites) {
        await queueAction({
          actionKind: "SUBTASK_UPDATE",
          entityType: "subtask",
          entityId: subtaskId,
          payload: {
            subtaskId,
            updates: { title },
          },
        });
        return;
      }

      const { error } = await supabase
        .from("subtasks")
        .update({ title })
        .eq("id", subtaskId);

      if (error) {
        await queueAction({
          actionKind: "SUBTASK_UPDATE",
          entityType: "subtask",
          entityId: subtaskId,
          payload: {
            subtaskId,
            updates: { title },
          },
        });
        void retryNow();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks", parentTaskId] });
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
    },
    onError: () => {
      toast.error("Failed to update subtask");
    },
  });

  const bulkAddSubtasks = useMutation({
    mutationFn: async (titles: string[]) => {
      if (!user?.id || !parentTaskId) throw new Error("Missing required data");

      const maxOrder = subtasks.length > 0
        ? Math.max(...subtasks.map((subtask) => subtask.sort_order)) + 1
        : 0;

      const rows = titles.map((title, index) => ({
        id: createOfflinePlannerId("subtask"),
        task_id: parentTaskId,
        user_id: user.id,
        title,
        completed: false,
        completed_at: null,
        sort_order: maxOrder + index,
        created_at: new Date().toISOString(),
      })) satisfies Subtask[];

      for (const row of rows) {
        await upsertPlannerRecord("subtasks", row);
      }

      if (shouldQueueWrites) {
        await Promise.all(rows.map((row) =>
          queueAction({
            actionKind: "SUBTASK_CREATE",
            entityType: "subtask",
            entityId: row.id,
            payload: row,
          }),
        ));
        return;
      }

      const { error } = await supabase.from("subtasks").insert(rows);
      if (error) {
        await Promise.all(rows.map((row) =>
          queueAction({
            actionKind: "SUBTASK_CREATE",
            entityType: "subtask",
            entityId: row.id,
            payload: row,
          }),
        ));
        void retryNow();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks", parentTaskId] });
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
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
