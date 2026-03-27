import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const getPendingActionCountMock = vi.fn();
  const fetchDailyTasksRemoteMock = vi.fn();
  const replaceLocalTasksForDateMock = vi.fn();

  return {
    getPendingActionCountMock,
    fetchDailyTasksRemoteMock,
    replaceLocalTasksForDateMock,
  };
});

vi.mock("@/utils/offlineStorage", () => ({
  getPendingActionCount: (...args: unknown[]) => mocks.getPendingActionCountMock(...args),
}));

vi.mock("@/services/dailyTasksRemote", () => ({
  fetchDailyTasksRemote: (...args: unknown[]) => mocks.fetchDailyTasksRemoteMock(...args),
}));

vi.mock("@/utils/plannerLocalStore", async () => {
  const actual = await vi.importActual<typeof import("@/utils/plannerLocalStore")>("@/utils/plannerLocalStore");

  return {
    ...actual,
    replaceLocalTasksForDate: (...args: unknown[]) => mocks.replaceLocalTasksForDateMock(...args),
  };
});

import {
  acquirePlannerRemoteSyncLock,
  canSyncPlannerFromRemote,
  syncLocalDailyTasksFromRemote,
} from "./plannerSync";

const originalOnlineDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");

const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
};

describe("plannerSync", () => {
  afterEach(() => {
    if (originalOnlineDescriptor) {
      Object.defineProperty(window.navigator, "onLine", originalOnlineDescriptor);
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setOnline(true);
    mocks.getPendingActionCountMock.mockResolvedValue(0);
    mocks.replaceLocalTasksForDateMock.mockResolvedValue(undefined);
  });

  it("blocks remote sync while a local planner write is in flight", async () => {
    const release = acquirePlannerRemoteSyncLock("user-1");

    await expect(canSyncPlannerFromRemote("user-1")).resolves.toBe(false);

    release();

    await expect(canSyncPlannerFromRemote("user-1")).resolves.toBe(true);
  });

  it("skips replacing local tasks if a write lock appears before remote data is applied", async () => {
    let release: (() => void) | null = null;

    mocks.fetchDailyTasksRemoteMock.mockImplementation(async () => {
      release = acquirePlannerRemoteSyncLock("user-1");

      return [
        {
          id: "task-1",
          user_id: "user-1",
          task_date: "2026-03-25",
        },
      ];
    });

    const result = await syncLocalDailyTasksFromRemote("user-1", "2026-03-25");
    release?.();

    expect(result).toBeNull();
    expect(mocks.replaceLocalTasksForDateMock).not.toHaveBeenCalled();
  });

  it("replaces local tasks when sync is clear to proceed", async () => {
    const remoteTasks = [
      {
        id: "task-1",
        user_id: "user-1",
        task_text: "Morning review",
        task_date: "2026-03-25",
        subtasks: [],
      },
    ];

    mocks.fetchDailyTasksRemoteMock.mockResolvedValue(remoteTasks);

    const result = await syncLocalDailyTasksFromRemote("user-1", "2026-03-25");

    expect(result).toEqual(remoteTasks);
    expect(mocks.replaceLocalTasksForDateMock).toHaveBeenCalledWith("user-1", "2026-03-25", remoteTasks);
  });
});
