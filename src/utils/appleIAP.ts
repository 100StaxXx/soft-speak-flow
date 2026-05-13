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

export const PREMIUM_YEARLY_PRODUCT_ID = "cosmiq_premium_yearly";
export const PREMIUM_MONTHLY_PRODUCT_ID = "cosmiq_premium_monthly";
export const REFERRAL_YEARLY_PRODUCT_ID = "cosmiq_referral_yearly";
export const COSMIQ_PRO_ENTITLEMENT_ID = "cosmiq_pro";
export const COSMIQ_PRO_ENTITLEMENT_NAME = "Cosmiq Pro";
export const REVENUECAT_IOS_API_KEY = "test_dnpQRPYilwaMbsjfCuXLepwYhac";
export const REVENUECAT_PRODUCT_IDS = [
  REFERRAL_YEARLY_PRODUCT_ID,
  PREMIUM_YEARLY_PRODUCT_ID,
  PREMIUM_MONTHLY_PRODUCT_ID,
] as const;

const PREMIUM_YEARLY_PRODUCT_IDS = [
  REFERRAL_YEARLY_PRODUCT_ID,
  PREMIUM_YEARLY_PRODUCT_ID,
  "com.darrylgraham.revolution.yearly",
] as const;
const PREMIUM_MONTHLY_PRODUCT_IDS = [
  PREMIUM_MONTHLY_PRODUCT_ID,
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

export const isReferralYearlyProductId = (productId: string | null | undefined): boolean => {
  return productId?.toLowerCase() === REFERRAL_YEARLY_PRODUCT_ID.toLowerCase();
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
  options?: { preferReferral?: boolean },
): StoreKitProduct | undefined => {
  if (plan === "yearly") {
    const referralProduct = products.find((p) => isReferralYearlyProductId(p.identifier));
    const premiumYearlyProduct = products.find((p) => p.identifier === PREMIUM_YEARLY_PRODUCT_ID);

    if (options?.preferReferral && referralProduct) return referralProduct;
    if (premiumYearlyProduct) return premiumYearlyProduct;
    if (referralProduct) return referralProduct;
  }

  return products.find((p) => resolvePlanFromProductId(p.identifier) === plan);
};

export const getPurchaseProductIdForPlan = (
  plan: IAPPlan,
  products: StoreKitProduct[],
  options?: { preferReferral?: boolean },
): string => {
  const product = getProductForPlan(plan, products, options);
  if (product) return product.identifier;
  if (plan === "yearly" && options?.preferReferral) return REFERRAL_YEARLY_PRODUCT_ID;
  return plan === "yearly" ? PREMIUM_YEARLY_PRODUCT_ID : PREMIUM_MONTHLY_PRODUCT_ID;
};
