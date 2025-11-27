import { useAuth } from "./useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 1 * 60 * 1000, // Refetch every minute
  });

  const subscription = subscriptionData ? {
    status: subscriptionData.status as "active" | "cancelled",
    plan: subscriptionData.plan as "monthly" | "yearly",
    current_period_end: subscriptionData.subscription_end,
  } : null;

  // Helper functions
  const isActive = subscriptionData?.subscribed || false;
  const isCancelled = subscription?.status === "cancelled";

  // Calculate next billing date
  const nextBillingDate = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : null;

  // Format price based on plan
  const planPrice = subscription?.plan === "yearly" ? "$99.99/year" : "$9.99/month";

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
