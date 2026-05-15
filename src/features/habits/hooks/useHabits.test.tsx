import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  let shouldQueueWrites = false;

  return {
    toast: vi.fn(),
    queueAction: vi.fn(),
    retryNow: vi.fn(),
    from: vi.fn(),
    loadLocalHabits: vi.fn(),
    loadLocalHabitCompletions: vi.fn(),
    loadLocalEpics: vi.fn(),
    syncLocalHabitsFromRemote: vi.fn(),
    withPlannerRemoteSyncLock: vi.fn(async (_userId: string, operation: () => Promise<unknown>) => operation()),
    dispatchPlannerSyncFinished: vi.fn(),
    getAllLocalTasksForUser: vi.fn(),
    getLocalEpicHabits: vi.fn(),
    getLocalHabitCompletions: vi.fn(),
    removePlannerRecord: vi.fn(),
    removePlannerRecords: vi.fn(),
    upsertPlannerRecord: vi.fn(),
    upsertPlannerRecords: vi.fn(),
    hapticsSuccess: vi.fn(),
    get shouldQueueWrites() {
      return shouldQueueWrites;
    },
    set shouldQueueWrites(value: boolean) {
      shouldQueueWrites = value;
    },
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mocks.from(...args),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}));

vi.mock("@/hooks/useXPRewards", () => ({
  useXPRewards: () => ({
    awardCustomXP: vi.fn(),
    awardAllHabitsComplete: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAchievements", () => ({
  useAchievements: () => ({
    checkDailyCompletionAchievement: vi.fn(),
    checkFirstTimeAchievements: vi.fn(),
    checkStreakAchievements: vi.fn(),
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: null,
  }),
}));

vi.mock("@/hooks/useCompanionAttributes", () => ({
  useCompanionAttributes: () => ({
    awardBehaviorStat: vi.fn(),
    awardDisciplineForHabitCompletion: vi.fn(),
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: null,
  }),
}));

vi.mock("@/contexts/ResilienceContext", () => ({
  useResilience: () => ({
    queueAction: (...args: unknown[]) => mocks.queueAction(...args),
    shouldQueueWrites: mocks.shouldQueueWrites,
    retryNow: (...args: unknown[]) => mocks.retryNow(...args),
  }),
}));

vi.mock("@/utils/haptics", () => ({
  haptics: {
    success: (...args: unknown[]) => mocks.hapticsSuccess(...args),
  },
}));

vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

vi.mock("@/utils/plannerLocalStore", () => ({
  createOfflinePlannerId: (prefix: string) => `${prefix}-offline-id`,
  getAllLocalTasksForUser: (...args: unknown[]) => mocks.getAllLocalTasksForUser(...args),
  getLocalEpicHabits: (...args: unknown[]) => mocks.getLocalEpicHabits(...args),
  getLocalHabitCompletions: (...args: unknown[]) => mocks.getLocalHabitCompletions(...args),
  removePlannerRecord: (...args: unknown[]) => mocks.removePlannerRecord(...args),
  removePlannerRecords: (...args: unknown[]) => mocks.removePlannerRecords(...args),
  upsertPlannerRecord: (...args: unknown[]) => mocks.upsertPlannerRecord(...args),
  upsertPlannerRecords: (...args: unknown[]) => mocks.upsertPlannerRecords(...args),
}));

vi.mock("@/utils/plannerSync", () => ({
  PLANNER_SYNC_EVENT: "planner-sync-finished",
  dispatchPlannerSyncFinished: (...args: unknown[]) =>
    mocks.dispatchPlannerSyncFinished(...args),
  loadLocalHabitCompletions: (...args: unknown[]) =>
    mocks.loadLocalHabitCompletions(...args),
  loadLocalHabits: (...args: unknown[]) => mocks.loadLocalHabits(...args),
  loadLocalEpics: (...args: unknown[]) => mocks.loadLocalEpics(...args),
  syncLocalHabitsFromRemote: (...args: unknown[]) =>
    mocks.syncLocalHabitsFromRemote(...args),
  withPlannerRemoteSyncLock: (...args: unknown[]) =>
    mocks.withPlannerRemoteSyncLock(...args),
}));

import { useHabits } from "./useHabits";

const createWrapper = (queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

describe("useHabits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldQueueWrites = false;
    mocks.queueAction.mockResolvedValue(undefined);
    mocks.retryNow.mockResolvedValue(undefined);
    mocks.loadLocalHabits.mockResolvedValue([]);
    mocks.loadLocalHabitCompletions.mockResolvedValue([]);
    mocks.loadLocalEpics.mockResolvedValue([]);
    mocks.syncLocalHabitsFromRemote.mockResolvedValue(undefined);
    mocks.withPlannerRemoteSyncLock.mockImplementation(async (_userId: string, operation: () => Promise<unknown>) => operation());
    mocks.getAllLocalTasksForUser.mockResolvedValue([]);
    mocks.getLocalEpicHabits.mockResolvedValue([]);
    mocks.getLocalHabitCompletions.mockResolvedValue([]);
    mocks.removePlannerRecord.mockResolvedValue(undefined);
    mocks.removePlannerRecords.mockResolvedValue(undefined);
    mocks.upsertPlannerRecord.mockResolvedValue(undefined);
    mocks.upsertPlannerRecords.mockResolvedValue(undefined);
  });

  it("deletes a campaign-linked habit through the planner cleanup path", async () => {
    let localHabits = [{
      id: "habit-linked",
      user_id: "user-1",
      title: "Daily Hydration",
      frequency: "daily",
      custom_days: null,
      custom_month_days: null,
      difficulty: "easy",
      category: "body",
      is_active: true,
      current_streak: 0,
      longest_streak: 0,
      created_at: "2026-04-01T00:00:00.000Z",
    }];
    let localEpicHabits = [{
      id: "link-1",
      epic_id: "epic-1",
      habit_id: "habit-linked",
    }];
    let localTasks = [
      {
        id: "task-open",
        user_id: "user-1",
        habit_source_id: "habit-linked",
        epic_id: "epic-1",
        epic_title: "Campaign Alpha",
        task_date: "2026-05-01",
        completed: false,
        completed_at: null,
      },
      {
        id: "task-complete",
        user_id: "user-1",
        habit_source_id: "habit-linked",
        epic_id: "epic-1",
        epic_title: "Campaign Alpha",
        task_date: "2026-04-30",
        completed: true,
        completed_at: "2026-04-30T12:00:00.000Z",
      },
    ];
    let localCompletions = [{
      id: "completion-1",
      habit_id: "habit-linked",
      user_id: "user-1",
      date: "2026-04-30",
    }];
    const loadEpicsFromLocalState = () => [{
      id: "epic-1",
      user_id: "user-1",
      title: "Campaign Alpha",
      status: "active",
      epic_habits: localEpicHabits.map((link) => ({
        habit_id: link.habit_id,
        habits: localHabits.find((habit) => habit.id === link.habit_id) ?? null,
      })),
    }];

    mocks.shouldQueueWrites = true;
    mocks.loadLocalHabits.mockImplementation(async () => localHabits);
    mocks.loadLocalHabitCompletions.mockImplementation(async () => localCompletions);
    mocks.loadLocalEpics.mockImplementation(async () => loadEpicsFromLocalState());
    mocks.getLocalEpicHabits.mockImplementation(async () => localEpicHabits);
    mocks.getAllLocalTasksForUser.mockImplementation(async () => localTasks);
    mocks.getLocalHabitCompletions.mockImplementation(async () => localCompletions);
    mocks.removePlannerRecord.mockImplementation(async (storeName: string, recordId: string) => {
      if (storeName === "habits") {
        localHabits = localHabits.filter((habit) => habit.id !== recordId);
      }
    });
    mocks.removePlannerRecords.mockImplementation(async (storeName: string, recordIds: string[]) => {
      if (storeName === "daily_tasks") {
        localTasks = localTasks.filter((task) => !recordIds.includes(task.id));
      }
      if (storeName === "epic_habits") {
        localEpicHabits = localEpicHabits.filter((link) => !recordIds.includes(link.id));
      }
      if (storeName === "habit_completions") {
        localCompletions = localCompletions.filter((completion) => !recordIds.includes(completion.id));
      }
    });
    mocks.upsertPlannerRecords.mockImplementation(async (storeName: string, records: typeof localTasks) => {
      if (storeName === "daily_tasks") {
        const updatesById = new Map(records.map((record) => [record.id, record]));
        localTasks = localTasks.map((task) => updatesById.get(task.id) ?? task);
      }
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const dailyTaskCacheKey = ["daily-tasks", "user-1", "2026-05-01"];
    const calendarTaskCacheKey = [
      "calendar-tasks",
      "user-1",
      "2026-04-26",
      "2026-05-02",
      "week",
    ];
    queryClient.setQueryData(dailyTaskCacheKey, localTasks);
    queryClient.setQueryData(calendarTaskCacheKey, localTasks);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useHabits(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.deleteHabit("habit-linked");
    });

    await waitFor(() => {
      expect(mocks.queueAction).toHaveBeenCalledWith({
        actionKind: "HABIT_DELETE",
        entityType: "habit",
        entityId: "habit-linked",
        payload: { habitId: "habit-linked" },
      });
    });

    expect(localHabits).toHaveLength(0);
    expect(localEpicHabits).toHaveLength(0);
    expect(localCompletions).toHaveLength(0);
    expect(localTasks).toEqual([
      expect.objectContaining({
        id: "task-complete",
        epic_id: null,
        epic_title: null,
        habit_source_id: null,
      }),
    ]);
    expect(queryClient.getQueryData(dailyTaskCacheKey)).toEqual([
      expect.objectContaining({
        id: "task-complete",
        epic_id: null,
        epic_title: null,
        habit_source_id: null,
      }),
    ]);
    expect(queryClient.getQueryData(calendarTaskCacheKey)).toEqual([
      expect.objectContaining({
        id: "task-complete",
        epic_id: null,
        epic_title: null,
        habit_source_id: null,
      }),
    ]);
    expect(mocks.withPlannerRemoteSyncLock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["epics"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["daily-tasks"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["calendar-tasks"] });
    expect(mocks.dispatchPlannerSyncFinished).toHaveBeenCalled();
  });

  it("deletes nullable incomplete remote habit tasks instead of leaving them to refetch", async () => {
    mocks.shouldQueueWrites = false;
    mocks.loadLocalHabits.mockResolvedValue([]);
    mocks.loadLocalHabitCompletions.mockResolvedValue([]);
    mocks.loadLocalEpics.mockResolvedValue([]);

    const linkLookupEqMock = vi.fn().mockResolvedValue({
      data: [{ id: "link-1" }],
      error: null,
    });
    const detachCompletedOrMock = vi.fn().mockResolvedValue({ error: null });
    const detachCompletedUserEqMock = vi.fn().mockReturnValue({
      or: detachCompletedOrMock,
    });
    const detachCompletedHabitEqMock = vi.fn().mockReturnValue({
      eq: detachCompletedUserEqMock,
    });
    const deleteIncompleteOrMock = vi.fn().mockResolvedValue({ error: null });
    const deleteIncompleteCompletedAtIsMock = vi.fn().mockReturnValue({
      or: deleteIncompleteOrMock,
    });
    const deleteIncompleteUserEqMock = vi.fn().mockReturnValue({
      is: deleteIncompleteCompletedAtIsMock,
    });
    const deleteIncompleteHabitEqMock = vi.fn().mockReturnValue({
      eq: deleteIncompleteUserEqMock,
    });
    const completionUserEqMock = vi.fn().mockResolvedValue({ error: null });
    const completionHabitEqMock = vi.fn().mockReturnValue({
      eq: completionUserEqMock,
    });
    const linkDeleteInMock = vi.fn().mockResolvedValue({ error: null });
    const habitUserEqMock = vi.fn().mockResolvedValue({ error: null });
    const habitIdEqMock = vi.fn().mockReturnValue({
      eq: habitUserEqMock,
    });

    mocks.from.mockImplementation((table: string) => {
      if (table === "epic_habits") {
        return {
          select: vi.fn().mockReturnValue({ eq: linkLookupEqMock }),
          delete: vi.fn().mockReturnValue({ in: linkDeleteInMock }),
        };
      }

      if (table === "daily_tasks") {
        return {
          update: vi.fn().mockReturnValue({ eq: detachCompletedHabitEqMock }),
          delete: vi.fn().mockReturnValue({ eq: deleteIncompleteHabitEqMock }),
        };
      }

      if (table === "habit_completions") {
        return {
          delete: vi.fn().mockReturnValue({ eq: completionHabitEqMock }),
        };
      }

      if (table === "habits") {
        return {
          delete: vi.fn().mockReturnValue({ eq: habitIdEqMock }),
        };
      }

      return {};
    });

    const { result } = renderHook(() => useHabits(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.deleteHabit("habit-linked");
    });

    await waitFor(() => {
      expect(detachCompletedOrMock).toHaveBeenCalledWith(
        "completed.eq.true,completed_at.not.is.null",
      );
      expect(deleteIncompleteCompletedAtIsMock).toHaveBeenCalledWith(
        "completed_at",
        null,
      );
      expect(deleteIncompleteOrMock).toHaveBeenCalledWith(
        "completed.is.null,completed.eq.false",
      );
    });

    expect(mocks.queueAction).not.toHaveBeenCalled();
  });
});
