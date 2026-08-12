import { Capacitor } from "@capacitor/core";
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

export const PREMIUM_YEARLY_PRODUCT_ID = "graceward_plus_yearly";
export const PREMIUM_MONTHLY_PRODUCT_ID = "graceward_plus_monthly";
export const PREMIUM_FOUNDER_YEARLY_PRODUCT_ID = "graceward_plus_founder_yearly";
export const APPLE_SUBSCRIPTION_PRODUCT_IDS = [
  PREMIUM_YEARLY_PRODUCT_ID,
  PREMIUM_MONTHLY_PRODUCT_ID,
  PREMIUM_FOUNDER_YEARLY_PRODUCT_ID,
] as const;

const PREMIUM_YEARLY_PRODUCT_IDS = [
  PREMIUM_YEARLY_PRODUCT_ID,
  PREMIUM_FOUNDER_YEARLY_PRODUCT_ID,
  "cosmiq_premium_yearly",
  "com.darrylgraham.revolution.yearly",
] as const;
const PREMIUM_MONTHLY_PRODUCT_IDS = [
  PREMIUM_MONTHLY_PRODUCT_ID,
  "cosmiq_premium_monthly",
  "com.darrylgraham.revolution.monthly",
] as const;

export const isIAPAvailable = (): boolean => {
  return Capacitor.isNativePlatform() && isNativeIOS();
};

export const resolvePlanFromProductId = (productId: string | null | undefined): IAPPlan | null => {
  if (!productId) return null;
  const id = productId.toLowerCase();
  if (PREMIUM_YEARLY_PRODUCT_IDS.some((knownId) => knownId.toLowerCase() === id)) return "yearly";
  if (PREMIUM_MONTHLY_PRODUCT_IDS.some((knownId) => knownId.toLowerCase() === id)) return "monthly";
  return null;
};

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
    const preferredProductId = useFounderRate
      ? PREMIUM_FOUNDER_YEARLY_PRODUCT_ID
      : PREMIUM_YEARLY_PRODUCT_ID;
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
  return useFounderRate ? PREMIUM_FOUNDER_YEARLY_PRODUCT_ID : PREMIUM_YEARLY_PRODUCT_ID;
};
