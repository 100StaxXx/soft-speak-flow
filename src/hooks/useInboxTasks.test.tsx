import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const fromMock = vi.fn();
  const selectMock = vi.fn();
  const eqUserIdMock = vi.fn();
  const isTaskDateMock = vi.fn();
  const eqCompletedMock = vi.fn();
  const orderCreatedAtMock = vi.fn();

  return {
    fromMock,
    selectMock,
    eqUserIdMock,
    isTaskDateMock,
    eqCompletedMock,
    orderCreatedAtMock,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mocks.fromMock(...args),
  },
}));

import { useInboxTasks } from "./useInboxTasks";

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

describe("useInboxTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.fromMock.mockReturnValue({
      select: mocks.selectMock,
    });
    mocks.selectMock.mockReturnValue({
      eq: mocks.eqUserIdMock,
    });
    mocks.eqUserIdMock.mockReturnValue({
      is: mocks.isTaskDateMock,
    });
    mocks.isTaskDateMock.mockReturnValue({
      eq: mocks.eqCompletedMock,
    });
    mocks.eqCompletedMock.mockReturnValue({
      order: mocks.orderCreatedAtMock,
    });
    mocks.orderCreatedAtMock.mockResolvedValue({
      data: [],
      error: null,
    });
  });

  it("does not fetch inbox tasks when disabled", () => {
    const { result } = renderHook(() => useInboxTasks({ enabled: false }), {
      wrapper: createWrapper(),
    });

    expect(result.current.inboxTasks).toEqual([]);
    expect(mocks.fromMock).not.toHaveBeenCalled();
  });
});
