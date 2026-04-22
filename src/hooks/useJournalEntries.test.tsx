import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  fromMock: vi.fn(),
  queryCalls: [] as Array<{
    table: string;
    method: "eq" | "gte" | "lte" | "order";
    args: unknown[];
  }>,
  results: {
    user_reflections: {
      data: [] as unknown[],
      error: null as unknown,
    },
    evening_reflections: {
      data: [] as unknown[],
      error: null as unknown,
    },
    daily_check_ins: {
      data: [] as unknown[],
      error: null as unknown,
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mocks.fromMock(...args),
  },
}));

import { useJournalEntries } from "./useJournalEntries";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

const createTableBuilder = (table: keyof typeof mocks.results) => {
  let orderCount = 0;

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((...args: unknown[]) => {
      mocks.queryCalls.push({ table, method: "eq", args });
      return builder;
    }),
    gte: vi.fn((...args: unknown[]) => {
      mocks.queryCalls.push({ table, method: "gte", args });
      return builder;
    }),
    lte: vi.fn((...args: unknown[]) => {
      mocks.queryCalls.push({ table, method: "lte", args });
      return builder;
    }),
    order: vi.fn((...args: unknown[]) => {
      mocks.queryCalls.push({ table, method: "order", args });
      orderCount += 1;
      if (orderCount >= 2) {
        return mocks.results[table];
      }
      return builder;
    }),
  };

  return builder;
};

describe("useJournalEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: "user-1" };
    mocks.queryCalls.length = 0;
    mocks.results.user_reflections = {
      data: [],
      error: null,
    };
    mocks.results.evening_reflections = {
      data: [],
      error: null,
    };
    mocks.results.daily_check_ins = {
      data: [],
      error: null,
    };
    mocks.fromMock.mockImplementation((table: keyof typeof mocks.results) =>
      createTableBuilder(table)
    );
  });

  it("loads and sorts canonical journal entries across reflection sources", async () => {
    mocks.results.user_reflections = {
      data: [
        {
          id: "reflection-1",
          user_id: "user-1",
          reflection_date: "2026-04-20",
          mood: "calm",
          note: "Took a quiet walk.",
          ai_reply: "Keep making room for that.",
          created_at: "2026-04-20T09:00:00.000Z",
        },
      ],
      error: null,
    };
    mocks.results.evening_reflections = {
      data: [
        {
          id: "evening-1",
          user_id: "user-1",
          reflection_date: "2026-04-21",
          mood: "proud",
          wins: "Shipped the wrapper tests.",
          additional_reflection: "The migration stayed calm.",
          tomorrow_adjustment: "Start earlier.",
          gratitude: "Good review notes",
          mentor_response: "Nice pace.",
          created_at: "2026-04-21T08:00:00.000Z",
        },
      ],
      error: null,
    };
    mocks.results.daily_check_ins = {
      data: [
        {
          id: "check-in-1",
          user_id: "user-1",
          check_in_date: "2026-04-21",
          check_in_type: "morning",
          completed_at: null,
          created_at: "2026-04-21T10:00:00.000Z",
          intention: "Protect deep work",
          mentor_response: "Keep the lane clear.",
          mood: "steady",
          reflection: "Need less context switching.",
        },
      ],
      error: null,
    };

    const { result } = renderHook(
      () => useJournalEntries({
        startDate: "2026-04-19",
        endDate: "2026-04-22",
        limit: 2,
      }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.entries).toMatchObject([
      {
        id: "check-in-1",
        entryType: "daily_check_in",
        date: "2026-04-21",
      },
      {
        id: "evening-1",
        entryType: "evening_reflection",
        date: "2026-04-21",
      },
    ]);
    expect(mocks.queryCalls).toEqual(
      expect.arrayContaining([
        {
          table: "user_reflections",
          method: "gte",
          args: ["reflection_date", "2026-04-19"],
        },
        {
          table: "user_reflections",
          method: "lte",
          args: ["reflection_date", "2026-04-22"],
        },
        {
          table: "daily_check_ins",
          method: "gte",
          args: ["check_in_date", "2026-04-19"],
        },
        {
          table: "daily_check_ins",
          method: "lte",
          args: ["check_in_date", "2026-04-22"],
        },
      ]),
    );
  });

  it("supports filtering by entry type and morning check-ins", async () => {
    mocks.results.daily_check_ins = {
      data: [
        {
          id: "check-in-2",
          user_id: "user-1",
          check_in_date: "2026-04-22",
          check_in_type: "morning",
          completed_at: null,
          created_at: "2026-04-22T08:00:00.000Z",
          intention: "Stay focused",
          mentor_response: null,
          mood: "good",
          reflection: "Need a clean start",
        },
      ],
      error: null,
    };
    mocks.results.evening_reflections = {
      data: [
        {
          id: "evening-2",
          user_id: "user-1",
          reflection_date: "2026-04-21",
          mood: "calm",
          wins: "Finished review",
          additional_reflection: null,
          tomorrow_adjustment: "Sleep earlier",
          gratitude: null,
          mentor_response: null,
          created_at: "2026-04-21T21:00:00.000Z",
        },
      ],
      error: null,
    };

    const { result } = renderHook(
      () => useJournalEntries({
        entryTypes: ["daily_check_in", "evening_reflection"],
        checkInType: "morning",
      }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.entries.map((entry) => entry.id)).toEqual([
      "check-in-2",
      "evening-2",
    ]);
    expect(mocks.queryCalls).toEqual(
      expect.arrayContaining([
        {
          table: "daily_check_ins",
          method: "eq",
          args: ["check_in_type", "morning"],
        },
      ]),
    );
    expect(mocks.queryCalls.some((call) => call.table === "user_reflections")).toBe(false);
  });

  it("stays idle when no authenticated user is available", async () => {
    mocks.user = null;

    const { result } = renderHook(() => useJournalEntries(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.entries).toEqual([]);
    });

    expect(mocks.fromMock).not.toHaveBeenCalled();
  });
});
