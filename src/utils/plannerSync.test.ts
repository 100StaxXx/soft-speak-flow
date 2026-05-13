import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const getPendingActionCountMock = vi.fn();
  const isOfflineDBTemporarilyUnavailableMock = vi.fn();
  const fetchDailyTasksRemoteMock = vi.fn();
  const fetchEpicsMock = vi.fn();
  const replaceLocalTasksForDateMock = vi.fn();
  const supabaseTables: Record<string, Array<Record<string, unknown>>> = {};
  const supabaseErrors: Record<string, Error | null> = {};

  return {
    getPendingActionCountMock,
    isOfflineDBTemporarilyUnavailableMock,
    fetchDailyTasksRemoteMock,
    fetchEpicsMock,
    replaceLocalTasksForDateMock,
    supabaseTables,
    supabaseErrors,
  };
});

vi.mock("@/utils/offlineStorage", () => ({
  getPendingActionCount: (...args: unknown[]) => mocks.getPendingActionCountMock(...args),
  isOfflineDBTemporarilyUnavailable: (...args: unknown[]) => mocks.isOfflineDBTemporarilyUnavailableMock(...args),
}));

vi.mock("@/services/dailyTasksRemote", () => ({
  fetchDailyTasksRemote: (...args: unknown[]) => mocks.fetchDailyTasksRemoteMock(...args),
}));

vi.mock("@/hooks/epicsQuery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/epicsQuery")>();

  return {
    ...actual,
    fetchEpics: (...args: unknown[]) => mocks.fetchEpicsMock(...args),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((tableName: string) => {
      const filters: Record<string, unknown> = {};
      const inFilters: Record<string, unknown[]> = {};
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn((column: string, value: unknown) => {
          filters[column] = value;
          return builder;
        }),
        in: vi.fn((column: string, values: unknown[]) => {
          inFilters[column] = values;
          return builder;
        }),
        order: vi.fn(() => builder),
        then: (
          resolve: (value: { data: Array<Record<string, unknown>> | null; error: Error | null }) => unknown,
          reject: (reason?: unknown) => unknown,
        ) => {
          const error = mocks.supabaseErrors[tableName] ?? null;
          const rows = error
            ? null
            : (mocks.supabaseTables[tableName] ?? []).filter((row) =>
              Object.entries(filters).every(([key, value]) => row[key] === value) &&
              Object.entries(inFilters).every(([key, values]) => values.includes(row[key]))
            );
          return Promise.resolve({ data: rows, error }).then(resolve, reject);
        },
      };
      return builder;
    }),
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
  getPlannerRemoteSyncEpoch,
  syncLocalDailyTasksFromRemote,
  syncLocalEpicsFromRemote,
  syncLocalHabitsFromRemote,
  withPlannerRemoteSnapshotApply,
  withPlannerRemoteSyncLock,
} from "./plannerSync";
import {
  __resetPlannerLocalDBForTests,
  clearPlannerLocalStateForUser,
  getAllLocalTasksForUser,
  upsertPlannerRecord,
} from "@/utils/plannerLocalStore";
import type { DailyTask } from "@/services/dailyTasksRemote";

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
    mocks.isOfflineDBTemporarilyUnavailableMock.mockReturnValue(false);
    mocks.replaceLocalTasksForDateMock.mockResolvedValue(undefined);
    mocks.fetchEpicsMock.mockResolvedValue([]);
    Object.keys(mocks.supabaseTables).forEach((key) => {
      delete mocks.supabaseTables[key];
    });
    Object.keys(mocks.supabaseErrors).forEach((key) => {
      delete mocks.supabaseErrors[key];
    });
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

  it("blocks remote sync while offline queue storage is unavailable", async () => {
    mocks.isOfflineDBTemporarilyUnavailableMock.mockReturnValue(true);

    await expect(canSyncPlannerFromRemote("user-1")).resolves.toBe(false);
    expect(mocks.getPendingActionCountMock).not.toHaveBeenCalled();
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

  it("skips replacing local tasks if a write lock happened during the remote fetch", async () => {
    mocks.fetchDailyTasksRemoteMock.mockImplementation(async () => {
      const release = acquirePlannerRemoteSyncLock("user-1");
      release();

      return [
        {
          id: "stale-task",
          user_id: "user-1",
          task_date: "2026-03-25",
        },
      ];
    });

    const result = await syncLocalDailyTasksFromRemote("user-1", "2026-03-25");

    expect(result).toBeNull();
    expect(mocks.replaceLocalTasksForDateMock).not.toHaveBeenCalled();
  });

  it("serializes remote snapshot applies before later local planner mutations", async () => {
    let mutationRan = false;
    let mutationPromise: Promise<void> | null = null;
    const syncEpoch = getPlannerRemoteSyncEpoch("user-1");

    const snapshotPromise = withPlannerRemoteSnapshotApply(
      "user-1",
      syncEpoch,
      async () => {
        mutationPromise = withPlannerRemoteSyncLock("user-1", async () => {
          mutationRan = true;
        });

        await Promise.resolve();
        expect(mutationRan).toBe(false);
        return "applied";
      },
    );

    await expect(snapshotPromise).resolves.toBe("applied");
    await mutationPromise;

    expect(mutationRan).toBe(true);
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
      prompt_context: {
        image_size: "1536x1024",
        render_version: 2,
      },
    });

    const epics = await loadLocalEpics("user-1");

    expect(epics).toHaveLength(1);
    expect(epics[0]?.latest_journey_path_url).toBe("https://example.com/persisted-path.png");
    expect(epics[0]?.latest_journey_path_milestone_index).toBe(2);
    expect(epics[0]?.latest_journey_path_prompt_context).toEqual({
      image_size: "1536x1024",
      render_version: 2,
    });
  });

  it("normalizes legacy local epics with missing end dates before they reach the UI", async () => {
    await upsertPlannerRecord("epics", {
      id: "epic-legacy",
      user_id: "user-1",
      title: "Legacy Countdown",
      description: null,
      status: "active",
      progress_percentage: 4,
      target_days: 21,
      start_date: "2026-03-01",
      end_date: null,
      created_at: "2026-03-01T00:00:00.000Z",
      epic_habits: [],
    });

    const epics = await loadLocalEpics("user-1");

    expect(epics[0]?.end_date).toBe("2026-03-22");
  });

  it("does not prune standalone habit tasks from the habit snapshot path", async () => {
    mocks.supabaseTables.habits = [];
    mocks.supabaseTables.habit_completions = [];

    await upsertPlannerRecord("habits", {
      id: "habit-deleted",
      user_id: "user-1",
      title: "Daily Hydration",
      is_active: true,
      frequency: "daily",
      custom_days: null,
      custom_month_days: null,
      created_at: "2026-05-01T00:00:00.000Z",
    });
    await upsertPlannerRecord("daily_tasks", {
      id: "task-habit-deleted",
      user_id: "user-1",
      task_text: "Daily Hydration",
      task_date: "2026-05-01",
      completed: false,
      completed_at: null,
      habit_source_id: "habit-deleted",
      epic_id: null,
      epic_title: null,
      subtasks: [],
    });

    await syncLocalHabitsFromRemote("user-1", "2026-05-01");

    const tasks = await getAllLocalTasksForUser<DailyTask>("user-1");
    expect(tasks).toEqual([
      expect.objectContaining({
        id: "task-habit-deleted",
        habit_source_id: "habit-deleted",
        epic_id: null,
        epic_title: null,
      }),
    ]);
  });

  it("does not prune campaign-linked tasks from habit sync when local epics are stale", async () => {
    mocks.supabaseTables.habits = [];
    mocks.supabaseTables.habit_completions = [];

    await upsertPlannerRecord("daily_tasks", {
      id: "task-live-campaign",
      user_id: "user-1",
      task_text: "Live campaign quest",
      task_date: "2026-05-01",
      completed: false,
      completed_at: null,
      habit_source_id: null,
      epic_id: "epic-live",
      epic_title: "Live Campaign",
      subtasks: [],
    });

    await syncLocalHabitsFromRemote("user-1", "2026-05-01");

    const tasks = await getAllLocalTasksForUser<DailyTask>("user-1");
    expect(tasks).toEqual([
      expect.objectContaining({
        id: "task-live-campaign",
        epic_id: "epic-live",
        epic_title: "Live Campaign",
      }),
    ]);
  });

  it("detaches incomplete local tasks linked to epics missing from the remote snapshot", async () => {
    mocks.fetchEpicsMock.mockResolvedValue([]);

    await upsertPlannerRecord("epics", {
      id: "epic-deleted",
      user_id: "user-1",
      title: "Deleted Campaign",
      description: null,
      status: "active",
      progress_percentage: 18,
      target_days: 30,
      start_date: "2026-03-01",
      end_date: "2026-03-31",
      created_at: "2026-03-01T00:00:00.000Z",
      epic_habits: [],
    });
    await upsertPlannerRecord("daily_tasks", {
      id: "task-epic-deleted",
      user_id: "user-1",
      task_text: "Deleted Campaign Quest",
      task_date: "2026-05-01",
      completed: false,
      completed_at: null,
      habit_source_id: null,
      epic_id: "epic-deleted",
      epic_title: "Deleted Campaign",
      subtasks: [],
    });

    await syncLocalEpicsFromRemote("user-1");

    const tasks = await getAllLocalTasksForUser<DailyTask>("user-1");
    expect(tasks).toEqual([
      expect.objectContaining({
        id: "task-epic-deleted",
        epic_id: null,
        epic_title: null,
        habit_source_id: null,
      }),
    ]);
  });

  it("detaches completed local history linked to epics missing from the remote snapshot", async () => {
    mocks.fetchEpicsMock.mockResolvedValue([]);

    await upsertPlannerRecord("epics", {
      id: "epic-deleted",
      user_id: "user-1",
      title: "Deleted Campaign",
      description: null,
      status: "active",
      progress_percentage: 18,
      target_days: 30,
      start_date: "2026-03-01",
      end_date: "2026-03-31",
      created_at: "2026-03-01T00:00:00.000Z",
      epic_habits: [],
    });
    await upsertPlannerRecord("daily_tasks", {
      id: "task-epic-history",
      user_id: "user-1",
      task_text: "Completed Campaign Quest",
      task_date: "2026-04-30",
      completed: true,
      completed_at: "2026-04-30T12:00:00.000Z",
      habit_source_id: "habit-deleted",
      epic_id: "epic-deleted",
      epic_title: "Deleted Campaign",
      subtasks: [],
    });

    await syncLocalEpicsFromRemote("user-1");

    const tasks = await getAllLocalTasksForUser<DailyTask>("user-1");
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.epic_id).toBeNull();
    expect(tasks[0]?.epic_title).toBeNull();
    expect(tasks[0]?.habit_source_id).toBe("habit-deleted");
  });

  it("keeps standalone habit task links while detaching orphaned campaign metadata", async () => {
    mocks.fetchEpicsMock.mockResolvedValue([]);

    await upsertPlannerRecord("daily_tasks", {
      id: "task-standalone-habit",
      user_id: "user-1",
      task_text: "Daily Stretching",
      task_date: "2026-05-01",
      completed: false,
      completed_at: null,
      habit_source_id: "habit-standalone",
      epic_id: "epic-deleted",
      epic_title: "Deleted Campaign",
      subtasks: [],
    });

    await syncLocalEpicsFromRemote("user-1");

    const tasks = await getAllLocalTasksForUser<DailyTask>("user-1");
    expect(tasks).toEqual([
      expect.objectContaining({
        id: "task-standalone-habit",
        epic_id: null,
        epic_title: null,
        habit_source_id: "habit-standalone",
      }),
    ]);
  });
});
