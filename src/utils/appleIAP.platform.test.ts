import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capacitorMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  getPlatform: vi.fn(),
}));

const revenueCatMocks = vi.hoisted(() => ({
  initializeRevenueCat: vi.fn(),
  isRevenueCatAvailable: vi.fn(),
  purchasePackage: vi.fn(),
  restoreRevenueCatPurchases: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: capacitorMocks.isNativePlatform,
    getPlatform: capacitorMocks.getPlatform,
  },
}));

vi.mock("@/services/revenueCat", () => ({
  COSMIQ_PRO_ENTITLEMENT: "Cosmiq Pro",
  PREMIUM_YEARLY_PRODUCT_ID: "cosmiq_premium_yearly",
  REFERRAL_YEARLY_PRODUCT_ID: "cosmiq_referral_yearly",
  getCosmiqProEntitlement: vi.fn(),
  getCurrentOfferingPackages: vi.fn((offerings) => offerings?.current?.availablePackages ?? []),
  getPackageForPlan: vi.fn((plan, offerings) =>
    offerings?.current?.availablePackages?.find((pkg: { identifier: string; product: { identifier: string } }) =>
      pkg.identifier === plan || pkg.product.identifier === plan,
    ),
  ),
  getRevenueCatErrorMessage: vi.fn((error) => error instanceof Error ? error.message : String(error)),
  initializeRevenueCat: revenueCatMocks.initializeRevenueCat,
  isRevenueCatAvailable: revenueCatMocks.isRevenueCatAvailable,
  isRevenueCatCancellationError: vi.fn(() => false),
  purchasePackage: revenueCatMocks.purchasePackage,
  resolveActivePlan: vi.fn(),
  resolvePlanFromProductIdentifier: vi.fn((value: string | null | undefined) => {
    const normalized = (value ?? "").toLowerCase();
    if (normalized.includes("lifetime")) return "lifetime";
    if (normalized.includes("year")) return "yearly";
    if (normalized.includes("month")) return "monthly";
    return null;
  }),
  restorePurchases: revenueCatMocks.restoreRevenueCatPurchases,
}));

import { getPurchaseProductIdForPlan, isIAPAvailable, purchaseProduct, restorePurchases } from "@/utils/appleIAP";

const baseOfferings = {
  current: {
    availablePackages: [
      {
        identifier: "monthly",
        product: {
          identifier: "monthly",
          title: "Monthly",
          description: "Monthly plan",
          price: 9.99,
          priceString: "$9.99",
          currencyCode: "USD",
        },
      },
    ],
  },
};

describe("appleIAP RevenueCat bridge", () => {
  beforeEach(() => {
    capacitorMocks.isNativePlatform.mockReset();
    capacitorMocks.getPlatform.mockReset();
    revenueCatMocks.initializeRevenueCat.mockReset();
    revenueCatMocks.isRevenueCatAvailable.mockReset();
    revenueCatMocks.purchasePackage.mockReset();
    revenueCatMocks.restoreRevenueCatPurchases.mockReset();
    revenueCatMocks.isRevenueCatAvailable.mockReturnValue(true);
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    capacitorMocks.getPlatform.mockReturnValue("ios");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns RevenueCat availability", () => {
    revenueCatMocks.isRevenueCatAvailable.mockReturnValue(false);
    expect(isIAPAvailable()).toBe(false);
  });

  it("purchases through the matching RevenueCat package", async () => {
    revenueCatMocks.purchasePackage.mockResolvedValue({
      productIdentifier: "monthly",
      customerInfo: { requestDate: "2026-04-13T00:00:00.000Z" },
    });

    await purchaseProduct("monthly", baseOfferings as never);

    expect(revenueCatMocks.initializeRevenueCat).toHaveBeenCalled();
    expect(revenueCatMocks.purchasePackage).toHaveBeenCalledWith(baseOfferings.current.availablePackages[0]);
  });

  it("prefers the separate referral yearly sku for referred users", () => {
    const products = [
      {
        identifier: "cosmiq_premium_yearly",
        title: "Yearly",
        description: "Standard yearly plan",
        price: 99.99,
        priceString: "$99.99",
        currencyCode: "USD",
        packageIdentifier: "annual",
        plan: "yearly",
        packageTarget: "yearly",
        hasReferralDiscount: false,
      },
      {
        identifier: "cosmiq_referral_yearly",
        title: "Referral Yearly",
        description: "Referral yearly plan",
        price: 69.99,
        priceString: "$69.99",
        currencyCode: "USD",
        packageIdentifier: "referral_annual",
        plan: "yearly",
        packageTarget: "referral_yearly",
        hasReferralDiscount: true,
      },
    ];

    expect(getPurchaseProductIdForPlan("yearly", products as never, { preferReferral: true })).toBe("cosmiq_referral_yearly");
    expect(getPurchaseProductIdForPlan("yearly", products as never, { preferReferral: false })).toBe("cosmiq_premium_yearly");
  });

  it("restores purchases through RevenueCat", async () => {
    revenueCatMocks.restoreRevenueCatPurchases.mockResolvedValue({
      allPurchasedProductIdentifiers: ["monthly"],
      requestDate: "2026-04-13T00:00:00.000Z",
    });

    const purchases = await restorePurchases();

    expect(revenueCatMocks.restoreRevenueCatPurchases).toHaveBeenCalled();
    expect(purchases[0]?.productId).toBe("monthly");
  });
});
