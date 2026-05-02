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
  const queueTaskActionMock = vi.fn();
  const requestJourneyPathGenerationMock = vi.fn();
  const retryNowMock = vi.fn();
  const dispatchPlannerSyncFinishedMock = vi.fn();
  const rpcMock = vi.fn();
  const getAllLocalTasksForUserMock = vi.fn();
  const getLocalEpicHabitsMock = vi.fn();
  const getLocalHabitCompletionsMock = vi.fn();
  const getLocalHabitsMock = vi.fn();
  const getLocalJourneyPathsMock = vi.fn();
  const getLocalJourneyPhasesMock = vi.fn();
  const getLocalEpicMilestonesMock = vi.fn();
  const removePlannerRecordMock = vi.fn();
  const removePlannerRecordsMock = vi.fn();
  const upsertPlannerRecordMock = vi.fn();
  const upsertPlannerRecordsMock = vi.fn();
  const getQueuedActionsMock = vi.fn();
  const reportApiFailureMock = vi.fn();
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
    queueTaskActionMock,
    requestJourneyPathGenerationMock,
    retryNowMock,
    dispatchPlannerSyncFinishedMock,
    rpcMock,
    getAllLocalTasksForUserMock,
    getLocalEpicHabitsMock,
    getLocalHabitCompletionsMock,
    getLocalHabitsMock,
    getLocalJourneyPathsMock,
    getLocalJourneyPhasesMock,
    getLocalEpicMilestonesMock,
    removePlannerRecordMock,
    removePlannerRecordsMock,
    upsertPlannerRecordMock,
    upsertPlannerRecordsMock,
    getQueuedActionsMock,
    reportApiFailureMock,
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
    queueTaskAction: (...args: unknown[]) => mocks.queueTaskActionMock(...args),
    shouldQueueWrites: mocks.shouldQueueWrites,
    retryNow: (...args: unknown[]) => mocks.retryNowMock(...args),
    reportApiFailure: (...args: unknown[]) => mocks.reportApiFailureMock(...args),
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

vi.mock("@/utils/offlineStorage", () => ({
  getQueuedActions: (...args: unknown[]) => mocks.getQueuedActionsMock(...args),
}));

vi.mock("@/utils/plannerSync", () => ({
  PLANNER_SYNC_EVENT: "planner-sync-finished",
  dispatchPlannerSyncFinished: (...args: unknown[]) => mocks.dispatchPlannerSyncFinishedMock(...args),
  loadLocalEpics: (...args: unknown[]) => mocks.loadLocalEpicsMock(...args),
  withPlannerRemoteSyncLock: (...args: unknown[]) => mocks.withPlannerRemoteSyncLockMock.apply(null, args),
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
    getLocalJourneyPaths: (...args: unknown[]) => mocks.getLocalJourneyPathsMock(...args),
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
import { ACTIVE_CAMPAIGN_LIMIT, ACTIVE_CAMPAIGN_LIMIT_MESSAGE } from "@/features/epics/constants";

const buildActiveEpic = (id: string) => ({
  id,
  user_id: "user-1",
  title: `Campaign ${id}`,
  description: null,
  status: "active" as const,
  progress_percentage: 0,
  target_days: 30,
  start_date: "2026-03-01",
  end_date: "2026-03-31",
  created_at: "2026-03-01T00:00:00.000Z",
  epic_habits: [],
});

const createWrapper = (queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })) => {

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const createDailyTasksRollbackDeleteMock = () => {
  const orCompletedMock = vi.fn().mockResolvedValue({ error: null });
  const isCompletedAtMock = vi.fn().mockReturnValue({ or: orCompletedMock });
  const eqUserMock = vi.fn().mockReturnValue({ is: isCompletedAtMock });
  const inHabitSourceMock = vi.fn().mockReturnValue({ eq: eqUserMock });
  const deleteMock = vi.fn().mockReturnValue({ in: inHabitSourceMock });

  return {
    deleteMock,
    inHabitSourceMock,
    eqUserMock,
    isCompletedAtMock,
    orCompletedMock,
  };
};

const createDefaultSupabaseTableMock = () => {
  const terminalEqMock = vi.fn().mockResolvedValue({ error: null });
  const eqChainMock = vi.fn().mockReturnValue({ eq: terminalEqMock });
  const inChainMock = vi.fn().mockReturnValue({ eq: eqChainMock });

  return {
    insert: vi.fn().mockResolvedValue({ error: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnValue({ eq: eqChainMock }),
    delete: vi.fn().mockReturnValue({
      eq: eqChainMock,
      in: inChainMock,
    }),
    select: mocks.selectMock,
  };
};

describe("useEpics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldQueueWrites = false;
    mocks.loadLocalEpicsMock.mockResolvedValue([]);
    mocks.queueActionMock.mockResolvedValue(undefined);
    mocks.queueTaskActionMock.mockResolvedValue(undefined);
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
    mocks.getLocalJourneyPathsMock.mockResolvedValue([]);
    mocks.getLocalJourneyPhasesMock.mockResolvedValue([]);
    mocks.getLocalEpicMilestonesMock.mockResolvedValue([]);
    mocks.removePlannerRecordMock.mockResolvedValue(undefined);
    mocks.removePlannerRecordsMock.mockResolvedValue(undefined);
    mocks.upsertPlannerRecordMock.mockResolvedValue(undefined);
    mocks.upsertPlannerRecordsMock.mockResolvedValue(undefined);
    mocks.getQueuedActionsMock.mockResolvedValue([]);
    mocks.reportApiFailureMock.mockReset();

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

  it("reuses the same in-flight create request for duplicate campaign submissions", async () => {
    let resolveHabitsInsert: ((value: { error: null }) => void) | null = null;
    const habitsInsertMock = vi.fn().mockImplementation(
      () =>
        new Promise<{ error: null }>((resolve) => {
          resolveHabitsInsert = resolve;
        }),
    );
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

      return createDefaultSupabaseTableMock();
    });

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const input = {
      title: "Pass the bar exam",
      target_days: 182,
      habits: [
        {
          title: "Morning focus",
          difficulty: "easy",
          frequency: "daily",
          custom_days: [1, 2, 3, 4, 5],
        },
      ],
    };

    let firstRequest!: Promise<unknown>;
    let secondRequest!: Promise<unknown>;

    await act(async () => {
      firstRequest = result.current.createEpic(input);
      secondRequest = result.current.createEpic(input);

      expect(firstRequest).toBe(secondRequest);

      await waitFor(() => {
        expect(resolveHabitsInsert).not.toBeNull();
      });
      resolveHabitsInsert?.({ error: null });
      await Promise.all([firstRequest, secondRequest]);
    });

    expect(habitsInsertMock).toHaveBeenCalledTimes(1);
    expect(epicsInsertMock).toHaveBeenCalledTimes(1);
    expect(linksInsertMock).toHaveBeenCalledTimes(1);
  });

  it("reuses an existing queued campaign create instead of creating a duplicate", async () => {
    const queuedEpic = {
      ...buildActiveEpic("epic-queued"),
      title: "Pass the bar exam",
      target_days: 182,
      created_at: new Date().toISOString(),
      story_type_slug: null,
    };

    mocks.getQueuedActionsMock.mockResolvedValue([
      {
        id: "queued-action-1",
        user_id: "user-1",
        action_kind: "EPIC_CREATE",
        entity_type: "epic",
        entity_id: "epic-queued",
        status: "queued",
        retry_count: 0,
        last_error: null,
        created_at: Date.now(),
        updated_at: Date.now(),
        payload: {
          epic: queuedEpic,
          habits: [
            {
              id: "habit-queued",
              user_id: "user-1",
              title: "Morning focus",
              description: null,
              difficulty: "easy",
              frequency: "daily",
              custom_days: [1, 2, 3, 4, 5],
              custom_month_days: null,
              preferred_time: "08:00",
              reminder_enabled: false,
              reminder_minutes_before: 15,
              estimated_minutes: null,
              category: null,
              is_active: true,
              current_streak: 0,
              longest_streak: 0,
              created_at: new Date().toISOString(),
            },
          ],
          epicHabits: [],
          phases: [],
          milestones: [],
        },
      },
    ]);

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let createResult: Awaited<ReturnType<typeof result.current.createEpic>> | undefined;

    await act(async () => {
      createResult = await result.current.createEpic({
        title: "Pass the bar exam",
        target_days: 182,
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

    expect(createResult).toMatchObject({
      queued: true,
      epic: expect.objectContaining({ id: "epic-queued" }),
    });
    expect(mocks.fromMock).not.toHaveBeenCalled();
    expect(mocks.queueActionMock).not.toHaveBeenCalled();
  });

  it("treats a partially successful create as success after remote reconciliation", async () => {
    let localEpics: Array<ReturnType<typeof buildActiveEpic>> = [];
    let localHabits: Array<Record<string, unknown>> = [];
    const habitsInsertMock = vi.fn().mockResolvedValue({ error: null });
    const epicsInsertMock = vi.fn().mockResolvedValue({
      error: { message: "violates check constraint", status: 400 },
    });
    const deleteEpicHabitsInMock = vi.fn().mockResolvedValue({ error: null });
    const deleteHabitsEqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteHabitsInMock = vi.fn().mockReturnValue({ eq: deleteHabitsEqMock });
    const deleteEpicsEqUserMock = vi.fn().mockResolvedValue({ error: null });
    const deleteEpicsEqIdMock = vi.fn().mockReturnValue({ eq: deleteEpicsEqUserMock });
    const dailyTasksRollbackDeleteMock = createDailyTasksRollbackDeleteMock();

    mocks.loadLocalEpicsMock.mockImplementation(async () => localEpics);
    mocks.getLocalHabitsMock.mockImplementation(async () => localHabits);
    mocks.getLocalJourneyPhasesMock.mockResolvedValue([]);
    mocks.getLocalEpicMilestonesMock.mockResolvedValue([]);
    mocks.warmEpicsQueryFromRemoteMock.mockImplementationOnce(async (queryClient: QueryClient, userId: string) => {
      const recoveredEpic = {
        ...buildActiveEpic("epic-recovered"),
        title: "Recovered Campaign",
        target_days: 30,
        created_at: new Date().toISOString(),
        story_type_slug: null,
        epic_habits: [{ habit_id: "habit-recovered", habits: null }],
      };

      localEpics = [recoveredEpic];
      localHabits = [
        {
          id: "habit-recovered",
          user_id: "user-1",
          title: "Morning focus",
          description: null,
          difficulty: "easy",
          frequency: "daily",
          custom_days: [1, 2, 3, 4, 5],
          custom_month_days: null,
          preferred_time: "08:00",
          reminder_enabled: false,
          reminder_minutes_before: 15,
          estimated_minutes: null,
          category: null,
          is_active: true,
          current_streak: 0,
          longest_streak: 0,
          created_at: new Date().toISOString(),
        },
      ];
      queryClient.setQueryData(["epics", userId], localEpics);
      return localEpics;
    });

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

      if (table === "daily_tasks") {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
          delete: dailyTasksRollbackDeleteMock.deleteMock,
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

      return createDefaultSupabaseTableMock();
    });

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let createResult: Awaited<ReturnType<typeof result.current.createEpic>> | undefined;

    await act(async () => {
      createResult = await result.current.createEpic({
        title: "Recovered Campaign",
        target_days: 30,
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

    expect(createResult).toMatchObject({
      queued: false,
      epic: expect.objectContaining({ id: "epic-recovered" }),
    });
    expect(mocks.toastErrorMock).not.toHaveBeenCalled();
    expect(mocks.requestJourneyPathGenerationMock).not.toHaveBeenCalled();
    expect(mocks.warmEpicsQueryFromRemoteMock).toHaveBeenCalledTimes(1);
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

      return createDefaultSupabaseTableMock();
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

  it("spawns campaign ritual tasks with time and duration during campaign creation", async () => {
    let localEpics: Array<Record<string, unknown>> = [];
    let localHabits: Array<Record<string, unknown>> = [];
    let localEpicHabits: Array<{ id: string; epic_id: string; habit_id: string }> = [];
    let localDailyTasks: Array<Record<string, unknown>> = [];

    const buildLocalEpics = () => localEpics.map((epic) => ({
      ...epic,
      epic_habits: localEpicHabits
        .filter((link) => link.epic_id === epic.id)
        .map((link) => ({
          habit_id: link.habit_id,
          habits: localHabits.find((habit) => habit.id === link.habit_id) ?? null,
        })),
    }));

    mocks.loadLocalEpicsMock.mockImplementation(async () => buildLocalEpics());
    mocks.getAllLocalTasksForUserMock.mockImplementation(async () => localDailyTasks);
    mocks.upsertPlannerRecordMock.mockImplementation(async (storeName: string, record: Record<string, unknown>) => {
      if (storeName === "epics") {
        localEpics = [...localEpics.filter((epic) => epic.id !== record.id), record];
      }
    });
    mocks.upsertPlannerRecordsMock.mockImplementation(async (storeName: string, records: Array<Record<string, unknown>>) => {
      if (storeName === "habits") {
        localHabits = [
          ...localHabits.filter((habit) => !records.some((record) => record.id === habit.id)),
          ...records,
        ];
      }
      if (storeName === "epic_habits") {
        localEpicHabits = [
          ...localEpicHabits.filter((link) => !records.some((record) => record.id === link.id)),
          ...(records as Array<{ id: string; epic_id: string; habit_id: string }>),
        ];
      }
      if (storeName === "daily_tasks") {
        localDailyTasks = [
          ...localDailyTasks.filter((task) => !records.some((record) => record.id === task.id)),
          ...records,
        ];
      }
    });

    const habitsInsertMock = vi.fn().mockResolvedValue({ error: null });
    const epicsInsertMock = vi.fn().mockResolvedValue({ error: null });
    const linksInsertMock = vi.fn().mockResolvedValue({ error: null });
    const dailyTasksUpsertMock = vi.fn().mockResolvedValue({ error: null });

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

      if (table === "epic_habits") {
        return {
          insert: linksInsertMock,
          select: mocks.selectMock,
        };
      }

      if (table === "daily_tasks") {
        return {
          upsert: dailyTasksUpsertMock,
          select: mocks.selectMock,
        };
      }

      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
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
        title: "Timed Campaign",
        target_days: 14,
        habits: [
          {
            title: "Morning focus",
            difficulty: "easy",
            frequency: "daily",
            custom_days: [0, 1, 2, 3, 4, 5, 6],
            preferred_time: "08:30",
            estimated_minutes: 45,
          },
          {
            title: "Evening wind-down",
            difficulty: "medium",
            frequency: "daily",
            custom_days: [0, 1, 2, 3, 4, 5, 6],
            preferredTime: "20:30",
            estimatedMinutes: 25,
          },
        ],
      });
    });

    expect(localDailyTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        task_text: "Morning focus",
        scheduled_time: "08:30",
        estimated_duration: 45,
        epic_id: expect.any(String),
      }),
      expect.objectContaining({
        task_text: "Evening wind-down",
        scheduled_time: "20:30",
        estimated_duration: 25,
        epic_id: expect.any(String),
      }),
    ]));
    expect(habitsInsertMock).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        title: "Evening wind-down",
        preferred_time: "20:30",
        estimated_minutes: 25,
      }),
    ]));
    expect(dailyTasksUpsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          task_text: "Morning focus",
          scheduled_time: "08:30",
          estimated_duration: 45,
          epic_id: expect.any(String),
        }),
        expect.objectContaining({
          task_text: "Evening wind-down",
          scheduled_time: "20:30",
          estimated_duration: 25,
          epic_id: expect.any(String),
        }),
      ]),
      expect.objectContaining({
        onConflict: "user_id,task_date,habit_source_id",
      }),
    );
  });

  it("computes a local end date before inserting a newly created campaign", async () => {
    const habitsInsertMock = vi.fn().mockResolvedValue({ error: null });
    const epicsInsertMock = vi.fn().mockResolvedValue({ error: null });
    const linksInsertMock = vi.fn().mockResolvedValue({ error: null });
    const dailyTasksUpsertMock = vi.fn().mockResolvedValue({ error: null });

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

      if (table === "daily_tasks") {
        return {
          upsert: dailyTasksUpsertMock,
          select: mocks.selectMock,
        };
      }

      return createDefaultSupabaseTableMock();
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
    expect(habitsInsertMock).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        title: "Morning focus",
        preferred_time: "08:00",
      }),
    ]));
    expect(dailyTasksUpsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          task_text: "Morning focus",
          scheduled_time: "08:00",
          estimated_duration: null,
        }),
      ]),
      expect.objectContaining({
        onConflict: "user_id,task_date,habit_source_id",
      }),
    );
  });

  it("persists shared-epic visibility when campaign creation requests a public invite flow", async () => {
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

      return createDefaultSupabaseTableMock();
    });

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.createEpic({
        title: "Shareable Campaign",
        target_days: 10,
        is_public: true,
        habits: [
          {
            title: "Momentum ritual",
            difficulty: "easy",
            frequency: "daily",
            custom_days: [1, 2, 3, 4, 5],
          },
        ],
      });
    });

    expect(epicsInsertMock.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      is_public: true,
    }));
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

      return createDefaultSupabaseTableMock();
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
            preferred_time: "20:00",
            estimated_minutes: 20,
          },
        ],
      });
    });

    expect(mocks.queueActionMock).toHaveBeenCalled();
    expect(mocks.queueTaskActionMock).toHaveBeenCalledWith(
      "CREATE_TASK",
      expect.objectContaining({
        task_text: "Evening reflection",
        scheduled_time: "20:00",
        estimated_duration: 20,
      }),
    );
    expect(mocks.requestJourneyPathGenerationMock).not.toHaveBeenCalled();
  });

  it("allows campaign creation when the user is one campaign under the limit", async () => {
    const activeEpics = Array.from({ length: ACTIVE_CAMPAIGN_LIMIT - 1 }, (_, index) =>
      buildActiveEpic(`epic-${index + 1}`)
    );
    const habitsInsertMock = vi.fn().mockResolvedValue({ error: null });
    const epicsInsertMock = vi.fn().mockResolvedValue({ error: null });
    const linksInsertMock = vi.fn().mockResolvedValue({ error: null });

    mocks.loadLocalEpicsMock.mockResolvedValue(activeEpics);
    mocks.warmEpicsQueryFromRemoteMock.mockImplementationOnce(async (queryClient: QueryClient, userId: string) => {
      queryClient.setQueryData(["epics", userId], activeEpics);
      return activeEpics;
    });
    mocks.rpcMock.mockResolvedValue({ data: ACTIVE_CAMPAIGN_LIMIT - 1, error: null });

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

      return createDefaultSupabaseTableMock();
    });

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.activeEpics).toHaveLength(ACTIVE_CAMPAIGN_LIMIT - 1);
    });

    await act(async () => {
      await result.current.createEpic({
        title: "Next Campaign",
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

    expect(mocks.rpcMock).toHaveBeenCalledWith("count_user_epics", {
      p_user_id: "user-1",
    });
    expect(epicsInsertMock).toHaveBeenCalledTimes(1);
    expect(habitsInsertMock).toHaveBeenCalledTimes(1);
  });

  it("blocks campaign creation from local state once the active campaign limit is already loaded", async () => {
    const activeEpics = Array.from({ length: ACTIVE_CAMPAIGN_LIMIT }, (_, index) =>
      buildActiveEpic(`epic-${index + 1}`)
    );

    mocks.loadLocalEpicsMock.mockResolvedValue(activeEpics);
    mocks.warmEpicsQueryFromRemoteMock.mockImplementationOnce(async (queryClient: QueryClient, userId: string) => {
      queryClient.setQueryData(["epics", userId], activeEpics);
      return activeEpics;
    });

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.activeEpics).toHaveLength(ACTIVE_CAMPAIGN_LIMIT);
    });

    await act(async () => {
      await expect(result.current.createEpic({
        title: "Blocked Campaign",
        target_days: 21,
        habits: [
          {
            title: "Evening reflection",
            difficulty: "easy",
            frequency: "daily",
            custom_days: [0, 1, 2, 3, 4, 5, 6],
          },
        ],
      })).rejects.toThrow(ACTIVE_CAMPAIGN_LIMIT_MESSAGE);
    });

    expect(mocks.rpcMock).not.toHaveBeenCalled();
  });

  it("blocks campaign creation when the remote active campaign count is already at the limit", async () => {
    const activeEpics = Array.from({ length: ACTIVE_CAMPAIGN_LIMIT - 1 }, (_, index) =>
      buildActiveEpic(`epic-${index + 1}`)
    );
    const habitsInsertMock = vi.fn().mockResolvedValue({ error: null });
    const epicsInsertMock = vi.fn().mockResolvedValue({ error: null });

    mocks.loadLocalEpicsMock.mockResolvedValue(activeEpics);
    mocks.warmEpicsQueryFromRemoteMock.mockImplementationOnce(async (queryClient: QueryClient, userId: string) => {
      queryClient.setQueryData(["epics", userId], activeEpics);
      return activeEpics;
    });
    mocks.rpcMock.mockResolvedValue({ data: ACTIVE_CAMPAIGN_LIMIT, error: null });

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

      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
        select: mocks.selectMock,
      };
    });

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.activeEpics).toHaveLength(ACTIVE_CAMPAIGN_LIMIT - 1);
    });

    await act(async () => {
      await expect(result.current.createEpic({
        title: "Remote Blocked Campaign",
        target_days: 14,
        habits: [
          {
            title: "Morning focus",
            difficulty: "easy",
            frequency: "daily",
            custom_days: [1, 2, 3, 4, 5],
          },
        ],
      })).rejects.toThrow(ACTIVE_CAMPAIGN_LIMIT_MESSAGE);
    });

    expect(mocks.rpcMock).toHaveBeenCalledWith("count_user_epics", {
      p_user_id: "user-1",
    });
    expect(habitsInsertMock).not.toHaveBeenCalled();
    expect(epicsInsertMock).not.toHaveBeenCalled();
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
    const dailyTasksRollbackDeleteMock = createDailyTasksRollbackDeleteMock();

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

      if (table === "daily_tasks") {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
          delete: dailyTasksRollbackDeleteMock.deleteMock,
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

      return createDefaultSupabaseTableMock();
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
    expect(dailyTasksRollbackDeleteMock.inHabitSourceMock).toHaveBeenCalledWith("habit_source_id", expect.any(Array));
    expect(dailyTasksRollbackDeleteMock.eqUserMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(dailyTasksRollbackDeleteMock.isCompletedAtMock).toHaveBeenCalledWith("completed_at", null);
    expect(dailyTasksRollbackDeleteMock.orCompletedMock).toHaveBeenCalledWith("completed.is.null,completed.eq.false");
    expect(deleteHabitsInMock).toHaveBeenCalled();
    expect(dailyTasksRollbackDeleteMock.orCompletedMock.mock.invocationCallOrder[0])
      .toBeLessThan(deleteHabitsInMock.mock.invocationCallOrder[0]);
    expect(deleteEpicsEqIdMock).toHaveBeenCalledWith("id", expect.any(String));
    expect(deleteEpicsEqUserMock).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("normalizes milestone percents and deletes linked incomplete tasks before habit rollback when milestone insert fails", async () => {
    const habitsInsertMock = vi.fn().mockResolvedValue({ error: null });
    const epicsInsertMock = vi.fn().mockResolvedValue({ error: null });
    const linksInsertMock = vi.fn().mockResolvedValue({ error: null });
    const phasesInsertMock = vi.fn().mockResolvedValue({ error: null });
    const milestonesInsertMock = vi.fn().mockResolvedValue({
      error: {
        code: "22P02",
        message: 'invalid input syntax for type integer: "33.33"',
        status: 400,
      },
    });
    const deleteEpicHabitsInMock = vi.fn().mockResolvedValue({ error: null });
    const deleteChildEqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteChildInMock = vi.fn().mockReturnValue({ eq: deleteChildEqMock });
    const deleteHabitsEqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteHabitsInMock = vi.fn().mockReturnValue({ eq: deleteHabitsEqMock });
    const deleteEpicsEqUserMock = vi.fn().mockResolvedValue({ error: null });
    const deleteEpicsEqIdMock = vi.fn().mockReturnValue({ eq: deleteEpicsEqUserMock });
    const dailyTasksRollbackDeleteMock = createDailyTasksRollbackDeleteMock();

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
          insert: linksInsertMock,
          delete: vi.fn().mockReturnValue({ in: deleteEpicHabitsInMock }),
          select: mocks.selectMock,
        };
      }

      if (table === "journey_phases") {
        return {
          insert: phasesInsertMock,
          delete: vi.fn().mockReturnValue({ in: deleteChildInMock }),
          select: mocks.selectMock,
        };
      }

      if (table === "epic_milestones") {
        return {
          insert: milestonesInsertMock,
          delete: vi.fn().mockReturnValue({ in: deleteChildInMock }),
          select: mocks.selectMock,
        };
      }

      if (table === "daily_tasks") {
        return {
          delete: dailyTasksRollbackDeleteMock.deleteMock,
          select: mocks.selectMock,
        };
      }

      return createDefaultSupabaseTableMock();
    });

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.createEpic({
        title: "Broken Milestones Campaign",
        target_days: 90,
        habits: [
          {
            title: "Daily running journal",
            difficulty: "medium",
            frequency: "daily",
            custom_days: [0, 1, 2, 3, 4, 5, 6],
          },
        ],
        phases: [
          {
            name: "Base",
            description: "Build base miles.",
            start_date: "2026-04-28",
            end_date: "2026-05-28",
            phase_order: 1,
          },
        ],
        milestones: [
          {
            title: "First third",
            target_date: "2026-05-28",
            milestone_percent: 33.33,
            is_postcard_milestone: true,
          },
          {
            title: "Second third",
            target_date: "2026-06-27",
            milestone_percent: 66.67,
            is_postcard_milestone: true,
          },
          {
            title: "Finish",
            target_date: "2026-07-27",
            milestone_percent: 100,
            is_postcard_milestone: true,
          },
        ],
      })).rejects.toMatchObject({
        code: "22P02",
      });
    });

    const milestonePayload = milestonesInsertMock.mock.calls[0]?.[0] as Array<{ milestone_percent: number }>;

    expect(milestonePayload.map((milestone) => milestone.milestone_percent)).toEqual([33, 67, 100]);
    expect(dailyTasksRollbackDeleteMock.inHabitSourceMock).toHaveBeenCalledWith("habit_source_id", expect.any(Array));
    expect(dailyTasksRollbackDeleteMock.eqUserMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(dailyTasksRollbackDeleteMock.isCompletedAtMock).toHaveBeenCalledWith("completed_at", null);
    expect(dailyTasksRollbackDeleteMock.orCompletedMock).toHaveBeenCalledWith("completed.is.null,completed.eq.false");
    expect(dailyTasksRollbackDeleteMock.orCompletedMock.mock.invocationCallOrder[0])
      .toBeLessThan(deleteHabitsInMock.mock.invocationCallOrder[0]);
  });

  it("reuses remembered campaign ids on retry after a failed create confirmation", async () => {
    const habitsInsertMock = vi.fn().mockResolvedValue({ error: null });
    const habitsUpsertMock = vi.fn().mockResolvedValue({ error: null });
    const epicsInsertMock = vi.fn().mockResolvedValueOnce({
      error: { message: "schema cache stale", status: 400 },
    });
    const epicsUpsertMock = vi.fn().mockResolvedValue({ error: null });
    const linksUpsertMock = vi.fn().mockResolvedValue({ error: null });
    const deleteEpicHabitsInMock = vi.fn().mockResolvedValue({ error: null });
    const deleteHabitsEqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteHabitsInMock = vi.fn().mockReturnValue({ eq: deleteHabitsEqMock });
    const deleteEpicsEqUserMock = vi.fn().mockResolvedValue({ error: null });
    const deleteEpicsEqIdMock = vi.fn().mockReturnValue({ eq: deleteEpicsEqUserMock });
    const dailyTasksRollbackDeleteMock = createDailyTasksRollbackDeleteMock();

    mocks.fromMock.mockImplementation((table: string) => {
      if (table === "habits") {
        return {
          insert: habitsInsertMock,
          upsert: habitsUpsertMock,
          delete: vi.fn().mockReturnValue({ in: deleteHabitsInMock }),
          select: mocks.selectMock,
        };
      }

      if (table === "epics") {
        return {
          insert: epicsInsertMock,
          upsert: epicsUpsertMock,
          delete: vi.fn().mockReturnValue({ eq: deleteEpicsEqIdMock }),
          select: mocks.selectMock,
        };
      }

      if (table === "epic_habits") {
        return {
          upsert: linksUpsertMock,
          delete: vi.fn().mockReturnValue({ in: deleteEpicHabitsInMock }),
          select: mocks.selectMock,
        };
      }

      if (table === "daily_tasks") {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
          delete: dailyTasksRollbackDeleteMock.deleteMock,
          select: mocks.selectMock,
        };
      }

      return createDefaultSupabaseTableMock();
    });

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const input = {
      title: "Retry Idempotent Campaign",
      target_days: 14,
      habits: [
        {
          title: "Retry focus ritual",
          difficulty: "easy",
          frequency: "daily",
          custom_days: [1, 2, 3, 4, 5],
        },
      ],
    };

    await act(async () => {
      await expect(result.current.createEpic(input)).rejects.toMatchObject({
        status: 400,
      });
    });

    const firstHabitPayload = habitsInsertMock.mock.calls[0]?.[0];
    const firstEpicPayload = epicsInsertMock.mock.calls[0]?.[0];

    await act(async () => {
      await result.current.createEpic(input);
    });

    expect(habitsInsertMock).toHaveBeenCalledTimes(1);
    expect(epicsInsertMock).toHaveBeenCalledTimes(1);
    expect(habitsUpsertMock).toHaveBeenCalledTimes(1);
    expect(epicsUpsertMock).toHaveBeenCalledTimes(1);
    expect(linksUpsertMock).toHaveBeenCalledTimes(1);
    expect(habitsUpsertMock.mock.calls[0]?.[0]?.[0]?.id).toBe(firstHabitPayload?.[0]?.id);
    expect(epicsUpsertMock.mock.calls[0]?.[0]?.id).toBe(firstEpicPayload?.id);
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

      return createDefaultSupabaseTableMock();
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

      return createDefaultSupabaseTableMock();
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

  it("updates campaign metadata and keeps local task campaign titles in sync", async () => {
    let localEpics = [
      {
        id: "epic-1",
        user_id: "user-1",
        title: "Campaign Alpha",
        description: "Old description",
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

      return createDefaultSupabaseTableMock();
    });

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.activeEpics[0]?.title).toBe("Campaign Alpha");
    });

    await act(async () => {
      await result.current.updateEpic({
        epicId: "epic-1",
        updates: {
          title: "Campaign Nova",
          description: "New description",
        },
      });
    });

    expect(updateMock).toHaveBeenCalledWith({
      title: "Campaign Nova",
      description: "New description",
    });
    expect(localEpics[0]).toMatchObject({
      title: "Campaign Nova",
      description: "New description",
    });
    expect(localTasks[0]?.epic_title).toBe("Campaign Nova");
  });

  it("hard deletes a campaign locally, preserves completed history, and queues EPIC_DELETE offline", async () => {
    let localEpics = [
      {
        id: "epic-1",
        user_id: "user-1",
        title: "Campaign Alpha",
        description: "Old description",
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
        id: "task-open",
        user_id: "user-1",
        habit_source_id: "habit-1",
        epic_id: "epic-1",
        epic_title: "Campaign Alpha",
        task_date: "2026-02-14",
        completed: false,
        completed_at: null,
      },
      {
        id: "task-complete",
        user_id: "user-1",
        habit_source_id: "habit-1",
        epic_id: "epic-1",
        epic_title: "Campaign Alpha",
        task_date: "2026-02-10",
        completed: true,
        completed_at: "2026-02-10T12:00:00.000Z",
      },
    ];
    let localHabits = [
      {
        id: "habit-1",
        user_id: "user-1",
        title: "Morning focus",
        description: null,
        difficulty: "easy",
        frequency: "daily",
        custom_days: [],
        custom_month_days: null,
        preferred_time: null,
        reminder_enabled: false,
        reminder_minutes_before: 15,
        estimated_minutes: 15,
        category: null,
        is_active: true,
        current_streak: 0,
        longest_streak: 0,
        created_at: "2026-02-01T00:00:00.000Z",
      },
    ];
    let localEpicHabits = [
      {
        id: "link-1",
        epic_id: "epic-1",
        habit_id: "habit-1",
      },
    ];
    let localJourneyPaths = [
      {
        id: "path-1",
        epic_id: "epic-1",
        user_id: "user-1",
      },
    ];
    let localCompletions = [
      {
        id: "completion-1",
        habit_id: "habit-1",
        user_id: "user-1",
        date: "2026-02-10",
      },
    ];

    mocks.shouldQueueWrites = true;
    mocks.loadLocalEpicsMock.mockImplementation(async () => localEpics);
    mocks.getAllLocalTasksForUserMock.mockImplementation(async () => localTasks);
    mocks.getLocalHabitsMock.mockImplementation(async () => localHabits);
    mocks.getLocalEpicHabitsMock.mockImplementation(async () => localEpicHabits);
    mocks.getLocalJourneyPathsMock.mockImplementation(async () => localJourneyPaths);
    mocks.getLocalHabitCompletionsMock.mockImplementation(async () => localCompletions);
    mocks.warmEpicsQueryFromRemoteMock.mockImplementationOnce(async (queryClient: QueryClient, userId: string) => {
      queryClient.setQueryData(["epics", userId], localEpics);
      return localEpics;
    });
    mocks.removePlannerRecordMock.mockImplementation(async (storeName: string, recordId: string) => {
      if (storeName === "epics") {
        localEpics = localEpics.filter((epic) => epic.id !== recordId);
      }
    });
    mocks.removePlannerRecordsMock.mockImplementation(async (storeName: string, recordIds: string[]) => {
      if (storeName === "daily_tasks") {
        localTasks = localTasks.filter((task) => !recordIds.includes(task.id));
      }
      if (storeName === "habits") {
        localHabits = localHabits.filter((habit) => !recordIds.includes(habit.id));
      }
      if (storeName === "epic_habits") {
        localEpicHabits = localEpicHabits.filter((link) => !recordIds.includes(link.id));
      }
      if (storeName === "epic_journey_paths") {
        localJourneyPaths = localJourneyPaths.filter((path) => !recordIds.includes(path.id));
      }
      if (storeName === "habit_completions") {
        localCompletions = localCompletions.filter((completion) => !recordIds.includes(completion.id));
      }
    });
    mocks.upsertPlannerRecordsMock.mockImplementation(async (storeName: string, records: typeof localTasks) => {
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
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.activeEpics[0]?.id).toBe("epic-1");
    });

    await act(async () => {
      await result.current.deleteEpic({ epicId: "epic-1" });
    });

    await waitFor(() => {
      expect(result.current.activeEpics).toHaveLength(0);
    });

    expect(localTasks).toEqual([
      expect.objectContaining({
        id: "task-complete",
        epic_id: null,
        epic_title: null,
        habit_source_id: null,
      }),
    ]);
    expect(localHabits).toHaveLength(0);
    expect(localEpicHabits).toHaveLength(0);
    expect(localJourneyPaths).toHaveLength(0);
    expect(localCompletions).toHaveLength(0);
    expect(mocks.queueActionMock).toHaveBeenCalledWith({
      actionKind: "EPIC_DELETE",
      entityType: "epic",
      entityId: "epic-1",
      payload: {
        epicId: "epic-1",
        epicTitle: "Campaign Alpha",
        epicCreatedAt: "2026-02-10T00:00:00.000Z",
      },
    });
    expect(mocks.withPlannerRemoteSyncLockMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["calendar-tasks"],
    });
  });

  it("deletes a campaign ritual locally before it can leak into planner context", async () => {
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
      epic_habits: [],
    };
    let localHabits = [
      {
        id: "habit-hydration",
        user_id: "user-1",
        title: "Daily Hydration",
        description: null,
        difficulty: "easy",
        frequency: "daily",
        custom_days: [],
        custom_month_days: null,
        preferred_time: null,
        reminder_enabled: false,
        reminder_minutes_before: 15,
        estimated_minutes: 5,
        category: null,
        is_active: true,
        current_streak: 0,
        longest_streak: 0,
        created_at: "2026-02-01T00:00:00.000Z",
      },
    ];
    let localEpicHabits = [
      {
        id: "link-hydration",
        epic_id: "epic-1",
        habit_id: "habit-hydration",
      },
    ];
    let localTasks = [
      {
        id: "task-hydration-open",
        user_id: "user-1",
        habit_source_id: "habit-hydration",
        epic_id: "epic-1",
        epic_title: "Campaign Alpha",
        task_date: "2026-04-30",
        completed: false,
        completed_at: null,
      },
      {
        id: "task-hydration-complete",
        user_id: "user-1",
        habit_source_id: "habit-hydration",
        epic_id: "epic-1",
        epic_title: "Campaign Alpha",
        task_date: "2026-04-29",
        completed: true,
        completed_at: "2026-04-29T12:00:00.000Z",
      },
    ];
    let localCompletions = [
      {
        id: "completion-hydration",
        habit_id: "habit-hydration",
        user_id: "user-1",
        date: "2026-04-29",
      },
    ];
    const loadEpicsFromLocalState = () => [{
      ...baseEpic,
      epic_habits: localEpicHabits.map((link) => ({
        habit_id: link.habit_id,
        habits: localHabits.find((habit) => habit.id === link.habit_id) ?? null,
      })),
    }];

    mocks.shouldQueueWrites = true;
    mocks.loadLocalEpicsMock.mockImplementation(async () => loadEpicsFromLocalState());
    mocks.getLocalEpicHabitsMock.mockImplementation(async () => localEpicHabits);
    mocks.getAllLocalTasksForUserMock.mockImplementation(async () => localTasks);
    mocks.getLocalHabitCompletionsMock.mockImplementation(async () => localCompletions);
    mocks.removePlannerRecordMock.mockImplementation(async (storeName: string, recordId: string) => {
      if (storeName === "habits") {
        localHabits = localHabits.filter((habit) => habit.id !== recordId);
      }
    });
    mocks.removePlannerRecordsMock.mockImplementation(async (storeName: string, recordIds: string[]) => {
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
    mocks.upsertPlannerRecordsMock.mockImplementation(async (storeName: string, records: typeof localTasks) => {
      if (storeName === "daily_tasks") {
        const updatesById = new Map(records.map((record) => [record.id, record]));
        localTasks = localTasks.map((task) => updatesById.get(task.id) ?? task);
      }
    });
    mocks.warmEpicsQueryFromRemoteMock.mockImplementationOnce(async (queryClient: QueryClient, userId: string) => {
      const epics = loadEpicsFromLocalState();
      queryClient.setQueryData(["epics", userId], epics);
      return epics;
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const dailyTaskCacheKey = ["daily-tasks", "user-1", "2026-04-30"];
    const calendarTaskCacheKey = [
      "calendar-tasks",
      "user-1",
      "2026-04-26",
      "2026-05-02",
      "week",
    ];
    queryClient.setQueryData(dailyTaskCacheKey, localTasks);
    queryClient.setQueryData(calendarTaskCacheKey, localTasks);

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.activeEpics[0]?.epic_habits).toHaveLength(1);
    });

    await act(async () => {
      await result.current.deleteCampaignRitual({
        epicId: "epic-1",
        habitId: "habit-hydration",
      });
    });

    await waitFor(() => {
      expect(result.current.activeEpics[0]?.epic_habits).toHaveLength(0);
    });

    expect(localTasks).toEqual([
      expect.objectContaining({
        id: "task-hydration-complete",
        epic_id: null,
        epic_title: null,
        habit_source_id: null,
      }),
    ]);
    expect(localHabits).toHaveLength(0);
    expect(localEpicHabits).toHaveLength(0);
    expect(localCompletions).toHaveLength(0);
    expect(queryClient.getQueryData(dailyTaskCacheKey)).toEqual([
      expect.objectContaining({
        id: "task-hydration-complete",
        epic_id: null,
        epic_title: null,
        habit_source_id: null,
      }),
    ]);
    expect(queryClient.getQueryData(calendarTaskCacheKey)).toEqual([
      expect.objectContaining({
        id: "task-hydration-complete",
        epic_id: null,
        epic_title: null,
        habit_source_id: null,
      }),
    ]);
    expect(mocks.queueActionMock).toHaveBeenCalledWith({
      actionKind: "EPIC_RITUAL_DELETE",
      entityType: "epic",
      entityId: "epic-1",
      payload: {
        epicId: "epic-1",
        habitId: "habit-hydration",
      },
    });
    expect(mocks.dispatchPlannerSyncFinishedMock).toHaveBeenCalled();
  });

  it("refuses to delete a habit that is not linked to the campaign", async () => {
    const localEpics = [{
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
    }];
    const localHabits = [{
      id: "habit-loose",
      user_id: "user-1",
      title: "Loose habit",
      description: null,
      difficulty: "easy",
      frequency: "daily",
      custom_days: [],
      custom_month_days: null,
      preferred_time: null,
      reminder_enabled: false,
      reminder_minutes_before: 15,
      estimated_minutes: 5,
      category: null,
      is_active: true,
      current_streak: 0,
      longest_streak: 0,
      created_at: "2026-02-01T00:00:00.000Z",
    }];

    mocks.shouldQueueWrites = true;
    mocks.loadLocalEpicsMock.mockImplementation(async () => localEpics);
    mocks.getLocalEpicHabitsMock.mockImplementation(async () => []);
    mocks.getAllLocalTasksForUserMock.mockImplementation(async () => []);
    mocks.getLocalHabitCompletionsMock.mockImplementation(async () => []);
    mocks.warmEpicsQueryFromRemoteMock.mockImplementationOnce(async (queryClient: QueryClient, userId: string) => {
      queryClient.setQueryData(["epics", userId], localEpics);
      return localEpics;
    });

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.activeEpics[0]?.id).toBe("epic-1");
    });

    let caughtError: unknown = null;
    await act(async () => {
      try {
        await result.current.deleteCampaignRitual({
          epicId: "epic-1",
          habitId: "habit-loose",
        });
      } catch (error) {
        caughtError = error;
      }
    });

    expect(caughtError).toEqual(expect.objectContaining({
      message: "Campaign ritual link not found",
    }));
    expect(localHabits).toHaveLength(1);
    expect(mocks.removePlannerRecordMock).not.toHaveBeenCalledWith(
      "habits",
      "habit-loose",
    );
    expect(mocks.queueActionMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        actionKind: "EPIC_RITUAL_DELETE",
      }),
    );
  });

  it("unlinks a campaign habit with lock protection and detaches cached task campaign metadata", async () => {
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
    let localEpicHabits = [
      {
        id: "link-1",
        epic_id: "epic-1",
        habit_id: "habit-linked",
      },
    ];
    let localTasks = [
      {
        id: "task-linked",
        user_id: "user-1",
        habit_source_id: "habit-linked",
        epic_id: "epic-1",
        epic_title: "Campaign Alpha",
        task_date: "2026-04-30",
        completed: false,
        completed_at: null,
      },
    ];
    const loadEpicsFromLocalState = () => [{
      ...baseEpic,
      epic_habits: localEpicHabits.map((link) => ({
        habit_id: link.habit_id,
        habits: {
          id: link.habit_id,
          title: "Linked habit",
          difficulty: "easy",
        },
      })),
    }];

    mocks.shouldQueueWrites = true;
    mocks.loadLocalEpicsMock.mockImplementation(async () => loadEpicsFromLocalState());
    mocks.getLocalEpicHabitsMock.mockImplementation(async () => localEpicHabits);
    mocks.getAllLocalTasksForUserMock.mockImplementation(async () => localTasks);
    mocks.removePlannerRecordsMock.mockImplementation(async (storeName: string, recordIds: string[]) => {
      if (storeName === "epic_habits") {
        localEpicHabits = localEpicHabits.filter((link) => !recordIds.includes(link.id));
      }
    });
    mocks.upsertPlannerRecordsMock.mockImplementation(async (storeName: string, records: typeof localTasks) => {
      if (storeName === "daily_tasks") {
        const updatesById = new Map(records.map((record) => [record.id, record]));
        localTasks = localTasks.map((task) => updatesById.get(task.id) ?? task);
      }
    });
    mocks.warmEpicsQueryFromRemoteMock.mockImplementationOnce(async (queryClient: QueryClient, userId: string) => {
      queryClient.setQueryData(["epics", userId], loadEpicsFromLocalState());
      return loadEpicsFromLocalState();
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const dailyTaskCacheKey = ["daily-tasks", "user-1", "2026-04-30"];
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

    const { result } = renderHook(() => useEpics(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.activeEpics[0]?.epic_habits).toHaveLength(1);
    });

    act(() => {
      result.current.removeHabitFromEpic({
        epicId: "epic-1",
        habitId: "habit-linked",
      });
    });

    await waitFor(() => {
      expect(mocks.queueActionMock).toHaveBeenCalledWith({
        actionKind: "EPIC_HABIT_UNLINK",
        entityType: "epic",
        entityId: "epic-1",
        payload: {
          epicId: "epic-1",
          habitId: "habit-linked",
        },
      });
    });

    expect(localEpicHabits).toHaveLength(0);
    expect(localTasks).toEqual([
      expect.objectContaining({
        id: "task-linked",
        epic_id: null,
        epic_title: null,
        habit_source_id: "habit-linked",
      }),
    ]);
    expect(queryClient.getQueryData(dailyTaskCacheKey)).toEqual([
      expect.objectContaining({
        id: "task-linked",
        epic_id: null,
        epic_title: null,
        habit_source_id: "habit-linked",
      }),
    ]);
    expect(queryClient.getQueryData(calendarTaskCacheKey)).toEqual([
      expect.objectContaining({
        id: "task-linked",
        epic_id: null,
        epic_title: null,
        habit_source_id: "habit-linked",
      }),
    ]);
    expect(mocks.withPlannerRemoteSyncLockMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["daily-tasks"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["calendar-tasks"] });
    expect(mocks.dispatchPlannerSyncFinishedMock).toHaveBeenCalled();
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
    const dailyTasksUpsertMock = vi.fn().mockResolvedValue({ error: null });

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

      if (table === "daily_tasks") {
        return {
          upsert: dailyTasksUpsertMock,
          select: mocks.selectMock,
        };
      }

      return createDefaultSupabaseTableMock();
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
        preferredTime: "19:00",
        estimatedMinutes: 30,
      });
    });

    const cachedEpics = queryClient.getQueryData<Array<{ epic_habits: Array<{ habits: { title?: string } | null }> }>>(["epics", "user-1"]);
    expect(cachedEpics?.[0]?.epic_habits.some((link) => link.habits?.title === "Evening Walk")).toBe(true);
    expect(mocks.upsertPlannerRecordMock).toHaveBeenCalledWith(
      "habits",
      expect.objectContaining({
        title: "Evening Walk",
        frequency: "daily",
        preferred_time: "19:00",
        estimated_minutes: 30,
      }),
    );
    expect(mocks.upsertPlannerRecordsMock).toHaveBeenCalledWith(
      "daily_tasks",
      expect.arrayContaining([
        expect.objectContaining({
          task_text: "Evening Walk",
          scheduled_time: "19:00",
          estimated_duration: 30,
          habit_source_id: expect.any(String),
          epic_id: "epic-1",
        }),
      ]),
    );
    expect(dailyTasksUpsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          task_text: "Evening Walk",
          scheduled_time: "19:00",
          estimated_duration: 30,
          habit_source_id: expect.any(String),
          epic_id: "epic-1",
        }),
      ]),
      expect.objectContaining({
        onConflict: "user_id,task_date,habit_source_id",
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
    const deleteTaskCompletedOrMock = vi.fn().mockResolvedValue({ error: null });
    const deleteTaskCompletedAtIsMock = vi.fn().mockReturnValue({ or: deleteTaskCompletedOrMock });
    const deleteTaskUserEqMock = vi.fn().mockReturnValue({ is: deleteTaskCompletedAtIsMock });
    const deleteTaskHabitEqMock = vi.fn().mockReturnValue({ eq: deleteTaskUserEqMock });

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

      if (table === "daily_tasks") {
        return {
          delete: () => ({
            eq: deleteTaskHabitEqMock,
          }),
          select: mocks.selectMock,
        };
      }

      return createDefaultSupabaseTableMock();
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

      return createDefaultSupabaseTableMock();
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
  it("returns campaign-limit messaging for active-epics backend errors", () => {
    const result = normalizeCreateCampaignError(
      `User can only have ${ACTIVE_CAMPAIGN_LIMIT} active epics at a time`
    );

    expect(result.title).toBe("Campaign limit reached");
    expect(result.description).toContain(`${ACTIVE_CAMPAIGN_LIMIT} active campaigns`);
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

  it("returns a dedicated message for invalid milestone percent errors", () => {
    const result = normalizeCreateCampaignError({
      code: "22P02",
      message: 'invalid input syntax for type integer: "33.33"',
    });

    expect(result.title).toBe("Campaign plan needs an update");
  });
});
