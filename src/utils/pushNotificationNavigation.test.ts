import { describe, expect, it } from "vitest";
import {
  buildPushNotificationNavigationDetail,
  normalizePushNotificationNavigationDetail,
  resolvePushNotificationDestination,
} from "@/utils/pushNotificationNavigation";

describe("push notification navigation", () => {
  it("routes legacy task URLs to the prepared Today experience", () => {
    expect(
      resolvePushNotificationDestination({
        url: "/tasks",
        task_id: "task-1",
        type: "task_reminder",
      }),
    ).toBe("/mentor");
  });

  it("rejects external URLs and falls back by notification type", () => {
    expect(
      resolvePushNotificationDestination({
        url: "https://example.com/phish",
        type: "mentor_nudge",
      }),
    ).toBe("/guide");
  });

  it("maps Cosmiq task deep links to Today only for Cosmiq", () => {
    expect(
      resolvePushNotificationDestination({
        deepLink: "cosmiq://task/task-2",
      }, null, "cosmiq"),
    ).toBe("/mentor");
  });

  it("does not honor a Cosmiq app URL in Graceward", () => {
    expect(
      resolvePushNotificationDestination({
        url: "https://app.cosmiq.quest/journeys?day=today",
      }, null, "christian"),
    ).toBe("/mentor");
  });

  it("does not honor a Graceward app URL in Cosmiq", () => {
    expect(
      resolvePushNotificationDestination({
        url: "https://graceward.app/pep-talk/private",
      }, null, "cosmiq"),
    ).toBe("/mentor");
  });

  it("keeps queue ids with native push navigation details", () => {
    expect(
      buildPushNotificationNavigationDetail({
        queue_id: "queue-1",
        task_id: "task-3",
        url: "/tasks",
      }),
    ).toEqual({
      url: "/mentor",
      queueId: "queue-1",
    });
  });

  it("normalizes the legacy string event detail shape", () => {
    expect(normalizePushNotificationNavigationDetail("/tasks")).toEqual({
      url: "/mentor",
    });
  });

  it("opens a daily encouragement notification in its full player", () => {
    expect(
      resolvePushNotificationDestination({
        type: "daily_pep",
        pep_talk_id: "daily-encouragement-1",
      }),
    ).toBe("/pep-talk/daily-encouragement-1");
  });

  it("falls back to the Today encouragement card when an old push has no id", () => {
    expect(resolvePushNotificationDestination({ type: "daily_pep" }))
      .toBe("/mentor#daily-encouragement");
  });
});
