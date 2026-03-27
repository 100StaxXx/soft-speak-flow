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
  const warmEpicsQueryFromRemoteMock = vi.fn();

  return {
    fromMock,
    selectMock,
    eqUserIdMock,
    orderCreatedAtMock,
    loadLocalEpicsMock,
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
    queueAction: vi.fn(),
    shouldQueueWrites: false,
    retryNow: vi.fn(),
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mocks.fromMock(...args),
    auth: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("@/utils/plannerSync", () => ({
  PLANNER_SYNC_EVENT: "planner-sync-finished",
  loadLocalEpics: (...args: unknown[]) => mocks.loadLocalEpicsMock(...args),
  warmEpicsQueryFromRemote: (...args: unknown[]) => mocks.warmEpicsQueryFromRemoteMock(...args),
}));

import { normalizeCreateCampaignError, useEpics } from "./useEpics";

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
    mocks.loadLocalEpicsMock.mockResolvedValue([]);
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
