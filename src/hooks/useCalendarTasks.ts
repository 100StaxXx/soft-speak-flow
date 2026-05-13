import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
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
  getPlannerRemoteSyncEpoch,
  withPlannerRemoteSnapshotApply,
} from "@/utils/plannerSync";
import {
  getAllLocalTasksForUser,
  replaceLocalTasksForDate,
} from "@/utils/plannerLocalStore";

interface CalendarTasksOptions {
  enabled?: boolean;
}

type RemoteCalendarTask = DailyTask & {
  epics?: { title: string | null } | null;
};

const REMOTE_REFRESH_RETRY_DELAY_MS = 30_000;
const REMOTE_REFRESH_WARN_COOLDOWN_MS = 60_000;

let lastRemoteRefreshWarnAt = 0;

const toLocalDateFromKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const normalizeRemoteCalendarTask = (task: RemoteCalendarTask): DailyTask => {
  const { epics, ...dailyTask } = task;
  return {
    ...dailyTask,
    epic_title: dailyTask.epic_title ?? epics?.title ?? null,
  };
};

const sortCalendarTasks = (tasks: DailyTask[]) =>
  tasks
    .slice()
    .sort((a, b) => {
      const dateCompare = (a.task_date ?? "").localeCompare(b.task_date ?? "");
      if (dateCompare !== 0) return dateCompare;

      const timeA = a.scheduled_time ?? "99:99";
      const timeB = b.scheduled_time ?? "99:99";
      if (timeA !== timeB) return timeA.localeCompare(timeB);

      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });

const filterTasksToRange = (tasks: DailyTask[], startDate: string, endDate: string) =>
  sortCalendarTasks(
    tasks.filter((task) => task.task_date && task.task_date >= startDate && task.task_date <= endDate),
  );

const warnRemoteRefreshFailure = (error: unknown) => {
  const now = Date.now();
  if (now - lastRemoteRefreshWarnAt < REMOTE_REFRESH_WARN_COOLDOWN_MS) {
    return;
  }

  lastRemoteRefreshWarnAt = now;
  console.warn("Failed to refresh local calendar tasks from remote:", error);
};

export const useCalendarTasks = (
  selectedDate: Date,
  view: "list" | "month" | "week",
  options: CalendarTasksOptions = {},
) => {
  const { user } = useAuth();
  const { enabled = true } = options;
  const queryClient = useQueryClient();
  const refreshControlRef = useRef({
    inFlight: false,
    retryAfter: 0,
  });

  const selectedDateKey = format(selectedDate, "yyyy-MM-dd");
  const { startDate, endDate, datesInRange } = useMemo(() => {
    const date = toLocalDateFromKey(selectedDateKey);
    let rangeStart: Date;
    let rangeEnd: Date;

    if (view === "month") {
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      rangeStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      rangeEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    } else if (view === "week") {
      rangeStart = startOfWeek(date, { weekStartsOn: 0 });
      rangeEnd = addDays(rangeStart, 6);
    } else {
      // For list view, just get the week
      rangeStart = startOfWeek(date, { weekStartsOn: 0 });
      rangeEnd = addDays(rangeStart, 6);
    }

    return {
      startDate: format(rangeStart, "yyyy-MM-dd"),
      endDate: format(rangeEnd, "yyyy-MM-dd"),
      datesInRange: eachDayOfInterval({ start: rangeStart, end: rangeEnd }).map((dateInRange) =>
        format(dateInRange, "yyyy-MM-dd"),
      ),
    };
  }, [selectedDateKey, view]);

  const query = useQuery({
    queryKey: ['calendar-tasks', user?.id, startDate, endDate, view],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const tasks = await getAllLocalTasksForUser<DailyTask>(user.id);
      return filterTasksToRange(tasks, startDate, endDate);
    },
    enabled: enabled && !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes - calendar data changes infrequently
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!enabled || !user?.id) return;

    let disposed = false;

    const refreshFromRemote = async () => {
      const refreshControl = refreshControlRef.current;
      const now = Date.now();
      if (refreshControl.inFlight || refreshControl.retryAfter > now) {
        return;
      }

      refreshControl.inFlight = true;

      try {
        const syncEpoch = getPlannerRemoteSyncEpoch(user.id);
        if (!(await canSyncPlannerFromRemote(user.id))) {
          return;
        }

        const { data, error } = await supabase
          .from("daily_tasks")
          .select("*, epics(title)")
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
          const normalizedTask = normalizeRemoteCalendarTask(task as RemoteCalendarTask);
          if (!normalizedTask.task_date) return;
          if (!tasksByDate.has(normalizedTask.task_date)) {
            tasksByDate.set(normalizedTask.task_date, []);
          }
          tasksByDate.get(normalizedTask.task_date)?.push(normalizedTask);
        });

        await withPlannerRemoteSnapshotApply(user.id, syncEpoch, async () => {
          for (const date of datesInRange) {
            if (disposed) {
              return;
            }
            await replaceLocalTasksForDate(user.id, date, tasksByDate.get(date) ?? []);
          }

          if (disposed) {
            return;
          }

          queryClient.setQueryData(
            ['calendar-tasks', user.id, startDate, endDate, view],
            await getAllLocalTasksForUser<DailyTask>(user.id).then((tasks) =>
              filterTasksToRange(tasks, startDate, endDate),
            ),
          );
        });

        refreshControl.retryAfter = 0;
      } catch (error) {
        refreshControl.retryAfter = Date.now() + REMOTE_REFRESH_RETRY_DELAY_MS;
        warnRemoteRefreshFailure(error);
      } finally {
        refreshControl.inFlight = false;
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
  }, [datesInRange, enabled, endDate, queryClient, startDate, user?.id, view]);

  return { tasks: query.data ?? [], isLoading: query.isLoading };
};
