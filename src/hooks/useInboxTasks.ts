import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCallback } from "react";

export const useInboxTasks = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: inboxTasks = [], isLoading } = useQuery({
    queryKey: ["inbox-tasks", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("daily_tasks")
        .select("*")
        .eq("user_id", user.id)
        .is("task_date", null)
        .eq("completed", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const scheduleTask = useMutation({
    mutationFn: async ({ taskId, targetDate }: { taskId: string; targetDate: string }) => {
      const { error } = await supabase
        .from("daily_tasks")
        .update({ task_date: targetDate })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
    },
  });

  const toggleInboxTask = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      const { error } = await supabase
        .from("daily_tasks")
        .update({ completed, completed_at: completed ? new Date().toISOString() : null })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox-tasks"] });
    },
  });

  const deleteInboxTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("daily_tasks")
        .delete()
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox-tasks"] });
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
