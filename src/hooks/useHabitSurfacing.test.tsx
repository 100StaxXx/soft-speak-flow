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
  const withPlannerRemoteSyncLockMock = vi.fn(async (_userId: string, operation: () => Promise<unknown>) => operation());
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
    withPlannerRemoteSyncLockMock,
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
  getDailyTasksQueryKey: (userId: string | undefined, taskDate: string) => ["daily-tasks", userId, taskDate],
  loadLocalEpics: (...args: unknown[]) => mocks.loadLocalEpicsMock(...args),
  loadLocalDailyTasks: (...args: unknown[]) => mocks.loadLocalDailyTasksMock(...args),
  syncLocalHabitsFromRemote: (...args: unknown[]) => mocks.syncLocalHabitsFromRemoteMock(...args),
  syncLocalEpicsFromRemote: (...args: unknown[]) => mocks.syncLocalEpicsFromRemoteMock(...args),
  syncLocalDailyTasksFromRemote: (...args: unknown[]) => mocks.syncLocalDailyTasksFromRemoteMock(...args),
  withPlannerRemoteSyncLock: (...args: unknown[]) => mocks.withPlannerRemoteSyncLockMock(...args),
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
    mocks.withPlannerRemoteSyncLockMock.mockImplementation(async (_userId: string, operation: () => Promise<unknown>) => operation());
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
        frequency: "custom",
        estimated_minutes: 10,
        preferred_time: "20:00",
        custom_days: [0],
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
    expect(result.current.unsurfacedHabitsCount).toBe(0);
  });

  it("surfaces a manually selected habit offline by writing local tasks first and queueing task creation", async () => {
    mocks.state.shouldQueueWrites = true;
    mocks.getLocalHabitsMock.mockResolvedValue([
      {
        id: "habit-standalone",
        user_id: "user-1",
        title: "Journal",
        description: null,
        difficulty: "easy",
        category: "soul",
        frequency: "custom",
        estimated_minutes: 10,
        preferred_time: "20:00",
        custom_days: [0],
        custom_month_days: null,
        is_active: true,
      },
    ]);

    const { result } = renderHook(
      () => useHabitSurfacing(new Date("2026-02-11T10:00:00.000Z")),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.surfacedHabits).toHaveLength(1);
    });

    await act(async () => {
      await result.current.surfaceHabit("habit-standalone");
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
    expect(mocks.withPlannerRemoteSyncLockMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
  });

  it("materializes missing due campaign rituals during refresh for the March 27 account shape", async () => {
    let localTasks = [
      {
        id: "manual-1",
        user_id: "user-1",
        task_text: "Morning Routine",
        difficulty: "hard",
        xp_reward: 10,
        task_date: "2026-03-27",
        completed: true,
        completed_at: null,
        is_main_quest: false,
        scheduled_time: "04:30:00",
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
        category: "mind",
        is_bonus: false,
        created_at: "2026-03-27T08:20:17.346976Z",
        priority: null,
        is_top_three: null,
        actual_time_spent: null,
        ai_generated: null,
        context_id: null,
        source: "manual",
        habit_source_id: null,
        epic_id: null,
        sort_order: 0,
        contact_id: null,
        auto_log_interaction: true,
        contact: null,
        image_url: null,
        attachments: [],
        notes: null,
        location: null,
        subtasks: [],
      },
      buildTask({
        id: "manual-2",
        task_text: "Bids for Next week",
        task_date: "2026-03-27",
        scheduled_time: "16:00:00",
        source: "manual",
        habit_source_id: null,
        epic_id: null,
      }),
      buildTask({
        id: "manual-3",
        task_text: "Walk 800 w 6th",
        task_date: "2026-03-27",
        scheduled_time: "10:00:00",
        completed: true,
        source: "manual",
        habit_source_id: null,
        epic_id: null,
      }),
      buildTask({
        id: "manual-4",
        task_text: "Evening reset",
        task_date: "2026-03-27",
        scheduled_time: "19:00:00",
        source: "manual",
        habit_source_id: null,
        epic_id: null,
      }),
    ];

    const activeHabits = [
      {
        id: "crm",
        user_id: "user-1",
        title: "Daily CRM Update",
        description: null,
        difficulty: "medium",
        category: "mind",
        frequency: "daily",
        estimated_minutes: 20,
        preferred_time: null,
        custom_days: [0, 1, 2, 3, 4, 5, 6],
        custom_month_days: null,
        is_active: true,
      },
      {
        id: "workout",
        user_id: "user-1",
        title: "Daily Workout Routine",
        description: null,
        difficulty: "medium",
        category: "body",
        frequency: "daily",
        estimated_minutes: 45,
        preferred_time: null,
        custom_days: [0, 1, 2, 3, 4, 5, 6],
        custom_month_days: null,
        is_active: true,
      },
      {
        id: "nutrition",
        user_id: "user-1",
        title: "Nutrition Tracking",
        description: null,
        difficulty: "medium",
        category: "body",
        frequency: "daily",
        estimated_minutes: 15,
        preferred_time: null,
        custom_days: [0, 1, 2, 3, 4, 5, 6],
        custom_month_days: null,
        is_active: true,
      },
      {
        id: "networking",
        user_id: "user-1",
        title: "Weekly Networking Events",
        description: null,
        difficulty: "medium",
        category: "mind",
        frequency: "custom",
        estimated_minutes: 30,
        preferred_time: null,
        custom_days: [0],
        custom_month_days: null,
        is_active: true,
      },
      {
        id: "review",
        user_id: "user-1",
        title: "Weekly Review and Planning",
        description: null,
        difficulty: "medium",
        category: "mind",
        frequency: "custom",
        estimated_minutes: 30,
        preferred_time: null,
        custom_days: [0],
        custom_month_days: null,
        is_active: true,
      },
      {
        id: "flexibility",
        user_id: "user-1",
        title: "Weekly Flexibility Assessment",
        description: null,
        difficulty: "medium",
        category: "body",
        frequency: "custom",
        estimated_minutes: 20,
        preferred_time: null,
        custom_days: [0],
        custom_month_days: null,
        is_active: true,
      },
    ];

    mocks.getLocalHabitsMock.mockImplementation(async () => activeHabits);
    mocks.loadLocalEpicsMock.mockImplementation(async () => [
      {
        id: "epic-money",
        user_id: "user-1",
        title: "Get Money",
        description: null,
        status: "active",
        progress_percentage: 0,
        target_days: 304,
        start_date: "2026-03-03",
        end_date: "2027-01-01",
        epic_habits: [
          { habit_id: "crm", habits: null },
          { habit_id: "networking", habits: null },
          { habit_id: "review", habits: null },
        ],
      },
      {
        id: "epic-summer",
        user_id: "user-1",
        title: "Summer Gains",
        description: null,
        status: "active",
        progress_percentage: 0,
        target_days: 91,
        start_date: "2026-03-03",
        end_date: "2026-06-02",
        epic_habits: [
          { habit_id: "workout", habits: null },
          { habit_id: "nutrition", habits: null },
          { habit_id: "flexibility", habits: null },
        ],
      },
    ]);
    mocks.loadLocalDailyTasksMock.mockImplementation(async (_userId: string, taskDate: string) => (
      taskDate === "2026-03-27" ? localTasks : []
    ));
    mocks.upsertPlannerRecordMock.mockImplementation(async (store: string, record: Record<string, unknown>) => {
      if (store === "daily_tasks") {
        localTasks = [...localTasks, record as typeof localTasks[number]];
      }
    });
    mocks.createOfflinePlannerIdMock
      .mockReturnValueOnce("ritual-task-1")
      .mockReturnValueOnce("ritual-task-2")
      .mockReturnValueOnce("ritual-task-3");

    const { result } = renderHook(
      () => useHabitSurfacing(new Date("2026-03-27T12:00:00.000Z")),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.unsurfacedHabitsCount).toBe(0);
    });

    expect(mocks.upsertPlannerRecordMock).toHaveBeenCalledTimes(3);
    expect(mocks.supabaseUpsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          task_text: "Daily CRM Update",
          task_date: "2026-03-27",
          habit_source_id: "crm",
          source: "recurring",
          epic_id: "epic-money",
          scheduled_time: null,
        }),
        expect.objectContaining({
          task_text: "Daily Workout Routine",
          task_date: "2026-03-27",
          habit_source_id: "workout",
          source: "recurring",
          epic_id: "epic-summer",
          scheduled_time: null,
        }),
        expect.objectContaining({
          task_text: "Nutrition Tracking",
          task_date: "2026-03-27",
          habit_source_id: "nutrition",
          source: "recurring",
          epic_id: "epic-summer",
          scheduled_time: null,
        }),
      ]),
      expect.objectContaining({
        onConflict: "user_id,task_date,habit_source_id",
        ignoreDuplicates: true,
      }),
    );
    expect(
      result.current.surfacedHabits
        .filter((habit) => ["crm", "workout", "nutrition"].includes(habit.habit_id))
        .every((habit) => typeof habit.task_id === "string" && habit.task_id.length > 0),
    ).toBe(true);
  });
});
