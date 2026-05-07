import { describe, expect, it } from "vitest";
import {
  buildPushNotificationNavigationDetail,
  normalizePushNotificationNavigationDetail,
  resolvePushNotificationDestination,
} from "@/utils/pushNotificationNavigation";

describe("push notification navigation", () => {
  it("routes legacy task URLs to journeys with the task id", () => {
    expect(
      resolvePushNotificationDestination({
        url: "/tasks",
        task_id: "task-1",
        type: "task_reminder",
      }),
    ).toBe("/journeys?taskId=task-1");
  });

  it("rejects external URLs and falls back by notification type", () => {
    expect(
      resolvePushNotificationDestination({
        url: "https://example.com/phish",
        type: "mentor_nudge",
      }),
    ).toBe("/companion");
  });

  it("maps Cosmiq task deep links into app routes", () => {
    expect(
      resolvePushNotificationDestination({
        deepLink: "cosmiq://task/task-2",
      }),
    ).toBe("/journeys?taskId=task-2");
  });

  it("keeps queue ids with native push navigation details", () => {
    expect(
      buildPushNotificationNavigationDetail({
        queue_id: "queue-1",
        task_id: "task-3",
        url: "/tasks",
      }),
    ).toEqual({
      url: "/journeys?taskId=task-3",
      queueId: "queue-1",
    });
  });

  it("normalizes the legacy string event detail shape", () => {
    expect(normalizePushNotificationNavigationDetail("/tasks")).toEqual({
      url: "/journeys",
    });
  });
});
