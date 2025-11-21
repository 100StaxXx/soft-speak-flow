import { useAuth } from "./useAuth";

export interface Subscription {
  id: string;
  stripe_subscription_id: string;
  plan: "monthly" | "yearly";
  status: "active" | "cancelled" | "past_due" | "trialing" | "incomplete";
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at: string | null;
  cancelled_at: string | null;
}

export function useSubscription() {
  const { user } = useAuth();

  // Temporary: subscriptions table not yet migrated
  // TODO: Uncomment when subscriptions table is created
  /*
  const { data: subscription, isLoading, error, refetch } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as Subscription | null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  */

  const subscription = null;
  const isLoading = false;
  const error = null;
  const refetch = async () => {};

  // Helper functions
  const isActive = subscription?.status === "active" || subscription?.status === "trialing";
  const isTrialing = subscription?.status === "trialing";
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
    // Cancel info
    willCancelAt: subscription?.cancel_at ? new Date(subscription.cancel_at) : null,
  };
}

export async function cancelSubscription(subscriptionId: string) {
  throw new Error("Subscriptions not yet implemented");
}

export async function resumeSubscription(subscriptionId: string) {
  throw new Error("Subscriptions not yet implemented");
}
