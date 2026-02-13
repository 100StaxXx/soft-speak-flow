import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const selectMock = vi.fn();
  const eqTaskIdMock = vi.fn();
  const eqUserIdMock = vi.fn();
  const orderMock = vi.fn();
  const updateMock = vi.fn();
  const updateEqMock = vi.fn();

  return {
    selectMock,
    eqTaskIdMock,
    eqUserIdMock,
    orderMock,
    updateMock,
    updateEqMock,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mocks.selectMock,
      update: mocks.updateMock,
    })),
  },
}));

import { useSubtasks } from "./useSubtasks";

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useSubtasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.selectMock.mockReturnValue({
      eq: mocks.eqTaskIdMock,
    });

    mocks.eqTaskIdMock.mockReturnValue({
      eq: mocks.eqUserIdMock,
    });

    mocks.eqUserIdMock.mockReturnValue({
      order: mocks.orderMock,
    });

    mocks.orderMock.mockResolvedValue({
      data: [],
      error: null,
    });

    mocks.updateMock.mockReturnValue({
      eq: mocks.updateEqMock,
    });

    mocks.updateEqMock.mockResolvedValue({
      error: null,
    });
  });

  it("invalidates both subtasks and daily-tasks after toggle", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSubtasks("task-1"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.toggleSubtask({ subtaskId: "subtask-1", completed: true });
    });

    await waitFor(() => {
      expect(mocks.updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          completed: true,
          completed_at: expect.any(String),
        })
      );
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["subtasks", "task-1"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["daily-tasks"] });
    });
  });
});
