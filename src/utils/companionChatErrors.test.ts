import { describe, expect, it } from "vitest";
import {
  resolveCompanionChatError,
  toUserFacingCompanionChatError,
} from "./companionChatErrors";

describe("companionChatErrors", () => {
  it("maps premium gating to the companion-specific premium message", () => {
    expect(
      toUserFacingCompanionChatError({
        category: "auth",
        isOffline: false,
        status: 403,
        backendMessage: "Companion Talk requires Premium access",
        responsePayload: {
          code: "PREMIUM_REQUIRED",
          error: "Companion Talk requires Premium access",
        },
      }),
    ).toBe("Companion Talk is available with Premium.");
  });

  it("maps missing function responses to a rollout-aware message", async () => {
    await expect(
      resolveCompanionChatError({
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: new Response("", { status: 404 }),
      }),
    ).resolves.toBe(
      "Companion Talk isn't live in this environment yet. Please try again after the backend is updated.",
    );
  });

  it("falls back to the generic function error mapper for server failures", () => {
    expect(
      toUserFacingCompanionChatError({
        category: "http",
        isOffline: false,
        status: 503,
      }),
    ).toBe("Our servers are temporarily unavailable. Please try again in a moment.");
  });

  it("maps missing thread storage tables to the setup message", () => {
    expect(
      toUserFacingCompanionChatError({
        category: "http",
        isOffline: false,
        status: 500,
        backendMessage: "relation \"companion_chat_threads\" does not exist",
      }),
    ).toBe(
      "Companion Talk is still being set up here. Please try again after the latest database update.",
    );
  });

  it("maps missing companion chat rollout columns to the setup message", () => {
    expect(
      toUserFacingCompanionChatError({
        category: "http",
        isOffline: false,
        status: 500,
        backendMessage: "Could not find the 'source' column of 'companion_chats' in the schema cache",
      }),
    ).toBe(
      "Companion Talk is still being set up here. Please try again after the latest database update.",
    );
  });
});
