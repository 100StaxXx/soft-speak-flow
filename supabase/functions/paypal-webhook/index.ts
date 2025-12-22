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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Get webhook payload
    const webhookEvent = await req.json();
    const eventType = webhookEvent.event_type;
    const resource = webhookEvent.resource;

    console.log(`Received PayPal webhook: ${eventType}`);
    console.log("Webhook payload:", JSON.stringify(webhookEvent, null, 2));

    // Optional: Verify webhook signature in production
    // For now, we'll process the webhook directly
    // In production, you should verify using PayPal's webhook verification API

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

    // Return 200 to acknowledge receipt
    return new Response(
      JSON.stringify({ 
        received: true, 
        event_type: eventType,
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
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
