import { Capacitor } from "@capacitor/core";
import {
  LOG_LEVEL,
  PACKAGE_TYPE,
  Purchases,
  type CustomerInfo,
  type LogInResult,
  type MakePurchaseResult,
  type PurchasesEntitlementInfo,
  type PurchasesOffering,
  type PurchasesOfferings,
  type PurchasesPackage,
} from "@revenuecat/purchases-capacitor";
import {
  PAYWALL_RESULT,
  RevenueCatUI,
  type PaywallResult,
} from "@revenuecat/purchases-capacitor-ui";
import { isNativeIOSHandheld } from "@/utils/platformTargets";

export const REVENUECAT_API_KEY = "test_dnpQRPYilwaMbsjfCuXLepwYhac";
export const COSMIQ_PRO_ENTITLEMENT = "Cosmiq Pro";
export const PREMIUM_YEARLY_PRODUCT_ID = "cosmiq_premium_yearly";
export const REFERRAL_YEARLY_PRODUCT_ID = "cosmiq_referral_yearly";

export type RevenueCatPlan = "yearly" | "monthly";
export type RevenueCatPackageTarget = RevenueCatPlan | "referral_yearly";

const isDevelopment = import.meta.env.DEV;

let configurationPromise: Promise<void> | null = null;
let configuredUserId: string | null = null;

export const isRevenueCatAvailable = (): boolean => {
  return Capacitor.isNativePlatform() && isNativeIOSHandheld();
};

const normalize = (value: string | null | undefined): string => (value ?? "").trim().toLowerCase();

export const isReferralProductIdentifier = (value: string | null | undefined): boolean => {
  const normalized = normalize(value);
  return normalized === REFERRAL_YEARLY_PRODUCT_ID || normalized.includes("referral");
};

const isExactProductIdMatch = (
  aPackage: PurchasesPackage,
  productId: string,
): boolean => normalize(aPackage.product.identifier) === normalize(productId);

export const isRevenueCatCancellationError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  const maybeCancelled = (error as { userCancelled?: unknown }).userCancelled;
  return maybeCancelled === true;
};

export const getRevenueCatErrorMessage = (error: unknown): string => {
  if (typeof error === "string" && error) return error;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "");
    if (message) return message;
  }
  return "Something went wrong with subscriptions. Please try again.";
};

export const initializeRevenueCat = async (appUserID?: string | null): Promise<void> => {
  if (!isRevenueCatAvailable()) return;

  const normalizedUserId = appUserID?.trim() || null;
  if (configurationPromise && configuredUserId === normalizedUserId) {
    return configurationPromise;
  }

  configurationPromise = (async () => {
    if (isDevelopment) {
      await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
    }

    await Purchases.configure({
      apiKey: REVENUECAT_API_KEY,
      appUserID: normalizedUserId,
    });
    configuredUserId = normalizedUserId;
  })();

  return configurationPromise;
};

export const logInRevenueCat = async (appUserID: string): Promise<LogInResult> => {
  await initializeRevenueCat();
  return Purchases.logIn({ appUserID });
};

export const logOutRevenueCat = async (): Promise<{ customerInfo: CustomerInfo }> => {
  await initializeRevenueCat();
  return Purchases.logOut();
};

export const getCustomerInfo = async (): Promise<CustomerInfo> => {
  await initializeRevenueCat();
  const { customerInfo } = await Purchases.getCustomerInfo();
  return customerInfo;
};

export const getOfferings = async (): Promise<PurchasesOfferings> => {
  await initializeRevenueCat();
  return Purchases.getOfferings();
};

export const purchasePackage = async (aPackage: PurchasesPackage): Promise<MakePurchaseResult> => {
  await initializeRevenueCat();
  return Purchases.purchasePackage({ aPackage });
};

export const restorePurchases = async (): Promise<CustomerInfo> => {
  await initializeRevenueCat();
  const { customerInfo } = await Purchases.restorePurchases();
  return customerInfo;
};

export const presentPaywall = async (offering?: PurchasesOffering): Promise<PaywallResult> => {
  await initializeRevenueCat();
  return RevenueCatUI.presentPaywall({
    offering,
    displayCloseButton: true,
  });
};

export const presentPaywallIfNeeded = async (offering?: PurchasesOffering): Promise<PaywallResult> => {
  await initializeRevenueCat();
  return RevenueCatUI.presentPaywallIfNeeded({
    offering,
    displayCloseButton: true,
    requiredEntitlementIdentifier: COSMIQ_PRO_ENTITLEMENT,
  });
};

export const presentCustomerCenter = async (): Promise<void> => {
  await initializeRevenueCat();
  await RevenueCatUI.presentCustomerCenter();
};

export const isCosmiqProActive = (customerInfo: CustomerInfo | null | undefined): boolean => {
  return Boolean(customerInfo?.entitlements.active[COSMIQ_PRO_ENTITLEMENT]?.isActive);
};

export const getCosmiqProEntitlement = (
  customerInfo: CustomerInfo | null | undefined,
): PurchasesEntitlementInfo | null => {
  return customerInfo?.entitlements.all[COSMIQ_PRO_ENTITLEMENT] ?? null;
};

export const resolvePlanFromProductIdentifier = (
  productIdentifier: string | null | undefined,
): RevenueCatPlan | null => {
  const id = normalize(productIdentifier);
  if (!id) return null;
  if (id === "yearly" || id.includes("yearly") || id.includes("annual") || id.includes("year")) {
    return "yearly";
  }
  if (id === "monthly" || id.includes("monthly") || id.includes("month")) return "monthly";
  return null;
};

export const resolvePlanFromPackage = (aPackage: PurchasesPackage | null | undefined): RevenueCatPlan | null => {
  if (!aPackage) return null;

  switch (aPackage.packageType) {
    case PACKAGE_TYPE.ANNUAL:
      return "yearly";
    case PACKAGE_TYPE.MONTHLY:
      return "monthly";
    default:
      break;
  }

  return (
    resolvePlanFromProductIdentifier(aPackage.identifier) ??
    resolvePlanFromProductIdentifier(aPackage.product.identifier)
  );
};

export const resolvePackageTargetFromPackage = (
  aPackage: PurchasesPackage | null | undefined,
): RevenueCatPackageTarget | null => {
  const plan = resolvePlanFromPackage(aPackage);
  if (!plan) return null;
  if (plan === "yearly" && isReferralProductIdentifier(aPackage?.identifier || aPackage?.product.identifier)) {
    return "referral_yearly";
  }
  return plan;
};

export const resolveActivePlan = (
  customerInfo: CustomerInfo | null | undefined,
): RevenueCatPlan | null => {
  const entitlement = getCosmiqProEntitlement(customerInfo);
  return resolvePlanFromProductIdentifier(entitlement?.productIdentifier);
};

export const getCurrentOfferingPackages = (
  offerings: PurchasesOfferings | null | undefined,
): PurchasesPackage[] => {
  return offerings?.current?.availablePackages ?? [];
};

export const getPackageForPlan = (
  plan: RevenueCatPackageTarget,
  offerings: PurchasesOfferings | null | undefined,
): PurchasesPackage | undefined => {
  const packages = getCurrentOfferingPackages(offerings);

  if (plan === "referral_yearly") {
    return (
      packages.find((aPackage) => isExactProductIdMatch(aPackage, REFERRAL_YEARLY_PRODUCT_ID)) ??
      packages.find((aPackage) => resolvePlanFromPackage(aPackage) === "yearly" && isReferralProductIdentifier(aPackage.identifier || aPackage.product.identifier))
    );
  }

  if (plan === "yearly") {
    return (
      packages.find((aPackage) => isExactProductIdMatch(aPackage, PREMIUM_YEARLY_PRODUCT_ID)) ??
      packages.find((aPackage) => resolvePlanFromPackage(aPackage) === "yearly" && !isReferralProductIdentifier(aPackage.identifier || aPackage.product.identifier)) ??
      packages.find((aPackage) => resolvePlanFromPackage(aPackage) === "yearly")
    );
  }

  return packages.find((aPackage) => resolvePlanFromPackage(aPackage) === plan);
};

export const isSuccessfulPaywallResult = (result: PaywallResult | null | undefined): boolean => {
  const paywallResult = result?.result;
  return paywallResult === PAYWALL_RESULT.PURCHASED || paywallResult === PAYWALL_RESULT.RESTORED;
};
