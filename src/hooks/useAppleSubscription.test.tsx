import React from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  purchase: vi.fn(),
  redeemOfferCode: vi.fn(),
  restorePurchases: vi.fn(),
  recoverPurchases: vi.fn(),
  manageSubscriptions: vi.fn(),
  presentPaywallIfNeeded: vi.fn(),
  presentCustomerCenter: vi.fn(),
  refreshProducts: vi.fn(),
  functionsInvoke: vi.fn(),
  invalidateQueries: vi.fn(),
  setQueryData: vi.fn(),
  storeKitProducts: [
    { identifier: "cosmiq_premium_monthly", displayName: "Monthly", description: "", price: 9.99, displayPrice: "$9.99" },
    { identifier: "cosmiq_premium_yearly", displayName: "Yearly", description: "", price: 99.99, displayPrice: "$99.99" },
  ],
  user: { id: "11111111-1111-4111-8111-111111111111" } as { id: string } | null,
  appliedReferralCodeState: {
    code: null,
    owner_type: null,
    affiliate_provider: null,
    is_active: false,
    apple_offer_code_status: null,
    apple_offer_campaign_identifier: null,
    apple_offer_code_expires_at: null,
    is_apple_offer_eligible: false,
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

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: (...args: unknown[]) => mocks.invalidateQueries(...args),
    setQueryData: (...args: unknown[]) => mocks.setQueryData(...args),
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.functionsInvoke(...args),
    },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/hooks/useAppliedReferralCodeState", () => ({
  useAppliedReferralCodeState: () => ({
    appliedReferralCodeState: mocks.appliedReferralCodeState,
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/useStoreKit", () => ({
  useStoreKit: () => ({
    isAvailable: true,
    products: mocks.storeKitProducts,
    productsLoading: false,
    purchase: (...args: unknown[]) => mocks.purchase(...args),
    redeemOfferCode: (...args: unknown[]) => mocks.redeemOfferCode(...args),
    restorePurchases: (...args: unknown[]) => mocks.restorePurchases(...args),
    recoverPurchases: (...args: unknown[]) => mocks.recoverPurchases(...args),
    manageSubscriptions: (...args: unknown[]) => mocks.manageSubscriptions(...args),
    presentPaywallIfNeeded: (...args: unknown[]) => mocks.presentPaywallIfNeeded(...args),
    presentCustomerCenter: (...args: unknown[]) => mocks.presentCustomerCenter(...args),
    refreshProducts: (...args: unknown[]) => mocks.refreshProducts(...args),
  }),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => "ios",
  },
}));

vi.mock("@/utils/platformTargets", () => ({
  isNativeIOS: () => true,
}));

vi.mock("@/utils/paywallTelemetry", () => ({
  trackPaywallEvent: vi.fn(),
}));

import { useAppleSubscription } from "./useAppleSubscription";

describe("useAppleSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageState.store.clear();
    mocks.storeKitProducts = [
      { identifier: "cosmiq_premium_monthly", displayName: "Monthly", description: "", price: 9.99, displayPrice: "$9.99" },
      { identifier: "cosmiq_premium_yearly", displayName: "Yearly", description: "", price: 99.99, displayPrice: "$99.99" },
    ];
    mocks.user = { id: "11111111-1111-4111-8111-111111111111" };
    mocks.appliedReferralCodeState = {
      code: null,
      owner_type: null,
      affiliate_provider: null,
      is_active: false,
      apple_offer_code_status: null,
      apple_offer_campaign_identifier: null,
      apple_offer_code_expires_at: null,
      is_apple_offer_eligible: false,
    };
    mocks.purchase.mockResolvedValue({
      productId: "cosmiq_premium_monthly",
      transactionId: "tx-1",
      expirationDate: "2099-01-01T00:00:00.000Z",
      appAccountToken: "11111111-1111-4111-8111-111111111111",
    });
    mocks.redeemOfferCode.mockResolvedValue({ status: "presented", entitlement: null });
    mocks.restorePurchases.mockResolvedValue({
      productId: "cosmiq_premium_monthly",
      transactionId: "tx-r",
      expirationDate: "2099-01-01T00:00:00.000Z",
      appAccountToken: "11111111-1111-4111-8111-111111111111",
    });
    mocks.recoverPurchases.mockResolvedValue(null);
    mocks.presentPaywallIfNeeded.mockResolvedValue(false);
    mocks.presentCustomerCenter.mockResolvedValue(undefined);
    mocks.refreshProducts.mockResolvedValue(mocks.storeKitProducts);
    mocks.functionsInvoke.mockResolvedValue({ data: { success: true }, error: null });
  });

  it("calls purchase for monthly products", async () => {
    const { result } = renderHook(() => useAppleSubscription());

    await act(async () => {
      await result.current.handlePurchase("cosmiq_premium_monthly");
    });

    expect(mocks.purchase).toHaveBeenCalledWith("cosmiq_premium_monthly");
    expect(mocks.functionsInvoke).toHaveBeenCalledWith("verify-apple-receipt", {
      body: { transactionId: "tx-1" },
    });
    expect(mocks.redeemOfferCode).not.toHaveBeenCalled();
  });

  it("starts offer code redemption for yearly when user has offer code", async () => {
    mocks.appliedReferralCodeState = {
      ...mocks.appliedReferralCodeState,
      code: "OFFER123",
      owner_type: "influencer",
      affiliate_provider: "winwinkit",
      is_active: true,
      apple_offer_code_status: "active",
      is_apple_offer_eligible: true,
    };

    const { result } = renderHook(() => useAppleSubscription());

    await act(async () => {
      await result.current.handlePurchase("cosmiq_premium_yearly");
    });

    expect(mocks.redeemOfferCode).toHaveBeenCalledTimes(1);
    expect(mocks.purchase).not.toHaveBeenCalled();
  });

  it("purchases yearly after the offer code redemption step is primed", async () => {
    mocks.appliedReferralCodeState = {
      ...mocks.appliedReferralCodeState,
      code: "OFFER123",
      owner_type: "influencer",
      affiliate_provider: "winwinkit",
      is_active: true,
      apple_offer_code_status: "active",
      is_apple_offer_eligible: true,
    };

    const { result } = renderHook(() => useAppleSubscription());

    await act(async () => {
      await result.current.handlePurchase("cosmiq_premium_yearly");
    });

    await act(async () => {
      await result.current.handlePurchase("cosmiq_premium_yearly");
    });

    expect(mocks.redeemOfferCode).toHaveBeenCalledTimes(1);
    expect(mocks.purchase).toHaveBeenCalledWith("cosmiq_premium_yearly");
    expect(mocks.functionsInvoke).toHaveBeenCalledWith("verify-apple-receipt", {
      body: { transactionId: "tx-1" },
    });
  });

  it("calls regular purchase for yearly when no offer code", async () => {
    mocks.appliedReferralCodeState = {
      ...mocks.appliedReferralCodeState,
      code: null,
      is_apple_offer_eligible: false,
    };

    const { result } = renderHook(() => useAppleSubscription());

    await act(async () => {
      await result.current.handlePurchase("cosmiq_premium_yearly");
    });

    expect(mocks.purchase).toHaveBeenCalledWith("cosmiq_premium_yearly");
    expect(mocks.functionsInvoke).toHaveBeenCalledWith("verify-apple-receipt", {
      body: { transactionId: "tx-1" },
    });
    expect(mocks.redeemOfferCode).not.toHaveBeenCalled();
  });

  it("still calls purchase when cached products are empty", async () => {
    mocks.storeKitProducts = [];

    const { result } = renderHook(() => useAppleSubscription());

    await act(async () => {
      await result.current.handlePurchase("cosmiq_premium_yearly");
    });

    expect(mocks.purchase).toHaveBeenCalledWith("cosmiq_premium_yearly");
    expect(mocks.functionsInvoke).toHaveBeenCalledWith("verify-apple-receipt", {
      body: { transactionId: "tx-1" },
    });
    expect(mocks.toast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "Unavailable" }),
    );
  });

  it("returns false and shows toast when user is not authenticated", async () => {
    mocks.user = null;

    const { result } = renderHook(() => useAppleSubscription());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handlePurchase("cosmiq_premium_monthly");
    });

    expect(success).toBe(false);
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Sign in required" }),
    );
    expect(mocks.purchase).not.toHaveBeenCalled();
  });

  it("returns false when purchase returns null (cancelled)", async () => {
    mocks.purchase.mockResolvedValue(null);

    const { result } = renderHook(() => useAppleSubscription());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handlePurchase("cosmiq_premium_monthly");
    });

    expect(success).toBe(false);
    expect(mocks.recoverPurchases).toHaveBeenCalledTimes(1);
    expect(mocks.functionsInvoke).not.toHaveBeenCalled();
  });

  it("recovers an existing App Store subscription when purchase returns null", async () => {
    mocks.purchase.mockResolvedValue(null);
    mocks.recoverPurchases.mockResolvedValueOnce({
      productId: "cosmiq_premium_yearly",
      transactionId: "recovered-null-purchase-tx",
      expirationDate: "2099-01-01T00:00:00.000Z",
      appAccountToken: "11111111-1111-4111-8111-111111111111",
    });

    const { result } = renderHook(() => useAppleSubscription());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handlePurchase("cosmiq_premium_yearly");
    });

    expect(success).toBe(true);
    expect(mocks.recoverPurchases).toHaveBeenCalledTimes(1);
    expect(mocks.functionsInvoke).toHaveBeenCalledWith("verify-apple-receipt", {
      body: { transactionId: "recovered-null-purchase-tx" },
    });
    expect(mocks.setQueryData).toHaveBeenCalledWith(
      ["access-state", "11111111-1111-4111-8111-111111111111"],
      expect.objectContaining({
        has_access: true,
        access_source: "subscription",
        subscribed: true,
        plan: "yearly",
      }),
    );
  });

  it("recovers an existing App Store subscription when Apple says already subscribed", async () => {
    mocks.purchase.mockRejectedValueOnce(new Error("You're already subscribed to this subscription."));
    mocks.recoverPurchases.mockResolvedValueOnce({
      productId: "cosmiq_premium_monthly",
      transactionId: "already-subscribed-recovery-tx",
      expirationDate: "2099-01-01T00:00:00.000Z",
      appAccountToken: "11111111-1111-4111-8111-111111111111",
    });

    const { result } = renderHook(() => useAppleSubscription());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handlePurchase("cosmiq_premium_monthly");
    });

    expect(success).toBe(true);
    expect(mocks.recoverPurchases).toHaveBeenCalledTimes(1);
    expect(mocks.functionsInvoke).toHaveBeenCalledWith("verify-apple-receipt", {
      body: { transactionId: "already-subscribed-recovery-tx" },
    });
    expect(mocks.toast).not.toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Purchase failed",
        variant: "destructive",
      }),
    );
  });

  it("shows an activation error when Apple succeeds but server verification fails", async () => {
    mocks.functionsInvoke.mockResolvedValueOnce({
      data: null,
      error: new Error("Verification unavailable"),
    });

    const { result } = renderHook(() => useAppleSubscription());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handlePurchase("cosmiq_premium_monthly");
    });

    expect(success).toBe(false);
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Subscription activation failed",
        variant: "destructive",
      }),
    );
  });

  it("shows account-linked recovery copy when Apple purchase belongs to another account", async () => {
    globalThis.localStorage.setItem(
      "cosmiq.localSubscriptionAccess.v1.11111111-1111-4111-8111-111111111111",
      JSON.stringify({
        has_access: true,
        access_source: "subscription",
        trial_ends_at: null,
        subscribed: true,
        status: "active",
        plan: "monthly",
        subscription_end: "2099-01-01T00:00:00.000Z",
      }),
    );
    mocks.functionsInvoke.mockResolvedValueOnce({
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

    const { result } = renderHook(() => useAppleSubscription());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handlePurchase("cosmiq_premium_monthly");
    });

    expect(success).toBe(false);
    expect(result.current.productError).toBe(
      "This App Store subscription is already linked to another Cosmiq account. Sign in to that account, or contact support if this is your purchase.",
    );
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Subscription already linked",
        description: "This App Store subscription is already linked to another Cosmiq account. Sign in to that account, or contact support if this is your purchase.",
        variant: "destructive",
      }),
    );
    expect(globalThis.localStorage.getItem(
      "cosmiq.localSubscriptionAccess.v1.11111111-1111-4111-8111-111111111111",
    )).toBeNull();
    expect(globalThis.localStorage.getItem(
      "cosmiq.rejectedLocalSubscriptionTransactions.v1.11111111-1111-4111-8111-111111111111",
    )).toContain("tx-1");
    expect(mocks.setQueryData).toHaveBeenCalledWith(
      ["access-state", "11111111-1111-4111-8111-111111111111"],
      expect.objectContaining({
        has_access: false,
        access_source: "none",
        subscribed: false,
      }),
    );
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["access-state", "11111111-1111-4111-8111-111111111111"],
    });
  });

  it("unlocks locally when Apple succeeds but the verification function is unreachable", async () => {
    mocks.functionsInvoke.mockResolvedValueOnce({
      data: null,
      error: new Error("Failed to send a request to the Edge Function"),
    });

    const { result } = renderHook(() => useAppleSubscription());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handlePurchase("cosmiq_premium_monthly");
    });

    expect(success).toBe(true);
    expect(mocks.setQueryData).toHaveBeenCalledWith(
      ["access-state", "11111111-1111-4111-8111-111111111111"],
      expect.objectContaining({
        has_access: true,
        access_source: "subscription",
        subscribed: true,
        plan: "monthly",
        subscription_end: "2099-01-01T00:00:00.000Z",
      }),
    );
    expect(mocks.toast).not.toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Subscription activation failed",
        variant: "destructive",
      }),
    );
    expect(globalThis.localStorage.getItem(
      "cosmiq.localSubscriptionAccess.v1.11111111-1111-4111-8111-111111111111",
    )).toContain("2099-01-01T00:00:00.000Z");
  });

  it("unlocks locally when RevenueCat returns a fresh purchase transaction before expiration is hydrated", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T00:23:39.000Z"));
    try {
      mocks.purchase.mockResolvedValueOnce({
        productId: "cosmiq_premium_yearly",
        transactionId: "2000001171944416",
        purchaseDate: "2026-05-18T00:23:39Z",
      });

      const { result } = renderHook(() => useAppleSubscription());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.handlePurchase("cosmiq_premium_yearly");
      });

      expect(success).toBe(true);
      expect(mocks.functionsInvoke).toHaveBeenCalledWith("verify-apple-receipt", {
        body: { transactionId: "2000001171944416" },
      });
      expect(mocks.setQueryData).toHaveBeenCalledWith(
        ["access-state", "11111111-1111-4111-8111-111111111111"],
        expect.objectContaining({
          has_access: true,
          access_source: "subscription",
          subscribed: true,
          plan: "yearly",
          subscription_end: "2026-05-18T00:38:39.000Z",
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("silently retries server verification after a deferred local unlock", async () => {
    vi.useFakeTimers();
    try {
      mocks.functionsInvoke
        .mockResolvedValueOnce({
          data: null,
          error: new Error("Failed to send a request to the Edge Function"),
        })
        .mockResolvedValueOnce({ data: { success: true }, error: null });

      const { result } = renderHook(() => useAppleSubscription());

      await act(async () => {
        await result.current.handlePurchase("cosmiq_premium_monthly");
      });

      expect(mocks.functionsInvoke).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });

      expect(mocks.functionsInvoke).toHaveBeenCalledTimes(2);
      expect(mocks.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["access-state", "11111111-1111-4111-8111-111111111111"],
      });
      expect(mocks.toast).not.toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Subscription activation failed",
          variant: "destructive",
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not locally unlock unknown StoreKit products when verification is unreachable", async () => {
    mocks.purchase.mockResolvedValueOnce({
      productId: "com.example.monthly.tip",
      transactionId: "unknown-product-tx",
      expirationDate: "2099-01-01T00:00:00.000Z",
      appAccountToken: "11111111-1111-4111-8111-111111111111",
    });
    mocks.functionsInvoke.mockResolvedValueOnce({
      data: null,
      error: new Error("Failed to send a request to the Edge Function"),
    });

    const { result } = renderHook(() => useAppleSubscription());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handlePurchase("cosmiq_premium_monthly");
    });

    expect(success).toBe(false);
    expect(mocks.setQueryData).not.toHaveBeenCalled();
    expect(globalThis.localStorage.getItem(
      "cosmiq.localSubscriptionAccess.v1.11111111-1111-4111-8111-111111111111",
    )).toBeNull();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Subscription activation failed",
        variant: "destructive",
      }),
    );
  });

  it("unlocks locally for active sandbox purchases missing Apple's app-account binding", async () => {
    mocks.purchase.mockResolvedValueOnce({
      productId: "cosmiq_premium_yearly",
      transactionId: "tokenless-sandbox-tx",
      expirationDate: "2099-01-01T00:00:00.000Z",
    });
    mocks.functionsInvoke.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        status: 400,
        context: new Response(JSON.stringify({
          error: "This purchase is missing its app-account binding. Update the app and restore the purchase again.",
          code: "APPLE_BINDING_MISSING",
        }), { status: 400 }),
      },
    });

    const { result } = renderHook(() => useAppleSubscription());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handlePurchase("cosmiq_premium_yearly");
    });

    expect(success).toBe(true);
    expect(mocks.setQueryData).toHaveBeenCalledWith(
      ["access-state", "11111111-1111-4111-8111-111111111111"],
      expect.objectContaining({
        has_access: true,
        access_source: "subscription",
        subscribed: true,
        plan: "yearly",
      }),
    );
    expect(mocks.toast).not.toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Subscription activation failed",
        variant: "destructive",
      }),
    );
  });

  it("defers local activation when binding-missing is returned as a successful payload", async () => {
    mocks.purchase.mockResolvedValueOnce({
      productId: "cosmiq_premium_yearly",
      transactionId: "tokenless-payload-tx",
      expirationDate: "2099-01-01T00:00:00.000Z",
    });
    mocks.functionsInvoke.mockResolvedValueOnce({
      data: {
        error: "This purchase is missing its app-account binding. Update the app and restore the purchase again.",
        code: "APPLE_BINDING_MISSING",
      },
      error: null,
    });

    const { result } = renderHook(() => useAppleSubscription());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handlePurchase("cosmiq_premium_yearly");
    });

    expect(success).toBe(true);
    expect(mocks.setQueryData).toHaveBeenCalledWith(
      ["access-state", "11111111-1111-4111-8111-111111111111"],
      expect.objectContaining({
        has_access: true,
        access_source: "subscription",
        subscribed: true,
        plan: "yearly",
      }),
    );
    expect(mocks.toast).not.toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Subscription activation failed",
        variant: "destructive",
      }),
    );
  });

  it("defers local activation when Apple has not returned subscription expiration yet", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T00:23:39.000Z"));
    try {
      mocks.purchase.mockResolvedValueOnce({
        productId: "cosmiq_premium_yearly",
        transactionId: "missing-expiration-tx",
        purchaseDate: "2026-05-18T00:23:39Z",
      });
      mocks.functionsInvoke.mockResolvedValueOnce({
        data: {
          error: "This Apple transaction is missing its subscription expiration date.",
        },
        error: null,
      });

      const { result } = renderHook(() => useAppleSubscription());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.handlePurchase("cosmiq_premium_yearly");
      });

      expect(success).toBe(true);
      expect(mocks.setQueryData).toHaveBeenCalledWith(
        ["access-state", "11111111-1111-4111-8111-111111111111"],
        expect.objectContaining({
          has_access: true,
          access_source: "subscription",
          subscribed: true,
          plan: "yearly",
          subscription_end: "2026-05-18T00:38:39.000Z",
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows error toast when purchase throws", async () => {
    mocks.purchase.mockRejectedValue(new Error("StoreKit purchase failed"));

    const { result } = renderHook(() => useAppleSubscription());

    await act(async () => {
      await result.current.handlePurchase("cosmiq_premium_monthly");
    });

    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Purchase failed",
        variant: "destructive",
      }),
    );
  });

  it("calls restorePurchases on restore", async () => {
    const { result } = renderHook(() => useAppleSubscription());

    await act(async () => {
      await result.current.handleRestore();
    });

    expect(mocks.restorePurchases).toHaveBeenCalled();
    expect(mocks.functionsInvoke).toHaveBeenCalledWith("verify-apple-receipt", {
      body: { transactionId: "tx-r" },
    });
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Purchases restored" }),
    );
  });

  it("does not cache local access when restore finds a purchase linked to another account", async () => {
    globalThis.localStorage.setItem(
      "cosmiq.localSubscriptionAccess.v1.11111111-1111-4111-8111-111111111111",
      JSON.stringify({
        has_access: true,
        access_source: "subscription",
        trial_ends_at: null,
        subscribed: true,
        status: "active",
        plan: "monthly",
        subscription_end: "2099-01-01T00:00:00.000Z",
      }),
    );
    mocks.functionsInvoke.mockResolvedValueOnce({
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

    const { result } = renderHook(() => useAppleSubscription());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.handleRestore();
    });

    expect(success).toBe(false);
    expect(mocks.restorePurchases).toHaveBeenCalled();
    expect(globalThis.localStorage.getItem(
      "cosmiq.localSubscriptionAccess.v1.11111111-1111-4111-8111-111111111111",
    )).toBeNull();
    expect(globalThis.localStorage.getItem(
      "cosmiq.rejectedLocalSubscriptionTransactions.v1.11111111-1111-4111-8111-111111111111",
    )).toContain("tx-r");
    expect(mocks.setQueryData).toHaveBeenCalledWith(
      ["access-state", "11111111-1111-4111-8111-111111111111"],
      expect.objectContaining({
        has_access: false,
        access_source: "none",
        subscribed: false,
      }),
    );
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Subscription already linked",
        variant: "destructive",
      }),
    );
  });

  it("shows error toast when restore throws", async () => {
    mocks.restorePurchases.mockRejectedValue(new Error("Restore failed"));

    const { result } = renderHook(() => useAppleSubscription());

    await act(async () => {
      await result.current.handleRestore();
    });

    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Restore failed",
        variant: "destructive",
      }),
    );
  });

  it("uses freshly loaded products when reloading product availability", async () => {
    mocks.storeKitProducts = [];
    mocks.refreshProducts.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useAppleSubscription());

    await act(async () => {
      await result.current.reloadProducts();
    });

    expect(result.current.productError).toBe("No products are available. Please try again later.");

    mocks.refreshProducts.mockResolvedValueOnce([
      { identifier: "cosmiq_premium_yearly", displayName: "Yearly", description: "", price: 99.99, displayPrice: "$99.99" },
    ]);

    await act(async () => {
      await result.current.reloadProducts();
    });

    expect(result.current.productError).toBeNull();
  });

  it("exposes hasOfferCode from the applied code eligibility state", () => {
    mocks.appliedReferralCodeState = {
      ...mocks.appliedReferralCodeState,
      code: "OFFER123",
      owner_type: "influencer",
      affiliate_provider: "winwinkit",
      is_active: true,
      apple_offer_code_status: "active",
      apple_offer_campaign_identifier: "referrals",
      is_apple_offer_eligible: true,
    };
    const { result } = renderHook(() => useAppleSubscription());
    expect(result.current.hasOfferCode).toBe(true);
    expect(result.current.activeYearlyOffer?.price).toBe("$69.99");
  });

  it("exposes Genesis pricing from the applied code campaign identifier", () => {
    mocks.appliedReferralCodeState = {
      ...mocks.appliedReferralCodeState,
      code: "GENESIS",
      owner_type: "influencer",
      affiliate_provider: null,
      is_active: true,
      apple_offer_code_status: "active",
      apple_offer_campaign_identifier: "GENESIS",
      is_apple_offer_eligible: true,
    };
    const { result } = renderHook(() => useAppleSubscription());
    expect(result.current.hasOfferCode).toBe(true);
    expect(result.current.activeYearlyOffer).toMatchObject({
      tier: "genesis",
      price: "$49.99",
      priceCents: 4999,
      unitPrice: "$4.17/month for the first year",
    });
  });

  it("keeps hasOfferCode false when a saved code is not Apple-offer eligible", () => {
    mocks.appliedReferralCodeState = {
      ...mocks.appliedReferralCodeState,
      code: "USERFRIEND",
      owner_type: "user",
      is_active: true,
      is_apple_offer_eligible: false,
    };
    const { result } = renderHook(() => useAppleSubscription());
    expect(result.current.hasOfferCode).toBe(false);
  });
});
