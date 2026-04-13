import { useMemo } from "react";
import { useRevenueCat } from "./useRevenueCat";

export interface Subscription {
  status: "active" | "cancelled" | "past_due" | "trialing" | "incomplete" | "expired";
  plan: "monthly" | "yearly";
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  product_identifier?: string | null;
  billing_provider?: "revenuecat";
}

export function useSubscription() {
  const {
    activeEntitlement,
    activePlan,
    customerInfo,
    expirationDate,
    isLoading,
    isPro,
    refreshCustomerInfo,
  } = useRevenueCat();

  const subscription = useMemo(() => {
    if (!activeEntitlement?.isActive || !activePlan) return null;

    const status: Subscription["status"] =
      activeEntitlement.billingIssueDetectedAt ? "past_due" :
      activeEntitlement.unsubscribeDetectedAt ? "cancelled" :
      activeEntitlement.periodType === "TRIAL" || activeEntitlement.periodType === "INTRO" ? "trialing" :
      "active";

    return {
      status,
      plan: activePlan,
      current_period_end: activeEntitlement.expirationDate,
      product_identifier: activeEntitlement.productIdentifier,
      billing_provider: "revenuecat",
      trial_ends_at:
        activeEntitlement.periodType === "TRIAL" || activeEntitlement.periodType === "INTRO"
          ? activeEntitlement.expirationDate
          : null,
    };
  }, [activeEntitlement, activePlan]);

  const isActive = isPro;
  const isCancelled = subscription?.status === "cancelled";

  const nextBillingDate = useMemo(() => {
    if (subscription?.current_period_end) {
      return new Date(subscription.current_period_end);
    }
    return expirationDate;
  }, [expirationDate, subscription?.current_period_end]);

  const planPrice = useMemo(() => {
    if (subscription?.plan === "yearly") {
      const normalizedIdentifier = subscription.product_identifier?.toLowerCase() ?? "";
      const hasReferralDiscount =
        normalizedIdentifier.includes("referral") || normalizedIdentifier.includes("discount");
      return hasReferralDiscount ? "$69.99/year" : "$99.99/year";
    }
    if (subscription?.plan === "monthly") return "$9.99/month";
    return null;
  }, [subscription?.plan, subscription?.product_identifier]);

  return {
    subscription,
    isLoading,
    error: null,
    refetch: refreshCustomerInfo,
    isActive,
    isCancelled,
    hasPremium: isActive,
    nextBillingDate,
    planPrice,
    plan: subscription?.plan,
    customerInfo,
  };
}
