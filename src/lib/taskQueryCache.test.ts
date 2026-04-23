import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/queryKeys";
import {
  cancelTaskQueryFamilies,
  getTaskSubtasksQueryKey,
  invalidatePlannerRuntimeTasksQuery,
  invalidateTaskSubtasksQuery,
  invalidateTaskQueryFamilies,
  restoreTaskQueryFamilies,
  setTaskQueryFamiliesData,
  snapshotTaskQueryFamilies,
  taskQueryFamilyGroups,
} from "@/lib/taskQueryCache";

describe("taskQueryCache", () => {
  it("snapshots and restores planner task query families", () => {
    const queryClient = new QueryClient();
    const dailyKey = queryKeys.dailyTasks.byDate("user-1", "2026-04-22");
    const calendarKey = queryKeys.dailyTasks.calendar("user-1", "2026-04-20", "2026-04-26", "week");

    queryClient.setQueryData(dailyKey, [{ id: "daily-1" }]);
    queryClient.setQueryData(calendarKey, [{ id: "calendar-1" }]);

    const snapshot = snapshotTaskQueryFamilies(queryClient, taskQueryFamilyGroups.planner);

    queryClient.setQueryData(dailyKey, [{ id: "daily-2" }]);
    queryClient.setQueryData(calendarKey, [{ id: "calendar-2" }]);

    restoreTaskQueryFamilies(queryClient, snapshot);

    expect(queryClient.getQueryData(dailyKey)).toEqual([{ id: "daily-1" }]);
    expect(queryClient.getQueryData(calendarKey)).toEqual([{ id: "calendar-1" }]);
  });

  it("updates and invalidates grouped task query families through the shared helpers", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);
    const cancelSpy = vi
      .spyOn(queryClient, "cancelQueries")
      .mockResolvedValue(undefined);

    queryClient.setQueryData(queryKeys.dailyTasks.byDate("user-1", "2026-04-22"), [{ id: "daily-1" }]);
    queryClient.setQueryData(
      queryKeys.dailyTasks.calendar("user-1", "2026-04-20", "2026-04-26", "week"),
      [{ id: "calendar-1" }],
    );

    setTaskQueryFamiliesData(queryClient, taskQueryFamilyGroups.planner, (old) => {
      if (!Array.isArray(old)) return old;
      return old.map((item) => ({ ...item, touched: true }));
    });

    expect(queryClient.getQueryData(queryKeys.dailyTasks.byDate("user-1", "2026-04-22"))).toEqual([
      { id: "daily-1", touched: true },
    ]);
    expect(
      queryClient.getQueryData(
        queryKeys.dailyTasks.calendar("user-1", "2026-04-20", "2026-04-26", "week"),
      ),
    ).toEqual([{ id: "calendar-1", touched: true }]);

    await cancelTaskQueryFamilies(queryClient, taskQueryFamilyGroups.planner);
    await invalidateTaskQueryFamilies(queryClient, taskQueryFamilyGroups.plannerAndInbox);

    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: queryKeys.dailyTasks.all });
    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: queryKeys.dailyTasks.calendarAll });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.dailyTasks.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.dailyTasks.calendarAll });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.inbox.tasksAll });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.inbox.countAll });
  });

  it("invalidates planner runtime task and subtask roots through the shared helpers", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);

    await invalidatePlannerRuntimeTasksQuery(queryClient);
    await invalidateTaskSubtasksQuery(
      queryClient,
      "task-e47e5651-7522-4888-a04d-6eff518fa4ba",
    );

    expect(getTaskSubtasksQueryKey("task-e47e5651-7522-4888-a04d-6eff518fa4ba")).toEqual(
      queryKeys.plannerRuntime.subtasks("e47e5651-7522-4888-a04d-6eff518fa4ba"),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.plannerRuntime.tasksAll });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.plannerRuntime.subtasks("e47e5651-7522-4888-a04d-6eff518fa4ba"),
    });
  });
});
