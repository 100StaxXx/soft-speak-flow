import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryKeys";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { DailyTask } from "@/services/dailyTasksRemote";
import {
  PLANNER_SYNC_EVENT,
  canSyncPlannerFromRemote,
} from "@/utils/plannerSync";
import {
  getAllLocalTasksForUser,
  replaceLocalTasksForDate,
} from "@/utils/plannerLocalStore";

interface LegacyCalendarTaskRangeOptions {
  enabled?: boolean;
}

export const useLegacyCalendarTaskRange = (
  selectedDate: Date,
  view: "list" | "month" | "week",
  options: LegacyCalendarTaskRangeOptions = {},
) => {
  const { user } = useAuth();
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  const getDateRange = () => {
    if (view === "month") {
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
      return { start: calendarStart, end: calendarEnd };
    }

    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
    const weekEnd = addDays(weekStart, 6);
    return { start: weekStart, end: weekEnd };
  };

  const { start, end } = getDateRange();
  const startDate = format(start, "yyyy-MM-dd");
  const endDate = format(end, "yyyy-MM-dd");
  const calendarQueryKey = queryKeys.dailyTasks.calendar(user?.id, startDate, endDate, view);

  const query = useQuery({
    queryKey: calendarQueryKey,
    queryFn: async () => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      const tasks = await getAllLocalTasksForUser<DailyTask>(user.id);
      return tasks
        .filter((task) => task.task_date && task.task_date >= startDate && task.task_date <= endDate)
        .slice()
        .sort((a, b) => {
          const dateCompare = (a.task_date ?? "").localeCompare(b.task_date ?? "");
          if (dateCompare !== 0) return dateCompare;

          const timeA = a.scheduled_time ?? "99:99";
          const timeB = b.scheduled_time ?? "99:99";
          if (timeA !== timeB) return timeA.localeCompare(timeB);

          return (b.created_at ?? "").localeCompare(a.created_at ?? "");
        });
    },
    enabled: enabled && !!user,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!enabled || !user?.id) return;

    let disposed = false;

    const refreshFromRemote = async () => {
      try {
        if (!(await canSyncPlannerFromRemote(user.id))) {
          return;
        }

        const { data, error } = await supabase
          .from("daily_tasks")
          .select("*")
          .eq("user_id", user.id)
          .gte("task_date", startDate)
          .lte("task_date", endDate)
          .order("scheduled_time", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (!(await canSyncPlannerFromRemote(user.id))) {
          return;
        }

        const tasksByDate = new Map<string, DailyTask[]>();
        (data ?? []).forEach((task) => {
          if (!task.task_date) return;
          if (!tasksByDate.has(task.task_date)) {
            tasksByDate.set(task.task_date, []);
          }
          tasksByDate.get(task.task_date)?.push(task as DailyTask);
        });

        const datesInRange = eachDayOfInterval({ start, end }).map((date) => format(date, "yyyy-MM-dd"));
        for (const date of datesInRange) {
          if (!(await canSyncPlannerFromRemote(user.id))) {
            return;
          }
          await replaceLocalTasksForDate(user.id, date, tasksByDate.get(date) ?? []);
        }

        if (disposed) return;

        queryClient.setQueryData(
          calendarQueryKey,
          await getAllLocalTasksForUser<DailyTask>(user.id).then((tasks) =>
            tasks
              .filter((task) => task.task_date && task.task_date >= startDate && task.task_date <= endDate)
              .slice()
              .sort((a, b) => {
                const dateCompare = (a.task_date ?? "").localeCompare(b.task_date ?? "");
                if (dateCompare !== 0) return dateCompare;

                const timeA = a.scheduled_time ?? "99:99";
                const timeB = b.scheduled_time ?? "99:99";
                if (timeA !== timeB) return timeA.localeCompare(timeB);

                return (b.created_at ?? "").localeCompare(a.created_at ?? "");
              }),
          ),
        );
      } catch (error) {
        console.warn("Failed to refresh local calendar tasks from remote:", error);
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
  }, [calendarQueryKey, enabled, end, endDate, queryClient, start, startDate, user?.id, view]);

  return { tasks: query.data ?? [], isLoading: query.isLoading };
};
