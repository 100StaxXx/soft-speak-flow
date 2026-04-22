import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
  awardReflectionComplete: vi.fn(),
  loadReflection: vi.fn(),
  insertReflection: vi.fn(),
  invokeFunction: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/hooks/useXPRewards", () => ({
  useXPRewards: () => ({
    awardReflectionComplete: mocks.awardReflectionComplete,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table !== "evening_reflections") {
        throw new Error(`Unexpected table access: ${table}`);
      }

      const selectChain = {
        eq: vi.fn(() => selectChain),
        maybeSingle: mocks.loadReflection,
      };

      return {
        select: () => selectChain,
        insert: () => ({
          select: () => ({
            single: mocks.insertReflection,
          }),
        }),
      };
    },
    functions: {
      invoke: mocks.invokeFunction,
    },
  },
}));

import { useEveningReflection } from "./useEveningReflection";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  queryClient.invalidateQueries = ((filters: unknown) => {
    mocks.invalidateQueries(filters);
    return Promise.resolve();
  }) as typeof queryClient.invalidateQueries;

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useEveningReflection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: "user-1" };
    mocks.loadReflection.mockResolvedValue({ data: null, error: null });
    mocks.insertReflection.mockResolvedValue({
      data: { id: "reflection-1" },
      error: null,
    });
    mocks.invokeFunction.mockResolvedValue({ error: null });
  });

  it("invalidates canonical journal entries after a successful reflection save", async () => {
    const { result } = renderHook(() => useEveningReflection(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.submitReflection({
        mood: "calm",
        wins: "Closed the loop",
      });
    });

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["evening-reflection"],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["journal-entries"],
    });
    expect(mocks.awardReflectionComplete).toHaveBeenCalledTimes(1);
    expect(mocks.invokeFunction).toHaveBeenCalledWith("generate-evening-response", {
      body: { reflectionId: "reflection-1" },
    });
  });
});
