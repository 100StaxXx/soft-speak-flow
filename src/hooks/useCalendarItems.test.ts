import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useExternalCalendarEventsMock: vi.fn(),
  useDailyTasksMock: vi.fn(),
  useCalendarTasksMock: vi.fn(),
  useQuestCalendarSyncMock: vi.fn(),
}));

vi.mock("@/hooks/useExternalCalendarEvents", () => ({
  useExternalCalendarEvents: (...args: unknown[]) =>
    mocks.useExternalCalendarEventsMock(...args),
}));

vi.mock("@/hooks/useDailyTasks", () => ({
  useDailyTasks: (...args: unknown[]) => mocks.useDailyTasksMock(...args),
}));

vi.mock("@/hooks/useCalendarTasks", () => ({
  useCalendarTasks: (...args: unknown[]) => mocks.useCalendarTasksMock(...args),
}));

vi.mock("@/hooks/useQuestCalendarSync", () => ({
  useQuestCalendarSync: (...args: unknown[]) =>
    mocks.useQuestCalendarSyncMock(...args),
}));

import { useCalendarItems } from "./useCalendarItems";

describe("useCalendarItems", () => {
  it("combines external events and day quests into canonical calendar items", () => {
    const selectedDate = new Date("2026-04-22T12:00:00.000Z");

    mocks.useExternalCalendarEventsMock.mockReturnValue({
      events: [
        {
          id: "event-1",
          title: "Doctor appointment",
          start: "2026-04-22T08:00:00.000Z",
          end: "2026-04-22T09:00:00.000Z",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
      ],
      isLoading: false,
    });
    mocks.useDailyTasksMock.mockReturnValue({
      tasks: [
        {
          id: "task-1",
          user_id: "user-1",
          task_text: "Deep work block",
          difficulty: "medium",
          xp_reward: 20,
          task_date: "2026-04-22",
          completed: false,
          completed_at: null,
          is_main_quest: true,
          scheduled_time: "10:15",
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
          created_at: "2026-04-22T07:00:00.000Z",
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
        },
      ],
      isLoading: false,
    });
    mocks.useCalendarTasksMock.mockReturnValue({
      tasks: [],
      isLoading: false,
    });
    mocks.useQuestCalendarSyncMock.mockReturnValue({
      linksByTask: new Map([
        [
          "task-1",
          [
            {
              connection_id: "connection-1",
              external_event_id: "google-quest-1",
              provider: "google",
              sync_mode: "full_sync",
            },
          ],
        ],
      ]),
      outlookTaskLinksByTask: new Map(),
    });

    const { result } = renderHook(() =>
      useCalendarItems(selectedDate, "day", { enabled: false }),
    );

    expect(mocks.useExternalCalendarEventsMock).toHaveBeenCalledWith(
      selectedDate,
      "day",
      { enabled: false },
    );
    expect(mocks.useDailyTasksMock).toHaveBeenCalledWith(selectedDate, {
      enabled: false,
    });
    expect(mocks.useCalendarTasksMock).toHaveBeenCalledWith(selectedDate, "week", {
      enabled: false,
    });
    expect(mocks.useQuestCalendarSyncMock).toHaveBeenCalledWith({
      enabled: false,
    });
    expect(result.current.items).toMatchObject([
      {
        id: "external:event-1",
        source: "external_event",
        title: "Doctor appointment",
        provider: "google",
      },
      {
        id: "quest:task-1",
        source: "quest",
        title: "Deep work block",
        questId: "task-1",
        provider: "google",
        syncMode: "full_sync",
      },
    ]);
    expect(result.current.isLoading).toBe(false);
  });

  it("uses range quests for non-day horizons and can exclude quest items", () => {
    const selectedDate = new Date("2026-04-22T12:00:00.000Z");

    mocks.useExternalCalendarEventsMock.mockReturnValue({
      events: [
        {
          id: "event-2",
          title: "Offsite",
          start: "2026-04-23T15:00:00.000Z",
          end: "2026-04-23T16:00:00.000Z",
          isAllDay: false,
          provider: "outlook",
          readOnly: true,
        },
      ],
      isLoading: true,
    });
    mocks.useDailyTasksMock.mockReturnValue({
      tasks: [],
      isLoading: false,
    });
    mocks.useCalendarTasksMock.mockReturnValue({
      tasks: [],
      isLoading: false,
    });
    mocks.useQuestCalendarSyncMock.mockReturnValue({
      linksByTask: new Map(),
      outlookTaskLinksByTask: new Map(),
    });

    const { result } = renderHook(() =>
      useCalendarItems(selectedDate, "month", {
        enabled: true,
        includeQuests: false,
      }),
    );

    expect(mocks.useDailyTasksMock).toHaveBeenCalledWith(selectedDate, {
      enabled: false,
    });
    expect(mocks.useCalendarTasksMock).toHaveBeenCalledWith(selectedDate, "month", {
      enabled: false,
    });
    expect(mocks.useQuestCalendarSyncMock).toHaveBeenCalledWith({
      enabled: false,
    });
    expect(result.current.items).toMatchObject([
      {
        id: "external:event-2",
        source: "external_event",
        title: "Offsite",
      },
    ]);
    expect(result.current.isLoading).toBe(true);
  });
});
