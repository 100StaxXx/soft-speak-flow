import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * PayPal Webhook
 * 
 * Receives PayPal payout status notifications and updates referral_payouts accordingly.
 * Handles events: PAYMENT.PAYOUTSBATCH.SUCCESS, PAYMENT.PAYOUTSBATCH.DENIED, 
 * PAYMENT.PAYOUTS-ITEM.SUCCEEDED, PAYMENT.PAYOUTS-ITEM.FAILED, etc.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, paypal-transmission-id, paypal-transmission-time, paypal-transmission-sig, paypal-cert-url, paypal-auth-algo",
};

// PayPal event types we care about
const PAYOUT_EVENTS = {
  BATCH_SUCCESS: "PAYMENT.PAYOUTSBATCH.SUCCESS",
  BATCH_DENIED: "PAYMENT.PAYOUTSBATCH.DENIED",
  ITEM_SUCCEEDED: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
  ITEM_FAILED: "PAYMENT.PAYOUTS-ITEM.FAILED",
  ITEM_BLOCKED: "PAYMENT.PAYOUTS-ITEM.BLOCKED",
  ITEM_CANCELED: "PAYMENT.PAYOUTS-ITEM.CANCELED",
  ITEM_UNCLAIMED: "PAYMENT.PAYOUTS-ITEM.UNCLAIMED",
  ITEM_RETURNED: "PAYMENT.PAYOUTS-ITEM.RETURNED",
};
const WEBHOOK_PROVIDER = "paypal";

/**
 * Verify PayPal webhook signature using PayPal's verification API
 * This is the recommended approach as it handles certificate validation automatically
 */
async function verifyPayPalWebhook(
  req: Request,
  rawBody: string,
  webhookId: string
): Promise<boolean> {
  const transmissionId = req.headers.get("paypal-transmission-id");
  const transmissionTime = req.headers.get("paypal-transmission-time");
  const transmissionSig = req.headers.get("paypal-transmission-sig");
  const certUrl = req.headers.get("paypal-cert-url");
  const authAlgo = req.headers.get("paypal-auth-algo");

  // All headers are required for verification
  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    console.error("Missing required PayPal webhook headers");
    return false;
  }

  // Validate cert URL is from PayPal's domain
  try {
    const certUrlParsed = new URL(certUrl);
    if (!certUrlParsed.hostname.endsWith("paypal.com")) {
      console.error("Invalid certificate URL domain:", certUrlParsed.hostname);
      return false;
    }
  } catch {
    console.error("Invalid certificate URL format");
    return false;
  }

  // Get PayPal API credentials
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_SECRET");
  const environment = Deno.env.get("PAYPAL_ENVIRONMENT") || "sandbox";

  if (!clientId || !clientSecret) {
    console.error("PayPal API credentials not configured");
    return false;
  }

  const baseUrl = environment === "production" 
    ? "https://api-m.paypal.com" 
    : "https://api-m.sandbox.paypal.com";

  try {
    // Get access token
    const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!authResponse.ok) {
      console.error("Failed to get PayPal access token:", await authResponse.text());
      return false;
    }

    const { access_token } = await authResponse.json();

    // Verify webhook signature using PayPal's API
    const verifyResponse = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: JSON.parse(rawBody),
      }),
    });

    if (!verifyResponse.ok) {
      console.error("PayPal verification API error:", await verifyResponse.text());
      return false;
    }

    const verifyResult = await verifyResponse.json();
    const isValid = verifyResult.verification_status === "SUCCESS";
    
    if (!isValid) {
      console.error("PayPal webhook signature verification failed:", verifyResult.verification_status);
    }

    return isValid;
  } catch (error) {
    console.error("Error verifying PayPal webhook:", error);
    return false;
  }
}

async function registerWebhookEvent(
  // deno-lint-ignore no-explicit-any
  supabaseClient: any,
  eventId: string,
  eventType: string,
  // deno-lint-ignore no-explicit-any
  webhookEvent: any,
): Promise<{ duplicate: boolean; error: boolean }> {
  const { error } = await supabaseClient
    .from("payment_webhook_events")
    .insert({
      provider: WEBHOOK_PROVIDER,
      event_id: eventId,
      event_type: eventType,
      payload: webhookEvent,
      received_at: new Date().toISOString(),
    });

  if (!error) {
    return { duplicate: false, error: false };
  }

  if (error.code === "23505") {
    return { duplicate: true, error: false };
  }

  console.error("Failed to register webhook event:", error);
  return { duplicate: false, error: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get webhook ID for verification
    const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID");
    
    // Clone request to read body twice (once for verification, once for parsing)
    const rawBody = await req.text();
    
    // Verify webhook signature (required in production)
    if (webhookId) {
      const isValid = await verifyPayPalWebhook(req, rawBody, webhookId);
      
      if (!isValid) {
        console.error("PayPal webhook signature verification failed - rejecting request");
        return new Response(
          JSON.stringify({ error: "Invalid webhook signature" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      console.log("PayPal webhook signature verified successfully");
    } else {
      // Log warning but allow in development/testing
      console.warn("PAYPAL_WEBHOOK_ID not configured - webhook signature verification skipped. Configure this secret for production!");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Parse webhook payload
    const webhookEvent = JSON.parse(rawBody);
    const eventType = webhookEvent.event_type;
    const resource = webhookEvent.resource;
    const eventId = webhookEvent.id; // For idempotency

    console.log(`Received PayPal webhook: ${eventType} (event_id: ${eventId})`);

    // Validate required event structure
    if (!eventType || !resource) {
      console.error("Invalid webhook payload: missing event_type or resource");
      return new Response(
        JSON.stringify({ error: "Invalid payload structure" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!eventId) {
      return new Response(
        JSON.stringify({ error: "Missing webhook event id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const eventRegistration = await registerWebhookEvent(
      supabaseClient,
      eventId,
      eventType,
      webhookEvent,
    );

    if (eventRegistration.error) {
      // Return 500 so PayPal retries later rather than silently dropping events.
      return new Response(
        JSON.stringify({ error: "Failed to register webhook event" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (eventRegistration.duplicate) {
      console.log(`Skipping duplicate PayPal webhook event: ${eventId}`);
      return new Response(
        JSON.stringify({
          received: true,
          duplicate: true,
          event_type: eventType,
          event_id: eventId,
          verified: !!webhookId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Handle batch-level events
    if (eventType === PAYOUT_EVENTS.BATCH_SUCCESS || eventType === PAYOUT_EVENTS.BATCH_DENIED) {
      const batchId = resource.batch_header?.payout_batch_id;
      const batchStatus = resource.batch_header?.batch_status;
      
      console.log(`Batch ${batchId} status: ${batchStatus}`);

      if (batchId) {
        // Update all payouts with this batch ID
        const newStatus = eventType === PAYOUT_EVENTS.BATCH_SUCCESS ? "paid" : "failed";
        
        const { error } = await supabaseClient
          .from("referral_payouts")
          .update({
            status: newStatus,
            paid_at: newStatus === "paid" ? new Date().toISOString() : null,
            admin_notes: `PayPal batch ${batchStatus}: ${eventType}`,
          })
          .eq("paypal_transaction_id", batchId);

        if (error) {
          console.error("Failed to update payout status:", error);
        } else {
          console.log(`Updated payouts for batch ${batchId} to ${newStatus}`);
        }
      }
    }

    // Handle item-level events (individual payout items)
    if (Object.values(PAYOUT_EVENTS).includes(eventType) && eventType !== PAYOUT_EVENTS.BATCH_SUCCESS && eventType !== PAYOUT_EVENTS.BATCH_DENIED) {
      const payoutItemId = resource.payout_item_id;
      const senderItemId = resource.payout_item?.sender_item_id; // This is our payout.id
      const transactionStatus = resource.transaction_status;
      const payoutBatchId = resource.payout_batch_id;

      console.log(`Payout item ${payoutItemId} (${senderItemId}) status: ${transactionStatus}`);

      if (senderItemId) {
        let newStatus = "processing";
        
        switch (eventType) {
          case PAYOUT_EVENTS.ITEM_SUCCEEDED:
            newStatus = "paid";
            break;
          case PAYOUT_EVENTS.ITEM_FAILED:
          case PAYOUT_EVENTS.ITEM_BLOCKED:
            newStatus = "failed";
            break;
          case PAYOUT_EVENTS.ITEM_CANCELED:
          case PAYOUT_EVENTS.ITEM_RETURNED:
            newStatus = "cancelled";
            break;
          case PAYOUT_EVENTS.ITEM_UNCLAIMED:
            newStatus = "unclaimed";
            break;
        }

        const { error } = await supabaseClient
          .from("referral_payouts")
          .update({
            status: newStatus,
            paid_at: newStatus === "paid" ? new Date().toISOString() : null,
            paypal_payer_id: payoutItemId,
            admin_notes: `PayPal item ${transactionStatus}: ${eventType}`,
          })
          .eq("id", senderItemId);

        if (error) {
          console.error("Failed to update payout item status:", error);
        } else {
          console.log(`Updated payout ${senderItemId} to ${newStatus}`);
        }
      }
    }

    await supabaseClient
      .from("payment_webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("provider", WEBHOOK_PROVIDER)
      .eq("event_id", eventId);

    // Return 200 to acknowledge receipt
    return new Response(
      JSON.stringify({ 
        received: true, 
        event_type: eventType,
        verified: !!webhookId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing PayPal webhook:", error);
    // Return 200 anyway to prevent PayPal from retrying
    // Log the error for investigation
    return new Response(
      JSON.stringify({ 
        received: true, 
        error: "Internal processing error",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
