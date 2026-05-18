import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "11111111-1111-4111-8111-111111111111" } as { id: string } | null,
  authLoading: false,
  functionsInvoke: vi.fn(),
  storeKit: {
    isPro: true,
    activePlan: "yearly" as "monthly" | "yearly" | null,
    currentEntitlement: {
      productId: "cosmiq_premium_yearly",
      expirationDate: "2099-01-01T00:00:00.000Z",
      transactionId: "local-tx",
      appAccountToken: "11111111-1111-4111-8111-111111111111",
    },
    expirationDate: new Date("2099-01-01T00:00:00.000Z"),
    entitlementError: false,
    isLoading: false,
  },
}));

const localStorageState = vi.hoisted(() => ({
  store: new Map<string, string>(),
}));

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => localStorageState.store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      localStorageState.store.set(key, value);
    },
    removeItem: (key: string) => {
      localStorageState.store.delete(key);
    },
    clear: () => {
      localStorageState.store.clear();
    },
    key: (index: number) => Array.from(localStorageState.store.keys())[index] ?? null,
    get length() {
      return localStorageState.store.size;
    },
  },
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
    loading: mocks.authLoading,
  }),
}));

vi.mock("@/hooks/useStoreKit", () => ({
  useStoreKit: () => mocks.storeKit,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.functionsInvoke(...args),
    },
  },
}));

import { useAccessState } from "./useAccessState";

const neutralAccessState = {
  has_access: false,
  access_source: "none",
  trial_ends_at: null,
  subscribed: false,
};

const mockSubscriptionCheck = (data: unknown = neutralAccessState) => {
  mocks.functionsInvoke.mockImplementation((functionName: string) => {
    if (functionName === "check-apple-subscription") {
      return Promise.resolve({
        data,
        error: null,
      });
    }

    if (functionName === "verify-apple-receipt") {
      return Promise.resolve({
        data: { success: true },
        error: null,
      });
    }

    return Promise.resolve({ data: null, error: null });
  });
};

const mockSubscriptionCheckError = (error: unknown) => {
  mocks.functionsInvoke.mockImplementation((functionName: string) => {
    if (functionName === "check-apple-subscription") {
      return Promise.resolve({
        data: null,
        error,
      });
    }

    if (functionName === "verify-apple-receipt") {
      return Promise.resolve({
        data: { success: true },
        error: null,
      });
    }

    return Promise.resolve({ data: null, error: null });
  });
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return Wrapper;
};

describe("useAccessState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageState.store.clear();
    mocks.user = { id: "11111111-1111-4111-8111-111111111111" };
    mocks.authLoading = false;
    mocks.storeKit = {
      isPro: true,
      activePlan: "yearly",
      currentEntitlement: {
        productId: "cosmiq_premium_yearly",
        expirationDate: "2099-01-01T00:00:00.000Z",
        transactionId: "local-tx",
        appAccountToken: "11111111-1111-4111-8111-111111111111",
      },
      expirationDate: new Date("2099-01-01T00:00:00.000Z"),
      entitlementError: false,
      isLoading: false,
    };
    mockSubscriptionCheck();
  });

  it("uses valid local StoreKit access over a neutral backend no-access response", async () => {
    const { result } = renderHook(() => useAccessState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.accessState).toMatchObject({
      has_access: true,
      access_source: "subscription",
      subscribed: true,
      plan: "yearly",
    });
    expect(mocks.functionsInvoke).toHaveBeenCalledWith("check-apple-subscription");
    await waitFor(() => {
      expect(mocks.functionsInvoke).toHaveBeenCalledWith("verify-apple-receipt", {
        body: { transactionId: "local-tx" },
      });
    });
  });

  it("uses valid monthly local StoreKit access over a neutral backend no-access response", async () => {
    mocks.storeKit = {
      isPro: true,
      activePlan: "monthly",
      currentEntitlement: {
        productId: "cosmiq_premium_monthly",
        expirationDate: "2099-01-01T00:00:00.000Z",
        transactionId: "monthly-local-tx",
        appAccountToken: "11111111-1111-4111-8111-111111111111",
      },
      expirationDate: new Date("2099-01-01T00:00:00.000Z"),
      entitlementError: false,
      isLoading: false,
    };

    const { result } = renderHook(() => useAccessState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.accessState).toMatchObject({
      has_access: true,
      access_source: "subscription",
      subscribed: true,
      plan: "monthly",
    });
    await waitFor(() => {
      expect(mocks.functionsInvoke).toHaveBeenCalledWith("verify-apple-receipt", {
        body: { transactionId: "monthly-local-tx" },
      });
    });
  });

  it("does not grant local StoreKit access when no active entitlement exists", async () => {
    mocks.storeKit = {
      isPro: false,
      activePlan: null,
      currentEntitlement: null,
      expirationDate: null,
      entitlementError: false,
      isLoading: false,
    };

    const { result } = renderHook(() => useAccessState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.accessState).toMatchObject({
      has_access: false,
      access_source: "none",
      subscribed: false,
    });
  });

  it("falls back to local StoreKit access when the backend check is unreachable", async () => {
    mockSubscriptionCheckError(new Error("Failed to send a request to the Edge Function"));

    const { result } = renderHook(() => useAccessState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.accessState).toMatchObject({
      has_access: true,
      access_source: "subscription",
      subscribed: true,
      plan: "yearly",
    });
  });

  it("keeps sandbox restore access when the StoreKit entitlement has no app-account token", async () => {
    mockSubscriptionCheckError(new Error("Failed to send a request to the Edge Function"));
    mocks.storeKit = {
      isPro: false,
      activePlan: null,
      currentEntitlement: {
        productId: "cosmiq_premium_monthly",
        expirationDate: "2099-01-01T00:00:00.000Z",
        transactionId: "tokenless-sandbox-tx",
        isSandbox: true,
      } as unknown as typeof mocks.storeKit.currentEntitlement,
      expirationDate: null,
      entitlementError: false,
      isLoading: false,
    };

    const { result } = renderHook(() => useAccessState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.accessState).toMatchObject({
      has_access: true,
      access_source: "subscription",
      subscribed: true,
      plan: "monthly",
    });
  });

  it("does not grant local fallback for a transaction rejected by backend binding", async () => {
    globalThis.localStorage.setItem(
      "cosmiq.rejectedLocalSubscriptionTransactions.v1.11111111-1111-4111-8111-111111111111",
      JSON.stringify({
        transactionKeys: ["conflict-original-tx", "conflict-current-tx"],
        updatedAt: "2026-05-17T19:12:00.000Z",
      }),
    );
    mockSubscriptionCheckError(new Error("Failed to send a request to the Edge Function"));
    mocks.storeKit = {
      isPro: true,
      activePlan: "yearly",
      currentEntitlement: {
        productId: "cosmiq_premium_yearly",
        expirationDate: "2099-01-01T00:00:00.000Z",
        transactionId: "conflict-current-tx",
        originalTransactionId: "conflict-original-tx",
        appAccountToken: "11111111-1111-4111-8111-111111111111",
      } as unknown as typeof mocks.storeKit.currentEntitlement,
      expirationDate: new Date("2099-01-01T00:00:00.000Z"),
      entitlementError: false,
      isLoading: false,
    };

    const { result } = renderHook(() => useAccessState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.accessState).toMatchObject({
      has_access: false,
      access_source: "none",
      subscribed: false,
    });
  });

  it("does not grant local access for unknown StoreKit subscription products", async () => {
    mocks.storeKit = {
      isPro: false,
      activePlan: null,
      currentEntitlement: {
        productId: "com.example.monthly.tip",
        expirationDate: "2099-01-01T00:00:00.000Z",
        transactionId: "unknown-product-tx",
      } as unknown as typeof mocks.storeKit.currentEntitlement,
      expirationDate: null,
      entitlementError: false,
      isLoading: false,
    };

    const { result } = renderHook(() => useAccessState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.accessState).toMatchObject({
      has_access: false,
      access_source: "none",
      subscribed: false,
    });
  });

  it("uses remembered local subscription access when the backend is unreachable and StoreKit has not returned yet", async () => {
    mockSubscriptionCheckError(new Error("Failed to send a request to the Edge Function"));
    globalThis.localStorage.setItem(
      "cosmiq.localSubscriptionAccess.v1.11111111-1111-4111-8111-111111111111",
      JSON.stringify({
        has_access: true,
        access_source: "subscription",
        trial_ends_at: null,
        subscribed: true,
        status: "active",
        plan: "yearly",
        subscription_end: "2099-01-01T00:00:00.000Z",
      }),
    );
    mocks.storeKit = {
      isPro: false,
      activePlan: null,
      currentEntitlement: null,
      expirationDate: null,
      entitlementError: false,
      isLoading: true,
    };

    const { result } = renderHook(() => useAccessState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.accessState).toMatchObject({
      has_access: true,
      access_source: "subscription",
      subscribed: true,
      plan: "yearly",
    });
  });

  it("uses remembered local subscription access when the backend is unreachable and StoreKit entitlement refresh fails", async () => {
    mockSubscriptionCheckError(new Error("Failed to send a request to the Edge Function"));
    globalThis.localStorage.setItem(
      "cosmiq.localSubscriptionAccess.v1.11111111-1111-4111-8111-111111111111",
      JSON.stringify({
        has_access: true,
        access_source: "subscription",
        trial_ends_at: null,
        subscribed: true,
        status: "active",
        plan: "yearly",
        subscription_end: "2099-01-01T00:00:00.000Z",
      }),
    );
    mocks.storeKit = {
      isPro: false,
      activePlan: null,
      currentEntitlement: null,
      expirationDate: null,
      entitlementError: true,
      isLoading: false,
    };

    const { result } = renderHook(() => useAccessState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.accessState).toMatchObject({
      has_access: true,
      access_source: "subscription",
      subscribed: true,
      plan: "yearly",
    });
  });

  it("does not let remembered local access override a completed StoreKit check with no entitlement", async () => {
    globalThis.localStorage.setItem(
      "cosmiq.localSubscriptionAccess.v1.11111111-1111-4111-8111-111111111111",
      JSON.stringify({
        has_access: true,
        access_source: "subscription",
        trial_ends_at: null,
        subscribed: true,
        status: "active",
        plan: "yearly",
        subscription_end: "2099-01-01T00:00:00.000Z",
      }),
    );
    mocks.storeKit = {
      isPro: false,
      activePlan: null,
      currentEntitlement: null,
      expirationDate: null,
      entitlementError: false,
      isLoading: false,
    };

    const { result } = renderHook(() => useAccessState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.accessState).toMatchObject({
      has_access: false,
      access_source: "none",
      subscribed: false,
    });
  });

  it("uses fresh post-purchase local access over a neutral backend response after StoreKit finishes with no entitlement", async () => {
    globalThis.localStorage.setItem(
      "cosmiq.localSubscriptionAccess.v1.11111111-1111-4111-8111-111111111111",
      JSON.stringify({
        version: 2,
        storedAt: new Date().toISOString(),
        transactionKeys: ["fresh-original-tx", "fresh-current-tx"],
        accessState: {
          has_access: true,
          access_source: "subscription",
          trial_ends_at: null,
          subscribed: true,
          status: "active",
          plan: "yearly",
          subscription_end: "2099-01-01T00:00:00.000Z",
        },
      }),
    );
    mocks.storeKit = {
      isPro: false,
      activePlan: null,
      currentEntitlement: null,
      expirationDate: null,
      entitlementError: false,
      isLoading: false,
    };

    const { result } = renderHook(() => useAccessState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.accessState).toMatchObject({
      has_access: true,
      access_source: "subscription",
      subscribed: true,
      plan: "yearly",
    });
  });

  it("does not use stale post-purchase local access after StoreKit finishes with no entitlement", async () => {
    globalThis.localStorage.setItem(
      "cosmiq.localSubscriptionAccess.v1.11111111-1111-4111-8111-111111111111",
      JSON.stringify({
        version: 2,
        storedAt: "2000-01-01T00:00:00.000Z",
        transactionKeys: ["stale-original-tx", "stale-current-tx"],
        accessState: {
          has_access: true,
          access_source: "subscription",
          trial_ends_at: null,
          subscribed: true,
          status: "active",
          plan: "yearly",
          subscription_end: "2099-01-01T00:00:00.000Z",
        },
      }),
    );
    mocks.storeKit = {
      isPro: false,
      activePlan: null,
      currentEntitlement: null,
      expirationDate: null,
      entitlementError: false,
      isLoading: false,
    };

    const { result } = renderHook(() => useAccessState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.accessState).toMatchObject({
      has_access: false,
      access_source: "none",
      subscribed: false,
    });
  });

  it("does not let remembered local access override an explicit backend subscription revocation", async () => {
    globalThis.localStorage.setItem(
      "cosmiq.localSubscriptionAccess.v1.11111111-1111-4111-8111-111111111111",
      JSON.stringify({
        has_access: true,
        access_source: "subscription",
        trial_ends_at: null,
        subscribed: true,
        status: "active",
        plan: "yearly",
        subscription_end: "2099-01-01T00:00:00.000Z",
      }),
    );
    mockSubscriptionCheck({
      has_access: false,
      access_source: "subscription",
      trial_ends_at: null,
      subscribed: false,
      status: "cancelled",
      plan: "yearly",
      subscription_end: "2026-05-11T00:00:00.000Z",
    });
    mocks.storeKit = {
      isPro: false,
      activePlan: null,
      currentEntitlement: null,
      expirationDate: null,
      entitlementError: true,
      isLoading: false,
    };

    const { result } = renderHook(() => useAccessState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.accessState).toMatchObject({
      has_access: false,
      access_source: "subscription",
      subscribed: false,
      status: "cancelled",
    });
  });

  it("uses live StoreKit access over a stale inactive backend subscription while recovery verifies", async () => {
    mockSubscriptionCheck({
      has_access: false,
      access_source: "subscription",
      trial_ends_at: null,
      subscribed: false,
      status: "cancelled",
      plan: "yearly",
      subscription_end: "2026-05-11T00:00:00.000Z",
    });

    const { result } = renderHook(() => useAccessState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.accessState).toMatchObject({
      has_access: true,
      access_source: "subscription",
      subscribed: true,
      status: "active",
      plan: "yearly",
    });
    await waitFor(() => {
      expect(mocks.functionsInvoke).toHaveBeenCalledWith("verify-apple-receipt", {
        body: { transactionId: "local-tx" },
      });
    });
  });

  it("rejects live StoreKit grace over inactive backend access when recovery finds an account binding conflict", async () => {
    mocks.functionsInvoke.mockImplementation((functionName: string) => {
      if (functionName === "check-apple-subscription") {
        return Promise.resolve({
          data: {
            has_access: false,
            access_source: "subscription",
            trial_ends_at: null,
            subscribed: false,
            status: "cancelled",
            plan: "yearly",
            subscription_end: "2026-05-11T00:00:00.000Z",
          },
          error: null,
        });
      }

      if (functionName === "verify-apple-receipt") {
        return Promise.resolve({
          data: null,
          error: {
            message: "Edge Function returned a non-2xx status code",
            status: 403,
            context: new Response(JSON.stringify({
              error: "This purchase is already linked to another account.",
              code: "APPLE_BINDING_CONFLICT",
            }), { status: 403 }),
          },
        });
      }

      return Promise.resolve({ data: null, error: null });
    });

    const { result } = renderHook(() => useAccessState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(globalThis.localStorage.getItem(
        "cosmiq.rejectedLocalSubscriptionTransactions.v1.11111111-1111-4111-8111-111111111111",
      )).toContain("local-tx");
    });
    expect(result.current.accessState).toMatchObject({
      has_access: false,
      access_source: "subscription",
      subscribed: false,
      status: "cancelled",
    });
  });

  it("does not let remembered local access override a StoreKit entitlement for a different user", async () => {
    globalThis.localStorage.setItem(
      "cosmiq.localSubscriptionAccess.v1.11111111-1111-4111-8111-111111111111",
      JSON.stringify({
        has_access: true,
        access_source: "subscription",
        trial_ends_at: null,
        subscribed: true,
        status: "active",
        plan: "yearly",
        subscription_end: "2099-01-01T00:00:00.000Z",
      }),
    );
    mockSubscriptionCheckError(new Error("Failed to send a request to the Edge Function"));
    mocks.storeKit = {
      isPro: false,
      activePlan: null,
      currentEntitlement: {
        productId: "cosmiq_premium_yearly",
        expirationDate: "2099-01-01T00:00:00.000Z",
        transactionId: "other-user-tx",
        appAccountToken: "22222222-2222-4222-8222-222222222222",
      },
      expirationDate: null,
      entitlementError: false,
      isLoading: false,
    };

    const { result } = renderHook(() => useAccessState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.accessState).toMatchObject({
      has_access: false,
      access_source: "none",
      subscribed: false,
    });
  });

  it("rejects grace access when quiet backend recovery finds an account binding conflict", async () => {
    mocks.functionsInvoke.mockImplementation((functionName: string) => {
      if (functionName === "check-apple-subscription") {
        return Promise.resolve({
          data: neutralAccessState,
          error: null,
        });
      }

      if (functionName === "verify-apple-receipt") {
        return Promise.resolve({
          data: null,
          error: {
            message: "Edge Function returned a non-2xx status code",
            status: 403,
            context: new Response(JSON.stringify({
              error: "This purchase is already linked to another account.",
              code: "APPLE_BINDING_CONFLICT",
            }), { status: 403 }),
          },
        });
      }

      return Promise.resolve({ data: null, error: null });
    });

    const { result } = renderHook(() => useAccessState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(globalThis.localStorage.getItem(
        "cosmiq.rejectedLocalSubscriptionTransactions.v1.11111111-1111-4111-8111-111111111111",
      )).toContain("local-tx");
    });
    expect(result.current.accessState).toMatchObject({
      has_access: false,
      access_source: "none",
      subscribed: false,
    });
  });
});
