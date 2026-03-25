import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const queueTaskActionMock = vi.fn();
  const retryNowMock = vi.fn();
  const getLocalHabitsMock = vi.fn();
  const upsertPlannerRecordMock = vi.fn();
  const loadLocalEpicsMock = vi.fn();
  const loadLocalDailyTasksMock = vi.fn();
  const syncLocalHabitsFromRemoteMock = vi.fn();
  const syncLocalEpicsFromRemoteMock = vi.fn();
  const syncLocalDailyTasksFromRemoteMock = vi.fn();
  const createOfflinePlannerIdMock = vi.fn(() => "task-local-queued");
  const supabaseUpsertMock = vi.fn();
  const state = {
    shouldQueueWrites: false,
  };

  return {
    queueTaskActionMock,
    retryNowMock,
    getLocalHabitsMock,
    upsertPlannerRecordMock,
    loadLocalEpicsMock,
    loadLocalDailyTasksMock,
    syncLocalHabitsFromRemoteMock,
    syncLocalEpicsFromRemoteMock,
    syncLocalDailyTasksFromRemoteMock,
    createOfflinePlannerIdMock,
    supabaseUpsertMock,
    state,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/contexts/ResilienceContext", () => ({
  useResilience: () => ({
    queueTaskAction: mocks.queueTaskActionMock,
    shouldQueueWrites: mocks.state.shouldQueueWrites,
    retryNow: mocks.retryNowMock,
  }),
}));

vi.mock("@/utils/plannerLocalStore", () => ({
  createOfflinePlannerId: (...args: unknown[]) => mocks.createOfflinePlannerIdMock(...args),
  getLocalHabits: (...args: unknown[]) => mocks.getLocalHabitsMock(...args),
  upsertPlannerRecord: (...args: unknown[]) => mocks.upsertPlannerRecordMock(...args),
}));

vi.mock("@/utils/plannerSync", () => ({
  PLANNER_SYNC_EVENT: "planner-sync-finished",
  loadLocalEpics: (...args: unknown[]) => mocks.loadLocalEpicsMock(...args),
  loadLocalDailyTasks: (...args: unknown[]) => mocks.loadLocalDailyTasksMock(...args),
  syncLocalHabitsFromRemote: (...args: unknown[]) => mocks.syncLocalHabitsFromRemoteMock(...args),
  syncLocalEpicsFromRemote: (...args: unknown[]) => mocks.syncLocalEpicsFromRemoteMock(...args),
  syncLocalDailyTasksFromRemote: (...args: unknown[]) => mocks.syncLocalDailyTasksFromRemoteMock(...args),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: mocks.supabaseUpsertMock,
    })),
  },
}));

import { useHabitSurfacing } from "./useHabitSurfacing";

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

const buildTask = (overrides: Record<string, unknown> = {}) => ({
  id: "task-1",
  user_id: "user-1",
  task_text: "Hydrate",
  difficulty: "easy",
  xp_reward: 10,
  task_date: "2026-02-10",
  completed: false,
  completed_at: null,
  is_main_quest: false,
  scheduled_time: "09:00",
  estimated_duration: 10,
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
  created_at: "2026-02-10T00:00:00.000Z",
  priority: null,
  is_top_three: null,
  actual_time_spent: null,
  ai_generated: null,
  context_id: null,
  source: "recurring",
  habit_source_id: "habit-active",
  epic_id: "epic-active",
  sort_order: 0,
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

describe("useHabitSurfacing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.shouldQueueWrites = false;
    mocks.getLocalHabitsMock.mockResolvedValue([]);
    mocks.loadLocalEpicsMock.mockResolvedValue([]);
    mocks.loadLocalDailyTasksMock.mockResolvedValue([]);
    mocks.syncLocalHabitsFromRemoteMock.mockResolvedValue(undefined);
    mocks.syncLocalEpicsFromRemoteMock.mockResolvedValue(undefined);
    mocks.syncLocalDailyTasksFromRemoteMock.mockResolvedValue(undefined);
    mocks.upsertPlannerRecordMock.mockResolvedValue(undefined);
    mocks.queueTaskActionMock.mockResolvedValue("queued-1");
    mocks.retryNowMock.mockResolvedValue(undefined);
    mocks.supabaseUpsertMock.mockResolvedValue({ error: null });
    mocks.createOfflinePlannerIdMock.mockReturnValue("task-local-queued");
  });

  it("builds surfaced habits from local habits, local epics, and local tasks", async () => {
    mocks.getLocalHabitsMock.mockResolvedValue([
      {
        id: "habit-active",
        user_id: "user-1",
        title: "Hydrate",
        description: "Water",
        difficulty: "easy",
        category: "body",
        frequency: "daily",
        estimated_minutes: 5,
        preferred_time: "09:00",
        custom_days: null,
        custom_month_days: null,
        is_active: true,
      },
      {
        id: "habit-completed-epic",
        user_id: "user-1",
        title: "Archive ritual",
        description: null,
        difficulty: "medium",
        category: "mind",
        frequency: "daily",
        estimated_minutes: 15,
        preferred_time: null,
        custom_days: null,
        custom_month_days: null,
        is_active: true,
      },
      {
        id: "habit-standalone",
        user_id: "user-1",
        title: "Journal",
        description: null,
        difficulty: "easy",
        category: "soul",
        frequency: "daily",
        estimated_minutes: 10,
        preferred_time: "20:00",
        custom_days: null,
        custom_month_days: null,
        is_active: true,
      },
    ]);

    mocks.loadLocalEpicsMock.mockResolvedValue([
      {
        id: "epic-active",
        user_id: "user-1",
        title: "Morning Reset",
        description: null,
        status: "active",
        progress_percentage: 0,
        target_days: 7,
        start_date: "2026-02-01",
        end_date: null,
        epic_habits: [{ habit_id: "habit-active", habits: null }],
      },
      {
        id: "epic-complete",
        user_id: "user-1",
        title: "Old Epic",
        description: null,
        status: "completed",
        progress_percentage: 100,
        target_days: 7,
        start_date: "2026-01-01",
        end_date: "2026-01-07",
        epic_habits: [{ habit_id: "habit-completed-epic", habits: null }],
      },
    ]);

    mocks.loadLocalDailyTasksMock.mockResolvedValue([buildTask()]);

    const { result } = renderHook(
      () => useHabitSurfacing(new Date("2026-02-10T10:00:00.000Z")),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.surfacedHabits).toHaveLength(2);
    });

    expect(result.current.surfacedHabits.map((habit) => habit.habit_id)).toEqual([
      "habit-active",
      "habit-standalone",
    ]);
    expect(result.current.surfacedHabits[0]?.task_id).toBe("task-1");
    expect(result.current.unsurfacedHabitsCount).toBe(1);
  });

  it("surfaces habits offline by writing local tasks first and queueing task creation", async () => {
    mocks.state.shouldQueueWrites = true;
    mocks.getLocalHabitsMock.mockResolvedValue([
      {
        id: "habit-standalone",
        user_id: "user-1",
        title: "Journal",
        description: null,
        difficulty: "easy",
        category: "soul",
        frequency: "daily",
        estimated_minutes: 10,
        preferred_time: "20:00",
        custom_days: null,
        custom_month_days: null,
        is_active: true,
      },
    ]);

    const { result } = renderHook(
      () => useHabitSurfacing(new Date("2026-02-10T10:00:00.000Z")),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.unsurfacedHabitsCount).toBe(1);
    });

    act(() => {
      result.current.surfaceAllHabits();
    });

    await waitFor(() => {
      expect(mocks.upsertPlannerRecordMock).toHaveBeenCalledWith(
        "daily_tasks",
        expect.objectContaining({
          id: "task-local-queued",
          task_text: "Journal",
          habit_source_id: "habit-standalone",
          source: "recurring",
        }),
      );
    });

    expect(mocks.queueTaskActionMock).toHaveBeenCalledWith(
      "CREATE_TASK",
      expect.objectContaining({
        id: "task-local-queued",
        task_text: "Journal",
        habit_source_id: "habit-standalone",
        source: "recurring",
      }),
    );
  });
});
