import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capacitorMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  getPlatform: vi.fn(),
}));

const nativePurchasesMocks = vi.hoisted(() => ({
  purchaseProduct: vi.fn(),
  getPurchases: vi.fn(),
  restorePurchases: vi.fn(),
  isBillingSupported: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: capacitorMocks.isNativePlatform,
    getPlatform: capacitorMocks.getPlatform,
  },
}));

vi.mock("@capgo/native-purchases", () => ({
  NativePurchases: {
    purchaseProduct: nativePurchasesMocks.purchaseProduct,
    getPurchases: nativePurchasesMocks.getPurchases,
    restorePurchases: nativePurchasesMocks.restorePurchases,
    isBillingSupported: nativePurchasesMocks.isBillingSupported,
  },
  PURCHASE_TYPE: {
    SUBS: "subs",
  },
}));

import { isIAPAvailable, purchaseProduct, restorePurchases } from "@/utils/appleIAP";

const originalUserAgentDescriptor = Object.getOwnPropertyDescriptor(navigator, "userAgent");
const originalMaxTouchPointsDescriptor = Object.getOwnPropertyDescriptor(navigator, "maxTouchPoints");

const setNavigatorValues = (userAgent: string, maxTouchPoints: number) => {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });

  Object.defineProperty(navigator, "maxTouchPoints", {
    configurable: true,
    value: maxTouchPoints,
  });
};

describe("isIAPAvailable", () => {
  beforeEach(() => {
    capacitorMocks.isNativePlatform.mockReset();
    capacitorMocks.getPlatform.mockReset();
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    capacitorMocks.getPlatform.mockReturnValue("ios");
    nativePurchasesMocks.purchaseProduct.mockReset();
    nativePurchasesMocks.getPurchases.mockReset();
    nativePurchasesMocks.restorePurchases.mockReset();
    nativePurchasesMocks.isBillingSupported.mockReset();
    nativePurchasesMocks.restorePurchases.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalUserAgentDescriptor) {
      Object.defineProperty(navigator, "userAgent", originalUserAgentDescriptor);
    } else {
      delete (navigator as Navigator & { userAgent?: string }).userAgent;
    }

    if (originalMaxTouchPointsDescriptor) {
      Object.defineProperty(navigator, "maxTouchPoints", originalMaxTouchPointsDescriptor);
    } else {
      delete (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints;
    }
  });

  it("returns false on Mac-hosted iOS app", () => {
    setNavigatorValues("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)", 0);

    expect(isIAPAvailable()).toBe(false);
  });

  it("returns true on handheld iOS", () => {
    setNavigatorValues("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 5);

    expect(isIAPAvailable()).toBe(true);
  });

  it("forwards appAccountToken during purchase", async () => {
    setNavigatorValues("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 5);
    nativePurchasesMocks.purchaseProduct.mockResolvedValue({
      productId: "cosmiq_premium_monthly",
      transactionId: "tx-1",
    });

    await purchaseProduct("cosmiq_premium_monthly", "11111111-1111-4111-8111-111111111111");

    expect(nativePurchasesMocks.purchaseProduct).toHaveBeenCalledWith({
      productIdentifier: "cosmiq_premium_monthly",
      productType: "subs",
      appAccountToken: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("forwards appAccountToken during restore lookups", async () => {
    setNavigatorValues("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 5);
    nativePurchasesMocks.getPurchases.mockResolvedValue({
      purchases: [
        {
          productIdentifier: "cosmiq_premium_yearly",
          transactionId: "tx-restore-1",
          purchaseDate: "2026-03-28T00:00:00.000Z",
          appAccountToken: "22222222-2222-4222-8222-222222222222",
        },
      ],
    });

    const purchases = await restorePurchases("22222222-2222-4222-8222-222222222222");

    expect(nativePurchasesMocks.getPurchases).toHaveBeenCalledWith({
      productType: "subs",
      appAccountToken: "22222222-2222-4222-8222-222222222222",
    });
    expect(purchases[0]?.appAccountToken).toBe("22222222-2222-4222-8222-222222222222");
  });
});
