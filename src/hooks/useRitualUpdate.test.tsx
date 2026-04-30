import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queueActionMock: vi.fn(),
  queueTaskActionMock: vi.fn(),
  retryNowMock: vi.fn(),
  getPlannerRecordMock: vi.fn(),
  getAllLocalTasksForUserMock: vi.fn(),
  getLocalSubtasksForTaskMock: vi.fn(),
  removePlannerRecordsMock: vi.fn(),
  upsertPlannerRecordMock: vi.fn(),
  upsertPlannerRecordsMock: vi.fn(),
  dispatchPlannerSyncFinishedMock: vi.fn(),
  withPlannerRemoteSyncLockMock: vi.fn(async (_userId: string, operation: () => Promise<unknown>) => operation()),
  loadLocalEpicsMock: vi.fn(),
  normalizeRitualScheduleMock: vi.fn(),
  reconcileHabitLinkedTasksMock: vi.fn(),
  habitsUpdateMock: vi.fn(),
  tasksUpsertMock: vi.fn(),
  tasksUpdateMock: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/contexts/ResilienceContext", () => ({
  useResilience: () => ({
    queueAction: mocks.queueActionMock,
    queueTaskAction: mocks.queueTaskActionMock,
    retryNow: mocks.retryNowMock,
    shouldQueueWrites: false,
  }),
}));

vi.mock("@/utils/plannerLocalStore", () => ({
  createOfflinePlannerId: (prefix: string) => `${prefix}-generated`,
  getPlannerRecord: (...args: unknown[]) => mocks.getPlannerRecordMock(...args),
  getAllLocalTasksForUser: (...args: unknown[]) => mocks.getAllLocalTasksForUserMock(...args),
  getLocalSubtasksForTask: (...args: unknown[]) => mocks.getLocalSubtasksForTaskMock(...args),
  removePlannerRecords: (...args: unknown[]) => mocks.removePlannerRecordsMock(...args),
  upsertPlannerRecord: (...args: unknown[]) => mocks.upsertPlannerRecordMock(...args),
  upsertPlannerRecords: (...args: unknown[]) => mocks.upsertPlannerRecordsMock(...args),
}));

vi.mock("@/utils/plannerSync", () => ({
  dispatchPlannerSyncFinished: mocks.dispatchPlannerSyncFinishedMock,
  loadLocalEpics: (...args: unknown[]) => mocks.loadLocalEpicsMock(...args),
  withPlannerRemoteSyncLock: (...args: unknown[]) => mocks.withPlannerRemoteSyncLockMock.apply(null, args),
}));

vi.mock("@/hooks/habitTaskReconciliation", async () => {
  const actual = await vi.importActual<typeof import("./habitTaskReconciliation")>("./habitTaskReconciliation");

  return {
    ...actual,
    normalizeRitualSchedule: (...args: unknown[]) => mocks.normalizeRitualScheduleMock(...args),
    reconcileHabitLinkedTasks: (...args: unknown[]) => mocks.reconcileHabitLinkedTasksMock(...args),
  };
});

vi.mock("@/utils/timezone", () => ({
  getEffectiveMissionDate: () => "2026-02-10",
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "habits") {
        return {
          update: () => ({
            eq: () => ({
              eq: mocks.habitsUpdateMock,
            }),
          }),
        };
      }

      if (table === "daily_tasks") {
        return {
          upsert: mocks.tasksUpsertMock,
          update: (updates: Record<string, unknown>) => ({
            eq: () => ({
              eq: (...args: unknown[]) => mocks.tasksUpdateMock(updates, ...args),
            }),
          }),
          delete: () => ({
            eq: () => ({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }

      return {};
    }),
  },
}));

import { useRitualUpdate } from "./useRitualUpdate";

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

const buildExistingHabitTask = (overrides: Record<string, unknown> = {}) => ({
  id: "task-existing",
  user_id: "user-1",
  task_text: "Strength Training Sessions",
  difficulty: "hard",
  xp_reward: 20,
  task_date: "2026-02-10",
  completed: false,
  completed_at: null,
  is_main_quest: false,
  scheduled_time: "07:00",
  estimated_duration: 180,
  recurrence_pattern: null,
  recurrence_days: null,
  recurrence_month_days: null,
  recurrence_custom_period: null,
  recurrence_end_date: null,
  is_recurring: false,
  reminder_enabled: false,
  reminder_minutes_before: 15,
  reminder_sent: false,
  parent_template_id: null,
  category: "body",
  is_bonus: false,
  created_at: "2026-02-09T00:00:00.000Z",
  priority: null,
  is_top_three: null,
  actual_time_spent: null,
  ai_generated: null,
  context_id: null,
  source: "recurring",
  habit_source_id: "habit-1",
  epic_id: "epic-1",
  epic_title: "Strong Week",
  sort_order: 3,
  contact_id: null,
  auto_log_interaction: true,
  contact: null,
  image_url: null,
  attachments: [],
  notes: null,
  location: null,
  subtasks: [],
  ...overrides,
});

describe("useRitualUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlannerRecordMock.mockResolvedValue({
      id: "habit-1",
      user_id: "user-1",
      title: "Strength Training Sessions",
      description: "Lift heavy",
      difficulty: "hard",
      frequency: "weekly",
      estimated_minutes: 180,
      preferred_time: "07:00",
      category: "body",
      custom_days: [0],
      custom_month_days: null,
      reminder_enabled: false,
      reminder_minutes_before: 15,
      is_active: true,
      current_streak: 0,
      longest_streak: 0,
      created_at: "2026-02-01T00:00:00.000Z",
      sort_order: 0,
    });
    mocks.getLocalSubtasksForTaskMock.mockResolvedValue([]);
    mocks.getAllLocalTasksForUserMock.mockResolvedValue([]);
    mocks.loadLocalEpicsMock.mockResolvedValue([]);
    mocks.upsertPlannerRecordMock.mockResolvedValue(undefined);
    mocks.upsertPlannerRecordsMock.mockResolvedValue(undefined);
    mocks.removePlannerRecordsMock.mockResolvedValue(undefined);
    mocks.queueActionMock.mockResolvedValue("queued-habit");
    mocks.queueTaskActionMock.mockResolvedValue("queued-task");
    mocks.retryNowMock.mockResolvedValue(undefined);
    mocks.withPlannerRemoteSyncLockMock.mockImplementation(async (_userId: string, operation: () => Promise<unknown>) => operation());
    mocks.normalizeRitualScheduleMock.mockReturnValue({
      frequency: "5x_week",
      custom_days: [0, 1, 2, 3, 4],
      custom_month_days: null,
      customPeriod: "week",
    });
    mocks.reconcileHabitLinkedTasksMock.mockResolvedValue({
      createdTasks: [
        {
          id: "task-created",
          user_id: "user-1",
          task_text: "Strength Training Sessions",
          difficulty: "hard",
          xp_reward: 20,
          task_date: "2026-02-10",
          completed: false,
          completed_at: null,
          is_main_quest: false,
          scheduled_time: "07:00",
          estimated_duration: 180,
          recurrence_pattern: null,
          recurrence_days: null,
          recurrence_month_days: null,
          recurrence_custom_period: null,
          recurrence_end_date: null,
          is_recurring: false,
          reminder_enabled: false,
          reminder_minutes_before: 15,
          reminder_sent: false,
          parent_template_id: null,
          category: "body",
          is_bonus: false,
          created_at: "2026-02-09T00:00:00.000Z",
          priority: null,
          is_top_three: null,
          actual_time_spent: null,
          ai_generated: null,
          context_id: null,
          source: "recurring",
          habit_source_id: "habit-1",
          epic_id: "epic-1",
          epic_title: "Strong Week",
          sort_order: 3,
          contact_id: null,
          auto_log_interaction: true,
          contact: null,
          image_url: null,
          attachments: [],
          notes: null,
          location: null,
          subtasks: [],
        },
      ],
      updatedTasks: [],
      deletedTasks: [],
      touchedDates: ["2026-02-10"],
    });
    mocks.habitsUpdateMock.mockResolvedValue({ error: null });
    mocks.tasksUpsertMock.mockResolvedValue({ error: null });
    mocks.tasksUpdateMock.mockResolvedValue({ error: null });
  });

  it("writes the normalized ritual schedule locally and refreshes planner-facing queries", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRitualUpdate(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.saveRitual({
        habitId: "habit-1",
        title: "Strength Training Sessions",
        description: "Lift heavy",
        difficulty: "hard",
        frequency: "5x_week",
        estimatedMinutes: 180,
        preferredTime: "07:00",
        category: "body",
        customDays: [0, 1, 2, 3, 4],
        customMonthDays: [],
        customPeriod: "week",
        reminderEnabled: false,
        reminderMinutesBefore: 15,
      });
    });

    expect(mocks.upsertPlannerRecordMock).toHaveBeenCalledWith(
      "habits",
      expect.objectContaining({
        id: "habit-1",
        frequency: "5x_week",
        custom_days: [0, 1, 2, 3, 4],
      }),
    );
    expect(mocks.upsertPlannerRecordsMock).toHaveBeenCalledWith(
      "daily_tasks",
      expect.arrayContaining([
        expect.objectContaining({
          id: "task-created",
          task_date: "2026-02-10",
        }),
      ]),
    );
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["epics"] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["habit-surfacing"] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["daily-tasks"] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["calendar-tasks"] });
    expect(mocks.dispatchPlannerSyncFinishedMock).toHaveBeenCalledTimes(1);
  });

  it("uses real reconciliation to update future spawned quest time and duration", async () => {
    const actualReconciliation = await vi.importActual<typeof import("./habitTaskReconciliation")>(
      "./habitTaskReconciliation",
    );
    mocks.normalizeRitualScheduleMock.mockImplementation(actualReconciliation.normalizeRitualSchedule);
    mocks.reconcileHabitLinkedTasksMock.mockImplementation(actualReconciliation.reconcileHabitLinkedTasks);
    mocks.loadLocalEpicsMock.mockResolvedValue([
      {
        id: "epic-1",
        title: "Strong Week",
        status: "active",
        epic_habits: [{ habit_id: "habit-1" }],
      },
    ]);
    mocks.getAllLocalTasksForUserMock.mockResolvedValue([buildExistingHabitTask()]);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useRitualUpdate(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.saveRitual({
        habitId: "habit-1",
        title: "Strength Training Sessions",
        description: "Lift heavy",
        difficulty: "hard",
        frequency: "weekly",
        estimatedMinutes: 90,
        preferredTime: "08:30",
        category: "body",
        customDays: [1],
        customMonthDays: [],
        customPeriod: "week",
        reminderEnabled: false,
        reminderMinutesBefore: 15,
      });
    });

    expect(mocks.upsertPlannerRecordsMock).toHaveBeenCalledWith(
      "daily_tasks",
      expect.arrayContaining([
        expect.objectContaining({
          id: "task-existing",
          scheduled_time: "08:30",
          estimated_duration: 90,
        }),
      ]),
    );
    expect(mocks.tasksUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduled_time: "08:30",
        estimated_duration: 90,
      }),
      "user_id",
      "user-1",
    );
    expect(mocks.queueTaskActionMock).not.toHaveBeenCalled();
  });

  it("uses real reconciliation to clear future spawned quest time and duration", async () => {
    const actualReconciliation = await vi.importActual<typeof import("./habitTaskReconciliation")>(
      "./habitTaskReconciliation",
    );
    mocks.normalizeRitualScheduleMock.mockImplementation(actualReconciliation.normalizeRitualSchedule);
    mocks.reconcileHabitLinkedTasksMock.mockImplementation(actualReconciliation.reconcileHabitLinkedTasks);
    mocks.loadLocalEpicsMock.mockResolvedValue([
      {
        id: "epic-1",
        title: "Strong Week",
        status: "active",
        epic_habits: [{ habit_id: "habit-1" }],
      },
    ]);
    mocks.getAllLocalTasksForUserMock.mockResolvedValue([buildExistingHabitTask()]);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(() => useRitualUpdate(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.saveRitual({
        habitId: "habit-1",
        title: "Strength Training Sessions",
        description: "Lift heavy",
        difficulty: "hard",
        frequency: "weekly",
        estimatedMinutes: null,
        preferredTime: null,
        category: "body",
        customDays: [1],
        customMonthDays: [],
        customPeriod: "week",
        reminderEnabled: false,
        reminderMinutesBefore: 15,
      });
    });

    expect(mocks.upsertPlannerRecordsMock).toHaveBeenCalledWith(
      "daily_tasks",
      expect.arrayContaining([
        expect.objectContaining({
          id: "task-existing",
          scheduled_time: null,
          estimated_duration: null,
        }),
      ]),
    );
    expect(mocks.tasksUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduled_time: null,
        estimated_duration: null,
      }),
      "user_id",
      "user-1",
    );
    expect(mocks.queueTaskActionMock).not.toHaveBeenCalled();
  });
});
