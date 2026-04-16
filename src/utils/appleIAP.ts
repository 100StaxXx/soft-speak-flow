import { Capacitor } from "@capacitor/core";
import { isNativeIOS } from "@/utils/platformTargets";
import type { StoreKitProduct } from "@/plugins/StoreKitPlugin";

export type IAPPlan = "monthly" | "yearly";

export interface IAPProduct {
  identifier: string;
  displayName: string;
  description: string;
  price: number;
  displayPrice: string;
  plan: IAPPlan;
}

export const PREMIUM_YEARLY_PRODUCT_ID = "cosmiq_premium_yearly";
export const PREMIUM_MONTHLY_PRODUCT_ID = "cosmiq_premium_monthly";

export const isIAPAvailable = (): boolean => {
  return Capacitor.isNativePlatform() && isNativeIOS();
};

export const resolvePlanFromProductId = (productId: string | null | undefined): IAPPlan | null => {
  if (!productId) return null;
  const id = productId.toLowerCase();
  if (id.includes("yearly") || id.includes("annual") || id.includes("year")) return "yearly";
  if (id.includes("monthly") || id.includes("month")) return "monthly";
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
): StoreKitProduct | undefined => {
  return products.find((p) => resolvePlanFromProductId(p.identifier) === plan);
};

export const getPurchaseProductIdForPlan = (
  plan: IAPPlan,
  products: StoreKitProduct[],
): string => {
  const product = getProductForPlan(plan, products);
  if (product) return product.identifier;
  return plan === "yearly" ? PREMIUM_YEARLY_PRODUCT_ID : PREMIUM_MONTHLY_PRODUCT_ID;
};
