import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const queryClient = {
    invalidateQueries: vi.fn(),
  };

  return {
    configure: vi.fn(),
    invoke: vi.fn(),
    isNativeIOSHandheld: vi.fn(() => false),
    isNativePlatform: vi.fn(() => false),
    loggerDebug: vi.fn(),
    loggerError: vi.fn(),
    profile: {
      created_at: "2026-04-29T12:00:00.000Z",
      referral_code: null as string | null,
      referred_by_code: null as string | null,
    },
    queryClient,
    setAppUserId: vi.fn(),
    setFirstSeenAt: vi.fn(),
    setIsPremium: vi.fn(),
    status: "authenticated",
    user: { id: "user-1" },
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mocks.queryClient,
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.isNativePlatform(),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    status: mocks.status,
    user: mocks.user,
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: mocks.profile,
  }),
}));

vi.mock("@/hooks/useStoreKit", () => ({
  useStoreKit: () => ({
    isPro: false,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.invoke(...args),
    },
  },
}));

vi.mock("@/plugins/WinWinKitPlugin", () => ({
  WinWinKit: {
    configure: () => mocks.configure(),
    setAppUserId: (...args: unknown[]) => mocks.setAppUserId(...args),
    setFirstSeenAt: (...args: unknown[]) => mocks.setFirstSeenAt(...args),
    setIsPremium: (...args: unknown[]) => mocks.setIsPremium(...args),
  },
}));

vi.mock("@/utils/platformTargets", () => ({
  isNativeIOSHandheld: () => mocks.isNativeIOSHandheld(),
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    debug: (...args: unknown[]) => mocks.loggerDebug(...args),
    error: (...args: unknown[]) => mocks.loggerError(...args),
  },
}));

import { useWinWinKitSync } from "./useWinWinKitSync";

const originalOnlineDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
}

describe("useWinWinKitSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profile.referral_code = null;
    mocks.profile.referred_by_code = null;
    mocks.status = "authenticated";
    mocks.user = { id: "user-1" };
    mocks.isNativePlatform.mockReturnValue(false);
    mocks.isNativeIOSHandheld.mockReturnValue(false);
    setOnline(true);
  });

  afterEach(() => {
    if (originalOnlineDescriptor) {
      Object.defineProperty(window.navigator, "onLine", originalOnlineDescriptor);
    }
  });

  it("syncs referral state and invalidates local referral queries when state changes", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        user: {
          referral_code: "COSMIQ1",
          referred_by: { code: "FRIEND1" },
        },
      },
      error: null,
    });

    renderHook(() => useWinWinKitSync());

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("sync-winwinkit-user", {
        body: {
          first_seen_at: "2026-04-29T12:00:00.000Z",
          is_premium: false,
        },
      });
    });

    await waitFor(() => {
      expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["profile", "user-1"] });
      expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["referral-stats", "user-1"] });
      expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["applied-referral-code-state", "user-1"],
      });
    });

    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it("defers the background sync while offline and retries when the app comes online", async () => {
    setOnline(false);
    mocks.invoke.mockResolvedValue({
      data: {
        user: {
          referral_code: null,
          referred_by: null,
        },
      },
      error: null,
    });

    renderHook(() => useWinWinKitSync());

    await waitFor(() => {
      expect(mocks.loggerDebug).toHaveBeenCalledWith(
        "WinWinKit referral sync deferred while offline",
        expect.objectContaining({ source: "initial" }),
      );
    });

    expect(mocks.invoke).not.toHaveBeenCalled();

    setOnline(true);
    window.dispatchEvent(new Event("online"));

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledTimes(1);
    });

    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it("treats FunctionsFetchError as retriable background work instead of logging an error", async () => {
    mocks.invoke
      .mockResolvedValueOnce({
        data: null,
        error: {
          name: "FunctionsFetchError",
          message: "Failed to send a request to the Edge Function",
        },
      })
      .mockResolvedValueOnce({
        data: {
          user: {
            referral_code: null,
            referred_by: null,
          },
        },
        error: null,
      });

    renderHook(() => useWinWinKitSync());

    await waitFor(() => {
      expect(mocks.loggerDebug).toHaveBeenCalledWith(
        "WinWinKit referral sync deferred; will retry",
        expect.objectContaining({
          category: "network",
          name: "FunctionsFetchError",
        }),
      );
    });

    expect(mocks.loggerError).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("online"));

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledTimes(2);
    });
  });
});
