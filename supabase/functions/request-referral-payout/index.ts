import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createErrorResponse, logError } from "../_shared/errorHandler.ts";

/**
 * Request Referral Payout
 * 
 * User-triggered function to request payout of their referral earnings.
 * Validates that the user has reached the minimum threshold ($50) before
 * flagging their payouts for admin review.
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

    // Verify user authentication
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

    // Get user's profile with PayPal email
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("paypal_email, email")
      .eq("id", user.id)
      .single();

    if (profileError) {
      logError(profileError, "profiles query");
      if (profileError.code === "42P01") {
        return createErrorResponse(profileError, req, corsHeaders);
      }
    }

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user has a PayPal email set
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
      .eq("referrer_id", user.id)
      .eq("status", "pending");

    if (payoutsError) {
      logError(payoutsError, "referral_payouts query");
      if (payoutsError.code === "42P01") {
        return createErrorResponse(payoutsError, req, corsHeaders);
      }
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
    const totalPending = pendingPayouts.reduce((sum, p) => sum + Number(p.amount), 0);

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

    // Mark all pending payouts as "requested" by updating admin_notes
    // (keeping status as pending so admin can still review and approve)
    const requestedAt = new Date().toISOString();
    const { error: updateError } = await supabaseClient
      .from("referral_payouts")
      .update({ 
        admin_notes: `Payout requested by user on ${requestedAt}` 
      })
      .eq("referrer_id", user.id)
      .eq("status", "pending");

    if (updateError) {
      logError(updateError, "referral_payouts update");
      if (updateError.code === "42P01") {
        return createErrorResponse(updateError, req, corsHeaders);
      }
      console.error("Error updating payouts:", updateError);
      return new Response(JSON.stringify({ error: "Failed to submit payout request" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`User ${user.id} requested payout of $${totalPending.toFixed(2)}`);

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
  } catch (error) {
    logError(error, "request-referral-payout edge function");
    return createErrorResponse(error, req, corsHeaders);
  }
});
