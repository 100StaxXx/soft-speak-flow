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
  const rpcMock = vi.fn();
  let shouldQueueWrites = false;
  const warmEpicsQueryFromRemoteMock = vi.fn();

  return {
    fromMock,
    selectMock,
    eqUserIdMock,
    orderCreatedAtMock,
    loadLocalEpicsMock,
    queueActionMock,
    requestJourneyPathGenerationMock,
    retryNowMock,
    rpcMock,
    get shouldQueueWrites() {
      return shouldQueueWrites;
    },
    set shouldQueueWrites(value: boolean) {
      shouldQueueWrites = value;
    },
    warmEpicsQueryFromRemoteMock,
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
  loadLocalEpics: (...args: unknown[]) => mocks.loadLocalEpicsMock(...args),
  warmEpicsQueryFromRemote: (...args: unknown[]) => mocks.warmEpicsQueryFromRemoteMock(...args),
}));

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
    mocks.rpcMock.mockResolvedValue({ data: 0, error: null });
    mocks.warmEpicsQueryFromRemoteMock.mockResolvedValue([]);

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
