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
      redirectUri: "https://app.cosmiq.quest/calendar/oauth/callback",
    });

    expect(getCalendarOAuthStateHint(state)).toEqual({
      provider: "outlook",
      source: "native",
      redirectUri: "https://app.cosmiq.quest/calendar/oauth/callback",
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

  it("uses original hosted origin for native universal-link callbacks", () => {
    const state = stateFor({
      v: 1,
      provider: "google",
      source: "native",
      syncMode: "send_only",
      userId: "user-1",
    });

    expect(
      getCalendarOAuthCallbackContext({
        search:
          `?code=oauth-code&state=${encodeURIComponent(state)}&calendar_callback_origin=https%3A%2F%2Fapp.cosmiq.quest`,
        origin: "capacitor://localhost",
        pathname: "/calendar/oauth/callback",
      }),
    ).toMatchObject({
      provider: "google",
      source: "native",
      code: "oauth-code",
      state,
      redirectUri: "https://app.cosmiq.quest/calendar/oauth/callback",
    });
  });

  it("prefers signed state redirect URIs over WebView callback origins", () => {
    const state = stateFor({
      v: 1,
      provider: "outlook",
      source: "native",
      syncMode: "send_only",
      userId: "user-1",
      redirectUri: "https://app.cosmiq.quest/calendar/oauth/callback",
    });

    expect(
      getCalendarOAuthCallbackContext({
        search: `?code=oauth-code&state=${encodeURIComponent(state)}`,
        origin: "capacitor://localhost",
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
});
