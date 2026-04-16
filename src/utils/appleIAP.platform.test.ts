import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capacitorMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  getPlatform: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: capacitorMocks.isNativePlatform,
    getPlatform: capacitorMocks.getPlatform,
  },
}));

vi.mock("@/utils/platformTargets", () => ({
  isNativeIOS: () => capacitorMocks.getPlatform() === "ios",
}));

import {
  isIAPAvailable,
  resolvePlanFromProductId,
  storeKitProductToIAP,
  getProductForPlan,
  getPurchaseProductIdForPlan,
  PREMIUM_MONTHLY_PRODUCT_ID,
  PREMIUM_YEARLY_PRODUCT_ID,
} from "@/utils/appleIAP";
import type { StoreKitProduct } from "@/plugins/StoreKitPlugin";

const mockProducts: StoreKitProduct[] = [
  {
    identifier: "cosmiq_premium_monthly",
    displayName: "Monthly",
    description: "Monthly plan",
    price: 9.99,
    displayPrice: "$9.99",
  },
  {
    identifier: "cosmiq_premium_yearly",
    displayName: "Yearly",
    description: "Yearly plan",
    price: 99.99,
    displayPrice: "$99.99",
  },
];

describe("appleIAP StoreKit 2 utilities", () => {
  beforeEach(() => {
    capacitorMocks.isNativePlatform.mockReset();
    capacitorMocks.getPlatform.mockReset();
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    capacitorMocks.getPlatform.mockReturnValue("ios");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("isIAPAvailable", () => {
    it("returns true on native iOS", () => {
      expect(isIAPAvailable()).toBe(true);
    });

    it("returns false on web", () => {
      capacitorMocks.isNativePlatform.mockReturnValue(false);
      capacitorMocks.getPlatform.mockReturnValue("web");
      expect(isIAPAvailable()).toBe(false);
    });

    it("returns false on native Android", () => {
      capacitorMocks.getPlatform.mockReturnValue("android");
      expect(isIAPAvailable()).toBe(false);
    });
  });

  describe("resolvePlanFromProductId", () => {
    it("resolves yearly from product ID", () => {
      expect(resolvePlanFromProductId("cosmiq_premium_yearly")).toBe("yearly");
    });

    it("resolves monthly from product ID", () => {
      expect(resolvePlanFromProductId("cosmiq_premium_monthly")).toBe("monthly");
    });

    it("returns null for null/undefined", () => {
      expect(resolvePlanFromProductId(null)).toBeNull();
      expect(resolvePlanFromProductId(undefined)).toBeNull();
    });

    it("returns null for unrecognized product ID", () => {
      expect(resolvePlanFromProductId("unknown_product")).toBeNull();
    });
  });

  describe("storeKitProductToIAP", () => {
    it("converts a StoreKit product to IAPProduct", () => {
      const result = storeKitProductToIAP(mockProducts[0]);
      expect(result).toEqual({
        identifier: "cosmiq_premium_monthly",
        displayName: "Monthly",
        description: "Monthly plan",
        price: 9.99,
        displayPrice: "$9.99",
        plan: "monthly",
      });
    });

    it("returns null for unrecognized product", () => {
      const result = storeKitProductToIAP({
        identifier: "unknown",
        displayName: "Unknown",
        description: "",
        price: 0,
        displayPrice: "$0.00",
      });
      expect(result).toBeNull();
    });
  });

  describe("getProductForPlan", () => {
    it("finds the monthly product", () => {
      const product = getProductForPlan("monthly", mockProducts);
      expect(product?.identifier).toBe("cosmiq_premium_monthly");
    });

    it("finds the yearly product", () => {
      const product = getProductForPlan("yearly", mockProducts);
      expect(product?.identifier).toBe("cosmiq_premium_yearly");
    });

    it("returns undefined when no match", () => {
      expect(getProductForPlan("monthly", [])).toBeUndefined();
    });
  });

  describe("getPurchaseProductIdForPlan", () => {
    it("returns product identifier from loaded products", () => {
      expect(getPurchaseProductIdForPlan("monthly", mockProducts)).toBe("cosmiq_premium_monthly");
      expect(getPurchaseProductIdForPlan("yearly", mockProducts)).toBe("cosmiq_premium_yearly");
    });

    it("falls back to constant when products are empty", () => {
      expect(getPurchaseProductIdForPlan("monthly", [])).toBe(PREMIUM_MONTHLY_PRODUCT_ID);
      expect(getPurchaseProductIdForPlan("yearly", [])).toBe(PREMIUM_YEARLY_PRODUCT_ID);
    });
  });
});
