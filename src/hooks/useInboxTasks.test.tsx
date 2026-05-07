import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { format } from "date-fns";
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
  const daySignalResponses: Array<{ data: unknown[] | null; error: unknown }> = [];
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
    daySignalResponses,
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
import {
  getCompletionFeedbackDaySignalTasksQueryKey,
  getCompletionFeedbackInboxTasksQueryKey,
  getCompletionFeedbackLocalCompletionsQueryKey,
} from "@/utils/completionFeedbackDaySignals";

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

const buildInboxTaskDetails = (overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
});

const normalizeSelection = (selection: unknown) =>
  typeof selection === "string" ? selection.replace(/\s+/g, " ").trim() : "";

const createDaySignalQuery = () => {
  const response = mocks.daySignalResponses.shift() ?? {
    data: [{ id: "task-1", completed: true, completed_at: "2026-02-20T12:00:00.000Z" }],
    error: null,
  };
  const chain = {
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    then: (resolve: (value: typeof response) => unknown, reject: (reason?: unknown) => unknown) =>
      Promise.resolve(response).then(resolve, reject),
    catch: (reject: (reason?: unknown) => unknown) => Promise.resolve(response).catch(reject),
    finally: (onFinally: () => void) => Promise.resolve(response).finally(onFinally),
  };
  return chain;
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
    mocks.daySignalResponses.length = 0;

    const selectChain = {
      eq: mocks.eqUserIdMock,
      is: mocks.isTaskDateMock,
      order: mocks.orderCreatedAtMock,
      maybeSingle: mocks.selectMaybeSingleMock,
    };
    mocks.selectMock.mockImplementation((selection?: string) => {
      if (normalizeSelection(selection) === "id, completed, completed_at") {
        return createDaySignalQuery();
      }
      return selectChain;
    });
    mocks.eqUserIdMock.mockReturnValue(selectChain);
    mocks.isTaskDateMock.mockReturnValue(selectChain);
    mocks.eqCompletedMock.mockReturnValue(selectChain);
    mocks.orderCreatedAtMock.mockResolvedValue({
      data: [],
      error: null,
    });
    mocks.selectMaybeSingleMock.mockResolvedValue({
      data: buildInboxTaskDetails(),
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

  it("passes day progress signals from the cached daily task list for inbox completions", async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { wrapper, queryClient } = createHarness();
    queryClient.setQueryData(["daily-tasks", "user-1", today], [
      { id: "task-2", completed: true, completed_at: `${today}T08:00:00.000Z` },
      { id: "task-3", completed: true, completed_at: `${today}T08:30:00.000Z` },
      { id: "task-4", completed: false, completed_at: null },
      { id: "task-5", completed: false, completed_at: null },
      { id: "task-6", completed: false, completed_at: null },
      { id: "task-7", completed: false, completed_at: null },
      { id: "task-8", completed: false, completed_at: null },
    ]);

    const { result } = renderHook(() => useInboxTasks({ enabled: false }), { wrapper });

    act(() => {
      result.current.toggleInboxTask({ taskId: "task-1", completed: true });
    });

    await waitFor(() => {
      expect(mocks.triggerCompletionFeedbackMock).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: "task-1",
          taskTitle: "Inbox quest",
          completionSource: "inbox",
          taskDate: null,
          isBuildingMomentum: true,
          isOverloaded: true,
        }),
      );
    });
  });

  it("passes first-completion signal for inbox completions when the cached day list is empty", async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { wrapper, queryClient } = createHarness();
    queryClient.setQueryData(["daily-tasks", "user-1", today], []);
    queryClient.setQueryData(getCompletionFeedbackDaySignalTasksQueryKey("user-1", today), []);

    const { result } = renderHook(() => useInboxTasks({ enabled: false }), { wrapper });

    act(() => {
      result.current.toggleInboxTask({ taskId: "task-1", completed: true });
    });

    await waitFor(() => {
      expect(mocks.triggerCompletionFeedbackMock).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: "task-1",
          taskTitle: "Inbox quest",
          completionSource: "inbox",
          firstCompletionToday: true,
          isBuildingMomentum: false,
          isOverloaded: false,
        }),
      );
    });
  });

  it("passes first-completion signal for inbox completions without a mounted daily task cache", async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { wrapper, queryClient } = createHarness();
    queryClient.setQueryData(getCompletionFeedbackDaySignalTasksQueryKey("user-1", today), []);
    const { result } = renderHook(() => useInboxTasks({ enabled: false }), { wrapper });

    act(() => {
      result.current.toggleInboxTask({ taskId: "task-1", completed: true });
    });

    await waitFor(() => {
      expect(mocks.triggerCompletionFeedbackMock).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: "task-1",
          taskTitle: "Inbox quest",
          completionSource: "inbox",
          firstCompletionToday: true,
          isBuildingMomentum: false,
          isOverloaded: false,
        }),
      );
    });
  });

  it("uses remote day signals instead of treating a missing daily cache as an empty day", async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { wrapper, queryClient } = createHarness();
    queryClient.setQueryData(getCompletionFeedbackDaySignalTasksQueryKey("user-1", today), [
      { id: "daily-done", completed: true, completed_at: `${today}T08:00:00.000Z` },
      { id: "task-1", completed: true, completed_at: `${today}T12:00:00.000Z` },
    ]);
    const { result } = renderHook(() => useInboxTasks({ enabled: false }), { wrapper });

    act(() => {
      result.current.toggleInboxTask({ taskId: "task-1", completed: true });
    });

    await waitFor(() => {
      expect(mocks.triggerCompletionFeedbackMock).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: "task-1",
          taskTitle: "Inbox quest",
          completionSource: "inbox",
          firstCompletionToday: false,
          isBuildingMomentum: false,
          isOverloaded: false,
        }),
      );
    });
  });

  it("omits day-progress buckets when neither remote signals nor a daily cache are available", async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { wrapper, queryClient } = createHarness();
    const { result } = renderHook(() => useInboxTasks({ enabled: false }), { wrapper });

    act(() => {
      result.current.toggleInboxTask({ taskId: "task-1", completed: true });
    });

    await waitFor(() => {
      expect(mocks.triggerCompletionFeedbackMock).toHaveBeenCalled();
    });

    const feedbackEvent = mocks.triggerCompletionFeedbackMock.mock.calls[0][0];
    expect(feedbackEvent).not.toHaveProperty("firstCompletionToday");
    expect(feedbackEvent).not.toHaveProperty("isBuildingMomentum");
    expect(feedbackEvent).not.toHaveProperty("isOverloaded");
    expect(queryClient.getQueryData(getCompletionFeedbackDaySignalTasksQueryKey("user-1", today)))
      .toBeUndefined();
  });

  it("does not treat local inbox completions as a fetched day-signal snapshot", async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { wrapper, queryClient } = createHarness();
    mocks.selectMaybeSingleMock
      .mockResolvedValueOnce({
        data: buildInboxTaskDetails({
          id: "task-1",
          task_text: "First inbox quest",
        }),
        error: null,
      })
      .mockResolvedValueOnce({
        data: buildInboxTaskDetails({
          id: "task-2",
          task_text: "Second inbox quest",
        }),
        error: null,
      });

    const { result } = renderHook(() => useInboxTasks({ enabled: false }), { wrapper });

    act(() => {
      result.current.toggleInboxTask({ taskId: "task-1", completed: true });
    });

    await waitFor(() => {
      expect(mocks.triggerCompletionFeedbackMock).toHaveBeenCalledTimes(1);
    });

    expect(queryClient.getQueryData(getCompletionFeedbackDaySignalTasksQueryKey("user-1", today)))
      .toBeUndefined();

    act(() => {
      result.current.toggleInboxTask({ taskId: "task-2", completed: true });
    });

    await waitFor(() => {
      expect(mocks.triggerCompletionFeedbackMock).toHaveBeenCalledTimes(2);
    });

    const secondFeedbackEvent = mocks.triggerCompletionFeedbackMock.mock.calls[1][0];
    expect(secondFeedbackEvent).not.toHaveProperty("firstCompletionToday");
    expect(secondFeedbackEvent).not.toHaveProperty("isBuildingMomentum");
    expect(secondFeedbackEvent).not.toHaveProperty("isOverloaded");
    expect(queryClient.getQueryData(getCompletionFeedbackDaySignalTasksQueryKey("user-1", today)))
      .toBeUndefined();
  });

  it("counts locally remembered daily completions when a fetched day snapshot exists", async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { wrapper, queryClient } = createHarness();
    queryClient.setQueryData(getCompletionFeedbackDaySignalTasksQueryKey("user-1", today), []);
    queryClient.setQueryData(getCompletionFeedbackLocalCompletionsQueryKey("user-1", today), [
      { id: "daily-done", completed: true, completed_at: `${today}T08:00:00.000Z` },
    ]);

    const { result } = renderHook(() => useInboxTasks({ enabled: false }), { wrapper });

    act(() => {
      result.current.toggleInboxTask({ taskId: "task-1", completed: true });
    });

    await waitFor(() => {
      expect(mocks.triggerCompletionFeedbackMock).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: "task-1",
          taskTitle: "Inbox quest",
          completionSource: "inbox",
          firstCompletionToday: false,
          isBuildingMomentum: false,
          isOverloaded: false,
        }),
      );
    });
  });

  it("counts prior local inbox completions when building day progress signals", async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { wrapper, queryClient } = createHarness();
    queryClient.setQueryData(["daily-tasks", "user-1", today], []);
    queryClient.setQueryData(getCompletionFeedbackDaySignalTasksQueryKey("user-1", today), []);
    mocks.selectMaybeSingleMock
      .mockResolvedValueOnce({
        data: buildInboxTaskDetails({
          id: "task-1",
          task_text: "First inbox quest",
        }),
        error: null,
      })
      .mockResolvedValueOnce({
        data: buildInboxTaskDetails({
          id: "task-2",
          task_text: "Second inbox quest",
        }),
        error: null,
      });

    const { result } = renderHook(() => useInboxTasks({ enabled: false }), { wrapper });

    act(() => {
      result.current.toggleInboxTask({ taskId: "task-1", completed: true });
    });

    await waitFor(() => {
      expect(mocks.triggerCompletionFeedbackMock).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: "task-1",
          taskTitle: "First inbox quest",
          firstCompletionToday: true,
          isBuildingMomentum: false,
          isOverloaded: false,
        }),
      );
    });

    act(() => {
      result.current.toggleInboxTask({ taskId: "task-2", completed: true });
    });

    await waitFor(() => {
      expect(mocks.triggerCompletionFeedbackMock).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: "task-2",
          taskTitle: "Second inbox quest",
          firstCompletionToday: false,
          isBuildingMomentum: false,
          isOverloaded: false,
        }),
      );
    });
  });

  it("does not update or trigger feedback for already-completed inbox tasks", async () => {
    mocks.selectMaybeSingleMock.mockResolvedValueOnce({
      data: buildInboxTaskDetails({
        completed: true,
        completed_at: "2026-04-29T16:00:00.000Z",
      }),
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
    const today = format(new Date(), "yyyy-MM-dd");
    const { wrapper, queryClient } = createHarness();
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
    expect(queryClient.getQueryData(getCompletionFeedbackInboxTasksQueryKey("user-1", today)))
      .toEqual([
        expect.objectContaining({
          id: "task-1",
          completed: true,
          completed_at: expect.any(String),
        }),
      ]);
  });

  it("remembers inbox completions queued from a queueable fetch error", async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { wrapper, queryClient } = createHarness();
    mocks.selectMaybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: new Error("Failed to fetch"),
    });

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

    expect(mocks.updateMock).not.toHaveBeenCalled();
    expect(mocks.triggerCompletionFeedbackMock).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(getCompletionFeedbackInboxTasksQueryKey("user-1", today)))
      .toEqual([
        expect.objectContaining({
          id: "task-1",
          completed: true,
          completed_at: expect.any(String),
        }),
      ]);
  });

  it("remembers inbox completions queued from a queueable update error", async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { wrapper, queryClient } = createHarness();
    mocks.updateMaybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: new Error("Failed to fetch"),
    });

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

    expect(mocks.triggerCompletionFeedbackMock).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(getCompletionFeedbackInboxTasksQueryKey("user-1", today)))
      .toEqual([
        expect.objectContaining({
          id: "task-1",
          completed: true,
          completed_at: expect.any(String),
        }),
      ]);
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
