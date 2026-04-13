import type { CustomerInfo, PurchasesOfferings, PurchasesPackage } from "@revenuecat/purchases-capacitor";
import {
  COSMIQ_PRO_ENTITLEMENT,
  PREMIUM_YEARLY_PRODUCT_ID,
  REFERRAL_YEARLY_PRODUCT_ID,
  getCosmiqProEntitlement,
  getCurrentOfferingPackages,
  getPackageForPlan,
  getRevenueCatErrorMessage,
  initializeRevenueCat,
  isReferralProductIdentifier,
  isRevenueCatAvailable,
  isRevenueCatCancellationError,
  purchasePackage,
  resolvePackageTargetFromPackage,
  resolveActivePlan,
  resolvePlanFromProductIdentifier,
  restorePurchases as restoreRevenueCatPurchases,
  type RevenueCatPackageTarget,
  type RevenueCatPlan,
} from "@/services/revenueCat";

export interface IAPPurchase {
  productId?: string;
  transactionId?: string;
}

export interface IAPProduct {
  identifier: string;
  title: string;
  description: string;
  price: number;
  priceString: string;
  currencyCode: string;
  packageIdentifier: string;
  plan: RevenueCatPlan;
  packageTarget: RevenueCatPackageTarget;
  hasReferralDiscount: boolean;
}

export type IAPPlan = RevenueCatPlan;

export const IAP_PRODUCTS = {
  MONTHLY: "monthly",
  YEARLY: PREMIUM_YEARLY_PRODUCT_ID,
} as const;

const packageToProduct = (aPackage: PurchasesPackage): IAPProduct | null => {
  const plan = resolvePlanFromProductIdentifier(aPackage.product.identifier) ??
    resolvePlanFromProductIdentifier(aPackage.identifier);

  if (!plan) return null;

  const identifier = aPackage.identifier.toLowerCase();
  const productIdentifier = aPackage.product.identifier.toLowerCase();
  const hasReferralDiscount =
    plan === "yearly" &&
    (isReferralProductIdentifier(identifier) || isReferralProductIdentifier(productIdentifier));

  return {
    identifier: aPackage.product.identifier,
    title: aPackage.product.title,
    description: aPackage.product.description,
    price: aPackage.product.price,
    priceString: aPackage.product.priceString,
    currencyCode: aPackage.product.currencyCode,
    packageIdentifier: aPackage.identifier,
    plan,
    packageTarget: hasReferralDiscount ? "referral_yearly" : plan,
    hasReferralDiscount,
  };
};

export const getProductIdsForPlan = (plan: IAPPlan): string[] => [plan];

export const getAllIAPProductIds = (): string[] => ["monthly", PREMIUM_YEARLY_PRODUCT_ID, REFERRAL_YEARLY_PRODUCT_ID];

export const resolvePlanFromProductId = (productId: string | null | undefined): IAPPlan | null => {
  return resolvePlanFromProductIdentifier(productId);
};

export const getProductForPlan = (
  plan: IAPPlan,
  products: IAPProduct[],
  options?: { preferReferral?: boolean },
): IAPProduct | undefined => {
  const matchingProducts = products.filter((product) => product.plan === plan);
  if (plan !== "yearly") return matchingProducts[0];
  if (options?.preferReferral) {
    return matchingProducts.find((product) => product.hasReferralDiscount) ?? matchingProducts[0];
  }
  return matchingProducts.find((product) => !product.hasReferralDiscount) ?? matchingProducts[0];
};

export const getPurchaseProductIdForPlan = (
  plan: IAPPlan,
  products: IAPProduct[],
  options?: { preferReferral?: boolean },
): string => {
  if (plan === "yearly" && options?.preferReferral) {
    return getProductForPlan(plan, products, options)?.identifier ?? REFERRAL_YEARLY_PRODUCT_ID;
  }
  if (plan === "yearly") {
    return getProductForPlan(plan, products, options)?.identifier ?? PREMIUM_YEARLY_PRODUCT_ID;
  }
  return getProductForPlan(plan, products, options)?.identifier ?? plan;
};

export const getPackageTargetForProductId = (
  productId: string,
  offerings: PurchasesOfferings | null | undefined,
): RevenueCatPackageTarget | null => {
  const matchingPackage = getCurrentOfferingPackages(offerings).find(
    (aPackage) => aPackage.product.identifier === productId,
  );
  return resolvePackageTargetFromPackage(matchingPackage);
};

export const isIAPAvailable = (): boolean => isRevenueCatAvailable();

export const getProductsFromOfferings = (offerings: PurchasesOfferings | null | undefined): IAPProduct[] => {
  return getCurrentOfferingPackages(offerings)
    .map(packageToProduct)
    .filter((product): product is IAPProduct => product !== null);
};

const findPackageByProductIdentifier = (
  productId: string,
  offerings: PurchasesOfferings | null | undefined,
): PurchasesPackage | undefined => {
  const requestedPlan = resolvePlanFromProductId(productId);
  if (requestedPlan) {
    const normalizedProductId = productId.toLowerCase();
    const packageTarget: RevenueCatPackageTarget =
      normalizedProductId === REFERRAL_YEARLY_PRODUCT_ID || (requestedPlan === "yearly" && isReferralProductIdentifier(normalizedProductId))
        ? "referral_yearly"
        : requestedPlan;
    return getPackageForPlan(packageTarget, offerings);
  }

  return getCurrentOfferingPackages(offerings).find((aPackage) => aPackage.product.identifier === productId);
};

export const purchaseProduct = async (
  productId: string,
  offerings?: PurchasesOfferings | null,
): Promise<IAPPurchase> => {
  await initializeRevenueCat();

  const aPackage = findPackageByProductIdentifier(productId, offerings);
  if (!aPackage) {
    throw new Error(`Unable to find a RevenueCat package for "${productId}".`);
  }

  try {
    const result = await purchasePackage(aPackage);
    return {
      productId: result.productIdentifier,
      transactionId: result.customerInfo.requestDate,
    };
  } catch (error) {
    if (isRevenueCatCancellationError(error)) {
      throw error;
    }
    throw new Error(getRevenueCatErrorMessage(error));
  }
};

export const restorePurchases = async (): Promise<IAPPurchase[]> => {
  await initializeRevenueCat();
  const customerInfo = await restoreRevenueCatPurchases();

  return customerInfo.allPurchasedProductIdentifiers.map((productId) => ({
    productId,
    transactionId: customerInfo.requestDate,
  }));
};

export const getProducts = async (_productIds: string[], offerings?: PurchasesOfferings | null): Promise<IAPProduct[]> => {
  await initializeRevenueCat();
  return getProductsFromOfferings(offerings);
};

export const openManageSubscriptions = async (): Promise<void> => {
  throw new Error("Use RevenueCat Customer Center to manage subscriptions.");
};

export const getEntitlementInfo = (customerInfo: CustomerInfo | null | undefined) => {
  return getCosmiqProEntitlement(customerInfo);
};

export const getEntitlementIdentifier = (): string => COSMIQ_PRO_ENTITLEMENT;

export const getPlanFromCustomerInfo = (customerInfo: CustomerInfo | null | undefined): IAPPlan | null => {
  return resolveActivePlan(customerInfo);
};
