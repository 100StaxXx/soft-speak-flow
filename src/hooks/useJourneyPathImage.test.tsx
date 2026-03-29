import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const eqMock = vi.fn();
  const maybeSingleMock = vi.fn();
  const orderMock = vi.fn(() => ({
    limit: vi.fn(() => ({
      maybeSingle: maybeSingleMock,
    })),
  }));

  const selectMock = vi.fn(() => ({
    eq: eqMock,
    order: orderMock,
  }));

  eqMock.mockImplementation((column: string, value: unknown) => {
    if (column === "epic_id") {
      return {
        eq: (nextColumn: string, nextValue: unknown) => {
          if (nextColumn === "user_id") {
            return {
              order: orderMock,
            };
          }
          throw new Error(`Unexpected chained eq column: ${String(nextColumn)}=${String(nextValue)}`);
        },
      };
    }
    throw new Error(`Unexpected eq column: ${String(column)}=${String(value)}`);
  });

  return {
    selectMock,
    maybeSingleMock,
    invokeMock: vi.fn(),
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: (...args: unknown[]) => mocks.selectMock(...args),
    }),
    functions: {
      invoke: (...args: unknown[]) => mocks.invokeMock(...args),
    },
  },
}));

import { useJourneyPathImage } from "./useJourneyPathImage";

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

describe("useJourneyPathImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.maybeSingleMock.mockResolvedValue({ data: null, error: null });
    mocks.invokeMock.mockResolvedValue({ data: { success: true }, error: null });
  });

  it("generates paths without sending a userId override", async () => {
    const { result } = renderHook(() => useJourneyPathImage("epic-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.regeneratePathForMilestone(3);
    });

    expect(mocks.invokeMock).toHaveBeenCalledWith("generate-journey-path", {
      body: {
        epicId: "epic-1",
        milestoneIndex: 3,
      },
    });
  });
});
