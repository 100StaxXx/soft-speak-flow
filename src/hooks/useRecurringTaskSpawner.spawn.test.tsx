import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const fromMock = vi.fn();
  const templatesQueryMock = vi.fn();
  const existingTasksQueryMock = vi.fn();
  const upsertSelectMock = vi.fn();
  const upsertMock = vi.fn();
  const insertSelectMock = vi.fn();
  const insertMock = vi.fn();
  const toastErrorMock = vi.fn();
  const withPlannerRemoteSyncLockMock = vi.fn(async (_userId: string, operation: () => Promise<unknown>) => operation());
  const localTasks: Array<Record<string, unknown>> = [];
  let nextId = 0;

  return {
    fromMock,
    templatesQueryMock,
    existingTasksQueryMock,
    upsertSelectMock,
    upsertMock,
    insertSelectMock,
    insertMock,
    toastErrorMock,
    withPlannerRemoteSyncLockMock,
    localTasks,
    nextIdRef: {
      get value() {
        return nextId;
      },
      set value(value: number) {
        nextId = value;
      },
    },
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mocks.toastErrorMock(...args),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mocks.fromMock(...args),
  },
}));

vi.mock("@/contexts/ResilienceContext", () => ({
  useResilience: () => ({
    queueTaskAction: vi.fn(),
    shouldQueueWrites: false,
    retryNow: vi.fn(),
  }),
}));

vi.mock("@/utils/plannerLocalStore", () => ({
  createOfflinePlannerId: (prefix: string) => {
    mocks.nextIdRef.value += 1;
    return `${prefix}-${mocks.nextIdRef.value}`;
  },
  getAllLocalTasksForUser: async (userId: string) =>
    mocks.localTasks.filter((task) => task.user_id === userId),
  removePlannerRecords: async (_storeName: string, ids: string[]) => {
    const idSet = new Set(ids);
    const remaining = mocks.localTasks.filter((task) => !idSet.has(String(task.id)));
    mocks.localTasks.splice(0, mocks.localTasks.length, ...remaining);
  },
  upsertPlannerRecords: async (_storeName: string, records: Array<Record<string, unknown>>) => {
    records.forEach((record) => {
      const index = mocks.localTasks.findIndex((task) => task.id === record.id);
      if (index >= 0) {
        mocks.localTasks[index] = { ...mocks.localTasks[index], ...record };
      } else {
        mocks.localTasks.push({ ...record });
      }
    });
  },
}));

vi.mock("@/utils/plannerSync", () => {
  return {
    PLANNER_SYNC_EVENT: "planner-sync-finished",
    canSyncPlannerFromRemote: vi.fn(async () => true),
    loadLocalDailyTasks: vi.fn(async (userId: string, taskDate: string) =>
      mocks.localTasks.filter((task) => task.user_id === userId && task.task_date === taskDate),
    ),
    syncLocalDailyTasksFromRemote: vi.fn(async () => []),
    withPlannerRemoteSyncLock: (...args: unknown[]) => mocks.withPlannerRemoteSyncLockMock(...args),
  };
});

import { useRecurringTaskSpawner } from "./useRecurringTaskSpawner";

const buildTemplate = (overrides: Record<string, unknown> = {}) => ({
  id: "template-1",
  task_text: "Recurring template",
  difficulty: "medium",
  task_date: "2026-02-01",
  created_at: "2026-02-01T12:00:00.000Z",
  scheduled_time: "09:00",
  estimated_duration: 30,
  category: null,
  recurrence_pattern: "daily",
  recurrence_days: null,
  recurrence_month_days: null,
  recurrence_custom_period: null,
  recurrence_end_date: null,
  xp_reward: 50,
  epic_id: null,
  reminder_enabled: false,
  reminder_minutes_before: null,
  ...overrides,
});

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

describe("useRecurringTaskSpawner spawn behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.localTasks.splice(0, mocks.localTasks.length);
    mocks.nextIdRef.value = 0;
    mocks.withPlannerRemoteSyncLockMock.mockImplementation(async (_userId: string, operation: () => Promise<unknown>) => operation());

    mocks.templatesQueryMock.mockResolvedValue({
      data: [
        buildTemplate({ id: "template-1", task_text: "No time recurring", scheduled_time: null }),
        buildTemplate({ id: "template-2", task_text: "Timed recurring", scheduled_time: "09:00" }),
      ],
      error: null,
    });

    mocks.existingTasksQueryMock.mockResolvedValue({
      data: [],
      error: null,
    });

    mocks.upsertSelectMock.mockResolvedValue({
      data: [{ id: "spawned-1" }],
      error: null,
    });

    mocks.upsertMock.mockImplementation(() => ({
      select: mocks.upsertSelectMock,
    }));
    mocks.insertSelectMock.mockResolvedValue({
      data: [{ id: "inserted-1" }],
      error: null,
    });
    mocks.insertMock.mockImplementation(() => ({
      select: mocks.insertSelectMock,
    }));

    mocks.fromMock.mockImplementation((table: string) => {
      if (table !== "daily_tasks") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: (selection: string) => {
          if (selection.includes("parent_template_id")) {
            return {
              eq: () => ({
                eq: mocks.existingTasksQueryMock,
              }),
            };
          }

          return {
            eq: () => ({
              eq: () => ({
                not: mocks.templatesQueryMock,
              }),
            }),
          };
        },
        upsert: mocks.upsertMock,
        insert: mocks.insertMock,
      };
    });
  });

  it("skips invalid templates without scheduled_time and shows an actionable toast", async () => {
    const { result } = renderHook(
      () => useRecurringTaskSpawner(new Date("2026-02-09T09:00:00.000Z")),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.pendingRecurringCount).toBe(2);
    });

    act(() => {
      result.current.spawnRecurringTasks();
    });

    await waitFor(() => {
      expect(mocks.upsertMock).toHaveBeenCalledTimes(1);
    });

    const upsertPayload = mocks.upsertMock.mock.calls[0]?.[0];
    expect(upsertPayload).toHaveLength(1);
    expect(upsertPayload[0]).toEqual(expect.objectContaining({
      parent_template_id: "template-2",
      scheduled_time: "09:00",
    }));

    expect(mocks.toastErrorMock).toHaveBeenCalledWith(
      "Set a time on recurring quest templates to resume auto-creation.",
    );
    expect(mocks.toastErrorMock).not.toHaveBeenCalledWith("Failed to create recurring quests");
    expect(mocks.withPlannerRemoteSyncLockMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
  });

  it("falls back to row-by-row insert when ON CONFLICT arbiter inference fails", async () => {
    mocks.templatesQueryMock.mockResolvedValueOnce({
      data: [buildTemplate({ id: "template-arbiter", task_text: "Arbiter recurring", scheduled_time: "10:00" })],
      error: null,
    });
    mocks.upsertSelectMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: "42P10",
        message: "there is no unique or exclusion constraint matching the ON CONFLICT specification",
        details: null,
        hint: null,
      },
    });
    mocks.insertSelectMock.mockResolvedValueOnce({
      data: [{ id: "spawned-insert-fallback" }],
      error: null,
    });

    const { result } = renderHook(
      () => useRecurringTaskSpawner(new Date("2026-02-09T09:00:00.000Z")),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.pendingRecurringCount).toBe(1);
    });

    act(() => {
      result.current.spawnRecurringTasks();
    });

    await waitFor(() => {
      expect(mocks.insertMock).toHaveBeenCalledTimes(1);
    });

    expect(mocks.upsertMock).toHaveBeenCalledTimes(1);
    expect(mocks.insertMock.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      parent_template_id: "template-arbiter",
      task_text: "Arbiter recurring",
    }));
    expect(mocks.toastErrorMock).not.toHaveBeenCalled();
  });

  it("retries row-by-row and creates valid templates even when one template write fails", async () => {
    mocks.templatesQueryMock.mockResolvedValueOnce({
      data: [
        buildTemplate({ id: "template-a", task_text: "Template A", scheduled_time: "09:00" }),
        buildTemplate({ id: "template-b", task_text: "Template B", scheduled_time: "10:00" }),
      ],
      error: null,
    });
    mocks.upsertSelectMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "23514",
          message: "new row for relation \"daily_tasks\" violates check constraint",
          details: null,
          hint: null,
        },
      })
      .mockResolvedValueOnce({
        data: [{ id: "spawned-row-1" }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "23514",
          message: "new row for relation \"daily_tasks\" violates check constraint",
          details: null,
          hint: null,
        },
      });

    const { result } = renderHook(
      () => useRecurringTaskSpawner(new Date("2026-02-09T09:00:00.000Z")),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.pendingRecurringCount).toBe(2);
    });

    act(() => {
      result.current.spawnRecurringTasks();
    });

    await waitFor(() => {
      expect(mocks.upsertMock).toHaveBeenCalledTimes(3);
    });

    expect(mocks.upsertMock.mock.calls[0]?.[0]).toHaveLength(2);
    expect(mocks.upsertMock.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
      parent_template_id: "template-a",
    }));
    expect(mocks.upsertMock.mock.calls[2]?.[0]).toEqual(expect.objectContaining({
      parent_template_id: "template-b",
    }));
    expect(mocks.toastErrorMock).toHaveBeenCalledWith(
      "Some recurring quests were not created. Open and re-save those templates.",
    );
  });
});
