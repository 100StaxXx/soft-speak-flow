import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  let idCounter = 0;

  return {
    getAllLocalTasksForUserMock: vi.fn(),
    loadLocalEpicsMock: vi.fn(),
    createOfflinePlannerIdMock: vi.fn(() => {
      idCounter += 1;
      return `task-created-${idCounter}`;
    }),
    resetIds: () => {
      idCounter = 0;
    },
  };
});

vi.mock("@/utils/plannerLocalStore", () => ({
  createOfflinePlannerId: (...args: unknown[]) => mocks.createOfflinePlannerIdMock.apply(null, args),
  getAllLocalTasksForUser: (...args: unknown[]) => mocks.getAllLocalTasksForUserMock(...args),
}));

vi.mock("@/utils/plannerSync", async () => {
  const actual = await vi.importActual<typeof import("@/utils/plannerSync")>("@/utils/plannerSync");
  return {
    ...actual,
    loadLocalEpics: (...args: unknown[]) => mocks.loadLocalEpicsMock(...args),
  };
});

import {
  normalizeRitualSchedule,
  reconcileHabitLinkedTasks,
} from "./habitTaskReconciliation";

const buildTask = (overrides: Record<string, unknown> = {}) => ({
  id: "task-1",
  user_id: "user-1",
  task_text: "Strength Training Sessions",
  difficulty: "hard",
  xp_reward: 20,
  task_date: "2026-02-09",
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
  habit_source_id: "habit-strength",
  epic_id: "epic-1",
  epic_title: "Strong Week",
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

describe("habitTaskReconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetIds();
    mocks.loadLocalEpicsMock.mockResolvedValue([
      {
        id: "epic-1",
        title: "Strong Week",
        status: "active",
        epic_habits: [{ habit_id: "habit-strength", habits: null }],
      },
    ]);
  });

  it("normalizes weekday selections into the canonical 5x_week schedule", () => {
    expect(
      normalizeRitualSchedule({
        frequency: "5x_week",
        customDays: [4, 2, 0, 3, 1],
        customMonthDays: [],
        customPeriod: "week",
      }),
    ).toEqual({
      frequency: "5x_week",
      custom_days: [0, 1, 2, 3, 4],
      custom_month_days: null,
      customPeriod: "week",
    });
  });

  it("creates missing weekday instances when a Monday-only ritual becomes weekdays", async () => {
    mocks.getAllLocalTasksForUserMock.mockResolvedValue([
      buildTask({ id: "task-mon", task_date: "2026-02-09" }),
    ]);

    const result = await reconcileHabitLinkedTasks(
      {
        habitId: "habit-strength",
        userId: "user-1",
        title: "Strength Training Sessions",
        difficulty: "hard",
        estimated_minutes: 180,
        preferred_time: "07:00",
        category: "body",
        reminder_enabled: false,
        reminder_minutes_before: 15,
        frequency: "5x_week",
        custom_days: [0, 1, 2, 3, 4],
        custom_month_days: null,
        customPeriod: "week",
      },
      {
        today: "2026-02-09",
        horizonDays: 4,
      },
    );

    expect(result.createdTasks.map((task) => task.task_date)).toEqual([
      "2026-02-10",
      "2026-02-11",
      "2026-02-12",
      "2026-02-13",
    ]);
    expect(result.deletedTasks).toHaveLength(0);
  });

  it("removes extra weekday instances when a ritual becomes Monday-only", async () => {
    mocks.getAllLocalTasksForUserMock.mockResolvedValue([
      buildTask({ id: "task-mon", task_date: "2026-02-09" }),
      buildTask({ id: "task-tue", task_date: "2026-02-10" }),
      buildTask({ id: "task-wed", task_date: "2026-02-11" }),
      buildTask({ id: "task-thu", task_date: "2026-02-12" }),
      buildTask({ id: "task-fri", task_date: "2026-02-13" }),
    ]);

    const result = await reconcileHabitLinkedTasks(
      {
        habitId: "habit-strength",
        userId: "user-1",
        title: "Strength Training Sessions",
        difficulty: "hard",
        estimated_minutes: 180,
        preferred_time: "07:00",
        category: "body",
        reminder_enabled: false,
        reminder_minutes_before: 15,
        frequency: "weekly",
        custom_days: [0],
        custom_month_days: null,
        customPeriod: "week",
      },
      {
        today: "2026-02-09",
        horizonDays: 4,
      },
    );

    expect(result.deletedTasks.map((task) => task.id)).toEqual([
      "task-tue",
      "task-wed",
      "task-thu",
      "task-fri",
    ]);
    expect(result.createdTasks).toHaveLength(0);
  });

  it("keeps matching future dates but updates their metadata in place", async () => {
    mocks.getAllLocalTasksForUserMock.mockResolvedValue([
      buildTask({
        id: "task-tue",
        task_date: "2026-02-10",
        task_text: "Old Strength Session",
        scheduled_time: "07:00",
      }),
      buildTask({
        id: "task-wed",
        task_date: "2026-02-11",
        task_text: "Old Strength Session",
        scheduled_time: "07:00",
      }),
    ]);

    const result = await reconcileHabitLinkedTasks(
      {
        habitId: "habit-strength",
        userId: "user-1",
        title: "Strength Training Sessions",
        difficulty: "easy",
        estimated_minutes: 90,
        preferred_time: "08:30",
        category: "body",
        reminder_enabled: true,
        reminder_minutes_before: 30,
        frequency: "5x_week",
        custom_days: [0, 1, 2, 3, 4],
        custom_month_days: null,
        customPeriod: "week",
      },
      {
        today: "2026-02-10",
        horizonDays: 1,
      },
    );

    expect(result.updatedTasks).toHaveLength(2);
    expect(result.updatedTasks.map((entry) => entry.existingTask.id)).toEqual(["task-tue", "task-wed"]);
    expect(result.updatedTasks.every((entry) => entry.nextTask.task_text === "Strength Training Sessions")).toBe(true);
    expect(result.updatedTasks.every((entry) => entry.nextTask.scheduled_time === "08:30")).toBe(true);
    expect(result.updatedTasks.every((entry) => entry.nextTask.estimated_duration === 90)).toBe(true);
  });

  it("leaves past and completed ritual instances untouched", async () => {
    mocks.getAllLocalTasksForUserMock.mockResolvedValue([
      buildTask({
        id: "task-past",
        task_date: "2026-02-09",
      }),
      buildTask({
        id: "task-completed-today",
        task_date: "2026-02-12",
        completed: true,
        completed_at: "2026-02-12T10:00:00.000Z",
      }),
    ]);

    const result = await reconcileHabitLinkedTasks(
      {
        habitId: "habit-strength",
        userId: "user-1",
        title: "Strength Training Sessions",
        difficulty: "hard",
        estimated_minutes: 180,
        preferred_time: "07:00",
        category: "body",
        reminder_enabled: false,
        reminder_minutes_before: 15,
        frequency: "weekly",
        custom_days: [0],
        custom_month_days: null,
        customPeriod: "week",
      },
      {
        today: "2026-02-12",
        horizonDays: 0,
      },
    );

    expect(result.createdTasks).toHaveLength(0);
    expect(result.updatedTasks).toHaveLength(0);
    expect(result.deletedTasks).toHaveLength(0);
  });
});
