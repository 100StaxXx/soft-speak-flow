import { describe, expect, it } from "vitest";
import {
  getPushNotificationSourceLabel,
  mapPushNotificationRowToInboxItem,
} from "@/hooks/usePushNotificationsInbox";

describe("push notification inbox mapping", () => {
  it("formats delivered queue rows for the tray", () => {
    expect(
      mapPushNotificationRowToInboxItem({
        id: "queue-1",
        notification_type: "task_reminder",
        title: "Quest soon",
        body: "Start the thing.",
        delivered_at: "2026-05-07T12:00:00.000Z",
        read_at: null,
        opened_at: null,
        payload: {
          task_id: "task-1",
          url: "/tasks",
        },
      }),
    ).toEqual({
      id: "queue-1",
      type: "task_reminder",
      sourceLabel: "Quest reminder",
      title: "Quest soon",
      body: "Start the thing.",
      deliveredAt: "2026-05-07T12:00:00.000Z",
      readAt: null,
      openedAt: null,
      destinationPath: "/journeys?taskId=task-1",
    });
  });

  it("uses stable labels for known notification types", () => {
    expect(getPushNotificationSourceLabel("daily_quote")).toBe("Daily quote");
    expect(getPushNotificationSourceLabel("task_reminder", { habit_source_id: "habit-1" })).toBe("Ritual reminder");
    expect(getPushNotificationSourceLabel("task_start", { is_ritual: true })).toBe("Ritual start");
    expect(getPushNotificationSourceLabel("checkin_evening_reminder")).toBe("Evening reflection");
    expect(getPushNotificationSourceLabel("unknown")).toBe("Cosmiq");
  });

  it("labels legacy daily task notification rows as rituals when source context says so", () => {
    const item = mapPushNotificationRowToInboxItem({
      id: "queue-ritual",
      notification_type: "task_reminder",
      title: "Ritual soon",
      body: "Start the ritual.",
      delivered_at: "2026-05-07T12:00:00.000Z",
      read_at: null,
      opened_at: null,
      source_table: "daily_tasks",
      source_id: "task-ritual",
      payload: {
        task_id: "task-ritual",
        url: "/journeys?taskId=task-ritual",
      },
    }, {
      ritualTaskIds: new Set(["task-ritual"]),
    });

    expect(item.sourceLabel).toBe("Ritual reminder");
  });

});
