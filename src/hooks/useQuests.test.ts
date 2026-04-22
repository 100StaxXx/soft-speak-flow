import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useDailyTasksMock: vi.fn(),
}));

vi.mock("./useDailyTasks", () => ({
  useDailyTasks: (...args: unknown[]) => mocks.useDailyTasksMock(...args),
}));

import { useQuests } from "./useQuests";

describe("useQuests", () => {
  it("reuses the legacy daily tasks hook and exposes canonical quest DTOs", () => {
    const addTask = vi.fn();
    const updateTask = vi.fn();

    mocks.useDailyTasksMock.mockReturnValue({
      tasks: [{
        id: "task-1",
        user_id: "user-1",
        task_text: "Review adapters",
        difficulty: "medium",
        xp_reward: 15,
        task_date: "2026-04-22",
        completed: false,
        completed_at: null,
        is_main_quest: true,
        scheduled_time: "13:00",
        estimated_duration: 30,
        recurrence_pattern: null,
        recurrence_days: null,
        recurrence_month_days: null,
        recurrence_custom_period: null,
        recurrence_end_date: null,
        is_recurring: false,
        reminder_enabled: false,
        reminder_minutes_before: null,
        reminder_sent: false,
        parent_template_id: null,
        category: null,
        is_bonus: false,
        created_at: null,
        priority: null,
        is_top_three: false,
        actual_time_spent: null,
        ai_generated: false,
        context_id: null,
        source: "manual",
        habit_source_id: null,
        epic_id: null,
        epic_title: null,
        sort_order: null,
        contact_id: null,
        auto_log_interaction: false,
        contact: null,
        image_url: null,
        attachments: [],
        notes: null,
        location: null,
        subtasks: [],
      }],
      isLoading: false,
      addTask,
      toggleTask: vi.fn(),
      deleteTask: vi.fn(),
      setMainQuest: vi.fn(),
      updateTask,
      reorderTasks: vi.fn(),
      moveTaskToSection: vi.fn(),
      moveTaskToDate: vi.fn(),
      restoreTask: vi.fn(),
      isAdding: false,
      isToggling: false,
      isDeleting: false,
      isUpdating: false,
      isReordering: false,
      isMoving: false,
      isMovingDate: false,
      isRestoring: false,
      completedCount: 0,
      totalCount: 1,
    });

    const selectedDate = new Date("2026-04-22T12:00:00.000Z");
    const { result } = renderHook(() => useQuests(selectedDate, { enabled: false }));

    expect(mocks.useDailyTasksMock).toHaveBeenCalledWith(selectedDate, { enabled: false });
    expect(result.current.quests[0]).toMatchObject({
      id: "task-1",
      title: "Review adapters",
      taskDate: "2026-04-22",
      scheduledTime: "13:00",
      isMainQuest: true,
    });
    expect(result.current.createQuest).toBe(addTask);
    expect(result.current.updateQuest).toBe(updateTask);
  });
});
