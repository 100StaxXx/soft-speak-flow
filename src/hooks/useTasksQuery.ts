import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import {
  PLANNER_SYNC_EVENT,
  loadLocalDailyTasks,
  syncLocalDailyTasksFromRemote,
} from "@/utils/plannerSync";
import { type DailyTask, fetchDailyTasksRemote } from "@/services/dailyTasksRemote";

export type { DailyTask } from "@/services/dailyTasksRemote";

export const DAILY_TASKS_STALE_TIME = 2 * 60 * 1000;
export const DAILY_TASKS_GC_TIME = 30 * 60 * 1000;

export const getDailyTasksQueryKey = (userId: string | undefined, taskDate: string) =>
  ["daily-tasks", userId, taskDate] as const;

export const fetchDailyTasks = fetchDailyTasksRemote;

interface TasksQueryOptions {
  enabled?: boolean;
}

export const useTasksQuery = (selectedDate?: Date, options: TasksQueryOptions = {}) => {
  const { user } = useAuth();
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  const taskDate = selectedDate
    ? format(selectedDate, "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");

  const query = useQuery({
    queryKey: getDailyTasksQueryKey(user?.id, taskDate),
    queryFn: async () => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      return loadLocalDailyTasks(user.id, taskDate);
    },
    enabled: enabled && !!user?.id,
    staleTime: DAILY_TASKS_STALE_TIME,
    gcTime: DAILY_TASKS_GC_TIME,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!enabled || !user?.id) return;

    let disposed = false;

    const refreshFromRemote = async () => {
      try {
        const synced = await syncLocalDailyTasksFromRemote(user.id, taskDate);
        if (disposed || !synced) return;

        queryClient.setQueryData(getDailyTasksQueryKey(user.id, taskDate), await loadLocalDailyTasks(user.id, taskDate));
      } catch (error) {
        console.warn("Failed to refresh local daily tasks from remote:", error);
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
  }, [enabled, queryClient, taskDate, user?.id]);

  const tasks = query.data ?? [];
  const completedCount = tasks.filter((task) => task.completed).length;
  const totalCount = tasks.length;

  return {
    tasks,
    isLoading: query.isLoading,
    error: query.error,
    taskDate,
    completedCount,
    totalCount,
  };
};
