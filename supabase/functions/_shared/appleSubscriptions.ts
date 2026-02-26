import { getCorsHeaders } from "./cors.ts";

// Use any for flexible client type compatibility across different Supabase client instances
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
  productId: string;
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

function getPriceCents(plan: "monthly" | "yearly") {
  const envValue = Deno.env.get(plan === "monthly" ? "APPLE_MONTHLY_PRICE_CENTS" : "APPLE_YEARLY_PRICE_CENTS");
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
  if (yearlyProductIds.some((id) => normalized.includes(id.toLowerCase())) || normalized.includes("year")) {
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

export function buildSubscriptionStatus(expiresAt: Date, cancelledAt?: Date | null): SubscriptionStatus {
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

  // Sandbox fallback (Apple returns 21007 when a sandbox receipt is sent to production endpoint)
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
    transactionId: latest.original_transaction_id ?? latest.transaction_id ?? "",
    expiresAt,
    purchaseDate,
    cancellationDate: parseAppleDate(latest.cancellation_date_ms ?? undefined),
  };
}

export async function upsertSubscription(
  supabase: SupabaseClient,
  payload: SubscriptionUpsert,
) {
  const status = buildSubscriptionStatus(payload.expiresAt, payload.cancellationDate);
  const now = new Date().toISOString();
  const amountCents = getPriceCents(payload.plan);

  const { data: existingPayment } = await supabase
    .from("payment_history")
    .select("id")
    .eq("stripe_payment_intent_id", payload.transactionId)
    .maybeSingle();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .upsert({
      user_id: payload.userId,
      stripe_subscription_id: payload.transactionId,
      stripe_customer_id: payload.transactionId,
      plan: payload.plan,
      status,
      current_period_start: payload.purchaseDate.toISOString(),
      current_period_end: payload.expiresAt.toISOString(),
      cancel_at: payload.cancellationDate ? payload.expiresAt.toISOString() : null,
      cancelled_at: payload.cancellationDate?.toISOString() ?? null,
      updated_at: now,
      environment: payload.environment ?? null,
      source: payload.source,
    }, {
      onConflict: "user_id",
    })
    .select()
    .single();

  await supabase
    .from("profiles")
    .update({
      is_premium: status === "active" || status === "trialing",
      subscription_status: status,
      subscription_expires_at: payload.expiresAt.toISOString(),
      updated_at: now,
    })
    .eq("id", payload.userId);

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
  if (!subscription) return { subscribed: false };
  const expiresAt = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
  const isActive = !!(expiresAt && expiresAt > new Date() && subscription.status !== "cancelled");

  return {
    subscribed: isActive,
    status: subscription.status as SubscriptionStatus,
    plan: subscription.plan as "monthly" | "yearly" | undefined,
    subscription_end: subscription.current_period_end,
  };
}

export function buildPromoSubscriptionResponse(grantedUntil: string | Date) {
  const expiresAt = grantedUntil instanceof Date ? grantedUntil.toISOString() : grantedUntil;

  return {
    subscribed: true,
    status: "active" as SubscriptionStatus,
    plan: "monthly" as const,
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
