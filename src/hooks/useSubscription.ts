import { useMemo } from "react";
import { logger } from "@/utils/logger";
import { useAccessState } from "./useAccessState";

export interface Subscription {
  status: "active" | "cancelled" | "past_due" | "trialing" | "incomplete" | "expired";
  plan: "monthly" | "yearly";
  trial_ends_at?: string | null;
  current_period_end?: string | null;
}

// Valid status values for type safety
const VALID_STATUSES: Subscription["status"][] = ["active", "cancelled", "past_due", "trialing", "incomplete", "expired"];
const VALID_PLANS: Subscription["plan"][] = ["monthly", "yearly"];

function isValidStatus(status: unknown): status is Subscription["status"] {
  return typeof status === "string" && VALID_STATUSES.includes(status as Subscription["status"]);
}

function isValidPlan(plan: unknown): plan is Subscription["plan"] {
  return typeof plan === "string" && VALID_PLANS.includes(plan as Subscription["plan"]);
}

export function useSubscription() {
  const { accessState, isLoading, error, refetch } = useAccessState();

  const subscription = useMemo(() => {
    // Return null if no data or user is not subscribed
    if (!accessState.subscribed) return null;
    
    // Validate status and plan - default to safe values if invalid
    const status = isValidStatus(accessState.status) 
      ? accessState.status 
      : "incomplete";
    const plan = isValidPlan(accessState.plan) 
      ? accessState.plan 
      : "monthly";

    // Log warning if values were unexpected (for debugging)
    if (!isValidStatus(accessState.status)) {
      logger.warn(`Unexpected subscription status: ${accessState.status}`);
    }
    if (accessState.plan && !isValidPlan(accessState.plan)) {
      logger.warn(`Unexpected subscription plan: ${accessState.plan}`);
    }

    return {
      status,
      plan,
      current_period_end: accessState.subscription_end,
      trial_ends_at: accessState.trial_ends_at,
    };
  }, [accessState]);

  // Helper functions - memoized for performance
  const isActive = accessState.subscribed;
  const isCancelled = subscription?.status === "cancelled";

  // Calculate next billing date - memoized
  const nextBillingDate = useMemo(() => 
    subscription?.current_period_end
      ? new Date(subscription.current_period_end)
      : null,
    [subscription?.current_period_end]
  );

  // Format price based on plan - memoized
  const planPrice = useMemo(() => 
    subscription?.plan === "yearly" ? "$59.99/year" : "$9.99/month",
    [subscription?.plan]
  );

  return {
    subscription,
    isLoading,
    error,
    refetch,
    // Status checks
    isActive,
    isCancelled,
    hasPremium: isActive,
    // Billing info
    nextBillingDate,
    planPrice,
    plan: subscription?.plan,
  };
}
