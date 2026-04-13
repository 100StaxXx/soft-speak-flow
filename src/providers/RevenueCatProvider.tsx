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
import { App as CapacitorApp } from "@capacitor/app";
import {
  Purchases,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesOfferings,
  type PurchasesPackage,
} from "@revenuecat/purchases-capacitor";
import { PAYWALL_RESULT, type PaywallResult } from "@revenuecat/purchases-capacitor-ui";
import { useAuth } from "@/hooks/useAuth";
import {
  COSMIQ_PRO_ENTITLEMENT,
  getCosmiqProEntitlement,
  getCustomerInfo,
  getOfferings,
  getPackageForPlan,
  initializeRevenueCat,
  isCosmiqProActive,
  isRevenueCatAvailable,
  isRevenueCatCancellationError,
  logInRevenueCat,
  logOutRevenueCat,
  presentCustomerCenter,
  presentPaywall,
  presentPaywallIfNeeded,
  purchasePackage as purchaseRevenueCatPackage,
  resolveActivePlan,
  restorePurchases as restoreRevenueCatPurchases,
  type RevenueCatPackageTarget,
  type RevenueCatPlan,
} from "@/services/revenueCat";

type RevenueCatContextValue = {
  isAvailable: boolean;
  isConfigured: boolean;
  isLoading: boolean;
  offeringsLoading: boolean;
  customerInfoLoading: boolean;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOfferings | null;
  isPro: boolean;
  activePlan: RevenueCatPlan | null;
  activeEntitlement: ReturnType<typeof getCosmiqProEntitlement>;
  expirationDate: Date | null;
  refreshCustomerInfo: () => Promise<CustomerInfo | null>;
  refreshOfferings: () => Promise<PurchasesOfferings | null>;
  purchasePackage: (aPackage: PurchasesPackage) => Promise<CustomerInfo | null>;
  purchasePlan: (plan: RevenueCatPackageTarget) => Promise<CustomerInfo | null>;
  restorePurchases: () => Promise<CustomerInfo | null>;
  presentPaywall: (offering?: PurchasesOffering) => Promise<PaywallResult | null>;
  presentPaywallIfNeeded: (offering?: PurchasesOffering) => Promise<PaywallResult | null>;
  presentCustomerCenter: () => Promise<boolean>;
};

const RevenueCatContext = createContext<RevenueCatContextValue | undefined>(undefined);

const didPaywallUnlock = (result: PaywallResult | null): boolean => {
  return result?.result === PAYWALL_RESULT.PURCHASED || result?.result === PAYWALL_RESULT.RESTORED;
};

export const RevenueCatProvider = ({ children }: { children: ReactNode }) => {
  const { user, status } = useAuth();
  const [isConfigured, setIsConfigured] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [customerInfoLoading, setCustomerInfoLoading] = useState(false);
  const [offeringsLoading, setOfferingsLoading] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const listenerIdRef = useRef<string | null>(null);

  const isAvailable = isRevenueCatAvailable();

  const refreshCustomerInfo = useCallback(async (): Promise<CustomerInfo | null> => {
    if (!isAvailable) return null;

    setCustomerInfoLoading(true);
    try {
      const info = await getCustomerInfo();
      setCustomerInfo(info);
      return info;
    } finally {
      setCustomerInfoLoading(false);
    }
  }, [isAvailable]);

  const refreshOfferings = useCallback(async (): Promise<PurchasesOfferings | null> => {
    if (!isAvailable) return null;

    setOfferingsLoading(true);
    try {
      const nextOfferings = await getOfferings();
      setOfferings(nextOfferings);
      return nextOfferings;
    } finally {
      setOfferingsLoading(false);
    }
  }, [isAvailable]);

  useEffect(() => {
    if (!isAvailable) return;

    let cancelled = false;

    void (async () => {
      await initializeRevenueCat();
      if (cancelled) return;
      setIsConfigured(true);

      if (!listenerIdRef.current) {
        listenerIdRef.current = await Purchases.addCustomerInfoUpdateListener((updatedCustomerInfo) => {
          setCustomerInfo(updatedCustomerInfo);
        });
      }

      await Promise.all([refreshCustomerInfo(), refreshOfferings()]);
    })().catch((error) => {
      console.error("[RevenueCat] Initialization failed", error);
    });

    return () => {
      cancelled = true;
    };
  }, [isAvailable, refreshCustomerInfo, refreshOfferings]);

  useEffect(() => {
    if (!isAvailable || !isConfigured) return;

    const nextUserId = status === "authenticated" ? user?.id ?? null : null;
    if (userIdRef.current === nextUserId) return;

    let cancelled = false;

    void (async () => {
      try {
        if (nextUserId) {
          const result = await logInRevenueCat(nextUserId);
          if (!cancelled) {
            setCustomerInfo(result.customerInfo);
          }
        } else if (userIdRef.current) {
          const result = await logOutRevenueCat();
          if (!cancelled) {
            setCustomerInfo(result.customerInfo);
          }
        } else {
          await refreshCustomerInfo();
        }
        await refreshOfferings();
      } catch (error) {
        console.error("[RevenueCat] Auth sync failed", error);
      } finally {
        if (!cancelled) {
          userIdRef.current = nextUserId;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAvailable, isConfigured, refreshCustomerInfo, refreshOfferings, status, user?.id]);

  useEffect(() => {
    if (!isAvailable || !isConfigured) return;

    let handle: { remove: () => Promise<void> } | null = null;

    void (async () => {
      handle = await CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) return;
        void refreshCustomerInfo();
        void refreshOfferings();
      });
    })();

    return () => {
      void handle?.remove();
    };
  }, [isAvailable, isConfigured, refreshCustomerInfo, refreshOfferings]);

  useEffect(() => {
    return () => {
      if (!listenerIdRef.current) return;
      void Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: listenerIdRef.current });
      listenerIdRef.current = null;
    };
  }, []);

  const purchasePackage = useCallback(async (aPackage: PurchasesPackage): Promise<CustomerInfo | null> => {
    if (!isAvailable) return null;

    try {
      const result = await purchaseRevenueCatPackage(aPackage);
      setCustomerInfo(result.customerInfo);
      return result.customerInfo;
    } catch (error) {
      if (isRevenueCatCancellationError(error)) {
        return null;
      }
      throw error;
    }
  }, [isAvailable]);

  const purchasePlan = useCallback(async (plan: RevenueCatPackageTarget): Promise<CustomerInfo | null> => {
    const aPackage = getPackageForPlan(plan, offerings);
    if (!aPackage) {
      throw new Error(`The ${plan} package is not configured in the current RevenueCat offering.`);
    }
    return purchasePackage(aPackage);
  }, [offerings, purchasePackage]);

  const restorePurchases = useCallback(async (): Promise<CustomerInfo | null> => {
    if (!isAvailable) return null;
    const info = await restoreRevenueCatPurchases();
    setCustomerInfo(info);
    return info;
  }, [isAvailable]);

  const handlePresentPaywall = useCallback(async (offering?: PurchasesOffering): Promise<PaywallResult | null> => {
    if (!isAvailable) return null;
    const result = await presentPaywall(offering);
    if (didPaywallUnlock(result)) {
      await refreshCustomerInfo();
    }
    return result;
  }, [isAvailable, refreshCustomerInfo]);

  const handlePresentPaywallIfNeeded = useCallback(async (offering?: PurchasesOffering): Promise<PaywallResult | null> => {
    if (!isAvailable) return null;
    const result = await presentPaywallIfNeeded(offering);
    if (didPaywallUnlock(result)) {
      await refreshCustomerInfo();
    }
    return result;
  }, [isAvailable, refreshCustomerInfo]);

  const handlePresentCustomerCenter = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false;
    await presentCustomerCenter();
    await refreshCustomerInfo();
    return true;
  }, [isAvailable, refreshCustomerInfo]);

  const activeEntitlement = getCosmiqProEntitlement(customerInfo);
  const activePlan = resolveActivePlan(customerInfo);
  const expirationDate = activeEntitlement?.expirationDate ? new Date(activeEntitlement.expirationDate) : null;
  const isPro = isCosmiqProActive(customerInfo);

  const value = useMemo<RevenueCatContextValue>(() => ({
    isAvailable,
    isConfigured,
    isLoading: !isConfigured || customerInfoLoading || offeringsLoading,
    offeringsLoading,
    customerInfoLoading,
    customerInfo,
    offerings,
    isPro,
    activePlan,
    activeEntitlement,
    expirationDate,
    refreshCustomerInfo,
    refreshOfferings,
    purchasePackage,
    purchasePlan,
    restorePurchases,
    presentPaywall: handlePresentPaywall,
    presentPaywallIfNeeded: handlePresentPaywallIfNeeded,
    presentCustomerCenter: handlePresentCustomerCenter,
  }), [
    activeEntitlement,
    activePlan,
    customerInfo,
    customerInfoLoading,
    expirationDate,
    handlePresentCustomerCenter,
    handlePresentPaywall,
    handlePresentPaywallIfNeeded,
    isAvailable,
    isConfigured,
    isPro,
    offerings,
    offeringsLoading,
    purchasePackage,
    purchasePlan,
    refreshCustomerInfo,
    refreshOfferings,
    restorePurchases,
  ]);

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
};

export const useRevenueCatContext = (): RevenueCatContextValue => {
  const context = useContext(RevenueCatContext);
  if (!context) {
    throw new Error("useRevenueCat must be used within a RevenueCatProvider");
  }
  return context;
};
