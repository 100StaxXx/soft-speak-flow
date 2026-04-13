import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const fromMock = vi.fn();
  const selectMock = vi.fn();
  const eqUserIdMock = vi.fn();
  const orderCreatedAtMock = vi.fn();
  const loadLocalEpicsMock = vi.fn();
  const queueActionMock = vi.fn();
  const requestJourneyPathGenerationMock = vi.fn();
  const retryNowMock = vi.fn();
  const dispatchPlannerSyncFinishedMock = vi.fn();
  const rpcMock = vi.fn();
  const getAllLocalTasksForUserMock = vi.fn();
  const getLocalEpicHabitsMock = vi.fn();
  const getLocalHabitCompletionsMock = vi.fn();
  const getLocalHabitsMock = vi.fn();
  const getLocalJourneyPhasesMock = vi.fn();
  const getLocalEpicMilestonesMock = vi.fn();
  const removePlannerRecordMock = vi.fn();
  const removePlannerRecordsMock = vi.fn();
  const upsertPlannerRecordMock = vi.fn();
  const upsertPlannerRecordsMock = vi.fn();
  let shouldQueueWrites = false;
  const warmEpicsQueryFromRemoteMock = vi.fn();
  const withPlannerRemoteSyncLockMock = vi.fn(async (_userId: string, operation: () => Promise<unknown>) => operation());
  const toastSuccessMock = vi.fn();
  const toastErrorMock = vi.fn();
  const toastMock = vi.fn();

  return {
    fromMock,
    selectMock,
    eqUserIdMock,
    orderCreatedAtMock,
    loadLocalEpicsMock,
    queueActionMock,
    requestJourneyPathGenerationMock,
    retryNowMock,
    dispatchPlannerSyncFinishedMock,
    rpcMock,
    getAllLocalTasksForUserMock,
    getLocalEpicHabitsMock,
    getLocalHabitCompletionsMock,
    getLocalHabitsMock,
    getLocalJourneyPhasesMock,
    getLocalEpicMilestonesMock,
    removePlannerRecordMock,
    removePlannerRecordsMock,
    upsertPlannerRecordMock,
    upsertPlannerRecordsMock,
    get shouldQueueWrites() {
      return shouldQueueWrites;
    },
    set shouldQueueWrites(value: boolean) {
      shouldQueueWrites = value;
    },
    warmEpicsQueryFromRemoteMock,
    withPlannerRemoteSyncLockMock,
    toastSuccessMock,
    toastErrorMock,
    toastMock,
  };
});

vi.mock("./useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useXPRewards", () => ({
  useXPRewards: () => ({
    awardCustomXP: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAIInteractionTracker", () => ({
  useAIInteractionTracker: () => ({
    trackEpicOutcome: vi.fn(),
  }),
}));

vi.mock("@/contexts/ResilienceContext", () => ({
  useResilience: () => ({
    queueAction: (...args: unknown[]) => mocks.queueActionMock(...args),
    shouldQueueWrites: mocks.shouldQueueWrites,
    retryNow: (...args: unknown[]) => mocks.retryNowMock(...args),
  }),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: Object.assign(
    (...args: unknown[]) => mocks.toastMock(...args),
    {
      success: (...args: unknown[]) => mocks.toastSuccessMock(...args),
      error: (...args: unknown[]) => mocks.toastErrorMock(...args),
    },
  ),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mocks.fromMock(...args),
    rpc: (...args: unknown[]) => mocks.rpcMock(...args),
    auth: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("@/utils/journeyPathCache", () => ({
  requestJourneyPathGeneration: (...args: unknown[]) => mocks.requestJourneyPathGenerationMock(...args),
}));

vi.mock("@/utils/plannerSync", () => ({
  PLANNER_SYNC_EVENT: "planner-sync-finished",
  dispatchPlannerSyncFinished: (...args: unknown[]) => mocks.dispatchPlannerSyncFinishedMock(...args),
  loadLocalEpics: (...args: unknown[]) => mocks.loadLocalEpicsMock(...args),
  withPlannerRemoteSyncLock: (...args: unknown[]) => mocks.withPlannerRemoteSyncLockMock(...args),
  warmEpicsQueryFromRemote: (...args: unknown[]) => mocks.warmEpicsQueryFromRemoteMock(...args),
}));

vi.mock("@/utils/plannerLocalStore", async () => {
  const actual = await vi.importActual<typeof import("@/utils/plannerLocalStore")>("@/utils/plannerLocalStore");

  return {
    ...actual,
    getAllLocalTasksForUser: (...args: unknown[]) => mocks.getAllLocalTasksForUserMock(...args),
    getLocalEpicHabits: (...args: unknown[]) => mocks.getLocalEpicHabitsMock(...args),
    getLocalHabitCompletions: (...args: unknown[]) => mocks.getLocalHabitCompletionsMock(...args),
    getLocalHabits: (...args: unknown[]) => mocks.getLocalHabitsMock(...args),
    getLocalJourneyPhases: (...args: unknown[]) => mocks.getLocalJourneyPhasesMock(...args),
    getLocalEpicMilestones: (...args: unknown[]) => mocks.getLocalEpicMilestonesMock(...args),
    removePlannerRecord: (...args: unknown[]) => mocks.removePlannerRecordMock(...args),
    removePlannerRecords: (...args: unknown[]) => mocks.removePlannerRecordsMock(...args),
    upsertPlannerRecord: (...args: unknown[]) => mocks.upsertPlannerRecordMock(...args),
    upsertPlannerRecords: (...args: unknown[]) => mocks.upsertPlannerRecordsMock(...args),
  };
});

import { normalizeCreateCampaignError, useEpics } from "./useEpics";
import { resolveEpicEndDate } from "@/utils/epicDates";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useEpics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldQueueWrites = false;
    mocks.loadLocalEpicsMock.mockResolvedValue([]);
    mocks.queueActionMock.mockResolvedValue(undefined);
    mocks.requestJourneyPathGenerationMock.mockResolvedValue(null);
    mocks.retryNowMock.mockResolvedValue(undefined);
    mocks.dispatchPlannerSyncFinishedMock.mockReset();
    mocks.rpcMock.mockResolvedValue({ data: 0, error: null });
    mocks.warmEpicsQueryFromRemoteMock.mockResolvedValue([]);
    mocks.withPlannerRemoteSyncLockMock.mockImplementation(async (_userId: string, operation: () => Promise<unknown>) => operation());
    mocks.toastSuccessMock.mockReset();
    mocks.toastErrorMock.mockReset();
    mocks.toastMock.mockReset();
    mocks.getAllLocalTasksForUserMock.mockResolvedValue([]);
    mocks.getLocalEpicHabitsMock.mockResolvedValue([]);
    mocks.getLocalHabitCompletionsMock.mockResolvedValue([]);
    mocks.getLocalHabitsMock.mockResolvedValue([]);
    mocks.getLocalJourneyPhasesMock.mockResolvedValue([]);
    mocks.getLocalEpicMilestonesMock.mockResolvedValue([]);
    mocks.removePlannerRecordMock.mockResolvedValue(undefined);
    mocks.removePlannerRecordsMock.mockResolvedValue(undefined);
    mocks.upsertPlannerRecordMock.mockResolvedValue(undefined);
    mocks.upsertPlannerRecordsMock.mockResolvedValue(undefined);

    mocks.fromMock.mockReturnValue({
      select: mocks.selectMock,
    });
    mocks.selectMock.mockReturnValue({
      eq: mocks.eqUserIdMock,
    });
    mocks.eqUserIdMock.mockReturnValue({
      order: mocks.orderCreatedAtMock,
    });
    mocks.orderCreatedAtMock.mockResolvedValue({
      data: [],
      error: null,
    });
  });

  it("does not fetch epics when disabled", () => {
    const { result } = renderHook(() => useEpics({ enabled: false }), {
      wrapper: createWrapper(),
    });

    expect(result.current.epics).toEqual([]);
    expect(mocks.fromMock).not.toHaveBeenCalled();
  });

  it("keeps visible campaigns stable while a planner sync refresh is in flight", async () => {
    const initialEpics = [
      {
        id: "epic-1",
        user_id: "user-1",
        title: "Campaign Alpha",
        description: null,
        status: "active",
        progress_percentage: 40,
        target_days: 14,
        start_date: "2026-02-10",
        end_date: null,
        created_at: "2026-02-10T00:00:00.000Z",
        epic_habits: [],
      },
    ];
    const refreshedEpics = [
      ...initialEpics,
      {
        id: "epic-2",
        user_id: "user-1",
        title: "Campaign Beta",
        description: null,
        status: "completed",
        progress_percentage: 100,
        target_days: 7,
        start_date: "2026-02-01",
        end_date: "2026-02-08",
        created_at: "2026-02-01T00:00:00.000Z",
        epic_habits: [],
      },
    ];

    let resolveRefresh: (() => void) | null = null;
    const refreshPending = new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    });

    mocks.loadLocalEpicsMock.mockResolvedValue(initialEpics);
    mocks.warmEpicsQueryFromRemoteMock
      .mockImplementationOnce(async (queryClient: QueryClient, userId: string) => {
        queryClient.setQueryData(["epics", userId], initialEpics);
        return initialEpics;
      })
      .mockImplementationOnce(async (queryClient: QueryClient, userId: string) => {
        await refreshPending;
        queryClient.setQueryData(["epics", userId], refreshedEpics);
        return refreshedEpics;
      });

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.activeEpics).toHaveLength(1);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent("planner-sync-finished"));
    });

    expect(result.current.activeEpics).toHaveLength(1);
    expect(result.current.activeEpics[0]?.title).toBe("Campaign Alpha");

    await act(async () => {
      resolveRefresh?.();
      await refreshPending;
    });

    await waitFor(() => {
      expect(result.current.completedEpics).toHaveLength(1);
    });
  });

  it("holds the empty state behind loading until the first remote hydration completes", async () => {
    const hydratedEpics = [
      {
        id: "epic-1",
        user_id: "user-1",
        title: "Summer Gains",
        description: null,
        status: "active",
        progress_percentage: 0,
        target_days: 91,
        start_date: "2026-03-03",
        end_date: "2026-06-02",
        created_at: "2026-03-03T06:04:39.896094Z",
        epic_habits: [],
      },
      {
        id: "epic-2",
        user_id: "user-1",
        title: "Get Money",
        description: null,
        status: "active",
        progress_percentage: 0,
        target_days: 304,
        start_date: "2026-03-03",
        end_date: "2027-01-01",
        created_at: "2026-03-03T05:59:36.751961Z",
        epic_habits: [],
      },
    ];

    let resolveHydration: (() => void) | null = null;
    const hydrationPending = new Promise<void>((resolve) => {
      resolveHydration = resolve;
    });

    mocks.loadLocalEpicsMock.mockResolvedValue([]);
    mocks.warmEpicsQueryFromRemoteMock.mockImplementationOnce(async (queryClient: QueryClient, userId: string) => {
      await hydrationPending;
      queryClient.setQueryData(["epics", userId], hydratedEpics);
      return hydratedEpics;
    });

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });
    expect(result.current.epics).toEqual([]);

    await act(async () => {
      resolveHydration?.();
      await hydrationPending;
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.activeEpics.map((epic) => epic.title)).toEqual([
      "Summer Gains",
      "Get Money",
    ]);
  });

  it("starts background initial journey-path generation after a successful remote create", async () => {
    const tableWithInsert = () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: mocks.selectMock,
    });

    mocks.fromMock.mockImplementation((table: string) => {
      if (["habits", "epics", "epic_habits", "journey_phases", "epic_milestones"].includes(table)) {
        return tableWithInsert();
      }

      return {
        select: mocks.selectMock,
      };
    });

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.createEpic({
        title: "Launch Sequence",
        target_days: 14,
        habits: [
          {
            title: "Morning focus",
            difficulty: "easy",
            frequency: "daily",
            custom_days: [1, 2, 3, 4, 5],
          },
        ],
      });
    });

    await waitFor(() => {
      expect(mocks.requestJourneyPathGenerationMock).toHaveBeenCalledWith({
        epicId: expect.any(String),
        milestoneIndex: 0,
        queryClient: expect.any(QueryClient),
        userId: "user-1",
      });
    });
  });

  it("computes a local end date before inserting a newly created campaign", async () => {
    const habitsInsertMock = vi.fn().mockResolvedValue({ error: null });
    const epicsInsertMock = vi.fn().mockResolvedValue({ error: null });
    const linksInsertMock = vi.fn().mockResolvedValue({ error: null });

    mocks.fromMock.mockImplementation((table: string) => {
      if (table === "habits") {
        return {
          insert: habitsInsertMock,
          select: mocks.selectMock,
        };
      }

      if (table === "epics") {
        return {
          insert: epicsInsertMock,
          select: mocks.selectMock,
        };
      }

      if (["epic_habits", "journey_phases", "epic_milestones"].includes(table)) {
        return {
          insert: linksInsertMock,
          select: mocks.selectMock,
        };
      }

      return {
        select: mocks.selectMock,
      };
    });

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.createEpic({
        title: "Date Locked",
        target_days: 14,
        habits: [
          {
            title: "Morning focus",
            difficulty: "easy",
            frequency: "daily",
            custom_days: [1, 2, 3, 4, 5],
          },
        ],
      });
    });

    const insertedEpic = epicsInsertMock.mock.calls[0]?.[0];

    expect(insertedEpic).toEqual(expect.objectContaining({
      start_date: expect.any(String),
      end_date: expect.any(String),
      target_days: 14,
    }));
    expect(insertedEpic.end_date).toBe(resolveEpicEndDate(insertedEpic));
    expect(insertedEpic).not.toHaveProperty("epic_habits");
  });

  it("preserves monthly ritual cadence and month days during campaign creation", async () => {
    const habitsInsertMock = vi.fn().mockResolvedValue({ error: null });
    const epicsInsertMock = vi.fn().mockResolvedValue({ error: null });
    const linksInsertMock = vi.fn().mockResolvedValue({ error: null });

    mocks.fromMock.mockImplementation((table: string) => {
      if (table === "habits") {
        return {
          insert: habitsInsertMock,
          select: mocks.selectMock,
        };
      }

      if (table === "epics") {
        return {
          insert: epicsInsertMock,
          select: mocks.selectMock,
        };
      }

      if (["epic_habits", "journey_phases", "epic_milestones"].includes(table)) {
        return {
          insert: linksInsertMock,
          select: mocks.selectMock,
        };
      }

      return {
        select: mocks.selectMock,
      };
    });

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.createEpic({
        title: "Revenue Rhythm",
        target_days: 30,
        habits: [
          {
            title: "Monthly Review and Adjust",
            difficulty: "medium",
            frequency: "monthly",
            custom_days: [],
            custom_month_days: [1],
          },
        ],
      });
    });

    expect(habitsInsertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        title: "Monthly Review and Adjust",
        frequency: "monthly",
        custom_days: null,
        custom_month_days: [1],
      }),
    ]);
  });

  it("skips background initial journey-path generation when the create is queued offline", async () => {
    mocks.shouldQueueWrites = true;

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.createEpic({
        title: "Offline Campaign",
        target_days: 21,
        habits: [
          {
            title: "Evening reflection",
            difficulty: "medium",
            frequency: "daily",
            custom_days: [0, 1, 2, 3, 4, 5, 6],
          },
        ],
      });
    });

    expect(mocks.queueActionMock).toHaveBeenCalled();
    expect(mocks.requestJourneyPathGenerationMock).not.toHaveBeenCalled();
  });

  it("rolls back and rejects when campaign creation fails with a non-queueable server error", async () => {
    const habitsInsertMock = vi.fn().mockResolvedValue({ error: null });
    const epicsInsertMock = vi.fn().mockResolvedValue({
      error: { message: "violates check constraint", status: 400 },
    });
    const deleteEpicHabitsInMock = vi.fn().mockResolvedValue({ error: null });
    const deleteHabitsEqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteHabitsInMock = vi.fn().mockReturnValue({ eq: deleteHabitsEqMock });
    const deleteEpicsEqUserMock = vi.fn().mockResolvedValue({ error: null });
    const deleteEpicsEqIdMock = vi.fn().mockReturnValue({ eq: deleteEpicsEqUserMock });

    mocks.fromMock.mockImplementation((table: string) => {
      if (table === "habits") {
        return {
          insert: habitsInsertMock,
          delete: vi.fn().mockReturnValue({ in: deleteHabitsInMock }),
          select: mocks.selectMock,
        };
      }

      if (table === "epics") {
        return {
          insert: epicsInsertMock,
          delete: vi.fn().mockReturnValue({ eq: deleteEpicsEqIdMock }),
          select: mocks.selectMock,
        };
      }

      if (table === "epic_habits") {
        return {
          delete: vi.fn().mockReturnValue({ in: deleteEpicHabitsInMock }),
          select: mocks.selectMock,
        };
      }

      if (table === "journey_phases" || table === "epic_milestones") {
        return {
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
          select: mocks.selectMock,
        };
      }

      return {
        select: mocks.selectMock,
      };
    });

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.createEpic({
        title: "Broken Campaign",
        target_days: 14,
        habits: [
          {
            title: "Morning focus",
            difficulty: "easy",
            frequency: "daily",
            custom_days: [1, 2, 3, 4, 5],
          },
        ],
      })).rejects.toMatchObject({
        status: 400,
      });
    });

    expect(mocks.queueActionMock).not.toHaveBeenCalled();
    expect(mocks.retryNowMock).not.toHaveBeenCalled();
    expect(mocks.removePlannerRecordMock).toHaveBeenCalledWith("epics", expect.any(String));
    expect(mocks.removePlannerRecordsMock).toHaveBeenCalledWith("habits", expect.any(Array));
    expect(deleteEpicHabitsInMock).toHaveBeenCalled();
    expect(deleteHabitsInMock).toHaveBeenCalled();
    expect(deleteEpicsEqIdMock).toHaveBeenCalledWith("id", expect.any(String));
    expect(deleteEpicsEqUserMock).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("renames an active campaign locally, syncs the new title remotely, and invalidates dependent queries", async () => {
    let localEpics = [
      {
        id: "epic-1",
        user_id: "user-1",
        title: "Campaign Alpha",
        description: null,
        status: "active",
        progress_percentage: 40,
        target_days: 14,
        start_date: "2026-02-10",
        end_date: null,
        created_at: "2026-02-10T00:00:00.000Z",
        epic_habits: [],
      },
    ];
    let localTasks = [
      {
        id: "task-1",
        user_id: "user-1",
        epic_id: "epic-1",
        epic_title: "Campaign Alpha",
      },
    ];

    mocks.loadLocalEpicsMock.mockImplementation(async () => localEpics);
    mocks.getAllLocalTasksForUserMock.mockImplementation(async () => localTasks);
    mocks.upsertPlannerRecordMock.mockImplementation(async (storeName: string, record: typeof localEpics[number]) => {
      if (storeName === "epics") {
        localEpics = localEpics.map((epic) => (epic.id === record.id ? record : epic));
      }
    });
    mocks.upsertPlannerRecordsMock.mockImplementation(async (storeName: string, records: typeof localTasks) => {
      if (storeName === "daily_tasks") {
        const updatesById = new Map(records.map((record) => [record.id, record]));
        localTasks = localTasks.map((task) => updatesById.get(task.id) ?? task);
      }
    });
    mocks.warmEpicsQueryFromRemoteMock.mockImplementationOnce(async (queryClient: QueryClient, userId: string) => {
      queryClient.setQueryData(["epics", userId], localEpics);
      return localEpics;
    });

    const eqUserIdUpdateMock = vi.fn().mockResolvedValue({ error: null });
    const eqIdUpdateMock = vi.fn().mockReturnValue({ eq: eqUserIdUpdateMock });
    const updateMock = vi.fn().mockReturnValue({ eq: eqIdUpdateMock });

    mocks.fromMock.mockImplementation((table: string) => {
      if (table === "epics") {
        return {
          update: updateMock,
          select: mocks.selectMock,
        };
      }

      return {
        select: mocks.selectMock,
      };
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useEpics(), { wrapper });

    await waitFor(() => {
      expect(result.current.activeEpics[0]?.title).toBe("Campaign Alpha");
    });

    await act(async () => {
      await result.current.renameEpic({ epicId: "epic-1", title: "  Campaign Aurora  " });
    });

    await waitFor(() => {
      expect(result.current.activeEpics[0]?.title).toBe("Campaign Aurora");
    });

    expect(updateMock).toHaveBeenCalledWith({ title: "Campaign Aurora" });
    expect(eqIdUpdateMock).toHaveBeenCalledWith("id", "epic-1");
    expect(eqUserIdUpdateMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(localTasks[0]?.epic_title).toBe("Campaign Aurora");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["epics"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["daily-tasks"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["habit-surfacing"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["user-ai-context"] });
  });

  it("queues EPIC_UPDATE when a remote rename falls back offline", async () => {
    let localEpics = [
      {
        id: "epic-1",
        user_id: "user-1",
        title: "Campaign Alpha",
        description: null,
        status: "active",
        progress_percentage: 40,
        target_days: 14,
        start_date: "2026-02-10",
        end_date: null,
        created_at: "2026-02-10T00:00:00.000Z",
        epic_habits: [],
      },
    ];

    mocks.loadLocalEpicsMock.mockImplementation(async () => localEpics);
    mocks.upsertPlannerRecordMock.mockImplementation(async (storeName: string, record: typeof localEpics[number]) => {
      if (storeName === "epics") {
        localEpics = localEpics.map((epic) => (epic.id === record.id ? record : epic));
      }
    });
    mocks.warmEpicsQueryFromRemoteMock.mockImplementationOnce(async (queryClient: QueryClient, userId: string) => {
      queryClient.setQueryData(["epics", userId], localEpics);
      return localEpics;
    });

    const remoteError = new Error("temporary outage");
    const eqUserIdUpdateMock = vi.fn().mockResolvedValue({ error: remoteError });
    const eqIdUpdateMock = vi.fn().mockReturnValue({ eq: eqUserIdUpdateMock });
    const updateMock = vi.fn().mockReturnValue({ eq: eqIdUpdateMock });

    mocks.fromMock.mockImplementation((table: string) => {
      if (table === "epics") {
        return {
          update: updateMock,
          select: mocks.selectMock,
        };
      }

      return {
        select: mocks.selectMock,
      };
    });

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.activeEpics[0]?.title).toBe("Campaign Alpha");
    });

    await act(async () => {
      await result.current.renameEpic({ epicId: "epic-1", title: "Campaign Nova" });
    });

    await waitFor(() => {
      expect(result.current.activeEpics[0]?.title).toBe("Campaign Nova");
    });

    expect(mocks.queueActionMock).toHaveBeenCalledWith({
      actionKind: "EPIC_UPDATE",
      entityType: "epic",
      entityId: "epic-1",
      payload: {
        epicId: "epic-1",
        updates: {
          title: "Campaign Nova",
        },
      },
    });
    expect(mocks.retryNowMock).toHaveBeenCalled();
  });

  it("creates a campaign ritual locally, syncs it remotely, and updates the cached epics immediately", async () => {
    let localHabits: Array<Record<string, unknown>> = [];
    let localEpicHabits: Array<{ id: string; epic_id: string; habit_id: string }> = [];
    const baseEpic = {
      id: "epic-1",
      user_id: "user-1",
      title: "Campaign Alpha",
      description: null,
      status: "active",
      progress_percentage: 40,
      target_days: 14,
      start_date: "2026-02-10",
      end_date: null,
      created_at: "2026-02-10T00:00:00.000Z",
    };

    const buildLocalEpics = () => [
      {
        ...baseEpic,
        epic_habits: localEpicHabits.map((link) => ({
          habit_id: link.habit_id,
          habits: (localHabits.find((habit) => habit.id === link.habit_id) as Record<string, unknown> | undefined) ?? null,
        })),
      },
    ];

    mocks.loadLocalEpicsMock.mockImplementation(async () => buildLocalEpics());
    mocks.upsertPlannerRecordMock.mockImplementation(async (storeName: string, record: Record<string, unknown>) => {
      if (storeName === "habits") {
        localHabits = [...localHabits.filter((habit) => habit.id !== record.id), record];
      }
      if (storeName === "epic_habits") {
        localEpicHabits = [...localEpicHabits.filter((link) => link.id !== record.id), record as { id: string; epic_id: string; habit_id: string }];
      }
    });

    const habitsInsertMock = vi.fn().mockResolvedValue({ error: null });
    const linksInsertMock = vi.fn().mockResolvedValue({ error: null });

    mocks.fromMock.mockImplementation((table: string) => {
      if (table === "habits") {
        return {
          insert: habitsInsertMock,
          select: mocks.selectMock,
        };
      }

      if (table === "epic_habits") {
        return {
          insert: linksInsertMock,
          select: mocks.selectMock,
        };
      }

      return {
        select: mocks.selectMock,
      };
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useEpics({ enabled: false }), { wrapper });

    await act(async () => {
      await result.current.createCampaignRitual({
        epicId: "epic-1",
        title: "Evening Walk",
        difficulty: "easy",
        frequency: "daily",
        customDays: [0, 1, 2, 3, 4, 5, 6],
      });
    });

    const cachedEpics = queryClient.getQueryData<Array<{ epic_habits: Array<{ habits: { title?: string } | null }> }>>(["epics", "user-1"]);
    expect(cachedEpics?.[0]?.epic_habits.some((link) => link.habits?.title === "Evening Walk")).toBe(true);
    expect(mocks.upsertPlannerRecordMock).toHaveBeenCalledWith(
      "habits",
      expect.objectContaining({
        title: "Evening Walk",
        frequency: "daily",
      }),
    );
    expect(mocks.upsertPlannerRecordMock).toHaveBeenCalledWith(
      "epic_habits",
      expect.objectContaining({
        epic_id: "epic-1",
      }),
    );
    expect(habitsInsertMock).toHaveBeenCalledTimes(1);
    expect(linksInsertMock).toHaveBeenCalledTimes(1);
    expect(mocks.dispatchPlannerSyncFinishedMock).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccessMock).toHaveBeenCalledWith(
      "Ritual added to campaign!",
      expect.objectContaining({
        description: expect.stringContaining("Evening Walk"),
      }),
    );
  });

  it("rolls back a campaign ritual when the epic link insert fails and never shows a success toast", async () => {
    let localHabits: Array<Record<string, unknown>> = [];
    let localEpicHabits: Array<{ id: string; epic_id: string; habit_id: string }> = [];
    const baseEpic = {
      id: "epic-1",
      user_id: "user-1",
      title: "Campaign Alpha",
      description: null,
      status: "active",
      progress_percentage: 40,
      target_days: 14,
      start_date: "2026-02-10",
      end_date: null,
      created_at: "2026-02-10T00:00:00.000Z",
    };

    const buildLocalEpics = () => [
      {
        ...baseEpic,
        epic_habits: localEpicHabits.map((link) => ({
          habit_id: link.habit_id,
          habits: (localHabits.find((habit) => habit.id === link.habit_id) as Record<string, unknown> | undefined) ?? null,
        })),
      },
    ];

    mocks.loadLocalEpicsMock.mockImplementation(async () => buildLocalEpics());
    mocks.upsertPlannerRecordMock.mockImplementation(async (storeName: string, record: Record<string, unknown>) => {
      if (storeName === "habits") {
        localHabits = [...localHabits.filter((habit) => habit.id !== record.id), record];
      }
      if (storeName === "epic_habits") {
        localEpicHabits = [...localEpicHabits.filter((link) => link.id !== record.id), record as { id: string; epic_id: string; habit_id: string }];
      }
    });
    mocks.removePlannerRecordMock.mockImplementation(async (storeName: string, recordId: string) => {
      if (storeName === "habits") {
        localHabits = localHabits.filter((habit) => habit.id !== recordId);
      }
      if (storeName === "epic_habits") {
        localEpicHabits = localEpicHabits.filter((link) => link.id !== recordId);
      }
    });

    const habitsInsertMock = vi.fn().mockResolvedValue({ error: null });
    const linksInsertError = { message: "violates check constraint", status: 400 };
    const linksInsertMock = vi.fn().mockResolvedValue({ error: linksInsertError });
    const deleteLinkEqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteHabitUserEqMock = vi.fn().mockResolvedValue({ error: null });

    mocks.fromMock.mockImplementation((table: string) => {
      if (table === "habits") {
        return {
          insert: habitsInsertMock,
          delete: () => ({
            eq: () => ({
              eq: deleteHabitUserEqMock,
            }),
          }),
          select: mocks.selectMock,
        };
      }

      if (table === "epic_habits") {
        return {
          insert: linksInsertMock,
          delete: () => ({
            eq: deleteLinkEqMock,
          }),
          select: mocks.selectMock,
        };
      }

      return {
        select: mocks.selectMock,
      };
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useEpics({ enabled: false }), { wrapper });

    let mutationError: unknown = null;
    await act(async () => {
      try {
        await result.current.createCampaignRitual({
          epicId: "epic-1",
          title: "Evening Walk",
          difficulty: "easy",
          frequency: "daily",
          customDays: [0, 1, 2, 3, 4, 5, 6],
        });
      } catch (error) {
        mutationError = error;
      }
    });

    expect(mutationError).toEqual(linksInsertError);

    const cachedEpics = queryClient.getQueryData<Array<{ epic_habits: Array<{ habits: { title?: string } | null }> }>>(["epics", "user-1"]);
    expect(localHabits).toHaveLength(0);
    expect(localEpicHabits).toHaveLength(0);
    expect(cachedEpics?.[0]?.epic_habits ?? []).toEqual([]);
    expect(mocks.dispatchPlannerSyncFinishedMock).toHaveBeenCalledTimes(2);
    expect(mocks.toastSuccessMock).not.toHaveBeenCalled();
    expect(mocks.toastErrorMock).toHaveBeenCalledWith("Failed to add ritual");
  });

  it("keeps a locally created campaign ritual when the remote write falls back to the offline queue", async () => {
    let localHabits: Array<Record<string, unknown>> = [];
    let localEpicHabits: Array<{ id: string; epic_id: string; habit_id: string }> = [];
    const baseEpic = {
      id: "epic-1",
      user_id: "user-1",
      title: "Campaign Alpha",
      description: null,
      status: "active",
      progress_percentage: 40,
      target_days: 14,
      start_date: "2026-02-10",
      end_date: null,
      created_at: "2026-02-10T00:00:00.000Z",
    };

    const buildLocalEpics = () => [
      {
        ...baseEpic,
        epic_habits: localEpicHabits.map((link) => ({
          habit_id: link.habit_id,
          habits: (localHabits.find((habit) => habit.id === link.habit_id) as Record<string, unknown> | undefined) ?? null,
        })),
      },
    ];

    mocks.loadLocalEpicsMock.mockImplementation(async () => buildLocalEpics());
    mocks.upsertPlannerRecordMock.mockImplementation(async (storeName: string, record: Record<string, unknown>) => {
      if (storeName === "habits") {
        localHabits = [...localHabits.filter((habit) => habit.id !== record.id), record];
      }
      if (storeName === "epic_habits") {
        localEpicHabits = [...localEpicHabits.filter((link) => link.id !== record.id), record as { id: string; epic_id: string; habit_id: string }];
      }
    });

    const habitsInsertMock = vi.fn().mockResolvedValue({ error: null });
    const linksInsertMock = vi.fn().mockResolvedValue({ error: new Error("Failed to fetch") });

    mocks.fromMock.mockImplementation((table: string) => {
      if (table === "habits") {
        return {
          insert: habitsInsertMock,
          select: mocks.selectMock,
        };
      }

      if (table === "epic_habits") {
        return {
          insert: linksInsertMock,
          select: mocks.selectMock,
        };
      }

      return {
        select: mocks.selectMock,
      };
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useEpics(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.createCampaignRitual({
        epicId: "epic-1",
        title: "Evening Walk",
        difficulty: "easy",
        frequency: "daily",
        customDays: [0, 1, 2, 3, 4, 5, 6],
      });
    });

    const cachedEpics = queryClient.getQueryData<Array<{ epic_habits: Array<{ habits: { title?: string } | null }> }>>(["epics", "user-1"]);
    expect(cachedEpics?.[0]?.epic_habits.some((link) => link.habits?.title === "Evening Walk")).toBe(true);
    expect(mocks.queueActionMock).toHaveBeenCalledWith({
      actionKind: "EPIC_RITUAL_CREATE",
      entityType: "epic",
      entityId: "epic-1",
      payload: expect.objectContaining({
        habit: expect.objectContaining({
          title: "Evening Walk",
        }),
        epicHabit: expect.objectContaining({
          epic_id: "epic-1",
        }),
      }),
    });
    expect(mocks.retryNowMock).toHaveBeenCalled();
    expect(mocks.toastSuccessMock).toHaveBeenCalledWith(
      "Ritual saved offline",
      expect.objectContaining({
        description: expect.stringContaining("back online"),
      }),
    );
  });

  it("surfaces hydrated latest journey-path data after a reopen-style load", async () => {
    const hydratedEpics = [
      {
        id: "epic-1",
        user_id: "user-1",
        title: "Reopen Ready",
        description: null,
        status: "active",
        progress_percentage: 12,
        target_days: 30,
        start_date: "2026-03-01",
        end_date: "2026-03-31",
        created_at: "2026-03-01T00:00:00.000Z",
        epic_habits: [],
        latest_journey_path_url: "https://example.com/persisted-path.png",
        latest_journey_path_milestone_index: 1,
        latest_journey_path_generated_at: "2026-03-27T23:59:59.000Z",
      },
    ];

    mocks.loadLocalEpicsMock.mockResolvedValue(hydratedEpics);
    mocks.warmEpicsQueryFromRemoteMock.mockImplementationOnce(async (queryClient: QueryClient, userId: string) => {
      queryClient.setQueryData(["epics", userId], hydratedEpics);
      return hydratedEpics;
    });

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.activeEpics).toHaveLength(1);
    });

    expect(result.current.activeEpics[0]?.latest_journey_path_url).toBe("https://example.com/persisted-path.png");
  });
});

describe("normalizeCreateCampaignError", () => {
  it("returns campaign-limit messaging for 3-active-epics backend errors", () => {
    const result = normalizeCreateCampaignError("User can only have 3 active epics at a time");

    expect(result.title).toBe("Campaign limit reached");
    expect(result.description).toContain("3 active campaigns");
  });

  it("prioritizes legacy active habit limit errors over generic habit creation failures", () => {
    const result = normalizeCreateCampaignError(
      "Failed to create habits: Maximum active habit limit reached (limit: 2)"
    );

    expect(result.title).toBe("Too many active rituals");
  });

  it("returns a dedicated message for missing month-schedule schema fields", () => {
    const result = normalizeCreateCampaignError(
      'Failed to create habits: column "custom_month_days" of relation "habits" does not exist'
    );

    expect(result.title).toBe("Campaign setup update needed");
  });
});
