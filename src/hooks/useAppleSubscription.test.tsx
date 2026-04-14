import React from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  purchase: vi.fn(),
  purchaseWithPromoOffer: vi.fn(),
  restorePurchases: vi.fn(),
  manageSubscriptions: vi.fn(),
  refreshProducts: vi.fn(),
  user: { id: "11111111-1111-4111-8111-111111111111" } as { id: string } | null,
  profile: null as { referred_by_code?: string | null } | null,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ profile: mocks.profile }),
}));

vi.mock("@/hooks/useStoreKit", () => ({
  useStoreKit: () => ({
    isAvailable: true,
    products: [
      { identifier: "cosmiq_premium_monthly", displayName: "Monthly", description: "", price: 9.99, displayPrice: "$9.99" },
      { identifier: "cosmiq_premium_yearly", displayName: "Yearly", description: "", price: 99.99, displayPrice: "$99.99" },
    ],
    productsLoading: false,
    purchase: (...args: unknown[]) => mocks.purchase(...args),
    purchaseWithPromoOffer: (...args: unknown[]) => mocks.purchaseWithPromoOffer(...args),
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
  isNativeIOSHandheld: () => true,
}));

vi.mock("@/utils/paywallTelemetry", () => ({
  trackPaywallEvent: vi.fn(),
}));

import { useAppleSubscription } from "./useAppleSubscription";

describe("useAppleSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: "11111111-1111-4111-8111-111111111111" };
    mocks.profile = null;
    mocks.purchase.mockResolvedValue({ productId: "cosmiq_premium_monthly", transactionId: "tx-1" });
    mocks.purchaseWithPromoOffer.mockResolvedValue({ productId: "cosmiq_premium_yearly", transactionId: "tx-2" });
    mocks.restorePurchases.mockResolvedValue({ productId: "cosmiq_premium_monthly", transactionId: "tx-r" });
    mocks.refreshProducts.mockResolvedValue(undefined);
  });

  it("calls purchase for monthly products", async () => {
    const { result } = renderHook(() => useAppleSubscription());

    await act(async () => {
      await result.current.handlePurchase("cosmiq_premium_monthly");
    });

    expect(mocks.purchase).toHaveBeenCalledWith("cosmiq_premium_monthly");
    expect(mocks.purchaseWithPromoOffer).not.toHaveBeenCalled();
  });

  it("calls purchaseWithPromoOffer for yearly when user has offer code", async () => {
    mocks.profile = { referred_by_code: "OFFER123" };

    const { result } = renderHook(() => useAppleSubscription());

    await act(async () => {
      await result.current.handlePurchase("cosmiq_premium_yearly");
    });

    expect(mocks.purchaseWithPromoOffer).toHaveBeenCalledWith("cosmiq_premium_yearly");
    expect(mocks.purchase).not.toHaveBeenCalled();
  });

  it("calls regular purchase for yearly when no offer code", async () => {
    mocks.profile = null;

    const { result } = renderHook(() => useAppleSubscription());

    await act(async () => {
      await result.current.handlePurchase("cosmiq_premium_yearly");
    });

    expect(mocks.purchase).toHaveBeenCalledWith("cosmiq_premium_yearly");
    expect(mocks.purchaseWithPromoOffer).not.toHaveBeenCalled();
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

  it("exposes hasOfferCode from profile", () => {
    mocks.profile = { referred_by_code: "OFFER123" };
    const { result } = renderHook(() => useAppleSubscription());
    expect(result.current.hasOfferCode).toBe(true);
  });

  it("hasOfferCode is false when no profile code", () => {
    mocks.profile = null;
    const { result } = renderHook(() => useAppleSubscription());
    expect(result.current.hasOfferCode).toBe(false);
  });
});
