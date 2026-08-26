import { useCallback, useMemo } from "react";
import type { AppleCustomerInfo } from "@/providers/StoreKitProvider";
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
    expirationDate,
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
    if (!accessState.subscribed || accessState.access_source !== "subscription") return null;

    return {
      status: (accessState.status as Subscription["status"] | undefined) ?? "active",
      plan: accessState.plan === "monthly" || accessState.plan === "yearly" ? accessState.plan : null,
      current_period_end: accessState.subscription_end ?? null,
      product_identifier: currentEntitlement?.productId ?? null,
      billing_provider: "storekit2",
      trial_ends_at: accessState.trial_ends_at,
    };
  }, [accessState, currentEntitlement]);

  const isActive = Boolean(subscription);
  const isCancelled = subscription?.status === "cancelled";

  const nextBillingDate = useMemo(() => {
    if (subscription?.current_period_end) {
      return new Date(subscription.current_period_end);
    }
    return expirationDate;
  }, [expirationDate, subscription?.current_period_end]);

  const planPrice = useMemo(() => {
    if (subscription?.plan === "yearly") return "$49.99/year";
    if (subscription?.plan === "monthly") return "$8.99/month";
    return null;
  }, [subscription?.plan]);

  const refetch = useCallback(async () => {
    await refreshEntitlement();
    await refetchAccessState();
  }, [refetchAccessState, refreshEntitlement]);

  return {
    subscription,
    isLoading: accessLoading,
    error: accessError,
    refetch,
    isActive,
    isCancelled,
    hasPremium: isActive,
    nextBillingDate,
    planPrice,
    plan: subscription?.plan,
    customerInfo: customerInfo as AppleCustomerInfo | null,
  };
}
