import { Capacitor } from "@capacitor/core";
import { PRODUCT, type ProductMode } from "@/config/product";
import { isNativeIOS } from "@/utils/platformTargets";
import type { StoreKitProduct } from "@/types/subscription";

export type IAPPlan = "monthly" | "yearly";

export interface IAPProduct {
  identifier: string;
  displayName: string;
  description: string;
  price: number;
  displayPrice: string;
  plan: IAPPlan;
}

interface AppleSubscriptionProductCatalog {
  monthly: string;
  yearly: string;
  founderYearly?: string;
  monthlyProductIds: readonly string[];
  yearlyProductIds: readonly string[];
  loadProductIds: readonly string[];
}

const PRODUCT_CATALOGS: Record<ProductMode, AppleSubscriptionProductCatalog> = {
  christian: {
    monthly: "graceward_plus_monthly",
    yearly: "graceward_plus_yearly",
    founderYearly: "graceward_plus_founder_yearly",
    monthlyProductIds: ["graceward_plus_monthly"],
    yearlyProductIds: ["graceward_plus_yearly", "graceward_plus_founder_yearly"],
    loadProductIds: [
      "graceward_plus_yearly",
      "graceward_plus_monthly",
      "graceward_plus_founder_yearly",
    ],
  },
  cosmiq: {
    monthly: "cosmiq_premium_monthly",
    yearly: "cosmiq_premium_yearly",
    monthlyProductIds: [
      "cosmiq_premium_monthly",
      "com.darrylgraham.revolution.monthly",
    ],
    yearlyProductIds: [
      "cosmiq_premium_yearly",
      "com.darrylgraham.revolution.yearly",
    ],
    loadProductIds: [
      "cosmiq_premium_yearly",
      "cosmiq_premium_monthly",
      "com.darrylgraham.revolution.yearly",
      "com.darrylgraham.revolution.monthly",
    ],
  },
};

export const getAppleSubscriptionProductCatalog = (
  productMode: ProductMode,
): AppleSubscriptionProductCatalog => PRODUCT_CATALOGS[productMode];

const CURRENT_PRODUCT_CATALOG = getAppleSubscriptionProductCatalog(PRODUCT.mode);

export const PREMIUM_YEARLY_PRODUCT_ID = CURRENT_PRODUCT_CATALOG.yearly;
export const PREMIUM_MONTHLY_PRODUCT_ID = CURRENT_PRODUCT_CATALOG.monthly;
export const PREMIUM_FOUNDER_YEARLY_PRODUCT_ID =
  CURRENT_PRODUCT_CATALOG.founderYearly ?? CURRENT_PRODUCT_CATALOG.yearly;
export const APPLE_SUBSCRIPTION_PRODUCT_IDS = CURRENT_PRODUCT_CATALOG.loadProductIds;

export const isIAPAvailable = (): boolean => {
  return Capacitor.isNativePlatform() && isNativeIOS();
};

export const resolvePlanFromProductIdForMode = (
  productId: string | null | undefined,
  productMode: ProductMode,
): IAPPlan | null => {
  if (!productId) return null;
  const id = productId.toLowerCase();
  const catalog = getAppleSubscriptionProductCatalog(productMode);
  if (catalog.yearlyProductIds.some((knownId) => knownId.toLowerCase() === id)) return "yearly";
  if (catalog.monthlyProductIds.some((knownId) => knownId.toLowerCase() === id)) return "monthly";
  return null;
};

export const resolvePlanFromProductId = (
  productId: string | null | undefined,
): IAPPlan | null => resolvePlanFromProductIdForMode(productId, PRODUCT.mode);

export const storeKitProductToIAP = (product: StoreKitProduct): IAPProduct | null => {
  const plan = resolvePlanFromProductId(product.identifier);
  if (!plan) return null;

  return {
    identifier: product.identifier,
    displayName: product.displayName,
    description: product.description,
    price: product.price,
    displayPrice: product.displayPrice,
    plan,
  };
};

export const getProductForPlan = (
  plan: IAPPlan,
  products: StoreKitProduct[],
  useFounderRate = false,
): StoreKitProduct | undefined => {
  if (plan === "yearly") {
    const preferredProductId = useFounderRate && CURRENT_PRODUCT_CATALOG.founderYearly
      ? CURRENT_PRODUCT_CATALOG.founderYearly
      : CURRENT_PRODUCT_CATALOG.yearly;
    const premiumYearlyProduct = products.find((p) => p.identifier === preferredProductId);

    if (premiumYearlyProduct) return premiumYearlyProduct;
  }

  return products.find((p) => resolvePlanFromProductId(p.identifier) === plan);
};

export const getPurchaseProductIdForPlan = (
  plan: IAPPlan,
  products: StoreKitProduct[],
  useFounderRate = false,
): string => {
  const product = getProductForPlan(plan, products, useFounderRate);
  if (product) return product.identifier;
  if (plan === "monthly") return PREMIUM_MONTHLY_PRODUCT_ID;
  return useFounderRate && CURRENT_PRODUCT_CATALOG.founderYearly
    ? CURRENT_PRODUCT_CATALOG.founderYearly
    : PREMIUM_YEARLY_PRODUCT_ID;
};
