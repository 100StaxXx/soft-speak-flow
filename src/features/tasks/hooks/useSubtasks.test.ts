import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const fromMock = vi.fn();
  const insertMock = vi.fn();
  const updateMock = vi.fn();
  const updateEqMock = vi.fn();
  const deleteMock = vi.fn();
  const deleteEqMock = vi.fn();
  const queueActionMock = vi.fn();
  const retryNowMock = vi.fn();
  const createOfflinePlannerIdMock = vi.fn(() => "subtask-local");
  const getLocalSubtasksForTaskMock = vi.fn();
  const upsertPlannerRecordMock = vi.fn();
  const removePlannerRecordMock = vi.fn();

  return {
    fromMock,
    insertMock,
    updateMock,
    updateEqMock,
    deleteMock,
    deleteEqMock,
    queueActionMock,
    retryNowMock,
    createOfflinePlannerIdMock,
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
    from: (...args: unknown[]) => mocks.fromMock(...args),
  },
}));

vi.mock("@/contexts/ResilienceContext", () => ({
  useResilience: () => ({
    queueAction: mocks.queueActionMock,
    shouldQueueWrites: false,
    retryNow: mocks.retryNowMock,
  }),
}));

vi.mock("@/utils/plannerLocalStore", () => ({
  createOfflinePlannerId: (...args: unknown[]) => mocks.createOfflinePlannerIdMock(...args),
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
    mocks.insertMock.mockResolvedValue({ error: null });
    mocks.upsertPlannerRecordMock.mockResolvedValue(undefined);
    mocks.removePlannerRecordMock.mockResolvedValue(undefined);
    mocks.queueActionMock.mockResolvedValue(undefined);
    mocks.retryNowMock.mockResolvedValue(undefined);
    mocks.createOfflinePlannerIdMock.mockReturnValue("subtask-local");

    mocks.updateMock.mockReturnValue({
      eq: mocks.updateEqMock,
    });
    mocks.deleteMock.mockReturnValue({
      eq: mocks.deleteEqMock,
    });

    mocks.updateEqMock.mockResolvedValue({
      error: null,
    });
    mocks.deleteEqMock.mockResolvedValue({
      error: null,
    });

    mocks.fromMock.mockImplementation((table: string) => {
      if (table !== "subtasks") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        insert: mocks.insertMock,
        update: mocks.updateMock,
        delete: mocks.deleteMock,
      };
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

  it("falls back to normalized parent task IDs when loading local subtasks", async () => {
    const legacyParentTaskId = "task-e47e5651-7522-4888-a04d-6eff518fa4ba";
    const normalizedParentTaskId = "e47e5651-7522-4888-a04d-6eff518fa4ba";
    mocks.getLocalSubtasksForTaskMock.mockImplementation(async (taskId: string) => {
      if (taskId === legacyParentTaskId) return [];
      if (taskId === normalizedParentTaskId) {
        return [
          {
            id: "subtask-1",
            task_id: normalizedParentTaskId,
            user_id: "user-1",
            title: "Normalized subtask",
            completed: false,
            completed_at: null,
            sort_order: 0,
            created_at: "2026-02-01T00:00:00.000Z",
          },
        ];
      }
      return [];
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useSubtasks(legacyParentTaskId), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.subtasks).toHaveLength(1);
    expect(result.current.subtasks[0]?.task_id).toBe(normalizedParentTaskId);
    expect(mocks.getLocalSubtasksForTaskMock).toHaveBeenCalledWith(legacyParentTaskId);
    expect(mocks.getLocalSubtasksForTaskMock).toHaveBeenCalledWith(normalizedParentTaskId);
  });

  it("normalizes parent and generated subtask IDs for remote add", async () => {
    const legacyParentTaskId = "task-e47e5651-7522-4888-a04d-6eff518fa4ba";
    const normalizedParentTaskId = "e47e5651-7522-4888-a04d-6eff518fa4ba";
    const legacySubtaskId = "subtask-2F96D0D4-0B3D-4C91-8A11-0C685B392253";
    const normalizedSubtaskId = "2f96d0d4-0b3d-4c91-8a11-0c685b392253";

    mocks.getLocalSubtasksForTaskMock.mockResolvedValue([]);
    mocks.createOfflinePlannerIdMock.mockReturnValueOnce(legacySubtaskId);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useSubtasks(legacyParentTaskId), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.addSubtask("Call uncle Derrick");
    });

    await waitFor(() => {
      expect(mocks.insertMock).toHaveBeenCalledWith(expect.objectContaining({
        id: normalizedSubtaskId,
        task_id: normalizedParentTaskId,
        title: "Call uncle Derrick",
      }));
    });
  });

  it("normalizes legacy subtask IDs for remote toggle", async () => {
    const legacySubtaskId = "subtask-2F96D0D4-0B3D-4C91-8A11-0C685B392253";
    const normalizedSubtaskId = "2f96d0d4-0b3d-4c91-8a11-0c685b392253";
    mocks.getLocalSubtasksForTaskMock.mockResolvedValue([
      {
        id: normalizedSubtaskId,
        task_id: "task-1",
        user_id: "user-1",
        title: "First subtask",
        completed: false,
        completed_at: null,
        sort_order: 0,
        created_at: "2026-02-01T00:00:00.000Z",
      },
    ]);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useSubtasks("task-1"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.toggleSubtask({ subtaskId: legacySubtaskId, completed: true });
    });

    await waitFor(() => {
      expect(mocks.updateEqMock).toHaveBeenCalledWith("id", normalizedSubtaskId);
    });
  });

  it("normalizes legacy subtask IDs for remote delete", async () => {
    const legacySubtaskId = "subtask-2F96D0D4-0B3D-4C91-8A11-0C685B392253";
    const normalizedSubtaskId = "2f96d0d4-0b3d-4c91-8a11-0c685b392253";
    mocks.getLocalSubtasksForTaskMock.mockResolvedValue([
      {
        id: normalizedSubtaskId,
        task_id: "task-1",
        user_id: "user-1",
        title: "First subtask",
        completed: false,
        completed_at: null,
        sort_order: 0,
        created_at: "2026-02-01T00:00:00.000Z",
      },
    ]);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useSubtasks("task-1"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.deleteSubtask(legacySubtaskId);
    });

    await waitFor(() => {
      expect(mocks.removePlannerRecordMock).toHaveBeenCalledWith("subtasks", normalizedSubtaskId);
      expect(mocks.deleteEqMock).toHaveBeenCalledWith("id", normalizedSubtaskId);
    });
  });

  it("normalizes legacy subtask IDs for remote title updates", async () => {
    const legacySubtaskId = "subtask-2F96D0D4-0B3D-4C91-8A11-0C685B392253";
    const normalizedSubtaskId = "2f96d0d4-0b3d-4c91-8a11-0c685b392253";
    mocks.getLocalSubtasksForTaskMock.mockResolvedValue([
      {
        id: normalizedSubtaskId,
        task_id: "task-1",
        user_id: "user-1",
        title: "First subtask",
        completed: false,
        completed_at: null,
        sort_order: 0,
        created_at: "2026-02-01T00:00:00.000Z",
      },
    ]);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useSubtasks("task-1"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.updateSubtask({ subtaskId: legacySubtaskId, title: "Updated title" });
    });

    await waitFor(() => {
      expect(mocks.updateMock).toHaveBeenCalledWith({ title: "Updated title" });
      expect(mocks.updateEqMock).toHaveBeenCalledWith("id", normalizedSubtaskId);
    });
  });

  it("normalizes generated IDs and parent task ID for bulk subtask inserts", async () => {
    const legacyParentTaskId = "task-e47e5651-7522-4888-a04d-6eff518fa4ba";
    const normalizedParentTaskId = "e47e5651-7522-4888-a04d-6eff518fa4ba";
    mocks.getLocalSubtasksForTaskMock.mockResolvedValue([]);
    mocks.createOfflinePlannerIdMock
      .mockReturnValueOnce("subtask-2F96D0D4-0B3D-4C91-8A11-0C685B392253")
      .mockReturnValueOnce("subtask-6FE2A91C-90F3-4EB6-960A-7E89AF5D9981");

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useSubtasks(legacyParentTaskId), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.bulkAddSubtasks(["One", "Two"]);
    });

    expect(mocks.insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "2f96d0d4-0b3d-4c91-8a11-0c685b392253",
        task_id: normalizedParentTaskId,
        title: "One",
      }),
      expect.objectContaining({
        id: "6fe2a91c-90f3-4eb6-960a-7e89af5d9981",
        task_id: normalizedParentTaskId,
        title: "Two",
      }),
    ]);
  });
});
