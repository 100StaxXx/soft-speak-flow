import type { ReactNode } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  let deepLinkHandler:
    | ((data: {
      type: "auth_recovery" | "task" | "calendar_oauth" | "calendar_oauth_callback" | "unknown";
      path?: string;
      rawUrl: string;
      taskId?: string;
      provider?: "google" | "outlook";
      status?: "success" | "error";
      message?: string;
    }) => void)
    | null = null;

  return {
    cleanupMock: vi.fn(),
    setHandler: (handler: typeof deepLinkHandler) => {
      deepLinkHandler = handler;
    },
    getHandler: () => deepLinkHandler,
  };
});

vi.mock("@/utils/deepLinkHandler", () => ({
  initializeDeepLinkHandler: (handler: typeof mocks.getHandler extends () => infer T ? T : never) => {
    mocks.setHandler(handler);
    return mocks.cleanupMock;
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

import { DeepLinkProvider } from "./DeepLinkContext";

describe("DeepLinkProvider", () => {
  let dispatchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    dispatchSpy = vi.spyOn(window, "dispatchEvent");
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
  });

  it("dispatches auth recovery navigation events", () => {
    render(
      <DeepLinkProvider>
        <div>child</div>
      </DeepLinkProvider>,
    );

    const handler = mocks.getHandler();
    expect(handler).not.toBeNull();

    act(() => {
      handler?.({
        type: "auth_recovery",
        path: "/auth/reset-password#access_token=token&refresh_token=refresh&type=recovery",
        rawUrl:
          "https://app.cosmiq.quest/auth/reset-password#access_token=token&refresh_token=refresh&type=recovery",
      });
    });

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent<{ path: string }>;
    expect(event.type).toBe("deep-link-navigation");
    expect(event.detail).toEqual({
      path: "/auth/reset-password#access_token=token&refresh_token=refresh&type=recovery",
    });
  });

  it("dispatches calendar oauth callback navigation events", () => {
    render(
      <DeepLinkProvider>
        <div>child</div>
      </DeepLinkProvider>,
    );

    const handler = mocks.getHandler();
    expect(handler).not.toBeNull();

    act(() => {
      handler?.({
        type: "calendar_oauth_callback",
        path:
          "/calendar/oauth/callback?code=oauth-code&state=signed-state&calendar_callback_origin=https%3A%2F%2Fapp.cosmiq.quest",
        rawUrl:
          "https://app.cosmiq.quest/calendar/oauth/callback?code=oauth-code&state=signed-state",
      });
    });

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent<{ path: string }>;
    expect(event.type).toBe("deep-link-navigation");
    expect(event.detail).toEqual({
      path:
        "/calendar/oauth/callback?code=oauth-code&state=signed-state&calendar_callback_origin=https%3A%2F%2Fapp.cosmiq.quest",
    });
  });
});
