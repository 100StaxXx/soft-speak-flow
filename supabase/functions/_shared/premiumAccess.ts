type SupabaseClient = any;

const PREMIUM_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due", "cancelled"];

const isFutureOrOpenEnded = (value: unknown, nowIso: string): boolean => {
  if (typeof value !== "string" || value.trim().length === 0) return true;
  return value > nowIso;
};

export async function hasPremiumAccess(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const nowIso = new Date().toISOString();

  const { data: entitlement, error: entitlementError } = await supabase
    .from("account_entitlements")
    .select("source, is_active, ends_at, trial_ends_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (entitlementError) throw entitlementError;

  if (
    entitlement?.is_active === true &&
    entitlement.source !== "none" &&
    (
      entitlement.source === "manual" ||
      isFutureOrOpenEnded(entitlement.ends_at ?? entitlement.trial_ends_at, nowIso)
    )
  ) {
    return true;
  }

  const { data: subscriptions, error } = await supabase
    .from("subscriptions")
    .select("id, cancelled_at")
    .eq("user_id", userId)
    .in("status", PREMIUM_SUBSCRIPTION_STATUSES)
    .gte("current_period_end", nowIso);

  if (error) throw error;
  if (!Array.isArray(subscriptions)) return false;

  return subscriptions.some((subscription) => (
    typeof subscription?.cancelled_at !== "string" ||
    subscription.cancelled_at.trim().length === 0
  ));
}
