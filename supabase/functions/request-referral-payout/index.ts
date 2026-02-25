import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyCreatorAccessToken } from "../_shared/influencerAuth.ts";

/**
 * Request Referral Payout
 * 
 * Influencer-triggered function to request payout of their referral earnings.
 * Works with referral_code_id (for influencers) or referrer_id (for users).
 * Validates that the minimum threshold ($50) is reached before submitting.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MINIMUM_PAYOUT_THRESHOLD = 50; // $50 minimum

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Parse request body (optional - can include referral_code for influencers)
    let referralCode: string | null = null;
    let creatorAccessToken: string | null = null;
    try {
      const body = await req.json();
      referralCode = body?.referral_code ? String(body.referral_code).trim().toUpperCase() : null;
      creatorAccessToken = body?.creator_access_token ? String(body.creator_access_token) : null;
    } catch {
      // No body or invalid JSON - that's fine
    }

    // If referral_code is provided, this is an influencer request and requires
    // a signed creator token proving ownership of the dashboard session.
    if (referralCode) {
      if (!creatorAccessToken) {
        return new Response(JSON.stringify({
          error: "Missing creator_access_token",
          code: "MISSING_CREATOR_TOKEN",
        }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return await handleInfluencerRequest(supabaseClient, referralCode, creatorAccessToken);
    }

    // Otherwise, require user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized - provide referral_code or auth token" }), {
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

    return await handleUserRequest(supabaseClient, user.id);
  } catch (error) {
    console.error("Error processing payout request:", error);
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

// Handle influencer payout request (using referral code)
// deno-lint-ignore no-explicit-any
async function handleInfluencerRequest(
  supabaseClient: any,
  referralCode: string,
  creatorAccessToken: string,
) {
  console.log(`Processing influencer payout request for code: ${referralCode}`);

  // Get the referral code details
  const { data: codeData, error: codeError } = await supabaseClient
    .from("referral_codes")
    .select("id, code, payout_identifier, influencer_email, owner_type")
    .eq("code", referralCode.toUpperCase())
    .eq("owner_type", "influencer")
    .single();

  if (codeError || !codeData) {
    console.error("Invalid referral code:", codeError);
    return new Response(JSON.stringify({ 
      error: "Invalid or non-influencer referral code",
      code: "INVALID_CODE"
    }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tokenCheck = await verifyCreatorAccessToken(codeData.code, creatorAccessToken);
  if (!tokenCheck.valid) {
    console.warn(`Creator token verification failed for code ${referralCode}: ${tokenCheck.reason}`);
    return new Response(JSON.stringify({
      error: "Unauthorized creator session",
      code: "INVALID_CREATOR_TOKEN",
    }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const paypalEmail = codeData.payout_identifier || codeData.influencer_email;
  if (!paypalEmail) {
    return new Response(JSON.stringify({ 
      error: "No PayPal email configured for this referral code",
      code: "NO_PAYPAL_EMAIL"
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get pending payouts for this referral code
  const { data: pendingPayouts, error: payoutsError } = await supabaseClient
    .from("referral_payouts")
    .select("id, amount, status")
    .eq("referral_code_id", codeData.id)
    .eq("status", "pending");

  if (payoutsError) {
    console.error("Error fetching payouts:", payoutsError);
    return new Response(JSON.stringify({ error: "Failed to fetch payouts" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!pendingPayouts || pendingPayouts.length === 0) {
    return new Response(JSON.stringify({ 
      error: "No pending payouts to request",
      code: "NO_PENDING_PAYOUTS"
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Calculate total pending amount
  const totalPending = pendingPayouts.reduce((sum: number, p: { amount: number }) => sum + Number(p.amount), 0);

  // Check minimum threshold
  if (totalPending < MINIMUM_PAYOUT_THRESHOLD) {
    return new Response(JSON.stringify({ 
      error: `Minimum payout threshold is $${MINIMUM_PAYOUT_THRESHOLD}. Your current pending balance is $${totalPending.toFixed(2)}.`,
      code: "BELOW_THRESHOLD",
      current_balance: totalPending,
      minimum_threshold: MINIMUM_PAYOUT_THRESHOLD,
      amount_needed: MINIMUM_PAYOUT_THRESHOLD - totalPending
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Mark all pending payouts as "requested"
  const requestedAt = new Date().toISOString();
  const { error: updateError } = await supabaseClient
    .from("referral_payouts")
    .update({ 
      status: "requested",
      admin_notes: `Payout requested by influencer on ${requestedAt}` 
    })
    .eq("referral_code_id", codeData.id)
    .eq("status", "pending");

  if (updateError) {
    console.error("Error updating payouts:", updateError);
    return new Response(JSON.stringify({ error: "Failed to submit payout request" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`Influencer ${referralCode} requested payout of $${totalPending.toFixed(2)}`);

  return new Response(
    JSON.stringify({
      success: true,
      message: `Payout request submitted! Your $${totalPending.toFixed(2)} will be reviewed by our team.`,
      total_requested: totalPending,
      paypal_email: paypalEmail,
      payout_count: pendingPayouts.length,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// Handle authenticated user payout request (using referrer_id)
// deno-lint-ignore no-explicit-any
async function handleUserRequest(supabaseClient: any, userId: string) {
  console.log(`Processing user payout request for user: ${userId}`);

  // Get user's profile with PayPal email
  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("paypal_email, email")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return new Response(JSON.stringify({ error: "Profile not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const paypalEmail = profile.paypal_email || profile.email;
  if (!paypalEmail) {
    return new Response(JSON.stringify({ 
      error: "Please set your PayPal email before requesting a payout",
      code: "NO_PAYPAL_EMAIL"
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get user's pending payouts
  const { data: pendingPayouts, error: payoutsError } = await supabaseClient
    .from("referral_payouts")
    .select("id, amount, status")
    .eq("referrer_id", userId)
    .eq("status", "pending");

  if (payoutsError) {
    console.error("Error fetching payouts:", payoutsError);
    return new Response(JSON.stringify({ error: "Failed to fetch payouts" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!pendingPayouts || pendingPayouts.length === 0) {
    return new Response(JSON.stringify({ 
      error: "No pending payouts to request",
      code: "NO_PENDING_PAYOUTS"
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Calculate total pending amount
  const totalPending = pendingPayouts.reduce((sum: number, p: { amount: number }) => sum + Number(p.amount), 0);

  // Check minimum threshold
  if (totalPending < MINIMUM_PAYOUT_THRESHOLD) {
    return new Response(JSON.stringify({ 
      error: `Minimum payout threshold is $${MINIMUM_PAYOUT_THRESHOLD}. Your current pending balance is $${totalPending.toFixed(2)}.`,
      code: "BELOW_THRESHOLD",
      current_balance: totalPending,
      minimum_threshold: MINIMUM_PAYOUT_THRESHOLD,
      amount_needed: MINIMUM_PAYOUT_THRESHOLD - totalPending
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Mark all pending payouts as "requested"
  const requestedAt = new Date().toISOString();
  const { error: updateError } = await supabaseClient
    .from("referral_payouts")
    .update({ 
      status: "requested",
      admin_notes: `Payout requested by user on ${requestedAt}` 
    })
    .eq("referrer_id", userId)
    .eq("status", "pending");

  if (updateError) {
    console.error("Error updating payouts:", updateError);
    return new Response(JSON.stringify({ error: "Failed to submit payout request" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`User ${userId} requested payout of $${totalPending.toFixed(2)}`);

  return new Response(
    JSON.stringify({
      success: true,
      message: `Payout request submitted! Your $${totalPending.toFixed(2)} will be reviewed by our team.`,
      total_requested: totalPending,
      paypal_email: paypalEmail,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
