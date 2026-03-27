import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const invalidateQueriesMock = vi.fn().mockResolvedValue(undefined);
  const dispatchPlannerSyncFinishedMock = vi.fn();
  const removeChannelMock = vi.fn();
  const subscribeMock = vi.fn();
  const onMock = vi.fn();
  const channelMock = vi.fn();
  const state = {
    user: { id: "user-123" } as { id: string } | null,
    dailyTasksCallback: null as null | (() => void),
    subtasksCallback: null as null | (() => void),
  };

  return {
    invalidateQueriesMock,
    dispatchPlannerSyncFinishedMock,
    removeChannelMock,
    subscribeMock,
    onMock,
    channelMock,
    state,
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueriesMock,
  }),
}));

vi.mock("./useAuth", () => ({
  useAuth: () => ({
    user: mocks.state.user,
  }),
}));

vi.mock("@/utils/plannerSync", () => ({
  dispatchPlannerSyncFinished: mocks.dispatchPlannerSyncFinishedMock,
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: mocks.channelMock,
    removeChannel: mocks.removeChannelMock,
  },
}));

import { useDailyTasksRealtime } from "./useDailyTasksRealtime";

describe("useDailyTasksRealtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.user = { id: "user-123" };
    mocks.state.dailyTasksCallback = null;
    mocks.state.subtasksCallback = null;

    mocks.onMock.mockImplementation((_event, config: { table?: string }, callback: () => void) => {
      if (config.table === "daily_tasks") {
        mocks.state.dailyTasksCallback = callback;
      }
      if (config.table === "subtasks") {
        mocks.state.subtasksCallback = callback;
      }

      return {
        on: mocks.onMock,
        subscribe: mocks.subscribeMock,
      };
    });

    mocks.subscribeMock.mockReturnValue({
      unsubscribe: vi.fn(),
    });

    mocks.channelMock.mockReturnValue({
      on: mocks.onMock,
    });
  });

  it("dispatches planner refresh and invalidates task queries for daily task events", async () => {
    renderHook(() => useDailyTasksRealtime());

    expect(mocks.channelMock).toHaveBeenCalledWith("daily-tasks-sync-user-123");
    expect(mocks.state.dailyTasksCallback).toBeTypeOf("function");

    await act(async () => {
      mocks.state.dailyTasksCallback?.();
    });

    expect(mocks.dispatchPlannerSyncFinishedMock).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["daily-tasks"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["tasks"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["calendar-tasks"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["habit-surfacing"] });
  });

  it("dispatches planner refresh for subtask events", async () => {
    renderHook(() => useDailyTasksRealtime());

    expect(mocks.state.subtasksCallback).toBeTypeOf("function");

    await act(async () => {
      mocks.state.subtasksCallback?.();
    });

    expect(mocks.dispatchPlannerSyncFinishedMock).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["daily-tasks"] });
  });
});
