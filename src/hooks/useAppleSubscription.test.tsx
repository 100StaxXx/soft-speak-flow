import React from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  purchase: vi.fn(),
  redeemOfferCode: vi.fn(),
  restorePurchases: vi.fn(),
  manageSubscriptions: vi.fn(),
  refreshProducts: vi.fn(),
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
    purchaseWithPromoOffer: vi.fn(),
    redeemOfferCode: (...args: unknown[]) => mocks.redeemOfferCode(...args),
    restorePurchases: (...args: unknown[]) => mocks.restorePurchases(...args),
    manageSubscriptions: (...args: unknown[]) => mocks.manageSubscriptions(...args),
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
    mocks.purchase.mockResolvedValue({ productId: "cosmiq_premium_monthly", transactionId: "tx-1" });
    mocks.redeemOfferCode.mockResolvedValue({ status: "presented", entitlement: null });
    mocks.restorePurchases.mockResolvedValue({ productId: "cosmiq_premium_monthly", transactionId: "tx-r" });
    mocks.refreshProducts.mockResolvedValue(mocks.storeKitProducts);
  });

  it("calls purchase for monthly products", async () => {
    const { result } = renderHook(() => useAppleSubscription());

    await act(async () => {
      await result.current.handlePurchase("cosmiq_premium_monthly");
    });

    expect(mocks.purchase).toHaveBeenCalledWith("cosmiq_premium_monthly");
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
    expect(mocks.redeemOfferCode).not.toHaveBeenCalled();
  });

  it("still calls purchase when cached products are empty", async () => {
    mocks.storeKitProducts = [];

    const { result } = renderHook(() => useAppleSubscription());

    await act(async () => {
      await result.current.handlePurchase("cosmiq_premium_yearly");
    });

    expect(mocks.purchase).toHaveBeenCalledWith("cosmiq_premium_yearly");
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
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Purchases restored" }),
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
      is_apple_offer_eligible: true,
    };
    const { result } = renderHook(() => useAppleSubscription());
    expect(result.current.hasOfferCode).toBe(true);
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
