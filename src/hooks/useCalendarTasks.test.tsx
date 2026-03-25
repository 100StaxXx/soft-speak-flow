import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const getAllLocalTasksForUserMock = vi.fn();
  const replaceLocalTasksForDateMock = vi.fn();
  const canSyncPlannerFromRemoteMock = vi.fn();

  return {
    getAllLocalTasksForUserMock,
    replaceLocalTasksForDateMock,
    canSyncPlannerFromRemoteMock,
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
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                order: vi.fn(),
              })),
            })),
          })),
        })),
      })),
    })),
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
    mocks.replaceLocalTasksForDateMock.mockResolvedValue(undefined);
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
});
