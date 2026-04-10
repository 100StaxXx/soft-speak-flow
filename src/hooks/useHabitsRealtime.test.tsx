import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const invalidateQueriesMock = vi.fn().mockResolvedValue(undefined);
  const warmEpicsQueryFromRemoteMock = vi.fn().mockResolvedValue(undefined);
  const syncLocalHabitsFromRemoteMock = vi.fn().mockResolvedValue(undefined);
  const dispatchPlannerSyncFinishedMock = vi.fn();
  const removeChannelMock = vi.fn();
  const subscribeMock = vi.fn();
  const onMock = vi.fn();
  const channelMock = vi.fn();
  const state = {
    user: { id: "user-123" } as { id: string } | null,
    habitsCallback: null as null | (() => void | Promise<void>),
    completionsCallback: null as null | (() => void | Promise<void>),
  };

  return {
    invalidateQueriesMock,
    warmEpicsQueryFromRemoteMock,
    syncLocalHabitsFromRemoteMock,
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

vi.mock("@/utils/timezone", () => ({
  getEffectiveMissionDate: () => "2026-04-09",
}));

vi.mock("@/utils/plannerSync", () => ({
  dispatchPlannerSyncFinished: mocks.dispatchPlannerSyncFinishedMock,
  syncLocalHabitsFromRemote: (...args: unknown[]) => mocks.syncLocalHabitsFromRemoteMock(...args),
  warmEpicsQueryFromRemote: (...args: unknown[]) => mocks.warmEpicsQueryFromRemoteMock(...args),
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

import { useHabitsRealtime } from "./useHabitsRealtime";

describe("useHabitsRealtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.user = { id: "user-123" };
    mocks.state.habitsCallback = null;
    mocks.state.completionsCallback = null;

    mocks.onMock.mockImplementation((_event, config: { table?: string }, callback: () => void | Promise<void>) => {
      if (config.table === "habits") {
        mocks.state.habitsCallback = callback;
      }
      if (config.table === "habit_completions") {
        mocks.state.completionsCallback = callback;
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

  it("warms local epic snapshots when habits change", async () => {
    renderHook(() => useHabitsRealtime());

    expect(mocks.channelMock).toHaveBeenCalledWith("habits-sync-user-123");
    expect(mocks.state.habitsCallback).toBeTypeOf("function");

    await act(async () => {
      await mocks.state.habitsCallback?.();
    });

    expect(mocks.syncLocalHabitsFromRemoteMock).toHaveBeenCalledWith("user-123", "2026-04-09");
    expect(mocks.warmEpicsQueryFromRemoteMock).toHaveBeenCalledWith(expect.any(Object), "user-123");
    expect(mocks.dispatchPlannerSyncFinishedMock).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["epics"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["habit-surfacing"] });
  });
});
