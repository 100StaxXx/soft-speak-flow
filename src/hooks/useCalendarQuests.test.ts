import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useLegacyCalendarTaskRangeMock: vi.fn(),
}));

vi.mock("./internal/useLegacyCalendarTaskRange", () => ({
  useLegacyCalendarTaskRange: (...args: unknown[]) => mocks.useLegacyCalendarTaskRangeMock(...args),
}));

import { useCalendarQuests } from "./useCalendarQuests";

describe("useCalendarQuests", () => {
  it("reuses the internal legacy calendar task range hook and exposes canonical quest DTOs", () => {
    mocks.useLegacyCalendarTaskRangeMock.mockReturnValue({
      tasks: [{
        id: "task-1",
        user_id: "user-1",
        task_text: "Plan the week",
        difficulty: "medium",
        xp_reward: 25,
        task_date: "2026-04-22",
        completed: false,
        completed_at: null,
        is_main_quest: true,
        scheduled_time: "11:00",
        estimated_duration: 45,
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
    });

    const selectedDate = new Date("2026-04-22T12:00:00.000Z");
    const { result } = renderHook(() =>
      useCalendarQuests(selectedDate, "week", { enabled: false }),
    );

    expect(mocks.useLegacyCalendarTaskRangeMock).toHaveBeenCalledWith(selectedDate, "week", {
      enabled: false,
    });
    expect(result.current.quests[0]).toMatchObject({
      id: "task-1",
      title: "Plan the week",
      taskDate: "2026-04-22",
      scheduledTime: "11:00",
      isMainQuest: true,
    });
  });
});
