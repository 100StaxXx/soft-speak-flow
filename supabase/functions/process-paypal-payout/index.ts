import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * Process PayPal Payout
 * 
 * Admin-triggered function to send approved referral payouts via PayPal.
 * Requires admin authentication and payout approval before processing.
 * 
 * Request body:
 * {
 *   payout_id: string - The referral_payouts.id to process
 * }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Fetch payout details
    const { data: payout, error: payoutError } = await supabaseClient
      .from("referral_payouts")
      .select(`
        *,
        referrer:profiles!referrer_id(paypal_email, email)
      `)
      .eq("id", payout_id)
      .single();

    if (payoutError || !payout) {
      return new Response(JSON.stringify({ error: "Payout not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify payout is approved
    if (payout.status !== "approved") {
      return new Response(JSON.stringify({ error: "Payout must be approved before processing" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify referrer has PayPal email
    const paypalEmail = payout.referrer.paypal_email || payout.referrer.email;
    if (!paypalEmail) {
      return new Response(JSON.stringify({ error: "Referrer has no PayPal email configured" }), {
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
    const tokenResponse = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
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
        sender_batch_id: `ref_payout_${payout.id}`,
        email_subject: "You've received a referral reward from Cosmiq!",
        email_message: "Thank you for referring friends to Cosmiq. Here's your reward!",
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: {
            value: payout.amount.toFixed(2),
            currency: "USD",
          },
          receiver: paypalEmail,
          note: `Cosmiq Referral Reward - ${payout.payout_type}`,
          sender_item_id: payout.id,
        },
      ],
    };

    const payoutResponse = await fetch("https://api-m.paypal.com/v1/payments/payouts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payoutBatch),
    });

    if (!payoutResponse.ok) {
      const errorText = await payoutResponse.text();
      console.error("PayPal payout failed:", errorText);
      return new Response(JSON.stringify({ error: "PayPal payout failed", details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payoutResult = await payoutResponse.json();
    const payoutBatchId = payoutResult.batch_header.payout_batch_id;
    const payoutItemId = payoutResult.items?.[0]?.payout_item_id;

    // Update payout status
    await supabaseClient
      .from("referral_payouts")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        paypal_transaction_id: payoutBatchId,
        paypal_payer_id: payoutItemId,
      })
      .eq("id", payout_id);

    console.log(`Successfully processed payout ${payout_id} to ${paypalEmail}`);

    return new Response(
      JSON.stringify({
        success: true,
        payout_batch_id: payoutBatchId,
        amount: payout.amount,
        recipient: paypalEmail,
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