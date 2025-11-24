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

      const { data, error } = await supabase.functions.invoke("check-subscription");

      if (error) throw error;
      return data as {
        subscribed: boolean;
        status?: string;
        is_trialing?: boolean;
        trial_end?: string;
        subscription_end?: string;
        plan?: string;
      } | null;
    },
    enabled: !!user,
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 1 * 60 * 1000, // Refetch every minute
  });

  const subscription = subscriptionData ? {
    status: subscriptionData.status as "active" | "cancelled" | "past_due" | "trialing" | "incomplete",
    plan: subscriptionData.plan as "monthly" | "yearly",
    trial_ends_at: subscriptionData.trial_end,
    current_period_end: subscriptionData.subscription_end,
  } : null;

  // Helper functions
  const isActive = subscriptionData?.subscribed || false;
  const isTrialing = subscriptionData?.is_trialing || false;
  const isPastDue = subscription?.status === "past_due";
  const isCancelled = subscription?.status === "cancelled";

  // Calculate days remaining in trial
  const trialDaysRemaining = subscription?.trial_ends_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.trial_ends_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  // Check if trial is ending soon (2 days or less)
  const trialEndingSoon = isTrialing && trialDaysRemaining <= 2 && trialDaysRemaining > 0;

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
    isTrialing,
    isPastDue,
    isCancelled,
    hasPremium: isActive,
    // Trial info
    trialDaysRemaining,
    trialEndingSoon,
    trialEndsAt: subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : null,
    // Billing info
    nextBillingDate,
    planPrice,
    plan: subscription?.plan,
  };
}

export async function cancelSubscription() {
  throw new Error("Use Stripe Customer Portal to manage subscription");
}

export async function resumeSubscription() {
  throw new Error("Use Stripe Customer Portal to manage subscription");
}
