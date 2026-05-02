import { describe, expect, it } from "vitest";
import {
  getCalendarOAuthCallbackContext,
  getCalendarOAuthStateHint,
} from "./CalendarOAuthCallback";

function stateFor(payload: Record<string, unknown>): string {
  const raw = JSON.stringify(payload);
  const encoded = btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `${encoded}.signature`;
}

describe("CalendarOAuthCallback helpers", () => {
  it("reads provider and source hints from signed-state payloads", () => {
    const state = stateFor({
      v: 1,
      provider: "outlook",
      source: "native",
      syncMode: "send_only",
      userId: "user-1",
    });

    expect(getCalendarOAuthStateHint(state)).toEqual({
      provider: "outlook",
      source: "native",
    });
  });

  it("defaults legacy state hints without source to web", () => {
    const state = stateFor({
      v: 1,
      provider: "google",
      syncMode: "send_only",
      userId: "user-1",
    });

    expect(getCalendarOAuthStateHint(state)).toEqual({
      provider: "google",
      source: "web",
    });
  });

  it("uses stable no-query redirect URIs for state-based callbacks", () => {
    const state = stateFor({
      v: 1,
      provider: "outlook",
      source: "native",
      syncMode: "send_only",
      userId: "user-1",
    });

    expect(
      getCalendarOAuthCallbackContext({
        search: `?code=oauth-code&state=${encodeURIComponent(state)}`,
        origin: "https://app.cosmiq.quest",
        pathname: "/calendar/oauth/callback",
      }),
    ).toMatchObject({
      provider: "outlook",
      source: "native",
      code: "oauth-code",
      state,
      redirectUri: "https://app.cosmiq.quest/calendar/oauth/callback",
    });
  });

  it("keeps legacy query redirect URI matching for already-started callbacks", () => {
    expect(
      getCalendarOAuthCallbackContext({
        search: "?calendar_provider=google&calendar_source=native&code=legacy-code",
        origin: "https://app.cosmiq.quest",
        pathname: "/calendar/oauth/callback",
      }),
    ).toMatchObject({
      provider: "google",
      source: "native",
      code: "legacy-code",
      redirectUri:
        "https://app.cosmiq.quest/calendar/oauth/callback?calendar_provider=google&calendar_source=native",
    });
  });
});
