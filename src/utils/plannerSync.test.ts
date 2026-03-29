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

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(),
      eq: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
    })),
  },
}));

vi.mock("@/utils/plannerLocalStore", async () => {
  const actual = await vi.importActual<typeof import("@/utils/plannerLocalStore")>("@/utils/plannerLocalStore");

  return {
    ...actual,
    replaceLocalTasksForDate: (...args: unknown[]) => mocks.replaceLocalTasksForDateMock(...args),
  };
});

import {
  loadLocalEpics,
  acquirePlannerRemoteSyncLock,
  canSyncPlannerFromRemote,
  syncLocalDailyTasksFromRemote,
} from "./plannerSync";
import {
  __resetPlannerLocalDBForTests,
  clearPlannerLocalStateForUser,
  upsertPlannerRecord,
} from "@/utils/plannerLocalStore";

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
    __resetPlannerLocalDBForTests();
    setOnline(true);
    mocks.getPendingActionCountMock.mockResolvedValue(0);
    mocks.replaceLocalTasksForDateMock.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await clearPlannerLocalStateForUser("user-1");
    __resetPlannerLocalDBForTests();
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

  it("hydrates locally persisted latest journey-path snapshots onto epics", async () => {
    await upsertPlannerRecord("epics", {
      id: "epic-1",
      user_id: "user-1",
      title: "Hydrated Trail",
      description: null,
      status: "active",
      progress_percentage: 18,
      target_days: 30,
      start_date: "2026-03-01",
      end_date: "2026-03-31",
      created_at: "2026-03-01T00:00:00.000Z",
      epic_habits: [],
    });

    await upsertPlannerRecord("epic_journey_paths", {
      id: "user-1:epic-1",
      user_id: "user-1",
      epic_id: "epic-1",
      milestone_index: 2,
      image_url: "https://example.com/persisted-path.png",
      generated_at: "2026-03-27T23:59:59.000Z",
    });

    const epics = await loadLocalEpics("user-1");

    expect(epics).toHaveLength(1);
    expect(epics[0]?.latest_journey_path_url).toBe("https://example.com/persisted-path.png");
    expect(epics[0]?.latest_journey_path_milestone_index).toBe(2);
  });
});
