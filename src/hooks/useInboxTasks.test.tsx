import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const fromMock = vi.fn();
  const selectMock = vi.fn();
  const eqUserIdMock = vi.fn();
  const isTaskDateMock = vi.fn();
  const eqCompletedMock = vi.fn();
  const orderCreatedAtMock = vi.fn();
  const updateMock = vi.fn();
  const updateEqMock = vi.fn();
  const deleteMock = vi.fn();
  const deleteEqMock = vi.fn();

  return {
    fromMock,
    selectMock,
    eqUserIdMock,
    isTaskDateMock,
    eqCompletedMock,
    orderCreatedAtMock,
    updateMock,
    updateEqMock,
    deleteMock,
    deleteEqMock,
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

import {
  INBOX_COUNT_QUERY_KEY,
  INBOX_TASKS_QUERY_KEY,
  useInboxTasks,
} from "./useInboxTasks";

const createHarness = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, wrapper };
};

describe("useInboxTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.fromMock.mockReturnValue({
      select: mocks.selectMock,
      update: mocks.updateMock,
      delete: mocks.deleteMock,
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

    mocks.updateMock.mockReturnValue({
      eq: mocks.updateEqMock,
    });
    mocks.updateEqMock.mockResolvedValue({
      error: null,
    });

    mocks.deleteMock.mockReturnValue({
      eq: mocks.deleteEqMock,
    });
    mocks.deleteEqMock.mockResolvedValue({
      error: null,
    });
  });

  it("does not fetch inbox tasks when disabled", () => {
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useInboxTasks({ enabled: false }), {
      wrapper,
    });

    expect(result.current.inboxTasks).toEqual([]);
    expect(mocks.fromMock).not.toHaveBeenCalled();
  });

  it("invalidates inbox and daily tasks queries after toggling an inbox task", async () => {
    const { wrapper, queryClient } = createHarness();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useInboxTasks({ enabled: false }), { wrapper });

    act(() => {
      result.current.toggleInboxTask({ taskId: "task-1", completed: true });
    });

    await waitFor(() => {
      expect(mocks.updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          completed: true,
        }),
      );
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [INBOX_TASKS_QUERY_KEY] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [INBOX_COUNT_QUERY_KEY] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["daily-tasks"] });
    });
  });

  it("invalidates inbox and daily tasks queries after deleting an inbox task", async () => {
    const { wrapper, queryClient } = createHarness();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useInboxTasks({ enabled: false }), { wrapper });

    act(() => {
      result.current.deleteInboxTask("task-1");
    });

    await waitFor(() => {
      expect(mocks.deleteMock).toHaveBeenCalled();
      expect(mocks.deleteEqMock).toHaveBeenCalledWith("id", "task-1");
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [INBOX_TASKS_QUERY_KEY] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [INBOX_COUNT_QUERY_KEY] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["daily-tasks"] });
    });
  });
});
