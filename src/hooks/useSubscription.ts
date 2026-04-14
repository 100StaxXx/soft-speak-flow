import { useMemo } from "react";
import { useStoreKit } from "./useStoreKit";

export interface Subscription {
  status: "active" | "cancelled" | "past_due" | "trialing" | "incomplete" | "expired";
  plan: "monthly" | "yearly";
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  product_identifier?: string | null;
  billing_provider?: "storekit2";
}

export function useSubscription() {
  const {
    currentEntitlement,
    isPro,
    activePlan,
    expirationDate,
    isLoading,
    refreshEntitlement,
  } = useStoreKit();

  const subscription = useMemo((): Subscription | null => {
    if (!isPro || !activePlan || !currentEntitlement) return null;

    return {
      status: "active",
      plan: activePlan,
      current_period_end: currentEntitlement.expirationDate ?? null,
      product_identifier: currentEntitlement.productId,
      billing_provider: "storekit2",
      trial_ends_at: null,
    };
  }, [activePlan, currentEntitlement, isPro]);

  const isActive = isPro;
  const isCancelled = false; // StoreKit 2 entitlements are only present while active

  const nextBillingDate = useMemo(() => {
    if (subscription?.current_period_end) {
      return new Date(subscription.current_period_end);
    }
    return expirationDate;
  }, [expirationDate, subscription?.current_period_end]);

  const planPrice = useMemo(() => {
    if (subscription?.plan === "yearly") return "$99.99/year";
    if (subscription?.plan === "monthly") return "$9.99/month";
    return null;
  }, [subscription?.plan]);

  return {
    subscription,
    isLoading,
    error: null,
    refetch: refreshEntitlement,
    isActive,
    isCancelled,
    hasPremium: isActive,
    nextBillingDate,
    planPrice,
    plan: subscription?.plan,
    customerInfo: null,
  };
}
