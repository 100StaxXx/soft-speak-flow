import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useExternalCalendarEventsMock: vi.fn(),
  useQuestsMock: vi.fn(),
  useCalendarQuestsMock: vi.fn(),
  useQuestCalendarSyncMock: vi.fn(),
}));

vi.mock("@/hooks/useExternalCalendarEvents", () => ({
  useExternalCalendarEvents: (...args: unknown[]) =>
    mocks.useExternalCalendarEventsMock(...args),
}));

vi.mock("@/hooks/useQuests", () => ({
  useQuests: (...args: unknown[]) => mocks.useQuestsMock(...args),
}));

vi.mock("@/hooks/useCalendarQuests", () => ({
  useCalendarQuests: (...args: unknown[]) => mocks.useCalendarQuestsMock(...args),
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
    mocks.useQuestsMock.mockReturnValue({
      quests: [
        {
          id: "task-1",
          userId: "user-1",
          title: "Deep work block",
          difficulty: "medium",
          xpReward: 20,
          taskDate: "2026-04-22",
          completed: false,
          completedAt: null,
          isMainQuest: true,
          scheduledTime: "10:15",
          estimatedDuration: 45,
          recurrencePattern: null,
          recurrenceDays: null,
          recurrenceMonthDays: null,
          recurrenceCustomPeriod: null,
          recurrenceEndDate: null,
          isRecurring: false,
          reminderEnabled: false,
          reminderMinutesBefore: null,
          reminderSent: false,
          parentTemplateId: null,
          category: null,
          isBonus: false,
          createdAt: "2026-04-22T07:00:00.000Z",
          priority: null,
          isTopThree: false,
          actualTimeSpent: null,
          aiGenerated: false,
          contextId: null,
          source: "manual",
          habitSourceId: null,
          campaignId: null,
          campaignTitle: null,
          sortOrder: null,
          contactId: null,
          autoLogInteraction: false,
          contact: null,
          imageUrl: null,
          attachments: [],
          notes: null,
          location: null,
          subtasks: [],
        },
      ],
      isLoading: false,
    });
    mocks.useCalendarQuestsMock.mockReturnValue({
      quests: [],
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
    expect(mocks.useQuestsMock).toHaveBeenCalledWith(selectedDate, {
      enabled: false,
    });
    expect(mocks.useCalendarQuestsMock).toHaveBeenCalledWith(selectedDate, "week", {
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
    mocks.useQuestsMock.mockReturnValue({
      quests: [],
      isLoading: false,
    });
    mocks.useCalendarQuestsMock.mockReturnValue({
      quests: [],
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

    expect(mocks.useQuestsMock).toHaveBeenCalledWith(selectedDate, {
      enabled: false,
    });
    expect(mocks.useCalendarQuestsMock).toHaveBeenCalledWith(selectedDate, "month", {
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
