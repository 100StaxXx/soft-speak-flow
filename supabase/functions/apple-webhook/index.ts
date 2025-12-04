import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.8.0";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const defaultAppleBundleId = "com.darrylgraham.revolution";
const appleWebhookAudiences = [
  Deno.env.get("APPLE_WEBHOOK_AUDIENCE"),
  Deno.env.get("APPLE_SERVICE_ID"),
  Deno.env.get("APPLE_IOS_BUNDLE_ID"),
].filter((value): value is string => Boolean(value));

if (appleWebhookAudiences.length === 0) {
  appleWebhookAudiences.push(defaultAppleBundleId);
}

const appleWebhookJWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

/**
 * Apple Server-to-Server Notification Webhook
 * 
 * This endpoint handles automatic notifications from Apple about subscription events:
 * - Renewals
 * - Cancellations
 * - Billing issues
 * - Refunds
 * - Plan changes
 * 
 * Setup in App Store Connect:
 * 1. Go to App Information > App Store Server Notifications
 * 2. Add this URL as webhook endpoint
 * 3. Apple will send POST requests for subscription events
 * 
 * SECURITY NOTE: Apple webhooks don't send Origin headers, so CORS is permissive.
 * The security comes from the signed JWT payload, which we now verify with Apple's JWKS.
 */

// Notification types from Apple
enum NotificationType {
  INITIAL_BUY = "INITIAL_BUY",
  DID_RENEW = "DID_RENEW",
  DID_CHANGE_RENEWAL_STATUS = "DID_CHANGE_RENEWAL_STATUS",
  DID_CHANGE_RENEWAL_PREF = "DID_CHANGE_RENEWAL_PREF",
  DID_FAIL_TO_RENEW = "DID_FAIL_TO_RENEW",
  DID_RECOVER = "DID_RECOVER",
  CANCEL = "CANCEL",
  REFUND = "REFUND",
  RENEWAL_EXTENDED = "RENEWAL_EXTENDED",
  REVOKE = "REVOKE",
  PRICE_INCREASE_CONSENT = "PRICE_INCREASE_CONSENT",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  try {
    // Create Supabase client with service role for server operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const payload = await req.json();
    
    console.log("Received Apple notification:", {
      type: payload.notification_type ?? payload?.notificationType,
      timestamp: new Date().toISOString(),
    });

    let notificationContext;
    try {
      notificationContext = await buildNotificationContext(payload);
    } catch (verificationError) {
      console.error("Apple webhook signature verification failed:", verificationError);
      return new Response("Invalid signature", {
        status: 401,
        headers: getCorsHeaders(req),
      });
    }

    const { notificationType, latestReceiptInfo, autoRenewStatus } = notificationContext;
    
    if (!latestReceiptInfo) {
      console.error("No receipt info in notification");
      return new Response("No receipt info", { status: 400 });
    }

    // Extract subscription details
    const originalTransactionId = latestReceiptInfo.original_transaction_id;
    const productId = latestReceiptInfo.product_id;
    const expiresDateMs = latestReceiptInfo.expires_date_ms;
    const purchaseDateMs = latestReceiptInfo.purchase_date_ms;
    const cancellationDateMs = latestReceiptInfo.cancellation_date_ms;

    // Find user by transaction ID
    const { data: subscription, error: subscriptionError } = await supabaseClient
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", originalTransactionId)
      .maybeSingle();

    if (subscriptionError) {
      console.error("Error fetching subscription:", subscriptionError);
      // Still return 200 to prevent Apple from retrying
      return new Response("OK", { 
        status: 200, 
        headers: getCorsHeaders(req),
      });
    }

    if (!subscription) {
      console.log("No subscription found for transaction:", originalTransactionId, "- This may be a new subscription being processed via verify-apple-receipt");
      // This might be a new subscription, return 200 to acknowledge
      return new Response("OK", { 
        status: 200, 
        headers: getCorsHeaders(req),
      });
    }

    const userId = subscription.user_id;

    // Determine plan from product ID
    let plan = "monthly";
    if (productId.includes("yearly") || productId.includes("annual")) {
      plan = "yearly";
    }

    // Process notification based on type
    switch (notificationType) {
      case NotificationType.INITIAL_BUY:
        // First-time subscription - handle activation AND referral payout
        await handleActivation(
          supabaseClient,
          userId,
          originalTransactionId,
          plan,
          expiresDateMs,
          purchaseDateMs
        );
        // Create referral payout if user was referred
        await createReferralPayout(
          supabaseClient,
          userId,
          originalTransactionId,
          plan
        );
        break;
        
      case NotificationType.DID_RENEW:
      case NotificationType.DID_RECOVER:
        // Subscription renewed or recovered
        await handleActivation(
          supabaseClient,
          userId,
          originalTransactionId,
          plan,
          expiresDateMs,
          purchaseDateMs
        );
        break;

      case NotificationType.DID_CHANGE_RENEWAL_STATUS: {
        // User enabled/disabled auto-renewal
        const willRenew = normalizeAutoRenewStatus(autoRenewStatus);
        await handleRenewalStatusChange(
          supabaseClient,
          userId,
          willRenew,
          expiresDateMs
        );
        break;
      }

      case NotificationType.DID_CHANGE_RENEWAL_PREF:
        // User changed plan (e.g., monthly to yearly)
        await handlePlanChange(
          supabaseClient,
          userId,
          plan,
          expiresDateMs
        );
        break;

      case NotificationType.DID_FAIL_TO_RENEW:
        // Billing issue - mark as past_due
        await handleBillingIssue(
          supabaseClient,
          userId,
          expiresDateMs
        );
        break;

      case NotificationType.CANCEL:
      case NotificationType.REVOKE:
        // User cancelled or subscription revoked
        await handleCancellation(
          supabaseClient,
          userId,
          cancellationDateMs || Date.now().toString(),
          expiresDateMs
        );
        break;

      case NotificationType.REFUND:
        // Payment refunded - revoke access
        await handleRefund(
          supabaseClient,
          userId,
          originalTransactionId
        );
        break;

      default:
        console.log("Unhandled notification type:", notificationType);
    }

    // Return 200 to acknowledge receipt
    return new Response("OK", {
      status: 200,
      headers: getCorsHeaders(req),
    });

  } catch (error) {
    console.error("Error processing Apple notification:", error);
    
    // Still return 200 to prevent Apple from retrying
    return new Response("OK", {
      status: 200,
      headers: getCorsHeaders(req),
    });
  }
});

async function handleActivation(
  supabase: any,
  userId: string,
  transactionId: string,
  plan: string,
  expiresDateMs: string,
  purchaseDateMs: string
) {
  const expiresDate = new Date(parseInt(expiresDateMs));
  const purchaseDate = new Date(parseInt(purchaseDateMs));

  await supabase.from("subscriptions").upsert({
    user_id: userId,
    stripe_subscription_id: transactionId,
    stripe_customer_id: transactionId,
    plan,
    status: "active",
    current_period_start: purchaseDate.toISOString(),
    current_period_end: expiresDate.toISOString(),
    updated_at: new Date().toISOString(),
  }, {
    onConflict: "user_id"
  });

  await supabase.from("profiles").update({
    is_premium: true,
    subscription_status: "active",
    subscription_expires_at: expiresDate.toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", userId);

  console.log(`Activated subscription for user ${userId}`);
}

type AppleJWSPayload = Record<string, unknown>;

async function buildNotificationContext(body: any) {
  let notificationType = body?.notification_type as NotificationType | undefined;
  let latestReceiptInfo = body?.latest_receipt_info;
  let autoRenewStatus = body?.auto_renew_status;

  if (body?.signedPayload) {
    const rootPayload = await verifyAppleNotification(body.signedPayload, appleWebhookAudiences);
    notificationType = rootPayload.notificationType as NotificationType;

    const data = (rootPayload.data ?? {}) as Record<string, unknown>;
    const bundleAudience = typeof data.bundleId === "string" ? data.bundleId : appleWebhookAudiences;

    let transactionInfo: AppleJWSPayload | null = null;
    if (typeof data.signedTransactionInfo === "string") {
      transactionInfo = await verifyAppleNotification(data.signedTransactionInfo, bundleAudience);
    }

    let renewalInfo: AppleJWSPayload | null = null;
    if (typeof data.signedRenewalInfo === "string") {
      renewalInfo = await verifyAppleNotification(data.signedRenewalInfo, bundleAudience);
      if (renewalInfo?.autoRenewStatus !== undefined) {
        autoRenewStatus = renewalInfo.autoRenewStatus;
      }
    }

    if (!latestReceiptInfo && transactionInfo) {
      latestReceiptInfo = convertTransactionToLegacyShape(transactionInfo);
    }
  }

  if (!notificationType) {
    throw new Error("Apple notification missing type");
  }

  return { notificationType, latestReceiptInfo, autoRenewStatus };
}

async function verifyAppleNotification(token: string, audience: string | string[]) {
  const normalizedAudience = (Array.isArray(audience) ? audience : [audience]).filter(
    (value): value is string => Boolean(value),
  );

  if (normalizedAudience.length === 0) {
    throw new Error("Missing Apple webhook audience configuration");
  }

  const { payload } = await jwtVerify(token, appleWebhookJWKS, {
    issuer: "appstoreconnect-v1",
    audience: normalizedAudience,
  });
  return payload as AppleJWSPayload;
}

function convertTransactionToLegacyShape(transactionInfo: AppleJWSPayload) {
  return {
    original_transaction_id: transactionInfo.originalTransactionId ?? transactionInfo.transactionId,
    product_id: transactionInfo.productId,
    expires_date_ms: normalizeMillis(transactionInfo.expiresDate ?? transactionInfo.expiresDateMs),
    purchase_date_ms: normalizeMillis(transactionInfo.purchaseDate ?? transactionInfo.purchaseDateMs),
    cancellation_date_ms: normalizeMillis(transactionInfo.revocationDate ?? transactionInfo.revocationDateMs),
  };
}

function normalizeMillis(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "number") {
    return value.toString();
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

function normalizeAutoRenewStatus(value: unknown) {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "on";
}

async function handleRenewalStatusChange(
  supabase: any,
  userId: string,
  willRenew: boolean,
  expiresDateMs: string
) {
  const expiresDate = new Date(parseInt(expiresDateMs));

  await supabase.from("subscriptions").update({
    status: willRenew ? "active" : "cancelled",
    cancel_at: willRenew ? null : expiresDate.toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  console.log(`Renewal status changed for user ${userId}: ${willRenew ? "enabled" : "disabled"}`);
}

async function handlePlanChange(
  supabase: any,
  userId: string,
  newPlan: string,
  expiresDateMs: string
) {
  const expiresDate = new Date(parseInt(expiresDateMs));

  await supabase.from("subscriptions").update({
    plan: newPlan,
    current_period_end: expiresDate.toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  console.log(`Plan changed for user ${userId} to ${newPlan}`);
}

async function handleBillingIssue(
  supabase: any,
  userId: string,
  expiresDateMs: string
) {
  const expiresDate = new Date(parseInt(expiresDateMs));

  await supabase.from("subscriptions").update({
    status: "past_due",
    current_period_end: expiresDate.toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  // Keep premium active for grace period
  await supabase.from("profiles").update({
    subscription_status: "past_due",
    updated_at: new Date().toISOString(),
  }).eq("id", userId);

  console.log(`Billing issue for user ${userId}`);
}

async function handleCancellation(
  supabase: any,
  userId: string,
  cancellationDateMs: string,
  expiresDateMs: string
) {
  const cancellationDate = new Date(parseInt(cancellationDateMs));
  const expiresDate = new Date(parseInt(expiresDateMs));

  await supabase.from("subscriptions").update({
    status: "cancelled",
    cancelled_at: cancellationDate.toISOString(),
    cancel_at: expiresDate.toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  // Keep premium until expiration date
  const isStillActive = expiresDate > new Date();
  
  await supabase.from("profiles").update({
    is_premium: isStillActive,
    subscription_status: "cancelled",
    subscription_expires_at: expiresDate.toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", userId);

  console.log(`Subscription cancelled for user ${userId}, expires ${expiresDate.toISOString()}`);
}

async function handleRefund(
  supabase: any,
  userId: string,
  transactionId: string
) {
  // Immediately revoke access
  await supabase.from("subscriptions").update({
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  await supabase.from("profiles").update({
    is_premium: false,
    subscription_status: "cancelled",
    updated_at: new Date().toISOString(),
  }).eq("id", userId);

  // Mark payment as refunded
  await supabase.from("payment_history").update({
    status: "refunded",
  }).eq("stripe_payment_intent_id", transactionId);

  console.log(`Refund processed for user ${userId}`);
}

async function createReferralPayout(
  supabase: any,
  userId: string,
  transactionId: string,
  plan: string
) {
  // Check if user was referred by someone using referral code
  const { data: profile } = await supabase
    .from("profiles")
    .select("referred_by_code")
    .eq("id", userId)
    .single();

  if (!profile?.referred_by_code) {
    console.log(`User ${userId} was not referred, no payout created`);
    return;
  }

  const referralCode = profile.referred_by_code;

  // Find the referral_code record
  const { data: codeData } = await supabase
    .from("referral_codes")
    .select("id, owner_type")
    .eq("code", referralCode)
    .single();

  if (!codeData) {
    console.error(`Referral code ${referralCode} not found`);
    return;
  }

  // Calculate payout amount based on plan
  const payoutAmount = plan === "yearly" ? 20.00 : 5.00; // 20% of $99.99 or 50% of $9.99
  const payoutType = plan === "yearly" ? "first_year" : "first_month";

  // Check if payout already exists to avoid duplicates
  const { data: existingPayout } = await supabase
    .from("referral_payouts")
    .select("id")
    .eq("referral_code_id", codeData.id)
    .eq("referee_id", userId)
    .eq("payout_type", payoutType)
    .single();

  if (existingPayout) {
    console.log(`Payout already exists for code ${referralCode}, referee ${userId}`);
    return;
  }

  // Create pending payout
  const { error } = await supabase
    .from("referral_payouts")
    .insert({
      referral_code_id: codeData.id,
      referee_id: userId,
      amount: payoutAmount,
      status: "pending",
      payout_type: payoutType,
      apple_transaction_id: transactionId,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error(`Failed to create payout for code ${referralCode}:`, error);
  } else {
    console.log(`Created ${payoutType} payout of $${payoutAmount} for code ${referralCode} (${codeData.owner_type})`);
  }
}
