import { useAuth } from "./useAuth";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useEffect } from "react";
import { logger } from "@/utils/logger";
import { checkAppleSubscription } from "@/lib/firebase/functions";
import { safeLocalStorage } from "@/utils/storage";

export interface Subscription {
  status: "active" | "cancelled" | "past_due" | "trialing" | "incomplete";
  plan: "monthly" | "yearly";
  trial_ends_at?: string | null;
  current_period_end?: string | null;
}

// Cache key and expiry (1 hour)
const SUBSCRIPTION_CACHE_KEY = "subscription_cache";
const SUBSCRIPTION_CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour in ms

interface CachedSubscription {
  data: any;
  timestamp: number;
  userId: string;
}

// Get cached subscription (returns null if expired or invalid)
function getCachedSubscription(userId: string): any | null {
  try {
    const cached = safeLocalStorage.getItem(SUBSCRIPTION_CACHE_KEY);
    if (!cached) return null;
    
    const parsed: CachedSubscription = JSON.parse(cached);
    const isExpired = Date.now() - parsed.timestamp > SUBSCRIPTION_CACHE_EXPIRY;
    const isWrongUser = parsed.userId !== userId;
    
    if (isExpired || isWrongUser) {
      safeLocalStorage.removeItem(SUBSCRIPTION_CACHE_KEY);
      return null;
    }
    
    return parsed.data;
  } catch {
    return null;
  }
}

// Save subscription to cache
function setCachedSubscription(userId: string, data: any): void {
  try {
    const cache: CachedSubscription = {
      data,
      timestamp: Date.now(),
      userId
    };
    safeLocalStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
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
  const { user } = useAuth();

  const { data: subscriptionData, isLoading, error, refetch } = useQuery({
    queryKey: ["subscription", user?.uid],
    queryFn: async () => {
      if (!user) return null;

      // Check cache first for fast initial load
      const cached = getCachedSubscription(user.uid);
      if (cached) {
        // Return cached immediately, but also fetch fresh in background
        checkAppleSubscription().then((fresh) => {
          if (fresh) setCachedSubscription(user.uid, fresh);
        }).catch(() => {});
        return cached;
      }

      // No cache, fetch from server
      const result = await checkAppleSubscription();
      if (result && user.uid) {
        setCachedSubscription(user.uid, result);
      }
      return result;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: false,
    // Return cached data immediately while revalidating
    placeholderData: user ? getCachedSubscription(user.uid) : undefined,
  });

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
