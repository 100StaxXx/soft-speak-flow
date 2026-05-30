import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const queryClient = {
    invalidateQueries: vi.fn(),
  };

  return {
    invoke: vi.fn(),
    loggerDebug: vi.fn(),
    loggerError: vi.fn(),
    accessLoading: false,
    accessState: {
      has_access: false,
      access_source: "none",
      trial_ends_at: null,
      subscribed: false,
    } as {
      has_access: boolean;
      access_source: "subscription" | "promo_code" | "trial" | "manual" | "none";
      trial_ends_at: string | null;
      subscribed: boolean;
      status?: string;
      plan?: string;
      subscription_end?: string;
    },
    profile: {
      created_at: "2026-04-29T12:00:00.000Z",
      referral_code: null as string | null,
      referred_by_code: null as string | null,
    },
    queryClient,
    status: "authenticated",
    user: { id: "user-1" },
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mocks.queryClient,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    status: mocks.status,
    user: mocks.user,
  }),
}));

vi.mock("@/hooks/useAccessState", () => ({
  useAccessState: () => ({
    accessState: mocks.accessState,
    isLoading: mocks.accessLoading,
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: mocks.profile,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.invoke(...args),
    },
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    debug: (...args: unknown[]) => mocks.loggerDebug(...args),
    error: (...args: unknown[]) => mocks.loggerError(...args),
  },
}));

import { useReferralSync } from "./useReferralSync";

const originalOnlineDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
}

describe("useReferralSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profile.referral_code = null;
    mocks.profile.referred_by_code = null;
    mocks.status = "authenticated";
    mocks.user = { id: "user-1" };
    mocks.accessLoading = false;
    mocks.accessState = {
      has_access: false,
      access_source: "none",
      trial_ends_at: null,
      subscribed: false,
    };
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

    renderHook(() => useReferralSync());

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("sync-referral-user", {
        body: {
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

  it("syncs premium from the hardened subscription access state", async () => {
    mocks.accessState = {
      has_access: true,
      access_source: "subscription",
      trial_ends_at: null,
      subscribed: true,
      status: "active",
      plan: "yearly",
      subscription_end: "2099-01-01T00:00:00.000Z",
    };
    mocks.invoke.mockResolvedValue({
      data: {
        user: {
          referral_code: null,
          referred_by: null,
        },
      },
      error: null,
    });

    renderHook(() => useReferralSync());

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("sync-referral-user", {
        body: {
          is_premium: true,
        },
      });
    });

    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it("does not sync premium when hardened access is inactive", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        user: {
          referral_code: null,
          referred_by: null,
        },
      },
      error: null,
    });

    renderHook(() => useReferralSync());

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("sync-referral-user", {
        body: {
          is_premium: false,
        },
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

    renderHook(() => useReferralSync());

    await waitFor(() => {
      expect(mocks.loggerDebug).toHaveBeenCalledWith(
        "Referral sync deferred while offline",
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

    renderHook(() => useReferralSync());

    await waitFor(() => {
      expect(mocks.loggerDebug).toHaveBeenCalledWith(
        "Referral sync deferred; will retry",
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
