import type { QueryClient, QueryKey } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";
import { normalizeUuidLikeId } from "@/utils/offlineId";

export const taskQueryFamilies = {
  daily: queryKeys.dailyTasks.all,
  calendar: queryKeys.dailyTasks.calendarAll,
  inboxTasks: queryKeys.inbox.tasksAll,
  inboxCount: queryKeys.inbox.countAll,
} as const;

export const taskQueryFamilyGroups = {
  planner: ["daily", "calendar"] as const,
  plannerAndInboxTasks: ["daily", "calendar", "inboxTasks"] as const,
  plannerAndInbox: ["daily", "calendar", "inboxTasks", "inboxCount"] as const,
  inbox: ["inboxTasks", "inboxCount"] as const,
} as const;

export type TaskQueryFamily = keyof typeof taskQueryFamilies;
export type TaskQueryFamilyList = readonly TaskQueryFamily[];
export type TaskQuerySnapshots = Partial<Record<TaskQueryFamily, Array<[QueryKey, unknown]>>>;

const getQueryFilter = (family: TaskQueryFamily) => ({
  queryKey: taskQueryFamilies[family],
});

export const cancelTaskQueryFamilies = async (
  queryClient: QueryClient,
  families: TaskQueryFamilyList,
) => {
  await Promise.all(
    families.map((family) => queryClient.cancelQueries(getQueryFilter(family))),
  );
};

export const invalidateTaskQueryFamilies = async (
  queryClient: QueryClient,
  families: TaskQueryFamilyList,
) => {
  await Promise.all(
    families.map((family) => queryClient.invalidateQueries(getQueryFilter(family))),
  );
};

export const snapshotTaskQueryFamilies = (
  queryClient: QueryClient,
  families: TaskQueryFamilyList,
): TaskQuerySnapshots =>
  Object.fromEntries(
    families.map((family) => [
      family,
      queryClient.getQueriesData({ queryKey: taskQueryFamilies[family] }),
    ]),
  ) as TaskQuerySnapshots;

export const restoreTaskQueryFamilies = (
  queryClient: QueryClient,
  snapshots: TaskQuerySnapshots | undefined,
) => {
  if (!snapshots) return;

  Object.values(snapshots).forEach((snapshotGroup) => {
    snapshotGroup?.forEach(([queryKey, data]) => {
      queryClient.setQueryData(queryKey, data);
    });
  });
};

export const setTaskQueryFamiliesData = (
  queryClient: QueryClient,
  families: TaskQueryFamilyList,
  updater: (old: unknown) => unknown,
) => {
  families.forEach((family) => {
    queryClient.setQueriesData(getQueryFilter(family), updater);
  });
};

export const getTaskSubtasksQueryKey = (taskId: string | null | undefined) =>
  queryKeys.plannerRuntime.subtasks(taskId ? normalizeUuidLikeId(taskId) : undefined);

export const invalidatePlannerRuntimeTasksQuery = async (
  queryClient: QueryClient,
) => queryClient.invalidateQueries({ queryKey: queryKeys.plannerRuntime.tasksAll });

export const invalidateTaskSubtasksQuery = async (
  queryClient: QueryClient,
  taskId: string | null | undefined,
) => queryClient.invalidateQueries({ queryKey: getTaskSubtasksQueryKey(taskId) });
