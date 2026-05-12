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
