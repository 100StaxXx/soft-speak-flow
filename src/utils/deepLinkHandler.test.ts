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
});
