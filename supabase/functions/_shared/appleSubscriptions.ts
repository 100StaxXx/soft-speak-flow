import { normalizeAppAccountToken } from "./appleServerAPI.ts";
import { upsertAccountEntitlement } from "./accountEntitlements.ts";
import { getCorsHeaders } from "./cors.ts";

type SupabaseClient = any;

type AppleReceiptInfo = {
  product_id?: string;
  original_transaction_id?: string;
  transaction_id?: string;
  expires_date_ms?: string;
  purchase_date_ms?: string;
  original_purchase_date_ms?: string;
  cancellation_date_ms?: string | null;
  cancellation_reason?: string | null;
};

type AppleVerifyResponse = {
  status: number;
  environment?: string;
  latest_receipt_info?: AppleReceiptInfo[];
  receipt?: { [key: string]: unknown };
};

type SubscriptionStatus = "active" | "trialing" | "cancelled" | "past_due" | "expired";

type SubscriptionUpsert = {
  userId: string;
  transactionId: string;
  originalTransactionId?: string;
  productId: string;
  appAccountToken?: string | null;
  allowCreateWithoutAppAccountToken?: boolean;
  plan: "monthly" | "yearly";
  expiresAt: Date;
  purchaseDate: Date;
  cancellationDate?: Date | null;
  environment?: string;
  source: "receipt" | "webhook";
};

const PROD_VERIFY_URL = "https://buy.itunes.apple.com/verifyReceipt";
const SANDBOX_VERIFY_URL = "https://sandbox.itunes.apple.com/verifyReceipt";

const DEFAULT_MONTHLY_PRICE_CENTS = 999; // $9.99
const DEFAULT_YEARLY_PRICE_CENTS = 5999; // $59.99 promotional pricing

export const APPLE_BINDING_CONFLICT_ERROR =
  "This purchase is already linked to another account.";
export const APPLE_BINDING_MISSING_ERROR =
  "This purchase is missing its app-account binding. Update the app and restore the purchase again.";

function getPriceCents(plan: "monthly" | "yearly") {
  const envValue = Deno.env.get(
    plan === "monthly" ? "APPLE_MONTHLY_PRICE_CENTS" : "APPLE_YEARLY_PRICE_CENTS",
  );
  const parsed = envValue ? Number(envValue) : NaN;
  if (!Number.isFinite(parsed)) return plan === "monthly" ? DEFAULT_MONTHLY_PRICE_CENTS : DEFAULT_YEARLY_PRICE_CENTS;
  return parsed;
}

function normalizeProductIds(envKey: string, defaults: string[]) {
  const envValue = Deno.env.get(envKey);
  if (!envValue) return defaults;
  return envValue
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

const monthlyProductIds = normalizeProductIds("APPLE_MONTHLY_PRODUCT_IDS", [
  "cosmiq_premium_monthly",
  "com.darrylgraham.revolution.monthly",
]);
const yearlyProductIds = normalizeProductIds("APPLE_YEARLY_PRODUCT_IDS", [
  "cosmiq_premium_yearly",
  "com.darrylgraham.revolution.yearly",
]);

export function resolvePlanFromProduct(productId: string | undefined): "monthly" | "yearly" {
  const normalized = (productId ?? "").toLowerCase();
  if (
    yearlyProductIds.some((id) => normalized.includes(id.toLowerCase())) ||
    normalized.includes("year")
  ) {
    return "yearly";
  }
  return monthlyProductIds.some((id) => normalized.includes(id.toLowerCase())) ? "monthly" : "monthly";
}

function parseAppleDate(value?: string | null) {
  if (!value) return null;
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber)) return null;
  return new Date(asNumber);
}

function normalizeOriginalTransactionId(
  originalTransactionId: string | null | undefined,
  fallbackTransactionId: string,
) {
  const normalized = originalTransactionId?.trim() || fallbackTransactionId.trim();
  if (!normalized) {
    throw new Error("Missing original transaction identifier");
  }
  return normalized;
}

function normalizeUserId(userId: string) {
  return userId.trim().toLowerCase();
}

export function buildSubscriptionStatus(
  expiresAt: Date,
  cancelledAt?: Date | null,
): SubscriptionStatus {
  if (cancelledAt && cancelledAt <= new Date()) return "cancelled";
  if (expiresAt <= new Date()) return "expired";
  return "active";
}

function selectLatestReceipt(receiptInfo: AppleReceiptInfo[]): AppleReceiptInfo | null {
  if (!Array.isArray(receiptInfo) || receiptInfo.length === 0) return null;
  return [...receiptInfo].sort((a, b) => {
    const aTime = Number(a.expires_date_ms ?? a.purchase_date_ms ?? 0);
    const bTime = Number(b.expires_date_ms ?? b.purchase_date_ms ?? 0);
    return bTime - aTime;
  })[0];
}

async function callAppleVerification(receipt: string, url: string): Promise<AppleVerifyResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "receipt-data": receipt,
      password: Deno.env.get("APPLE_SHARED_SECRET"),
      "exclude-old-transactions": true,
    }),
  });

  return await response.json();
}

export async function verifyReceiptWithApple(receipt: string) {
  if (!receipt) {
    throw new Error("Receipt data required");
  }

  const prodResult = await callAppleVerification(receipt, PROD_VERIFY_URL);
  if (prodResult.status === 0) {
    return { result: prodResult, environment: prodResult.environment ?? "Production" };
  }

  if (prodResult.status === 21007) {
    const sandboxResult = await callAppleVerification(receipt, SANDBOX_VERIFY_URL);
    if (sandboxResult.status === 0) {
      return { result: sandboxResult, environment: sandboxResult.environment ?? "Sandbox" };
    }
    throw new Error(`Sandbox verification failed: ${sandboxResult.status}`);
  }

  throw new Error(`Receipt verification failed: ${prodResult.status}`);
}

export function extractLatestTransaction(verifyResult: AppleVerifyResponse) {
  const receiptInfo = verifyResult.latest_receipt_info ?? [];
  const latest = selectLatestReceipt(receiptInfo);
  if (!latest) return null;

  const expiresAt = parseAppleDate(latest.expires_date_ms);
  const purchaseDate = parseAppleDate(latest.purchase_date_ms ?? latest.original_purchase_date_ms);

  if (!expiresAt || !purchaseDate) {
    return null;
  }

  return {
    productId: latest.product_id ?? "",
    transactionId: latest.transaction_id ?? latest.original_transaction_id ?? "",
    originalTransactionId: latest.original_transaction_id ?? latest.transaction_id ?? "",
    expiresAt,
    purchaseDate,
    cancellationDate: parseAppleDate(latest.cancellation_date_ms ?? undefined),
  };
}

export async function fetchAppleTransactionBinding(
  supabase: SupabaseClient,
  originalTransactionId: string,
) {
  const { data, error } = await supabase
    .from("apple_transaction_bindings")
    .select("*")
    .eq("original_transaction_id", originalTransactionId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function ensureAppleTransactionBinding(
  supabase: SupabaseClient,
  payload: {
    userId: string;
    transactionId: string;
    originalTransactionId?: string;
    productId: string;
    environment?: string;
    appAccountToken?: string | null;
    allowCreateWithoutAppAccountToken?: boolean;
    metadata?: Record<string, unknown>;
  },
) {
  const originalTransactionId = normalizeOriginalTransactionId(
    payload.originalTransactionId,
    payload.transactionId,
  );
  const normalizedUserId = normalizeUserId(payload.userId);
  const normalizedToken = normalizeAppAccountToken(payload.appAccountToken);

  if (normalizedToken && normalizedToken !== normalizedUserId) {
    throw new Error(APPLE_BINDING_CONFLICT_ERROR);
  }

  const existing = await fetchAppleTransactionBinding(supabase, originalTransactionId);
  if (existing) {
    const boundUserId = normalizeUserId(existing.bound_user_id);
    const boundToken = normalizeAppAccountToken(existing.app_account_token);

    if (boundUserId !== normalizedUserId) {
      throw new Error(APPLE_BINDING_CONFLICT_ERROR);
    }

    if (normalizedToken && boundToken && boundToken !== normalizedToken) {
      throw new Error(APPLE_BINDING_CONFLICT_ERROR);
    }

    const { data, error } = await supabase
      .from("apple_transaction_bindings")
      .update({
        latest_transaction_id: payload.transactionId,
        product_id: payload.productId,
        environment: payload.environment ?? existing.environment ?? null,
        metadata: {
          ...(existing.metadata ?? {}),
          ...(payload.metadata ?? {}),
        },
        app_account_token: boundToken ?? normalizedToken,
        last_verified_at: new Date().toISOString(),
      })
      .eq("original_transaction_id", originalTransactionId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  if (!normalizedToken && !payload.allowCreateWithoutAppAccountToken) {
    throw new Error(APPLE_BINDING_MISSING_ERROR);
  }

  const insertPayload = {
    original_transaction_id: originalTransactionId,
    bound_user_id: payload.userId,
    app_account_token: normalizedToken,
    latest_transaction_id: payload.transactionId,
    product_id: payload.productId,
    environment: payload.environment ?? null,
    metadata: payload.metadata ?? {},
    last_verified_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("apple_transaction_bindings")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) {
    const concurrentBinding = await fetchAppleTransactionBinding(supabase, originalTransactionId);
    if (concurrentBinding && normalizeUserId(concurrentBinding.bound_user_id) === normalizedUserId) {
      return concurrentBinding;
    }
    throw new Error(APPLE_BINDING_CONFLICT_ERROR);
  }

  return data;
}

export async function upsertSubscription(
  supabase: SupabaseClient,
  payload: SubscriptionUpsert,
) {
  const originalTransactionId = normalizeOriginalTransactionId(
    payload.originalTransactionId,
    payload.transactionId,
  );

  await ensureAppleTransactionBinding(supabase, {
    userId: payload.userId,
    transactionId: payload.transactionId,
    originalTransactionId,
    productId: payload.productId,
    environment: payload.environment,
    appAccountToken: payload.appAccountToken,
    allowCreateWithoutAppAccountToken: payload.allowCreateWithoutAppAccountToken,
    metadata: {
      source: payload.source,
    },
  });

  const status = buildSubscriptionStatus(payload.expiresAt, payload.cancellationDate);
  const now = new Date().toISOString();
  const amountCents = getPriceCents(payload.plan);
  const isActive = payload.expiresAt > new Date() &&
    (status === "active" || status === "trialing" || status === "past_due" || status === "cancelled");

  const { data: existingPayment } = await supabase
    .from("payment_history")
    .select("id")
    .eq("stripe_payment_intent_id", payload.transactionId)
    .maybeSingle();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .upsert(
      {
        user_id: payload.userId,
        stripe_subscription_id: originalTransactionId,
        stripe_customer_id: originalTransactionId,
        plan: payload.plan,
        status,
        current_period_start: payload.purchaseDate.toISOString(),
        current_period_end: payload.expiresAt.toISOString(),
        cancel_at: payload.cancellationDate ? payload.expiresAt.toISOString() : null,
        cancelled_at: payload.cancellationDate?.toISOString() ?? null,
        updated_at: now,
        environment: payload.environment ?? null,
        source: payload.source,
      },
      {
        onConflict: "user_id",
      },
    )
    .select()
    .single();

  await upsertAccountEntitlement(supabase, {
    user_id: payload.userId,
    source: "subscription",
    status,
    plan: payload.plan,
    is_active: isActive,
    started_at: payload.purchaseDate.toISOString(),
    ends_at: payload.expiresAt.toISOString(),
    trial_started_at: status === "trialing" ? payload.purchaseDate.toISOString() : null,
    trial_ends_at: status === "trialing" ? payload.expiresAt.toISOString() : null,
    billing_customer_id: originalTransactionId,
    billing_subscription_id: originalTransactionId,
    metadata: {
      product_id: payload.productId,
      original_transaction_id: originalTransactionId,
      environment: payload.environment ?? "unknown",
      source: payload.source,
    },
  });

  if (!existingPayment) {
    await supabase.from("payment_history").insert({
      user_id: payload.userId,
      subscription_id: subscription?.id,
      stripe_payment_intent_id: payload.transactionId,
      stripe_invoice_id: payload.transactionId,
      amount: amountCents,
      currency: "usd",
      status: status === "active" ? "succeeded" : "pending",
      created_at: payload.purchaseDate.toISOString(),
      updated_at: now,
      metadata: {
        product_id: payload.productId,
        original_transaction_id: originalTransactionId,
        environment: payload.environment ?? "unknown",
      },
    });
  }

  return subscription;
}

export async function fetchSubscriptionForUser(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchActivePromoAccessForUser(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("promo_code_redemptions")
    .select("granted_until")
    .eq("user_id", userId)
    .gt("granted_until", new Date().toISOString())
    .order("granted_until", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function buildSubscriptionResponse(subscription: any) {
  if (!subscription) {
    return {
      has_access: false,
      access_source: "none" as const,
      trial_ends_at: null,
      subscribed: false,
    };
  }
  const expiresAt = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
  const isActive = !!(
    expiresAt &&
    expiresAt > new Date() &&
    (subscription.status === "active" ||
      subscription.status === "trialing" ||
      subscription.status === "past_due" ||
      subscription.status === "cancelled")
  );

  return {
    has_access: isActive,
    access_source: "subscription" as const,
    trial_ends_at: subscription.trial_ends_at ?? null,
    subscribed: isActive,
    status: subscription.status as SubscriptionStatus,
    plan: subscription.plan as "monthly" | "yearly" | undefined,
    subscription_end: subscription.current_period_end,
  };
}

export function buildPromoSubscriptionResponse(grantedUntil: string | Date) {
  const expiresAt = grantedUntil instanceof Date ? grantedUntil.toISOString() : grantedUntil;

  return {
    has_access: true,
    access_source: "promo_code" as const,
    trial_ends_at: null,
    subscribed: true,
    status: "active" as SubscriptionStatus,
    plan: undefined,
    subscription_end: expiresAt,
    source: "promo_code",
  };
}

export function buildErrorResponse(req: Request, message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders(req),
    },
  });
}
