import { useAuth } from "./useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export interface Subscription {
  status: "active" | "cancelled" | "past_due" | "trialing" | "incomplete";
  plan: "monthly" | "yearly";
  trial_ends_at?: string | null;
  current_period_end?: string | null;
}

export function useSubscription() {
  const { user } = useAuth();

  const { data: subscriptionData, isLoading, error, refetch } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase.functions.invoke("check-apple-subscription");

      if (error) throw error;
      return data as {
        subscribed: boolean;
        status?: string;
        subscription_end?: string;
        plan?: string;
      } | null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes - increased for better performance
    refetchInterval: false, // Disable automatic refetching for better performance
  });

  const subscription = useMemo(() => subscriptionData ? {
    status: subscriptionData.status as Subscription["status"],
    plan: subscriptionData.plan as Subscription["plan"],
    current_period_end: subscriptionData.subscription_end,
  } : null, [subscriptionData]);

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
    subscription?.plan === "yearly" ? "$99.99/year" : "$9.99/month",
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
