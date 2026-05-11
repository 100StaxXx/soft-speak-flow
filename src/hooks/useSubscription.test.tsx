import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshEntitlement: vi.fn(),
  refetchAccessState: vi.fn(),
  storeKit: {
    currentEntitlement: null as {
      productId: string;
      expirationDate: string;
      transactionId: string;
      appAccountToken?: string | null;
    } | null,
    isPro: false,
    activePlan: null as "monthly" | "yearly" | null,
    expirationDate: null as Date | null,
    isLoading: false,
    refreshEntitlement: vi.fn(),
  },
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
  accessLoading: false,
  accessError: null as Error | null,
}));

vi.mock("./useStoreKit", () => ({
  useStoreKit: () => mocks.storeKit,
}));

vi.mock("./useAccessState", () => ({
  useAccessState: () => ({
    accessState: mocks.accessState,
    isLoading: mocks.accessLoading,
    error: mocks.accessError,
    refetch: mocks.refetchAccessState,
  }),
}));

import { useSubscription } from "./useSubscription";

describe("useSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refreshEntitlement.mockResolvedValue(undefined);
    mocks.refetchAccessState.mockResolvedValue(undefined);
    mocks.storeKit = {
      currentEntitlement: null,
      isPro: false,
      activePlan: null,
      expirationDate: null,
      isLoading: false,
      refreshEntitlement: mocks.refreshEntitlement,
    };
    mocks.accessState = {
      has_access: false,
      access_source: "none",
      trial_ends_at: null,
      subscribed: false,
    };
    mocks.accessLoading = false;
    mocks.accessError = null;
  });

  it("shows subscription details from hardened access state when StoreKit has a tokenless sandbox entitlement", () => {
    mocks.storeKit.currentEntitlement = {
      productId: "cosmiq_premium_yearly",
      expirationDate: "2099-01-01T00:00:00.000Z",
      transactionId: "sandbox-tx",
      appAccountToken: null,
    };
    mocks.accessState = {
      has_access: true,
      access_source: "subscription",
      trial_ends_at: null,
      subscribed: true,
      status: "active",
      plan: "yearly",
      subscription_end: "2099-01-01T00:00:00.000Z",
    };

    const { result } = renderHook(() => useSubscription());

    expect(result.current.isActive).toBe(true);
    expect(result.current.hasPremium).toBe(true);
    expect(result.current.plan).toBe("yearly");
    expect(result.current.planPrice).toBe("$99.99/year");
    expect(result.current.subscription).toMatchObject({
      status: "active",
      plan: "yearly",
      product_identifier: "cosmiq_premium_yearly",
    });
  });

  it("refreshes both StoreKit and the access-state fallback", async () => {
    const { result } = renderHook(() => useSubscription());

    await result.current.refetch();

    expect(mocks.refreshEntitlement).toHaveBeenCalledTimes(1);
    expect(mocks.refetchAccessState).toHaveBeenCalledTimes(1);
  });
});
