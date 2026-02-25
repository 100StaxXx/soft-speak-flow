import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * Process PayPal Payout
 * 
 * Admin-triggered function to process approved referral payouts via PayPal.
 * Uses PAYPAL_ENVIRONMENT secret to determine sandbox vs production mode.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get PayPal environment - defaults to sandbox for safety
const getPayPalEnvironment = (): "sandbox" | "production" => {
  const env = Deno.env.get("PAYPAL_ENVIRONMENT") || "sandbox";
  return env.toLowerCase() === "production" ? "production" : "sandbox";
};

const getPayPalApiUrl = (): string => {
  return getPayPalEnvironment() === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
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

    const paypalEnv = getPayPalEnvironment();
    const paypalBaseUrl = getPayPalApiUrl();
    console.log(`Processing payout in ${paypalEnv} mode (${paypalBaseUrl})`);

    // Verify admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const { data: userRole } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!userRole) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { payout_id } = await req.json();

    if (!payout_id) {
      return new Response(JSON.stringify({ error: "Missing payout_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch payout details with referral code info
    const { data: payout, error: payoutError } = await supabaseClient
      .from("referral_payouts")
      .select(`
        *,
        referral_code:referral_codes!referral_code_id(
          code,
          owner_type,
          payout_identifier,
          influencer_email
        )
      `)
      .eq("id", payout_id)
      .single();

    if (payoutError || !payout) {
      return new Response(JSON.stringify({ error: "Payout not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency guard: if payout already has a PayPal batch in-flight or settled,
    // do not submit another payout request.
    if (
      payout.paypal_transaction_id &&
      (payout.status === "processing" || payout.status === "paid")
    ) {
      return new Response(
        JSON.stringify({
          success: true,
          idempotent: true,
          payout_batch_id: payout.paypal_transaction_id,
          batch_status: payout.status === "paid" ? "SUCCESS" : "PENDING",
          amount: payout.amount,
          recipient: payout.referral_code?.payout_identifier || null,
          environment: paypalEnv,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify payout is approved
    if (payout.status !== "approved") {
      return new Response(JSON.stringify({ error: "Payout must be approved before processing" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get PayPal email from referral code
    const paypalEmail = payout.referral_code?.payout_identifier;
    if (!paypalEmail) {
      return new Response(JSON.stringify({ error: "No PayPal email configured for this referral code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get PayPal OAuth token
    const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
    const clientSecret = Deno.env.get("PAYPAL_SECRET");

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: "PayPal credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    const tokenResponse = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResponse.ok) {
      console.error("PayPal auth failed:", await tokenResponse.text());
      return new Response(JSON.stringify({ error: "PayPal authentication failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { access_token } = await tokenResponse.json();

    // Create PayPal payout
    const payoutBatch = {
      sender_batch_header: {
        // Deterministic sender_batch_id prevents accidental duplicate payouts.
        sender_batch_id: `ref_payout_${payout.id}`,
        email_subject: "You've received a referral reward from Cosmiq!",
        email_message: "Thank you for referring friends to Cosmiq. Here's your reward!",
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: {
            value: Number(payout.amount).toFixed(2),
            currency: "USD",
          },
          receiver: paypalEmail,
          note: `Cosmiq Referral Reward - ${payout.payout_type}`,
          sender_item_id: payout.id,
        },
      ],
    };

    console.log("Sending payout request:", JSON.stringify(payoutBatch, null, 2));

    const payoutResponse = await fetch(`${paypalBaseUrl}/v1/payments/payouts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `payout-${payout.id}`,
      },
      body: JSON.stringify(payoutBatch),
    });

    if (!payoutResponse.ok) {
      const errorText = await payoutResponse.text();
      console.error("PayPal payout failed:", errorText);

      if (errorText.includes("DUPLICATE_REQUEST_ID")) {
        console.warn(`Duplicate PayPal request detected for payout ${payout.id}, treating as idempotent`);
        return new Response(
          JSON.stringify({
            success: true,
            idempotent: true,
            payout_batch_id: payout.paypal_transaction_id || null,
            batch_status: "PENDING",
            amount: payout.amount,
            recipient: paypalEmail,
            environment: paypalEnv,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(JSON.stringify({ error: "PayPal payout failed", details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payoutResult = await payoutResponse.json();
    const payoutBatchId = payoutResult.batch_header?.payout_batch_id;
    const batchStatus = payoutResult.batch_header?.batch_status;

    console.log("PayPal payout response:", JSON.stringify(payoutResult, null, 2));

    // Update payout status to "processing" - webhook will confirm final status
    const { error: updateError } = await supabaseClient
      .from("referral_payouts")
      .update({
        status: batchStatus === "SUCCESS" ? "paid" : "processing",
        paid_at: batchStatus === "SUCCESS" ? new Date().toISOString() : null,
        paypal_transaction_id: payoutBatchId,
        admin_notes: `PayPal batch ${payoutBatchId} - Status: ${batchStatus}`,
      })
      .eq("id", payout_id)
      .eq("status", "approved");

    if (updateError) {
      console.error("Failed to persist payout status update:", updateError);
      return new Response(JSON.stringify({ error: "Payout processed but failed to persist state" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Successfully submitted payout ${payout_id} to PayPal (batch: ${payoutBatchId})`);

    return new Response(
      JSON.stringify({
        success: true,
        payout_batch_id: payoutBatchId,
        batch_status: batchStatus,
        amount: payout.amount,
        recipient: paypalEmail,
        environment: paypalEnv,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing payout:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
