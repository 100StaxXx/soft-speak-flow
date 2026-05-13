import { useCallback, useMemo } from "react";
import type { CustomerInfo } from "@revenuecat/purchases-capacitor";
import { useAccessState } from "./useAccessState";
import { useStoreKit } from "./useStoreKit";

export interface Subscription {
  status: "active" | "cancelled" | "past_due" | "trialing" | "incomplete" | "expired";
  plan?: "monthly" | "yearly" | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  product_identifier?: string | null;
  billing_provider?: "revenuecat" | "storekit2";
}

export function useSubscription() {
  const {
    currentEntitlement,
    isPro,
    activePlan,
    expirationDate,
    isLoading,
    customerInfo,
    refreshEntitlement,
  } = useStoreKit();
  const {
    accessState,
    isLoading: accessLoading,
    error: accessError,
    refetch: refetchAccessState,
  } = useAccessState();

  const subscription = useMemo((): Subscription | null => {
    if (isPro && activePlan && currentEntitlement) {
      return {
        status: "active",
        plan: activePlan,
        current_period_end: currentEntitlement.expirationDate ?? null,
        product_identifier: currentEntitlement.productId,
        billing_provider: "revenuecat",
        trial_ends_at: null,
      };
    }

    if (!accessState.subscribed || accessState.access_source !== "subscription") return null;

    return {
      status: (accessState.status as Subscription["status"] | undefined) ?? "active",
      plan: accessState.plan === "monthly" || accessState.plan === "yearly" ? accessState.plan : null,
      current_period_end: accessState.subscription_end ?? null,
      product_identifier: currentEntitlement?.productId ?? null,
      billing_provider: "revenuecat",
      trial_ends_at: accessState.trial_ends_at,
    };
  }, [accessState, activePlan, currentEntitlement, isPro]);

  const isActive = Boolean(subscription);
  const isCancelled = subscription?.status === "cancelled";

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

  const refetch = useCallback(async () => {
    await refreshEntitlement();
    await refetchAccessState();
  }, [refetchAccessState, refreshEntitlement]);

  return {
    subscription,
    isLoading: isLoading || accessLoading,
    error: accessError,
    refetch,
    isActive,
    isCancelled,
    hasPremium: isActive,
    nextBillingDate,
    planPrice,
    plan: subscription?.plan,
    customerInfo: customerInfo as CustomerInfo | null,
  };
}
