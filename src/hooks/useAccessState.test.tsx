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
    mocks.functionsInvoke.mockResolvedValue({
      data: {
        has_access: false,
        access_source: "none",
        trial_ends_at: null,
        subscribed: false,
      },
      error: null,
    });
  });

  it("uses a reachable backend no-access response over a local StoreKit entitlement", async () => {
    const { result } = renderHook(() => useAccessState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.accessState).toMatchObject({
      has_access: false,
      access_source: "none",
      subscribed: false,
    });
    expect(mocks.functionsInvoke).toHaveBeenCalledWith("check-apple-subscription");
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
    mocks.functionsInvoke.mockResolvedValueOnce({
      data: null,
      error: new Error("Failed to send a request to the Edge Function"),
    });

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
    mocks.functionsInvoke.mockResolvedValueOnce({
      data: null,
      error: new Error("Failed to send a request to the Edge Function"),
    });
    mocks.storeKit = {
      isPro: false,
      activePlan: null,
      currentEntitlement: {
        productId: "cosmiq_premium_monthly",
        expirationDate: "2099-01-01T00:00:00.000Z",
        transactionId: "tokenless-sandbox-tx",
      } as typeof mocks.storeKit.currentEntitlement,
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
    mocks.functionsInvoke.mockResolvedValueOnce({
      data: null,
      error: new Error("Failed to send a request to the Edge Function"),
    });
    mocks.storeKit = {
      isPro: true,
      activePlan: "yearly",
      currentEntitlement: {
        productId: "cosmiq_premium_yearly",
        expirationDate: "2099-01-01T00:00:00.000Z",
        transactionId: "conflict-current-tx",
        originalTransactionId: "conflict-original-tx",
        appAccountToken: "11111111-1111-4111-8111-111111111111",
      } as typeof mocks.storeKit.currentEntitlement,
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
      } as typeof mocks.storeKit.currentEntitlement,
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
    mocks.functionsInvoke.mockResolvedValueOnce({
      data: null,
      error: new Error("Failed to send a request to the Edge Function"),
    });
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
    mocks.functionsInvoke.mockResolvedValueOnce({
      data: null,
      error: new Error("Failed to send a request to the Edge Function"),
    });
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
    mocks.functionsInvoke.mockResolvedValueOnce({
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

  it("does not let local StoreKit access override an explicit backend subscription revocation", async () => {
    mocks.functionsInvoke.mockResolvedValueOnce({
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
    mocks.functionsInvoke.mockResolvedValueOnce({
      data: null,
      error: new Error("Failed to send a request to the Edge Function"),
    });
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
});
