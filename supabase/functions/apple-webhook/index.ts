import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for server operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const payload = await req.json();
    
    console.log("Received Apple notification:", {
      type: payload.notification_type,
      timestamp: new Date().toISOString(),
    });

    // Extract notification data
    const notificationType = payload.notification_type as NotificationType;
    const latestReceiptInfo = payload.latest_receipt_info;
    
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
    const { data: subscription } = await supabaseClient
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", originalTransactionId)
      .single();

    if (!subscription) {
      console.log("No subscription found for transaction:", originalTransactionId);
      // This might be a new subscription, return 200 to acknowledge
      return new Response("OK", { 
        status: 200, 
        headers: corsHeaders 
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
      case NotificationType.DID_RENEW:
      case NotificationType.DID_RECOVER:
        // Subscription active or renewed
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
        const willRenew = payload.auto_renew_status === "true";
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
      headers: corsHeaders,
    });

  } catch (error) {
    console.error("Error processing Apple notification:", error);
    
    // Still return 200 to prevent Apple from retrying
    return new Response("OK", {
      status: 200,
      headers: corsHeaders,
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
