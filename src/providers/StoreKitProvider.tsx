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
import { isNativeIOS } from "@/utils/platformTargets";
import { StoreKit, type StoreKitProduct, type StoreKitTransaction } from "@/plugins/StoreKitPlugin";
import { useAuth } from "@/hooks/useAuth";

const PRODUCT_IDS = ["cosmiq_premium_monthly", "cosmiq_premium_yearly"];
const OFFER_CODE_REDEMPTION_URL = import.meta.env.VITE_APPLE_OFFER_CODE_REDEMPTION_URL;

export type StoreKitPlan = "monthly" | "yearly";

type StoreKitContextValue = {
  isAvailable: boolean;
  isLoading: boolean;
  products: StoreKitProduct[];
  productsLoading: boolean;
  currentEntitlement: StoreKitTransaction | null;
  isPro: boolean;
  activePlan: StoreKitPlan | null;
  expirationDate: Date | null;
  purchase: (productId: string) => Promise<StoreKitTransaction | null>;
  purchaseWithPromoOffer: (productId: string) => Promise<StoreKitTransaction | null>;
  redeemOfferCode: () => Promise<{ status: "presented" | "opened_url"; entitlement: StoreKitTransaction | null }>;
  restorePurchases: () => Promise<StoreKitTransaction | null>;
  manageSubscriptions: () => Promise<void>;
  refreshEntitlement: () => Promise<void>;
  refreshProducts: () => Promise<StoreKitProduct[]>;
};

const StoreKitContext = createContext<StoreKitContextValue | undefined>(undefined);

function resolvePlan(productId: string | undefined): StoreKitPlan | null {
  if (!productId) return null;
  const id = productId.toLowerCase();
  if (id.includes("yearly") || id.includes("annual") || id.includes("year")) return "yearly";
  if (id.includes("monthly") || id.includes("month")) return "monthly";
  return null;
}

function normalizeAccountToken(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

function entitlementBelongsToUser(
  entitlement: StoreKitTransaction | null,
  userId: string | null | undefined,
): boolean {
  const appAccountToken = normalizeAccountToken(entitlement?.appAccountToken);
  const normalizedUserId = normalizeAccountToken(userId);
  return Boolean(appAccountToken && normalizedUserId && appAccountToken === normalizedUserId);
}

function entitlementIsCurrent(entitlement: StoreKitTransaction | null): boolean {
  if (!entitlement || entitlement.cancelled || entitlement.pending || entitlement.revocationDate) {
    return false;
  }

  if (!entitlement.expirationDate) return false;
  const expirationDate = new Date(entitlement.expirationDate);
  return !Number.isNaN(expirationDate.getTime()) && expirationDate > new Date();
}

export const StoreKitProvider = ({ children }: { children: ReactNode }) => {
  const { user, status } = useAuth();
  const [products, setProducts] = useState<StoreKitProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [currentEntitlement, setCurrentEntitlement] = useState<StoreKitTransaction | null>(null);
  const [entitlementLoading, setEntitlementLoading] = useState(false);
  const listenerStartedRef = useRef(false);

  const isAvailable = Capacitor.isNativePlatform() && isNativeIOS();

  const refreshProducts = useCallback(async () => {
    if (!isAvailable) return [];
    setProductsLoading(true);
    try {
      const { products: loaded } = await StoreKit.getProducts({ productIds: PRODUCT_IDS });
      console.info("[StoreKit] Loaded products", {
        productIds: PRODUCT_IDS,
        loadedCount: loaded.length,
        platform: Capacitor.getPlatform(),
      });
      if (!loaded.length) {
        console.warn("[StoreKit] Product fetch returned no products", {
          productIds: PRODUCT_IDS,
          platform: Capacitor.getPlatform(),
        });
      }
      setProducts(loaded);
      return loaded;
    } catch (error) {
      console.error("[StoreKit] Failed to load products", {
        productIds: PRODUCT_IDS,
        platform: Capacitor.getPlatform(),
        error,
      });
      return [];
    } finally {
      setProductsLoading(false);
    }
  }, [isAvailable]);

  const refreshEntitlement = useCallback(async () => {
    if (!isAvailable) return;
    setEntitlementLoading(true);
    try {
      const { entitlement } = await StoreKit.getCurrentEntitlement();
      setCurrentEntitlement(entitlement);
    } catch (error) {
      console.error("[StoreKit] Failed to get entitlement:", error);
    } finally {
      setEntitlementLoading(false);
    }
  }, [isAvailable]);

  // Initialize on mount
  useEffect(() => {
    if (!isAvailable) return;
    void refreshProducts();
    void refreshEntitlement();
  }, [isAvailable, refreshProducts, refreshEntitlement]);

  // Start transaction listener
  useEffect(() => {
    if (!isAvailable || listenerStartedRef.current) return;
    listenerStartedRef.current = true;

    void StoreKit.startTransactionListener();
    void StoreKit.addListener("transactionUpdate", (transaction) => {
      if (!transaction.cancelled && !transaction.pending) {
        setCurrentEntitlement(transaction);
      }
    });
  }, [isAvailable]);

  // Refresh on app resume
  useEffect(() => {
    if (!isAvailable) return;

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
  }, [isAvailable, refreshEntitlement, refreshProducts]);

  // Refresh entitlement when auth changes
  useEffect(() => {
    if (!isAvailable) return;
    if (status === "authenticated" && user?.id) {
      void refreshEntitlement();
    } else {
      setCurrentEntitlement(null);
    }
  }, [isAvailable, refreshEntitlement, status, user?.id]);

  const purchase = useCallback(async (productId: string): Promise<StoreKitTransaction | null> => {
    if (!isAvailable) return null;
    const result = await StoreKit.purchase({
      productId,
      appAccountToken: user?.id,
    });
    if (result.cancelled || result.pending) return null;
    setCurrentEntitlement(result);
    return result;
  }, [isAvailable, user?.id]);

  const purchaseWithPromoOffer = useCallback(async (productId: string): Promise<StoreKitTransaction | null> => {
    if (!isAvailable) {
      throw new Error("Promotional offers are no longer used for the affiliate yearly discount flow.");
    }

    throw new Error("Promotional offers are no longer used for the affiliate yearly discount flow.");
  }, [isAvailable]);

  const redeemOfferCode = useCallback(async () => {
    if (!isAvailable) {
      throw new Error("Offer code redemption is only available on iOS devices");
    }

    const result = await StoreKit.presentOfferCodeRedeemSheet({
      redemptionURL: OFFER_CODE_REDEMPTION_URL,
    });

    await refreshProducts();
    const { entitlement } = await StoreKit.getCurrentEntitlement();
    setCurrentEntitlement(entitlement);

    return {
      status: result.status,
      entitlement,
    };
  }, [isAvailable, refreshProducts]);

  const restorePurchasesHandler = useCallback(async (): Promise<StoreKitTransaction | null> => {
    if (!isAvailable) return null;
    const { entitlement } = await StoreKit.restorePurchases();
    setCurrentEntitlement(entitlement);
    return entitlement;
  }, [isAvailable]);

  const manageSubscriptionsHandler = useCallback(async () => {
    if (!isAvailable) return;
    await StoreKit.manageSubscriptions();
    await refreshEntitlement();
  }, [isAvailable, refreshEntitlement]);

  const isPro = entitlementIsCurrent(currentEntitlement) &&
    entitlementBelongsToUser(currentEntitlement, user?.id);
  const activePlan = isPro ? resolvePlan(currentEntitlement?.productId) : null;
  const expirationDate = isPro && currentEntitlement?.expirationDate
    ? new Date(currentEntitlement.expirationDate)
    : null;

  const value = useMemo<StoreKitContextValue>(() => ({
    isAvailable,
    isLoading: productsLoading || entitlementLoading,
    products,
    productsLoading,
    currentEntitlement,
    isPro,
    activePlan,
    expirationDate,
    purchase,
    purchaseWithPromoOffer,
    redeemOfferCode,
    restorePurchases: restorePurchasesHandler,
    manageSubscriptions: manageSubscriptionsHandler,
    refreshEntitlement,
    refreshProducts,
  }), [
    activePlan,
    currentEntitlement,
    entitlementLoading,
    expirationDate,
    isAvailable,
    isPro,
    manageSubscriptionsHandler,
    products,
    productsLoading,
    purchase,
    purchaseWithPromoOffer,
    redeemOfferCode,
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
