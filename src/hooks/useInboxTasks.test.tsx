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
  const updateIsMock = vi.fn();
  const updateSelectMock = vi.fn();
  const updateMaybeSingleMock = vi.fn();
  const deleteMock = vi.fn();
  const deleteEqMock = vi.fn();
  const selectMaybeSingleMock = vi.fn();
  const queueTaskActionMock = vi.fn();
  const reportApiFailureMock = vi.fn();
  const triggerCompletionFeedbackMock = vi.fn();
  let shouldQueueWrites = false;

  return {
    fromMock,
    selectMock,
    eqUserIdMock,
    isTaskDateMock,
    eqCompletedMock,
    orderCreatedAtMock,
    updateMock,
    updateEqMock,
    updateIsMock,
    updateSelectMock,
    updateMaybeSingleMock,
    deleteMock,
    deleteEqMock,
    selectMaybeSingleMock,
    queueTaskActionMock,
    reportApiFailureMock,
    triggerCompletionFeedbackMock,
    get shouldQueueWrites() {
      return shouldQueueWrites;
    },
    set shouldQueueWrites(value: boolean) {
      shouldQueueWrites = value;
    },
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

vi.mock("@/contexts/ResilienceContext", () => ({
  useResilience: () => ({
    shouldQueueWrites: mocks.shouldQueueWrites,
    queueTaskAction: mocks.queueTaskActionMock,
    reportApiFailure: mocks.reportApiFailureMock,
  }),
}));

vi.mock("@/hooks/useCompletionFeedback", () => ({
  useCompletionFeedback: () => ({
    triggerCompletionFeedback: mocks.triggerCompletionFeedbackMock,
  }),
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
    mocks.shouldQueueWrites = false;

    mocks.fromMock.mockReturnValue({
      select: mocks.selectMock,
      update: mocks.updateMock,
      delete: mocks.deleteMock,
    });

    const selectChain = {
      eq: mocks.eqUserIdMock,
      is: mocks.isTaskDateMock,
      order: mocks.orderCreatedAtMock,
      maybeSingle: mocks.selectMaybeSingleMock,
    };
    mocks.selectMock.mockReturnValue(selectChain);
    mocks.eqUserIdMock.mockReturnValue(selectChain);
    mocks.isTaskDateMock.mockReturnValue(selectChain);
    mocks.eqCompletedMock.mockReturnValue(selectChain);
    mocks.orderCreatedAtMock.mockResolvedValue({
      data: [],
      error: null,
    });
    mocks.selectMaybeSingleMock.mockResolvedValue({
      data: {
        id: "task-1",
        task_text: "Inbox quest",
        task_date: null,
        scheduled_time: null,
        difficulty: "medium",
        category: "mind",
        habit_source_id: null,
        epic_id: null,
        completed: false,
        completed_at: null,
        epics: null,
      },
      error: null,
    });

    const updateChain = {
      eq: mocks.updateEqMock,
      is: mocks.updateIsMock,
      select: mocks.updateSelectMock,
      maybeSingle: mocks.updateMaybeSingleMock,
    };
    mocks.updateMock.mockReturnValue(updateChain);
    mocks.updateEqMock.mockReturnValue(updateChain);
    mocks.updateIsMock.mockReturnValue(updateChain);
    mocks.updateSelectMock.mockReturnValue(updateChain);
    mocks.updateMaybeSingleMock.mockResolvedValue({
      data: { id: "task-1" },
      error: null,
    });

    mocks.deleteMock.mockReturnValue({
      eq: mocks.deleteEqMock,
    });
    mocks.deleteEqMock.mockResolvedValue({
      error: null,
    });
    mocks.triggerCompletionFeedbackMock.mockResolvedValue(undefined);
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

    expect(mocks.triggerCompletionFeedbackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-1",
        taskTitle: "Inbox quest",
        completionSource: "inbox",
      }),
    );
  });

  it("does not update or trigger feedback for already-completed inbox tasks", async () => {
    mocks.selectMaybeSingleMock.mockResolvedValueOnce({
      data: {
        id: "task-1",
        task_text: "Inbox quest",
        task_date: null,
        scheduled_time: null,
        difficulty: "medium",
        category: "mind",
        habit_source_id: null,
        epic_id: null,
        completed: true,
        completed_at: "2026-04-29T16:00:00.000Z",
        epics: null,
      },
      error: null,
    });
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useInboxTasks({ enabled: false }), { wrapper });

    act(() => {
      result.current.toggleInboxTask({ taskId: "task-1", completed: true });
    });

    await waitFor(() => {
      expect(mocks.selectMaybeSingleMock).toHaveBeenCalled();
    });

    expect(mocks.updateMock).not.toHaveBeenCalled();
    expect(mocks.triggerCompletionFeedbackMock).not.toHaveBeenCalled();
  });

  it("queues inbox completion without fetching or triggering feedback while offline", async () => {
    mocks.shouldQueueWrites = true;
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useInboxTasks({ enabled: false }), { wrapper });

    act(() => {
      result.current.toggleInboxTask({ taskId: "task-1", completed: true });
    });

    await waitFor(() => {
      expect(mocks.queueTaskActionMock).toHaveBeenCalledWith(
        "COMPLETE_TASK",
        expect.objectContaining({
          taskId: "task-1",
          completed: true,
          completedAt: expect.any(String),
        }),
      );
    });

    expect(mocks.selectMock).not.toHaveBeenCalled();
    expect(mocks.updateMock).not.toHaveBeenCalled();
    expect(mocks.triggerCompletionFeedbackMock).not.toHaveBeenCalled();
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

  it("normalizes legacy prefixed inbox task IDs before delete", async () => {
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useInboxTasks({ enabled: false }), { wrapper });

    act(() => {
      result.current.deleteInboxTask("task-69dc5fc8-f625-4e17-8d71-401ed641124b");
    });

    await waitFor(() => {
      expect(mocks.deleteEqMock).toHaveBeenCalledWith("id", "69dc5fc8-f625-4e17-8d71-401ed641124b");
    });
  });
});
