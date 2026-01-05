import { useAuth } from "./useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { logger } from "@/utils/logger";

export interface Subscription {
  status: "active" | "cancelled" | "past_due" | "trialing" | "incomplete";
  plan: "monthly" | "yearly";
  trial_ends_at?: string | null;
  current_period_end?: string | null;
}

// Valid status values for type safety
const VALID_STATUSES: Subscription["status"][] = ["active", "cancelled", "past_due", "trialing", "incomplete"];
const VALID_PLANS: Subscription["plan"][] = ["monthly", "yearly"];

function isValidStatus(status: unknown): status is Subscription["status"] {
  return typeof status === "string" && VALID_STATUSES.includes(status as Subscription["status"]);
}

function isValidPlan(plan: unknown): plan is Subscription["plan"] {
  return typeof plan === "string" && VALID_PLANS.includes(plan as Subscription["plan"]);
}

export function useSubscription() {
  const { user, loading: authLoading } = useAuth();

  const { data: subscriptionData, isLoading: queryLoading, error, refetch } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Create a timeout promise to prevent infinite loading
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          logger.warn('Subscription check timed out after 5s');
          resolve(null);
        }, 5000);
      });

      try {
        // Race the actual check against the timeout
        const result = await Promise.race([
          supabase.functions.invoke("check-apple-subscription").then(({ data, error }) => {
            if (error) {
              logger.warn('Subscription check error:', { error: error.message });
              return null;
            }
            return data as {
              subscribed: boolean;
              status?: string;
              subscription_end?: string;
              plan?: string;
            } | null;
          }),
          timeoutPromise
        ]);

        return result;
      } catch (err) {
        logger.warn('Subscription check failed:', { error: err instanceof Error ? err.message : 'Unknown error' });
        return null;
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes - increased for better performance
    refetchInterval: false, // Disable automatic refetching for better performance
    retry: false, // Don't retry failed subscription checks to avoid blocking
  });

  // Only consider loading if auth is done AND user exists AND query is actually loading
  const isLoading = authLoading || (!!user && queryLoading);

  const subscription = useMemo(() => {
    // Return null if no data or user is not subscribed
    if (!subscriptionData || !subscriptionData.subscribed) return null;
    
    // Validate status and plan - default to safe values if invalid
    const status = isValidStatus(subscriptionData.status) 
      ? subscriptionData.status 
      : "incomplete";
    const plan = isValidPlan(subscriptionData.plan) 
      ? subscriptionData.plan 
      : "monthly";

    // Log warning if values were unexpected (for debugging)
    if (!isValidStatus(subscriptionData.status)) {
      logger.warn(`Unexpected subscription status: ${subscriptionData.status}`);
    }
    if (subscriptionData.plan && !isValidPlan(subscriptionData.plan)) {
      logger.warn(`Unexpected subscription plan: ${subscriptionData.plan}`);
    }

    return {
      status,
      plan,
      current_period_end: subscriptionData.subscription_end,
    };
  }, [subscriptionData]);

  // Helper functions - memoized for performance
  const isActive = subscriptionData?.subscribed || false;
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
