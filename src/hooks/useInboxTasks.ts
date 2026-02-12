import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCallback } from "react";

const INBOX_TASKS_QUERY_KEY = "inbox-tasks";
const INBOX_COUNT_QUERY_KEY = "inbox-count";

export const useInboxTasks = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const invalidateInboxQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [INBOX_TASKS_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: [INBOX_COUNT_QUERY_KEY] });
  }, [queryClient]);

  const { data: inboxTasks = [], isLoading } = useQuery({
    queryKey: [INBOX_TASKS_QUERY_KEY, user?.id],
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
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
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
      invalidateInboxQueries();
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
      invalidateInboxQueries();
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
      invalidateInboxQueries();
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
    queryKey: [INBOX_COUNT_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;

      const { count, error } = await supabase
        .from("daily_tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("task_date", null)
        .eq("completed", false);

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
  });

  return { inboxCount };
};
