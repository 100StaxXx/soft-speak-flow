type SupabaseClient = any;

export type AccessSource = "subscription" | "promo_code" | "trial" | "manual" | "none";

export type AccountEntitlement = {
  user_id: string;
  source: AccessSource;
  status: string;
  plan: string | null;
  is_active: boolean;
  started_at?: string | null;
  ends_at?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  billing_customer_id?: string | null;
  billing_subscription_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AccountEntitlementPatch = Pick<AccountEntitlement, "user_id" | "source"> &
  Partial<Omit<AccountEntitlement, "user_id" | "source">>;

function hasOwn(target: object, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(target, key);
}

function normalizeSource(value: unknown): AccessSource {
  if (
    value === "subscription" ||
    value === "promo_code" ||
    value === "trial" ||
    value === "manual" ||
    value === "none"
  ) {
    return value;
  }
  return "none";
}

function normalizePlan(value: unknown): "monthly" | "yearly" | undefined {
  if (value === "monthly" || value === "yearly") return value;
  return undefined;
}

export function buildAccessStateResponse(entitlement: AccountEntitlement | null) {
  if (!entitlement) {
    return {
      has_access: false,
      access_source: "none" as const,
      trial_ends_at: null,
      subscribed: false,
      status: undefined,
      plan: undefined,
      subscription_end: undefined,
    };
  }

  const accessSource = normalizeSource(entitlement.source);
  const subscribed = entitlement.is_active && accessSource !== "trial" && accessSource !== "none";

  return {
    has_access: entitlement.is_active,
    access_source: accessSource,
    trial_ends_at: entitlement.trial_ends_at ?? null,
    subscribed,
    status: typeof entitlement.status === "string" ? entitlement.status : undefined,
    plan: normalizePlan(entitlement.plan),
    subscription_end: entitlement.ends_at ?? undefined,
  };
}

export async function fetchAccountEntitlementForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<AccountEntitlement | null> {
  const { data, error } = await supabase
    .from("account_entitlements")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertAccountEntitlement(
  supabase: SupabaseClient,
  entitlement: AccountEntitlementPatch,
) {
  const existing = await fetchAccountEntitlementForUser(supabase, entitlement.user_id);

  const payload = {
    user_id: entitlement.user_id,
    source: normalizeSource(entitlement.source),
    status: hasOwn(entitlement, "status")
      ? entitlement.status ?? "inactive"
      : existing?.status ?? "inactive",
    plan: hasOwn(entitlement, "plan")
      ? entitlement.plan ?? null
      : existing?.plan ?? null,
    is_active: hasOwn(entitlement, "is_active")
      ? entitlement.is_active ?? false
      : existing?.is_active ?? false,
    started_at: hasOwn(entitlement, "started_at")
      ? entitlement.started_at ?? null
      : existing?.started_at ?? null,
    ends_at: hasOwn(entitlement, "ends_at")
      ? entitlement.ends_at ?? null
      : existing?.ends_at ?? null,
    trial_started_at: hasOwn(entitlement, "trial_started_at")
      ? entitlement.trial_started_at ?? null
      : existing?.trial_started_at ?? null,
    trial_ends_at: hasOwn(entitlement, "trial_ends_at")
      ? entitlement.trial_ends_at ?? null
      : existing?.trial_ends_at ?? null,
    billing_customer_id: hasOwn(entitlement, "billing_customer_id")
      ? entitlement.billing_customer_id ?? null
      : existing?.billing_customer_id ?? null,
    billing_subscription_id: hasOwn(entitlement, "billing_subscription_id")
      ? entitlement.billing_subscription_id ?? null
      : existing?.billing_subscription_id ?? null,
    metadata: {
      ...(existing?.metadata ?? {}),
      ...((hasOwn(entitlement, "metadata") ? entitlement.metadata : null) ?? {}),
    },
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("account_entitlements")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data as AccountEntitlement | null;
}
