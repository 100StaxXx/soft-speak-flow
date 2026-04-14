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
import { isNativeIOSHandheld } from "@/utils/platformTargets";
import { StoreKit, type StoreKitProduct, type StoreKitTransaction } from "@/plugins/StoreKitPlugin";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const PRODUCT_IDS = ["cosmiq_premium_monthly", "cosmiq_premium_yearly"];

export type StoreKitPlan = "monthly" | "yearly";

interface PromoOfferSignature {
  offerID: string;
  keyID: string;
  nonce: string;
  signature: string;
  timestamp: number;
  appAccountToken: string;
}

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
  restorePurchases: () => Promise<StoreKitTransaction | null>;
  manageSubscriptions: () => Promise<void>;
  refreshEntitlement: () => Promise<void>;
  refreshProducts: () => Promise<void>;
};

const StoreKitContext = createContext<StoreKitContextValue | undefined>(undefined);

function resolvePlan(productId: string | undefined): StoreKitPlan | null {
  if (!productId) return null;
  const id = productId.toLowerCase();
  if (id.includes("yearly") || id.includes("annual") || id.includes("year")) return "yearly";
  if (id.includes("monthly") || id.includes("month")) return "monthly";
  return null;
}

export const StoreKitProvider = ({ children }: { children: ReactNode }) => {
  const { user, status } = useAuth();
  const [products, setProducts] = useState<StoreKitProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [currentEntitlement, setCurrentEntitlement] = useState<StoreKitTransaction | null>(null);
  const [entitlementLoading, setEntitlementLoading] = useState(false);
  const listenerStartedRef = useRef(false);

  const isAvailable = Capacitor.isNativePlatform() && isNativeIOSHandheld();

  const refreshProducts = useCallback(async () => {
    if (!isAvailable) return;
    setProductsLoading(true);
    try {
      const { products: loaded } = await StoreKit.getProducts({ productIds: PRODUCT_IDS });
      setProducts(loaded);
    } catch (error) {
      console.error("[StoreKit] Failed to load products:", error);
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
    if (!isAvailable) return null;

    // Fetch the promotional offer signature from the server
    const { data, error } = await supabase.functions.invoke("generate-promo-offer-signature", {
      body: { product_id: productId, offer_id: "Cosmiq_PromoOffer_yearly" },
    });

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to generate offer signature");
    }

    const sig = data as PromoOfferSignature;
    const result = await StoreKit.purchaseWithPromoOffer({
      productId,
      appAccountToken: user?.id,
      offerID: sig.offerID,
      keyID: sig.keyID,
      nonce: sig.nonce,
      signature: sig.signature,
      timestamp: sig.timestamp,
    });

    if (result.cancelled || result.pending) return null;
    setCurrentEntitlement(result);
    return result;
  }, [isAvailable, user?.id]);

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

  const isPro = Boolean(currentEntitlement && !currentEntitlement.revocationDate);
  const activePlan = resolvePlan(currentEntitlement?.productId);
  const expirationDate = currentEntitlement?.expirationDate
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
