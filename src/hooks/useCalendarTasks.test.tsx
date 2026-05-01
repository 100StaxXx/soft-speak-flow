import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const getAllLocalTasksForUserMock = vi.fn();
  const replaceLocalTasksForDateMock = vi.fn();
  const canSyncPlannerFromRemoteMock = vi.fn();
  const getPlannerRemoteSyncEpochMock = vi.fn();
  const withPlannerRemoteSnapshotApplyMock = vi.fn();
  const supabaseFromMock = vi.fn();
  const supabaseSelectMock = vi.fn();
  const supabaseEqMock = vi.fn();
  const supabaseGteMock = vi.fn();
  const supabaseLteMock = vi.fn();
  const supabaseOrderFirstMock = vi.fn();
  const supabaseOrderSecondMock = vi.fn();

  return {
    getAllLocalTasksForUserMock,
    replaceLocalTasksForDateMock,
    canSyncPlannerFromRemoteMock,
    getPlannerRemoteSyncEpochMock,
    withPlannerRemoteSnapshotApplyMock,
    supabaseFromMock,
    supabaseSelectMock,
    supabaseEqMock,
    supabaseGteMock,
    supabaseLteMock,
    supabaseOrderFirstMock,
    supabaseOrderSecondMock,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/utils/plannerLocalStore", () => ({
  getAllLocalTasksForUser: (...args: unknown[]) => mocks.getAllLocalTasksForUserMock(...args),
  replaceLocalTasksForDate: (...args: unknown[]) => mocks.replaceLocalTasksForDateMock(...args),
}));

vi.mock("@/utils/plannerSync", () => ({
  PLANNER_SYNC_EVENT: "planner-sync-finished",
  canSyncPlannerFromRemote: (...args: unknown[]) => mocks.canSyncPlannerFromRemoteMock(...args),
  getPlannerRemoteSyncEpoch: (...args: unknown[]) => mocks.getPlannerRemoteSyncEpochMock(...args),
  withPlannerRemoteSnapshotApply: (...args: unknown[]) => mocks.withPlannerRemoteSnapshotApplyMock(...args),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mocks.supabaseFromMock(...args),
  },
}));

import { useCalendarTasks } from "./useCalendarTasks";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useCalendarTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canSyncPlannerFromRemoteMock.mockResolvedValue(false);
    mocks.getPlannerRemoteSyncEpochMock.mockReturnValue(0);
    mocks.withPlannerRemoteSnapshotApplyMock.mockImplementation(
      async (_userId: string, _epoch: number, operation: () => Promise<unknown>) =>
        operation(),
    );
    mocks.replaceLocalTasksForDateMock.mockResolvedValue(undefined);
    mocks.supabaseFromMock.mockReturnValue({ select: mocks.supabaseSelectMock });
    mocks.supabaseSelectMock.mockReturnValue({ eq: mocks.supabaseEqMock });
    mocks.supabaseEqMock.mockReturnValue({ gte: mocks.supabaseGteMock });
    mocks.supabaseGteMock.mockReturnValue({ lte: mocks.supabaseLteMock });
    mocks.supabaseLteMock.mockReturnValue({ order: mocks.supabaseOrderFirstMock });
    mocks.supabaseOrderFirstMock.mockReturnValue({ order: mocks.supabaseOrderSecondMock });
    mocks.supabaseOrderSecondMock.mockResolvedValue({ data: [], error: null });
  });

  it("loads calendar tasks from local storage and filters them to the selected range", async () => {
    mocks.getAllLocalTasksForUserMock.mockResolvedValue([
      {
        id: "task-outside",
        user_id: "user-1",
        task_text: "Outside",
        task_date: "2026-02-01",
        scheduled_time: "08:00",
        created_at: "2026-02-01T00:00:00.000Z",
      },
      {
        id: "task-later",
        user_id: "user-1",
        task_text: "Later",
        task_date: "2026-02-11",
        scheduled_time: "11:00",
        created_at: "2026-02-11T00:00:00.000Z",
      },
      {
        id: "task-earlier",
        user_id: "user-1",
        task_text: "Earlier",
        task_date: "2026-02-10",
        scheduled_time: "09:00",
        created_at: "2026-02-10T00:00:00.000Z",
      },
      {
        id: "task-same-day-late",
        user_id: "user-1",
        task_text: "Same day later",
        task_date: "2026-02-10",
        scheduled_time: "12:00",
        created_at: "2026-02-10T00:00:00.000Z",
      },
    ]);

    const { result } = renderHook(
      () => useCalendarTasks(new Date("2026-02-10T12:00:00.000Z"), "week"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(3);
    });

    expect(result.current.tasks.map((task) => task.id)).toEqual([
      "task-earlier",
      "task-same-day-late",
      "task-later",
    ]);
  });

  it("hydrates campaign titles from the remote epic relation during calendar refresh", async () => {
    mocks.canSyncPlannerFromRemoteMock.mockResolvedValue(true);
    mocks.getAllLocalTasksForUserMock
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        {
          id: "ritual-portfolio",
          user_id: "user-1",
          task_text: "Portfolio work",
          task_date: "2026-02-10",
          scheduled_time: "19:00",
          created_at: "2026-02-10T00:00:00.000Z",
          habit_source_id: "habit-portfolio",
          epic_id: "epic-portfolio",
          epic_title: "Build Portfolio Website",
        },
      ]);
    mocks.supabaseOrderSecondMock.mockResolvedValue({
      data: [
        {
          id: "ritual-portfolio",
          user_id: "user-1",
          task_text: "Portfolio work",
          task_date: "2026-02-10",
          scheduled_time: "19:00",
          created_at: "2026-02-10T00:00:00.000Z",
          habit_source_id: "habit-portfolio",
          epic_id: "epic-portfolio",
          epic_title: null,
          epics: { title: "Build Portfolio Website" },
        },
      ],
      error: null,
    });

    const { result } = renderHook(
      () => useCalendarTasks(new Date("2026-02-10T12:00:00.000Z"), "week"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(mocks.supabaseSelectMock).toHaveBeenCalledWith("*, epics(title)");
      expect(
        mocks.replaceLocalTasksForDateMock.mock.calls.some(
          (call) => call[0] === "user-1" && call[1] === "2026-02-10",
        ),
      ).toBe(true);
    });

    const replacementCall = mocks.replaceLocalTasksForDateMock.mock.calls.find(
      (call) => call[0] === "user-1" && call[1] === "2026-02-10",
    );
    expect(replacementCall?.[2]).toEqual([
      expect.objectContaining({
        id: "ritual-portfolio",
        epic_title: "Build Portfolio Website",
      }),
    ]);
    expect(replacementCall?.[2][0]).not.toHaveProperty("epics");

    await waitFor(() => {
      expect(result.current.tasks).toEqual([
        expect.objectContaining({
          id: "ritual-portfolio",
          epic_title: "Build Portfolio Website",
        }),
      ]);
    });
  });

  it("does not apply remote calendar rows when a local planner mutation happened during the fetch", async () => {
    mocks.canSyncPlannerFromRemoteMock.mockResolvedValue(true);
    mocks.withPlannerRemoteSnapshotApplyMock.mockResolvedValue(null);
    mocks.getAllLocalTasksForUserMock.mockResolvedValue([]);
    mocks.supabaseOrderSecondMock.mockResolvedValue({
      data: [
        {
          id: "stale-habit-task",
          user_id: "user-1",
          task_text: "Daily Hydration",
          task_date: "2026-02-10",
          completed: null,
          completed_at: null,
          habit_source_id: "habit-deleted",
          epic_id: null,
        },
      ],
      error: null,
    });

    renderHook(
      () => useCalendarTasks(new Date("2026-02-10T12:00:00.000Z"), "week"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(mocks.supabaseOrderSecondMock).toHaveBeenCalled();
      expect(mocks.withPlannerRemoteSnapshotApplyMock).toHaveBeenCalledWith(
        "user-1",
        0,
        expect.any(Function),
      );
    });

    expect(mocks.replaceLocalTasksForDateMock).not.toHaveBeenCalled();
  });
});
