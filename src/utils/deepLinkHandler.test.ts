import { describe, expect, it } from "vitest";
import { parseDeepLink } from "./deepLinkHandler";

describe("parseDeepLink", () => {
  it("parses task deep links", () => {
    const parsed = parseDeepLink("cosmiq://task/task-123?from=widget");
    expect(parsed).toEqual({
      type: "task",
      taskId: "task-123",
      rawUrl: "cosmiq://task/task-123?from=widget",
    });
  });

  it.each([
    "com.darrylgraham.revolution://tasks/task-legacy",
    "https://app.cosmiq.quest/task/task-legacy",
    "https://cosmiq.quest/tasks/task-legacy",
  ])("normalizes legacy and universal task URLs from %s", (url) => {
    expect(parseDeepLink(url)).toEqual({
      type: "task",
      taskId: "task-legacy",
      rawUrl: url,
    });
  });

  it("parses calendar oauth callback deep links", () => {
    const parsed = parseDeepLink(
      "cosmiq://calendar/oauth/callback?provider=google&status=error&message=OAuth%20failed",
    );
    expect(parsed).toEqual({
      type: "calendar_oauth",
      provider: "google",
      status: "error",
      message: "OAuth failed",
      rawUrl:
        "cosmiq://calendar/oauth/callback?provider=google&status=error&message=OAuth%20failed",
    });
  });

  it("parses app-only epic invite deep links", () => {
    const parsed = parseDeepLink("cosmiq://join/EPIC-QUEST-1234");
    expect(parsed).toEqual({
      type: "join_epic",
      path: "/join/EPIC-QUEST-1234",
      rawUrl: "cosmiq://join/EPIC-QUEST-1234",
    });
  });

  it("preserves encoded epic invite codes in app-only deep links", () => {
    const parsed = parseDeepLink("cosmiq://join/EPIC%20QUEST%2F1234");
    expect(parsed).toEqual({
      type: "join_epic",
      path: "/join/EPIC%20QUEST%2F1234",
      rawUrl: "cosmiq://join/EPIC%20QUEST%2F1234",
    });
  });

  it.each([
    "com.darrylgraham.revolution://epics/join/EPIC-OLD-1234",
    "https://app.cosmiq.quest/join/EPIC-OLD-1234",
    "https://cosmiq.quest/campaigns/join/EPIC-OLD-1234",
  ])("normalizes legacy and universal epic invite URLs from %s", (url) => {
    expect(parseDeepLink(url)).toEqual({
      type: "join_epic",
      path: "/join/EPIC-OLD-1234",
      rawUrl: url,
    });
  });

  it.each(["cosmiq://journeys", "cosmiq://journeys/plan"])(
    "parses widget journeys deep links from %s",
    (url) => {
      const parsed = parseDeepLink(url);
      expect(parsed).toEqual({
        type: "journeys",
        path: "/journeys",
        rawUrl: url,
      });
    },
  );

  it.each([
    "com.darrylgraham.revolution://journeys",
    "https://app.cosmiq.quest/journeys",
    "https://cosmiq.quest/tasks",
  ])("normalizes legacy and universal journeys URLs from %s", (url) => {
    expect(parseDeepLink(url)).toEqual({
      type: "journeys",
      path: "/journeys",
      rawUrl: url,
    });
  });

  it("parses hosted auth recovery links", () => {
    const parsed = parseDeepLink(
      "https://app.cosmiq.quest/auth/reset-password#access_token=token&refresh_token=refresh&type=recovery",
    );
    expect(parsed).toEqual({
      type: "auth_recovery",
      path: "/auth/reset-password#access_token=token&refresh_token=refresh&type=recovery",
      rawUrl:
        "https://app.cosmiq.quest/auth/reset-password#access_token=token&refresh_token=refresh&type=recovery",
    });
  });

  it("parses hosted calendar oauth callback universal links", () => {
    const parsed = parseDeepLink(
      "https://app.cosmiq.quest/calendar/oauth/callback?code=oauth-code&state=signed-state",
    );
    expect(parsed).toEqual({
      type: "calendar_oauth_callback",
      path:
        "/calendar/oauth/callback?code=oauth-code&state=signed-state&calendar_callback_origin=https%3A%2F%2Fapp.cosmiq.quest",
      rawUrl:
        "https://app.cosmiq.quest/calendar/oauth/callback?code=oauth-code&state=signed-state",
    });
  });

  it("parses custom-scheme auth recovery links", () => {
    const parsed = parseDeepLink(
      "cosmiq://auth/reset-password#access_token=token&refresh_token=refresh&type=recovery",
    );
    expect(parsed).toEqual({
      type: "auth_recovery",
      path: "/auth/reset-password#access_token=token&refresh_token=refresh&type=recovery",
      rawUrl:
        "cosmiq://auth/reset-password#access_token=token&refresh_token=refresh&type=recovery",
    });
  });
});
