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
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { useAuth } from "@/hooks/useAuth";
import { AppleStoreKit } from "@/plugins/AppleStoreKitPlugin";
import { isNativeIOS } from "@/utils/platformTargets";
import {
  APPLE_SUBSCRIPTION_PRODUCT_IDS,
  resolvePlanFromProductId,
} from "@/utils/appleIAP";
import { withTimeout } from "@/utils/asyncTimeout";
import type { StoreKitProduct, StoreKitTransaction } from "@/types/subscription";

const STOREKIT_REQUEST_TIMEOUT_MS = 12_000;
const OFFER_CODE_ENTITLEMENT_POLL_DELAYS_MS = [0, 500, 1_000, 1_500] as const;

export type AppleCustomerInfo = {
  activeSubscriptions: string[];
  requestDate: string;
};

type StoreKitPlan = "monthly" | "yearly";

type StoreKitContextValue = {
  isAvailable: boolean;
  isLoading: boolean;
  products: StoreKitProduct[];
  productsLoading: boolean;
  currentEntitlement: StoreKitTransaction | null;
  customerInfo: AppleCustomerInfo | null;
  offerings: null;
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

function isActiveSubscription(transaction: StoreKitTransaction): boolean {
  if (!resolvePlanFromProductId(transaction.productId)) return false;
  if (transaction.cancelled || transaction.pending || transaction.revocationDate) return false;
  if (!transaction.expirationDate) return false;

  const expirationDate = new Date(transaction.expirationDate);
  return !Number.isNaN(expirationDate.getTime()) && expirationDate > new Date();
}

function selectCurrentEntitlement(
  transactions: StoreKitTransaction[],
): StoreKitTransaction | null {
  return [...transactions]
    .filter(isActiveSubscription)
    .sort((left, right) => (
      new Date(right.expirationDate ?? 0).getTime() -
      new Date(left.expirationDate ?? 0).getTime()
    ))[0] ?? null;
}

function customerInfoFor(transaction: StoreKitTransaction | null): AppleCustomerInfo {
  return {
    activeSubscriptions: transaction ? [transaction.productId] : [],
    requestDate: new Date().toISOString(),
  };
}

export const StoreKitProvider = ({ children }: { children: ReactNode }) => {
  const { user, status } = useAuth();
  const isAvailable = Capacitor.isNativePlatform() && isNativeIOS();
  const [products, setProducts] = useState<StoreKitProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [currentEntitlement, setCurrentEntitlement] = useState<StoreKitTransaction | null>(null);
  const [customerInfo, setCustomerInfo] = useState<AppleCustomerInfo | null>(null);
  const [entitlementLoading, setEntitlementLoading] = useState(false);
  const [entitlementError, setEntitlementError] = useState(false);
  const purchaseRecoveryPromiseRef = useRef<Promise<StoreKitTransaction | null> | null>(null);

  const applyTransactions = useCallback((transactions: StoreKitTransaction[]) => {
    const entitlement = selectCurrentEntitlement(transactions);
    setCurrentEntitlement(entitlement);
    setCustomerInfo(customerInfoFor(entitlement));
    return entitlement;
  }, []);

  const refreshProducts = useCallback(async (): Promise<StoreKitProduct[]> => {
    if (!isAvailable || status !== "authenticated" || !user?.id) return [];

    setProductsLoading(true);
    try {
      const result = await withTimeout(
        () => AppleStoreKit.loadProducts({ productIds: [...APPLE_SUBSCRIPTION_PRODUCT_IDS] }),
        {
          timeoutMs: STOREKIT_REQUEST_TIMEOUT_MS,
          operation: "Apple StoreKit product lookup",
          timeoutCode: "STOREKIT_TIMEOUT",
        },
      );
      setProducts(result.products);
      return result.products;
    } catch (error) {
      console.error("[StoreKit] Failed to load Apple subscription products", error);
      setProducts([]);
      return [];
    } finally {
      setProductsLoading(false);
    }
  }, [isAvailable, status, user?.id]);

  const readCurrentEntitlement = useCallback(async () => {
    const result = await withTimeout(
      () => AppleStoreKit.currentEntitlements(),
      {
        timeoutMs: STOREKIT_REQUEST_TIMEOUT_MS,
        operation: "Apple StoreKit entitlement refresh",
        timeoutCode: "STOREKIT_TIMEOUT",
      },
    );
    return applyTransactions(result.transactions);
  }, [applyTransactions]);

  const refreshEntitlement = useCallback(async () => {
    if (!isAvailable || status !== "authenticated" || !user?.id) return;

    setEntitlementLoading(true);
    try {
      await readCurrentEntitlement();
      setEntitlementError(false);
    } catch (error) {
      setEntitlementError(true);
      console.error("[StoreKit] Failed to refresh Apple entitlements", error);
    } finally {
      setEntitlementLoading(false);
    }
  }, [isAvailable, readCurrentEntitlement, status, user?.id]);

  useEffect(() => {
    if (!isAvailable || status !== "authenticated" || !user?.id) {
      setProducts([]);
      setCurrentEntitlement(null);
      setCustomerInfo(null);
      setEntitlementError(false);
      return;
    }

    void refreshProducts();
    void refreshEntitlement();
  }, [isAvailable, refreshEntitlement, refreshProducts, status, user?.id]);

  useEffect(() => {
    if (!isAvailable || status !== "authenticated" || !user?.id) return;

    let listener: PluginListenerHandle | null = null;
    let cancelled = false;

    void AppleStoreKit.addListener("transactionUpdated", (transaction) => {
      if (!isActiveSubscription(transaction)) return;
      setCurrentEntitlement(transaction);
      setCustomerInfo(customerInfoFor(transaction));
      setEntitlementError(false);
    }).then((handle) => {
      if (cancelled) {
        void handle.remove();
      } else {
        listener = handle;
      }
    }).catch((error) => {
      console.warn("[StoreKit] Could not register transaction updates", error);
    });

    return () => {
      cancelled = true;
      void listener?.remove();
    };
  }, [isAvailable, status, user?.id]);

  useEffect(() => {
    if (!isAvailable || status !== "authenticated" || !user?.id) return;

    let listener: PluginListenerHandle | null = null;
    let cancelled = false;
    void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) return;
      void refreshEntitlement();
      void refreshProducts();
    }).then((handle) => {
      if (cancelled) {
        void handle.remove();
      } else {
        listener = handle;
      }
    });

    return () => {
      cancelled = true;
      void listener?.remove();
    };
  }, [isAvailable, refreshEntitlement, refreshProducts, status, user?.id]);

  const purchase = useCallback(async (productId: string): Promise<StoreKitTransaction | null> => {
    if (!isAvailable || status !== "authenticated" || !user?.id) return null;

    const result = await withTimeout(
      () => AppleStoreKit.purchase({
        productId,
        appAccountToken: user.id,
      }),
      {
        timeoutMs: 120_000,
        operation: "Apple StoreKit purchase",
        timeoutCode: "STOREKIT_TIMEOUT",
      },
    );

    if (result.status !== "purchased" || !result.transaction) return null;
    setCurrentEntitlement(result.transaction);
    setCustomerInfo(customerInfoFor(result.transaction));
    setEntitlementError(false);
    return result.transaction;
  }, [isAvailable, status, user?.id]);

  const redeemOfferCode = useCallback(async () => {
    if (!isAvailable || status !== "authenticated" || !user?.id) {
      throw new Error("Apple offer-code redemption is only available in the signed-in iOS app.");
    }

    await AppleStoreKit.presentCodeRedemptionSheet();
    let entitlement: StoreKitTransaction | null = null;
    for (const delay of OFFER_CODE_ENTITLEMENT_POLL_DELAYS_MS) {
      if (delay > 0) await wait(delay);
      entitlement = await readCurrentEntitlement();
      if (entitlement) break;
    }

    return { status: "presented" as const, entitlement };
  }, [isAvailable, readCurrentEntitlement, status, user?.id]);

  const restorePurchases = useCallback(async (): Promise<StoreKitTransaction | null> => {
    if (!isAvailable || status !== "authenticated" || !user?.id) return null;

    const result = await withTimeout(
      () => AppleStoreKit.restorePurchases(),
      {
        timeoutMs: 30_000,
        operation: "Apple StoreKit purchase restore",
        timeoutCode: "STOREKIT_TIMEOUT",
      },
    );
    const entitlement = applyTransactions(result.transactions);
    setEntitlementError(false);
    return entitlement;
  }, [applyTransactions, isAvailable, status, user?.id]);

  const recoverPurchases = useCallback(async (): Promise<StoreKitTransaction | null> => {
    if (!isAvailable || status !== "authenticated" || !user?.id) return null;
    if (purchaseRecoveryPromiseRef.current) return purchaseRecoveryPromiseRef.current;

    const recoveryPromise = (async () => {
      setEntitlementLoading(true);
      try {
        const current = await readCurrentEntitlement();
        if (current) return current;
        return await restorePurchases();
      } catch (error) {
        console.warn("[StoreKit] Existing Apple purchase recovery failed", error);
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
  }, [isAvailable, readCurrentEntitlement, restorePurchases, status, user?.id]);

  const manageSubscriptions = useCallback(async () => {
    if (!isAvailable) return;
    await AppleStoreKit.manageSubscriptions();
    await refreshEntitlement();
  }, [isAvailable, refreshEntitlement]);

  const activePlan = resolvePlanFromProductId(currentEntitlement?.productId);
  const isPro = Boolean(currentEntitlement && isActiveSubscription(currentEntitlement));
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
    offerings: null,
    entitlementError,
    isPro,
    activePlan,
    expirationDate,
    purchase,
    redeemOfferCode,
    restorePurchases,
    manageSubscriptions,
    presentPaywall: async () => false,
    presentPaywallIfNeeded: async () => false,
    presentCustomerCenter: manageSubscriptions,
    recoverPurchases,
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
    manageSubscriptions,
    products,
    productsLoading,
    purchase,
    recoverPurchases,
    redeemOfferCode,
    refreshEntitlement,
    refreshProducts,
    restorePurchases,
  ]);

  return <StoreKitContext.Provider value={value}>{children}</StoreKitContext.Provider>;
};

export const useStoreKitContext = (): StoreKitContextValue => {
  const context = useContext(StoreKitContext);
  if (!context) throw new Error("useStoreKit must be used within a StoreKitProvider");
  return context;
};
