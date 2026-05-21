import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import type {
  CustomerInfo,
  PurchasesEntitlementInfo,
  PurchasesOfferings,
  PurchasesPackage,
  PurchasesStoreProduct,
  PurchasesStoreTransaction,
} from "@revenuecat/purchases-capacitor";
import { isNativeIOS } from "@/utils/platformTargets";
import { useAuth } from "@/hooks/useAuth";
import {
  COSMIQ_PRO_ENTITLEMENT_ID,
  COSMIQ_PRO_ENTITLEMENT_NAME,
  REVENUECAT_IOS_API_KEY,
  REVENUECAT_PRODUCT_IDS,
  resolvePlanFromProductId,
} from "@/utils/appleIAP";
import { withTimeout } from "@/utils/asyncTimeout";
import type { StoreKitProduct, StoreKitTransaction } from "@/types/subscription";

const CUSTOMER_INFO_TIMEOUT_MS = 5000;
const REVENUECAT_PRODUCTS_TIMEOUT_MS = 8000;
const REVENUECAT_CONFIGURE_TIMEOUT_MS = 10000;
const REVENUECAT_PURCHASE_RECOVERY_TIMEOUT_MS = 8000;
const OFFER_CODE_ENTITLEMENT_POLL_DELAYS_MS = [0, 500, 1000, 1500];
const REVENUECAT_DEBUG = import.meta.env.VITE_REVENUECAT_DEBUG === "true";
const COSMIQ_PRO_ENTITLEMENT_ALIASES = [
  COSMIQ_PRO_ENTITLEMENT_ID,
  COSMIQ_PRO_ENTITLEMENT_NAME,
] as const;
const REVENUECAT_PAYWALL_ENTITLEMENT_ID = COSMIQ_PRO_ENTITLEMENT_NAME;

type RevenueCatModule = typeof import("@revenuecat/purchases-capacitor");
type RevenueCatUIModule = typeof import("@revenuecat/purchases-capacitor-ui");

let revenueCatModulePromise: Promise<RevenueCatModule> | null = null;
let revenueCatUIModulePromise: Promise<RevenueCatUIModule> | null = null;

function loadRevenueCat(): Promise<RevenueCatModule> {
  revenueCatModulePromise ??= import("@revenuecat/purchases-capacitor");
  return revenueCatModulePromise;
}

function loadRevenueCatUI(): Promise<RevenueCatUIModule> {
  revenueCatUIModulePromise ??= import("@revenuecat/purchases-capacitor-ui");
  return revenueCatUIModulePromise;
}

type RevenueCatPurchaseTransaction = PurchasesStoreTransaction & {
  productId?: string;
  revenueCatId?: string;
  purchaseDateMillis?: number;
};
type RevenueCatSubscriptionInfo = CustomerInfo["subscriptionsByProductIdentifier"][string];
type ActiveCosmiqSubscription = {
  productId: string;
  subscription: RevenueCatSubscriptionInfo;
};

type StoreKitPlan = "monthly" | "yearly";

type StoreKitContextValue = {
  isAvailable: boolean;
  isLoading: boolean;
  products: StoreKitProduct[];
  productsLoading: boolean;
  currentEntitlement: StoreKitTransaction | null;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOfferings | null;
  entitlementError: boolean;
  isPro: boolean;
  activePlan: StoreKitPlan | null;
  expirationDate: Date | null;
  purchase: (productId: string) => Promise<StoreKitTransaction | null>;
  redeemOfferCode: () => Promise<{ status: "presented"; entitlement: StoreKitTransaction | null }>;
  restorePurchases: () => Promise<StoreKitTransaction | null>;
  manageSubscriptions: () => Promise<void>;
  presentPaywall: () => Promise<boolean>;
  presentPaywallIfNeeded: () => Promise<boolean>;
  presentCustomerCenter: () => Promise<void>;
  recoverPurchases: () => Promise<StoreKitTransaction | null>;
  refreshEntitlement: () => Promise<void>;
  refreshProducts: () => Promise<StoreKitProduct[]>;
};

const StoreKitContext = createContext<StoreKitContextValue | undefined>(undefined);

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function parseSubscriptionPeriod(period: string | null): {
  subscriptionPeriodUnit?: number;
  subscriptionPeriodValue?: number;
} {
  if (!period) return {};

  const match = /^P(\d+)([DWMY])$/.exec(period);
  if (!match) return {};

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return {};

  const unit = match[2] === "D"
    ? 0
    : match[2] === "W"
      ? 1
      : match[2] === "M"
        ? 2
        : 3;

  return {
    subscriptionPeriodUnit: unit,
    subscriptionPeriodValue: value,
  };
}

function revenueCatProductToStoreKitProduct(product: PurchasesStoreProduct): StoreKitProduct {
  return {
    identifier: product.identifier,
    displayName: product.title,
    description: product.description,
    displayPrice: product.priceString,
    price: product.price,
    type: product.productType,
    pricePerMonthString: product.pricePerMonthString,
    pricePerYearString: product.pricePerYearString,
    ...parseSubscriptionPeriod(product.subscriptionPeriod),
  };
}

function mergeProducts(products: PurchasesStoreProduct[]): StoreKitProduct[] {
  const byIdentifier = new Map<string, PurchasesStoreProduct>();
  for (const product of products) {
    byIdentifier.set(product.identifier, product);
  }
  const configuredProductIds = new Set<string>(REVENUECAT_PRODUCT_IDS);

  const ordered = [
    ...REVENUECAT_PRODUCT_IDS
      .map((productId) => byIdentifier.get(productId))
      .filter((product): product is PurchasesStoreProduct => Boolean(product)),
    ...products.filter((product) => !configuredProductIds.has(product.identifier)),
  ];

  return ordered.map(revenueCatProductToStoreKitProduct);
}

function packagesFromOfferings(offerings: PurchasesOfferings | null): PurchasesPackage[] {
  if (!offerings) return [];

  const packages: PurchasesPackage[] = [];
  const seen = new Set<string>();
  const addPackage = (pkg: PurchasesPackage | null | undefined) => {
    if (!pkg || seen.has(`${pkg.presentedOfferingContext.offeringIdentifier}:${pkg.identifier}:${pkg.product.identifier}`)) {
      return;
    }
    seen.add(`${pkg.presentedOfferingContext.offeringIdentifier}:${pkg.identifier}:${pkg.product.identifier}`);
    packages.push(pkg);
  };

  offerings.current?.availablePackages.forEach(addPackage);
  Object.values(offerings.all).forEach((offering) => {
    offering.availablePackages.forEach(addPackage);
  });

  return packages;
}

function activeCosmiqProEntitlement(customerInfo: CustomerInfo | null): PurchasesEntitlementInfo | null {
  if (!customerInfo) return null;

  for (const entitlementId of COSMIQ_PRO_ENTITLEMENT_ALIASES) {
    const entitlement = customerInfo.entitlements.active[entitlementId];
    if (entitlement?.isActive) return entitlement;
  }

  return null;
}

function activeCosmiqProSubscription(
  customerInfo: CustomerInfo | null,
): ActiveCosmiqSubscription | null {
  const subscriptions = customerInfo?.subscriptionsByProductIdentifier;
  if (!subscriptions) return null;

  const activeProductIds = new Set(customerInfo.activeSubscriptions ?? []);
  const knownProductIds = new Set<string>(REVENUECAT_PRODUCT_IDS);
  const productIds = [
    ...REVENUECAT_PRODUCT_IDS,
    ...Object.keys(subscriptions).filter((productId) => (
      !knownProductIds.has(productId) && resolvePlanFromProductId(productId)
    )),
  ];

  for (const productId of productIds) {
    const subscription = subscriptions[productId];
    if (!subscription) continue;

    const expiresDate = subscription.expiresDate ? new Date(subscription.expiresDate) : null;
    const hasFutureExpiration = Boolean(
      expiresDate && !Number.isNaN(expiresDate.getTime()) && expiresDate > new Date(),
    );

    if (subscription.isActive || (activeProductIds.has(productId) && hasFutureExpiration)) {
      return {
        productId: subscription.productIdentifier ?? productId,
        subscription,
      };
    }
  }

  return null;
}

function transactionIdFor(
  entitlement: PurchasesEntitlementInfo,
  subscription: CustomerInfo["subscriptionsByProductIdentifier"][string] | undefined,
  transaction?: PurchasesStoreTransaction | null,
): string {
  return (
    transaction?.transactionIdentifier ||
    subscription?.storeTransactionId ||
    `${entitlement.productIdentifier}:${entitlement.latestPurchaseDateMillis}`
  );
}

function customerInfoToTransaction(
  customerInfo: CustomerInfo | null,
  transaction?: PurchasesStoreTransaction | null,
): StoreKitTransaction | null {
  const entitlement = activeCosmiqProEntitlement(customerInfo);
  if (!customerInfo || !entitlement) {
    return activeSubscriptionToTransaction(customerInfo, transaction);
  }

  const subscription = customerInfo.subscriptionsByProductIdentifier[entitlement.productIdentifier];
  const transactionId = transactionIdFor(entitlement, subscription, transaction);

  return {
    transactionId,
    originalTransactionId: subscription?.storeTransactionId ?? transactionId,
    productId: entitlement.productIdentifier,
    purchaseDate: entitlement.latestPurchaseDate ?? subscription?.purchaseDate ?? customerInfo.requestDate,
    expirationDate: entitlement.expirationDate ?? subscription?.expiresDate ?? undefined,
    revenueCatOriginalAppUserId: customerInfo.originalAppUserId,
    isSandbox: entitlement.isSandbox ?? subscription?.isSandbox,
  };
}

function activeSubscriptionToTransaction(
  customerInfo: CustomerInfo | null,
  transaction?: PurchasesStoreTransaction | null,
): StoreKitTransaction | null {
  const activeSubscription = activeCosmiqProSubscription(customerInfo);
  if (!customerInfo || !activeSubscription) return null;

  const { productId, subscription } = activeSubscription;
  const transactionId = transaction?.transactionIdentifier || subscription.storeTransactionId;
  if (!transactionId || !productId) return null;

  return {
    transactionId,
    originalTransactionId: subscription.storeTransactionId ?? transactionId,
    productId,
    purchaseDate: subscription.purchaseDate ?? customerInfo.requestDate,
    expirationDate: subscription.expiresDate ?? undefined,
    revenueCatOriginalAppUserId: customerInfo.originalAppUserId,
    isSandbox: subscription.isSandbox,
  };
}

function purchaseResultToTransaction(
  productIdentifier: string,
  customerInfo: CustomerInfo | null,
  transaction?: PurchasesStoreTransaction | null,
): StoreKitTransaction | null {
  const entitlementTransaction = customerInfoToTransaction(customerInfo, transaction);
  if (entitlementTransaction) return entitlementTransaction;

  if (!transaction) return null;

  const purchaseTransaction = transaction as RevenueCatPurchaseTransaction;
  const transactionId = purchaseTransaction.transactionIdentifier || purchaseTransaction.revenueCatId;
  const productId = purchaseTransaction.productIdentifier || purchaseTransaction.productId || productIdentifier;
  if (!transactionId || !productId) return null;

  return {
    transactionId,
    originalTransactionId: transactionId,
    productId,
    purchaseDate: purchaseTransaction.purchaseDate ?? customerInfo?.requestDate ?? new Date().toISOString(),
    revenueCatOriginalAppUserId: customerInfo?.originalAppUserId,
  };
}

function paywallSucceeded(result: string): boolean {
  return result === "PURCHASED" || result === "RESTORED";
}

function revenueCatErrorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage;
  }
  return "RevenueCat request failed";
}

export const StoreKitProvider = ({ children }: { children: ReactNode }) => {
  const { user, status } = useAuth();
  const isAvailable = Capacitor.isNativePlatform() && isNativeIOS();
  const [products, setProducts] = useState<StoreKitProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [currentEntitlement, setCurrentEntitlement] = useState<StoreKitTransaction | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [entitlementLoading, setEntitlementLoading] = useState(isAvailable);
  const [entitlementError, setEntitlementError] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const configuredAppUserIdRef = useRef<string | null>(null);
  const purchaseRecoveryPromiseRef = useRef<Promise<StoreKitTransaction | null> | null>(null);
  const packagesRef = useRef<PurchasesPackage[]>([]);
  const storeProductsRef = useRef<Map<string, PurchasesStoreProduct>>(new Map());

  const applyCustomerInfo = useCallback((
    nextCustomerInfo: CustomerInfo | null,
    transaction?: PurchasesStoreTransaction | null,
  ) => {
    setCustomerInfo(nextCustomerInfo);
    setCurrentEntitlement(customerInfoToTransaction(nextCustomerInfo, transaction));
  }, []);

  const fetchCustomerInfo = useCallback(async () => {
    const { Purchases } = await loadRevenueCat();
    const { customerInfo: nextCustomerInfo } = await withTimeout(
      () => Purchases.getCustomerInfo(),
      {
        timeoutMs: CUSTOMER_INFO_TIMEOUT_MS,
        operation: "RevenueCat customer info refresh",
        timeoutCode: "REVENUECAT_TIMEOUT",
      },
    );
    applyCustomerInfo(nextCustomerInfo);
    return nextCustomerInfo;
  }, [applyCustomerInfo]);

  const refreshProducts = useCallback(async () => {
    if (!isAvailable || !isConfigured) return [];

    setProductsLoading(true);
    try {
      const { PRODUCT_CATEGORY, Purchases } = await loadRevenueCat();
      const [offeringsResult, productsResult] = await withTimeout(
        () => Promise.allSettled([
          Purchases.getOfferings(),
          Purchases.getProducts({
            productIdentifiers: [...REVENUECAT_PRODUCT_IDS],
            type: PRODUCT_CATEGORY.SUBSCRIPTION,
          }),
        ]),
        {
          timeoutMs: REVENUECAT_PRODUCTS_TIMEOUT_MS,
          operation: "RevenueCat offerings and products fetch",
          timeoutCode: "REVENUECAT_TIMEOUT",
        },
      );

      const nextOfferings = offeringsResult.status === "fulfilled" ? offeringsResult.value : null;
      if (offeringsResult.status === "rejected") {
        console.warn("[RevenueCat] Failed to load offerings; direct product lookup will still be used", {
          productIds: REVENUECAT_PRODUCT_IDS,
          platform: Capacitor.getPlatform(),
          error: offeringsResult.reason,
        });
      }

      if (productsResult.status === "rejected") {
        console.error("[RevenueCat] Failed to load products", {
          productIds: REVENUECAT_PRODUCT_IDS,
          platform: Capacitor.getPlatform(),
          error: productsResult.reason,
        });
      }

      setOfferings(nextOfferings);
      const offeringPackages = packagesFromOfferings(nextOfferings);
      packagesRef.current = offeringPackages;

      const packageProducts = offeringPackages.map((pkg) => pkg.product);
      const directProducts = productsResult.status === "fulfilled" ? productsResult.value.products : [];
      const allProducts = [...packageProducts, ...directProducts];
      storeProductsRef.current = new Map(allProducts.map((product) => [product.identifier, product]));

      const mappedProducts = mergeProducts(allProducts);
      setProducts(mappedProducts);

      if (!mappedProducts.length) {
        console.warn("[RevenueCat] Product fetch returned no products", {
          productIds: REVENUECAT_PRODUCT_IDS,
          platform: Capacitor.getPlatform(),
        });
      }

      return mappedProducts;
    } catch (error) {
      console.error("[RevenueCat] Failed to load offerings/products", {
        productIds: REVENUECAT_PRODUCT_IDS,
        platform: Capacitor.getPlatform(),
        error,
      });
      return [];
    } finally {
      setProductsLoading(false);
    }
  }, [isAvailable, isConfigured]);

  const refreshEntitlement = useCallback(async () => {
    if (!isAvailable || !isConfigured) return;

    setEntitlementLoading(true);
    try {
      await fetchCustomerInfo();
      setEntitlementError(false);
    } catch (error) {
      setEntitlementError(true);
      console.error("[RevenueCat] Failed to get customer info:", error);
    } finally {
      setEntitlementLoading(false);
    }
  }, [fetchCustomerInfo, isAvailable, isConfigured]);

  useEffect(() => {
    if (!isAvailable) {
      setEntitlementLoading(false);
      return;
    }

    if (status !== "authenticated" || !user?.id) {
      applyCustomerInfo(null);
      setEntitlementLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setEntitlementLoading(true);
      try {
        const { LOG_LEVEL, Purchases, STOREKIT_VERSION } = await loadRevenueCat();

        if (!configuredAppUserIdRef.current) {
          await Purchases.setLogLevel({
            level: REVENUECAT_DEBUG ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR,
          });
          await withTimeout(
            () => Purchases.configure({
              apiKey: REVENUECAT_IOS_API_KEY,
              appUserID: user.id,
              storeKitVersion: STOREKIT_VERSION.STOREKIT_2,
            }),
            {
              timeoutMs: REVENUECAT_CONFIGURE_TIMEOUT_MS,
              operation: "RevenueCat configure",
              timeoutCode: "REVENUECAT_TIMEOUT",
            },
          );
          configuredAppUserIdRef.current = user.id;
          if (!cancelled) setIsConfigured(true);
          const nextCustomerInfo = await fetchCustomerInfo();
          if (!cancelled) {
            applyCustomerInfo(nextCustomerInfo);
          }
        } else if (configuredAppUserIdRef.current !== user.id) {
          const result = await Purchases.logIn({ appUserID: user.id });
          configuredAppUserIdRef.current = user.id;
          if (!cancelled) {
            setIsConfigured(true);
            applyCustomerInfo(result.customerInfo);
          }
        } else {
          if (!cancelled) setIsConfigured(true);
          const nextCustomerInfo = await fetchCustomerInfo();
          if (!cancelled) applyCustomerInfo(nextCustomerInfo);
        }

        if (!cancelled) {
          setEntitlementError(false);
        }
      } catch (error) {
        if (!cancelled) {
          setEntitlementError(true);
          console.error("[RevenueCat] Configuration failed:", revenueCatErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setEntitlementLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyCustomerInfo, fetchCustomerInfo, isAvailable, status, user?.id]);

  useEffect(() => {
    if (!isAvailable || !isConfigured) return;
    void refreshProducts();
  }, [isAvailable, isConfigured, refreshProducts]);

  useEffect(() => {
    if (!isAvailable || !isConfigured) return;

    let listenerId: string | null = null;
    let cancelled = false;

    void (async () => {
      const { Purchases } = await loadRevenueCat();
      return Purchases.addCustomerInfoUpdateListener((nextCustomerInfo) => {
        applyCustomerInfo(nextCustomerInfo);
        setEntitlementError(false);
      }).then((id) => {
        if (cancelled) {
          void Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: id });
        } else {
          listenerId = id;
        }
      });
    })().catch((error) => {
      console.error("[RevenueCat] Failed to register customer info listener:", error);
    });

    return () => {
      cancelled = true;
      if (listenerId) {
        const idToRemove = listenerId;
        void loadRevenueCat().then(({ Purchases }) =>
          Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: idToRemove }),
        );
      }
    };
  }, [applyCustomerInfo, isAvailable, isConfigured]);

  useEffect(() => {
    if (!isAvailable || !isConfigured) return;

    let handle: { remove: () => Promise<void> } | null = null;

    void (async () => {
      handle = await CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) return;
        void refreshEntitlement();
        void refreshProducts();
      });
    })();

    return () => {
      void handle?.remove();
    };
  }, [isAvailable, isConfigured, refreshEntitlement, refreshProducts]);

  const purchase = useCallback(async (productId: string): Promise<StoreKitTransaction | null> => {
    if (!isAvailable || !isConfigured) return null;

    const { PRODUCT_CATEGORY, Purchases } = await loadRevenueCat();
    const packageToPurchase = packagesRef.current.find((pkg) => pkg.product.identifier === productId);
    let result;
    if (packageToPurchase) {
      result = await Purchases.purchasePackage({ aPackage: packageToPurchase });
    } else {
      const directProduct = storeProductsRef.current.get(productId) ?? (
        await Purchases.getProducts({
          productIdentifiers: [productId],
          type: PRODUCT_CATEGORY.SUBSCRIPTION,
        })
      ).products[0];

      if (!directProduct) {
        throw new Error(`RevenueCat product not found: ${productId}`);
      }

      result = await Purchases.purchaseStoreProduct({ product: directProduct });
    }

    applyCustomerInfo(result.customerInfo, result.transaction);
    setEntitlementError(false);
    return purchaseResultToTransaction(result.productIdentifier, result.customerInfo, result.transaction);
  }, [applyCustomerInfo, isAvailable, isConfigured]);

  const redeemOfferCode = useCallback(async () => {
    if (!isAvailable || !isConfigured) {
      throw new Error("Offer code redemption is only available after RevenueCat is configured on iOS.");
    }

    const { Purchases } = await loadRevenueCat();
    await Purchases.presentCodeRedemptionSheet();
    await refreshProducts();

    let entitlement: StoreKitTransaction | null = null;
    for (const delay of OFFER_CODE_ENTITLEMENT_POLL_DELAYS_MS) {
      if (delay > 0) await wait(delay);

      const nextCustomerInfo = await fetchCustomerInfo();
      entitlement = customerInfoToTransaction(nextCustomerInfo);
      applyCustomerInfo(nextCustomerInfo);
      if (entitlement) break;
    }

    return {
      status: "presented" as const,
      entitlement,
    };
  }, [applyCustomerInfo, fetchCustomerInfo, isAvailable, isConfigured, refreshProducts]);

  const restorePurchasesHandler = useCallback(async (): Promise<StoreKitTransaction | null> => {
    if (!isAvailable || !isConfigured) return null;

    const { Purchases } = await loadRevenueCat();
    const { customerInfo: restoredCustomerInfo } = await Purchases.restorePurchases();
    applyCustomerInfo(restoredCustomerInfo);
    setEntitlementError(false);
    return customerInfoToTransaction(restoredCustomerInfo);
  }, [applyCustomerInfo, isAvailable, isConfigured]);

  const recoverPurchasesHandler = useCallback(async (): Promise<StoreKitTransaction | null> => {
    if (!isAvailable || !isConfigured) return null;
    if (purchaseRecoveryPromiseRef.current) {
      return purchaseRecoveryPromiseRef.current;
    }

    const recoveryPromise = (async (): Promise<StoreKitTransaction | null> => {
      setEntitlementLoading(true);
      try {
        const { Purchases } = await loadRevenueCat();

        try {
          await withTimeout(
            () => Purchases.syncPurchases(),
            {
              timeoutMs: REVENUECAT_PURCHASE_RECOVERY_TIMEOUT_MS,
              operation: "RevenueCat purchase sync",
              timeoutCode: "REVENUECAT_TIMEOUT",
            },
          );
          const syncedCustomerInfo = await fetchCustomerInfo();
          const syncedTransaction = customerInfoToTransaction(syncedCustomerInfo);
          if (syncedTransaction) {
            setEntitlementError(false);
            return syncedTransaction;
          }
        } catch (syncError) {
          console.warn("[RevenueCat] Existing purchase sync failed; trying restore purchases", syncError);
        }

        const { customerInfo: restoredCustomerInfo } = await withTimeout(
          () => Purchases.restorePurchases(),
          {
            timeoutMs: REVENUECAT_PURCHASE_RECOVERY_TIMEOUT_MS,
            operation: "RevenueCat purchase restore",
            timeoutCode: "REVENUECAT_TIMEOUT",
          },
        );
        applyCustomerInfo(restoredCustomerInfo);
        setEntitlementError(false);
        return customerInfoToTransaction(restoredCustomerInfo);
      } catch (error) {
        console.warn("[RevenueCat] Existing purchase recovery failed", error);
        return null;
      } finally {
        setEntitlementLoading(false);
      }
    })();

    purchaseRecoveryPromiseRef.current = recoveryPromise;
    try {
      return await recoveryPromise;
    } finally {
      if (purchaseRecoveryPromiseRef.current === recoveryPromise) {
        purchaseRecoveryPromiseRef.current = null;
      }
    }
  }, [applyCustomerInfo, fetchCustomerInfo, isAvailable, isConfigured]);

  const presentRevenueCatPaywall = useCallback(async (onlyIfNeeded: boolean): Promise<boolean> => {
    if (!isAvailable || !isConfigured) return false;

    const { RevenueCatUI } = await loadRevenueCatUI();
    const paywallResult = onlyIfNeeded
      ? await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: REVENUECAT_PAYWALL_ENTITLEMENT_ID,
      })
      : await RevenueCatUI.presentPaywall();

    if (paywallSucceeded(paywallResult.result)) {
      await refreshEntitlement();
      return true;
    }

    if (paywallResult.result === "NOT_PRESENTED") {
      await refreshEntitlement();
    }

    return false;
  }, [isAvailable, isConfigured, refreshEntitlement]);

  const manageSubscriptionsHandler = useCallback(async () => {
    if (!isAvailable || !isConfigured) return;
    const { RevenueCatUI } = await loadRevenueCatUI();
    await RevenueCatUI.presentCustomerCenter();
    await refreshEntitlement();
  }, [isAvailable, isConfigured, refreshEntitlement]);

  const activeEntitlement = activeCosmiqProEntitlement(customerInfo);
  const activePlan = resolvePlanFromProductId(currentEntitlement?.productId);
  const isPro = Boolean(activeEntitlement?.isActive || currentEntitlement);
  const expirationDate = currentEntitlement?.expirationDate
    ? new Date(currentEntitlement.expirationDate)
    : null;

  const value = useMemo<StoreKitContextValue>(() => ({
    isAvailable,
    isLoading: entitlementLoading,
    products,
    productsLoading,
    currentEntitlement,
    customerInfo,
    offerings,
    entitlementError,
    isPro,
    activePlan,
    expirationDate,
    purchase,
    redeemOfferCode,
    restorePurchases: restorePurchasesHandler,
    manageSubscriptions: manageSubscriptionsHandler,
    presentPaywall: () => presentRevenueCatPaywall(false),
    presentPaywallIfNeeded: () => presentRevenueCatPaywall(true),
    presentCustomerCenter: manageSubscriptionsHandler,
    recoverPurchases: recoverPurchasesHandler,
    refreshEntitlement,
    refreshProducts,
  }), [
    activePlan,
    currentEntitlement,
    customerInfo,
    entitlementError,
    entitlementLoading,
    expirationDate,
    isAvailable,
    isPro,
    manageSubscriptionsHandler,
    offerings,
    presentRevenueCatPaywall,
    products,
    productsLoading,
    purchase,
    redeemOfferCode,
    recoverPurchasesHandler,
    refreshEntitlement,
    refreshProducts,
    restorePurchasesHandler,
  ]);

  return <StoreKitContext.Provider value={value}>{children}</StoreKitContext.Provider>;
};

export const useStoreKitContext = (): StoreKitContextValue => {
  const context = useContext(StoreKitContext);
  if (!context) {
    throw new Error("useStoreKit must be used within a StoreKitProvider");
  }
  return context;
};
