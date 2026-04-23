import { describe, expect, it } from "vitest";

import type { Quest } from "@/types/domain";

import {
  toCalendarItemFromExternalEvent,
  toCalendarItemFromQuest,
} from "./calendarItemAdapters";

const buildQuest = (): Quest => ({
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
  estimatedDuration: 50,
  recurrencePattern: null,
  recurrenceDays: [],
  recurrenceMonthDays: [],
  recurrenceCustomPeriod: null,
  recurrenceEndDate: null,
  isRecurring: false,
  reminderEnabled: false,
  reminderMinutesBefore: null,
  category: null,
  priority: null,
  aiGenerated: false,
  source: "manual",
  habitSourceId: null,
  campaignId: null,
  campaignTitle: null,
  sortOrder: null,
  contactId: null,
  autoLogInteraction: false,
  imageUrl: null,
  attachments: [],
  notes: null,
  location: null,
  subtasks: [],
});

describe("calendar item adapters", () => {
  it("maps external provider events into read-only calendar items", () => {
    expect(toCalendarItemFromExternalEvent({
      id: "event-1",
      connection_id: "connection-1",
      title: "Doctor appointment",
      start_time: "2026-04-22T16:00:00.000Z",
      end_time: "2026-04-22T17:00:00.000Z",
      is_all_day: false,
      source: "google",
      external_event_id: "google-1",
      color: null,
      description: null,
      location: null,
      raw_data: null,
      synced_at: null,
      user_id: "user-1",
    })).toEqual({
      id: "external:event-1",
      source: "external_event",
      title: "Doctor appointment",
      startsAt: "2026-04-22T16:00:00.000Z",
      endsAt: "2026-04-22T17:00:00.000Z",
      isAllDay: false,
      provider: "google",
      readOnly: true,
      questId: null,
      syncMode: null,
      sourceTable: "external_calendar_events",
      externalEventId: "google-1",
      connectionId: "connection-1",
      taskDate: null,
      scheduledTime: null,
      estimatedDuration: null,
    });
  });

  it("maps scheduled quests into user-owned calendar items with sync metadata", () => {
    expect(toCalendarItemFromQuest(buildQuest(), {
      calendarLinks: [
        {
          connection_id: "connection-1",
          external_event_id: "google-quest-1",
          provider: "google",
          sync_mode: "full_sync",
        },
      ],
    })).toMatchObject({
      id: "quest:task-1",
      source: "quest",
      title: "Deep work block",
      startsAt: "2026-04-22T10:15:00",
      endsAt: "2026-04-22T11:05:00",
      isAllDay: false,
      provider: "google",
      readOnly: false,
      questId: "task-1",
      syncMode: "full_sync",
      externalEventId: "google-quest-1",
      connectionId: "connection-1",
    });
  });

  it("projects date-only quests as all-day calendar items for Outlook To Do compatibility", () => {
    const quest = buildQuest();
    quest.scheduledTime = null;

    expect(toCalendarItemFromQuest(quest, {
      outlookTaskLinks: [
        {
          connection_id: "connection-2",
          external_task_id: "outlook-task-1",
          provider: "outlook",
          sync_mode: "send_only",
        },
      ],
    })).toMatchObject({
      isAllDay: true,
      provider: "outlook",
      syncMode: "send_only",
      externalEventId: "outlook-task-1",
      startsAt: "2026-04-22T00:00:00",
      endsAt: "2026-04-22T23:59:59",
    });
  });
});
