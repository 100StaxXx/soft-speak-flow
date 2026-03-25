import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const updateMock = vi.fn();
  const updateEqMock = vi.fn();
  const getLocalSubtasksForTaskMock = vi.fn();
  const upsertPlannerRecordMock = vi.fn();
  const removePlannerRecordMock = vi.fn();

  return {
    updateMock,
    updateEqMock,
    getLocalSubtasksForTaskMock,
    upsertPlannerRecordMock,
    removePlannerRecordMock,
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
      update: mocks.updateMock,
    })),
  },
}));

vi.mock("@/contexts/ResilienceContext", () => ({
  useResilience: () => ({
    queueAction: vi.fn(),
    shouldQueueWrites: false,
    retryNow: vi.fn(),
  }),
}));

vi.mock("@/utils/plannerLocalStore", () => ({
  createOfflinePlannerId: () => "subtask-local",
  getLocalSubtasksForTask: (...args: unknown[]) => mocks.getLocalSubtasksForTaskMock(...args),
  removePlannerRecord: (...args: unknown[]) => mocks.removePlannerRecordMock(...args),
  upsertPlannerRecord: (...args: unknown[]) => mocks.upsertPlannerRecordMock(...args),
}));

import { useSubtasks } from "./useSubtasks";

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useSubtasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLocalSubtasksForTaskMock.mockResolvedValue([
      {
        id: "subtask-1",
        task_id: "task-1",
        user_id: "user-1",
        title: "First subtask",
        completed: false,
        completed_at: null,
        sort_order: 0,
        created_at: "2026-02-01T00:00:00.000Z",
      },
    ]);
    mocks.upsertPlannerRecordMock.mockResolvedValue(undefined);
    mocks.removePlannerRecordMock.mockResolvedValue(undefined);

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
