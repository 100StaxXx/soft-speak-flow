import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuthenticatedUser } from "../_shared/auth.ts";
import { verifyCreatorAccessToken } from "../_shared/influencerAuth.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const MINIMUM_PAYOUT_THRESHOLD = 50;

function jsonResponse(
  corsHeaders: HeadersInit,
  status: number,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleRequestReferralPayout(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let referralCode: string | null = null;
    let creatorAccessToken: string | null = null;

    try {
      const body = await req.json();
      referralCode = body?.referral_code ? String(body.referral_code).trim().toUpperCase() : null;
      creatorAccessToken = body?.creator_access_token ? String(body.creator_access_token).trim() : null;
    } catch {
      referralCode = null;
      creatorAccessToken = null;
    }

    if (referralCode) {
      if (!creatorAccessToken) {
        return jsonResponse(corsHeaders, 401, {
          error: "Missing creator_access_token",
          code: "MISSING_CREATOR_TOKEN",
        });
      }

      return await handleInfluencerRequest(
        supabaseClient,
        referralCode,
        creatorAccessToken,
        corsHeaders,
      );
    }

    const userAuth = await requireAuthenticatedUser(req, corsHeaders);
    if (userAuth instanceof Response) {
      return userAuth;
    }

    return await handleUserRequest(supabaseClient, userAuth.userId, corsHeaders);
  } catch (error) {
    console.error("Error processing payout request:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse(corsHeaders, 500, { error: errorMessage, code: "INTERNAL_ERROR" });
  }
}

async function handleInfluencerRequest(
  supabaseClient: any,
  referralCode: string,
  creatorAccessToken: string,
  corsHeaders: HeadersInit,
): Promise<Response> {
  console.log(`Processing influencer payout request for code: ${referralCode}`);

  const { data: codeData, error: codeError } = await supabaseClient
    .from("referral_codes")
    .select("id, code, payout_identifier, influencer_email, owner_type")
    .eq("code", referralCode.toUpperCase())
    .eq("owner_type", "influencer")
    .single();

  if (codeError || !codeData) {
    console.error("Invalid referral code:", codeError);
    return jsonResponse(corsHeaders, 404, {
      error: "Invalid or non-influencer referral code",
      code: "INVALID_CODE",
    });
  }

  const tokenCheck = await verifyCreatorAccessToken(codeData.code, creatorAccessToken);
  if (!tokenCheck.valid) {
    if (tokenCheck.reason?.includes("INFLUENCER_DASHBOARD_SECRET")) {
      console.error("Creator dashboard secret is not configured");
      return jsonResponse(corsHeaders, 500, {
        error: "Creator dashboard is temporarily unavailable",
        code: "CREATOR_DASHBOARD_UNAVAILABLE",
      });
    }

    console.warn(`Creator token verification failed for code ${referralCode}: ${tokenCheck.reason}`);
    return jsonResponse(corsHeaders, 401, {
      error: "Unauthorized creator session",
      code: "INVALID_CREATOR_TOKEN",
    });
  }

  const paypalEmail = codeData.payout_identifier || codeData.influencer_email;
  if (!paypalEmail) {
    return jsonResponse(corsHeaders, 400, {
      error: "No PayPal email configured for this referral code",
      code: "NO_PAYPAL_EMAIL",
    });
  }

  const { data: pendingPayouts, error: payoutsError } = await supabaseClient
    .from("referral_payouts")
    .select("id, amount, status")
    .eq("referral_code_id", codeData.id)
    .eq("status", "pending");

  if (payoutsError) {
    console.error("Error fetching payouts:", payoutsError);
    return jsonResponse(corsHeaders, 500, {
      error: "Failed to fetch payouts",
      code: "PAYOUT_LOOKUP_FAILED",
    });
  }

  if (!pendingPayouts || pendingPayouts.length === 0) {
    return jsonResponse(corsHeaders, 400, {
      error: "No pending payouts to request",
      code: "NO_PENDING_PAYOUTS",
    });
  }

  const totalPending = pendingPayouts.reduce((sum: number, payout: { amount: number }) => {
    return sum + Number(payout.amount);
  }, 0);

  if (totalPending < MINIMUM_PAYOUT_THRESHOLD) {
    return jsonResponse(corsHeaders, 400, {
      error: `Minimum payout threshold is $${MINIMUM_PAYOUT_THRESHOLD}. Your current pending balance is $${totalPending.toFixed(2)}.`,
      code: "BELOW_THRESHOLD",
      current_balance: totalPending,
      minimum_threshold: MINIMUM_PAYOUT_THRESHOLD,
      amount_needed: MINIMUM_PAYOUT_THRESHOLD - totalPending,
    });
  }

  const requestedAt = new Date().toISOString();
  const { error: updateError } = await supabaseClient
    .from("referral_payouts")
    .update({
      status: "requested",
      admin_notes: `Payout requested by influencer on ${requestedAt}`,
    })
    .eq("referral_code_id", codeData.id)
    .eq("status", "pending");

  if (updateError) {
    console.error("Error updating payouts:", updateError);
    return jsonResponse(corsHeaders, 500, {
      error: "Failed to submit payout request",
      code: "PAYOUT_UPDATE_FAILED",
    });
  }

  console.log(`Influencer ${referralCode} requested payout of $${totalPending.toFixed(2)}`);
  return jsonResponse(corsHeaders, 200, {
    success: true,
    message: `Payout request submitted! Your $${totalPending.toFixed(2)} will be reviewed by our team.`,
    total_requested: totalPending,
    paypal_email: paypalEmail,
    payout_count: pendingPayouts.length,
  });
}

async function handleUserRequest(
  supabaseClient: any,
  userId: string,
  corsHeaders: HeadersInit,
): Promise<Response> {
  console.log(`Processing user payout request for user: ${userId}`);

  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("paypal_email, email")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return jsonResponse(corsHeaders, 404, {
      error: "Profile not found",
      code: "PROFILE_NOT_FOUND",
    });
  }

  const paypalEmail = profile.paypal_email || profile.email;
  if (!paypalEmail) {
    return jsonResponse(corsHeaders, 400, {
      error: "Please set your PayPal email before requesting a payout",
      code: "NO_PAYPAL_EMAIL",
    });
  }

  const { data: pendingPayouts, error: payoutsError } = await supabaseClient
    .from("referral_payouts")
    .select("id, amount, status")
    .eq("referrer_id", userId)
    .eq("status", "pending");

  if (payoutsError) {
    console.error("Error fetching payouts:", payoutsError);
    return jsonResponse(corsHeaders, 500, {
      error: "Failed to fetch payouts",
      code: "PAYOUT_LOOKUP_FAILED",
    });
  }

  if (!pendingPayouts || pendingPayouts.length === 0) {
    return jsonResponse(corsHeaders, 400, {
      error: "No pending payouts to request",
      code: "NO_PENDING_PAYOUTS",
    });
  }

  const totalPending = pendingPayouts.reduce((sum: number, payout: { amount: number }) => {
    return sum + Number(payout.amount);
  }, 0);

  if (totalPending < MINIMUM_PAYOUT_THRESHOLD) {
    return jsonResponse(corsHeaders, 400, {
      error: `Minimum payout threshold is $${MINIMUM_PAYOUT_THRESHOLD}. Your current pending balance is $${totalPending.toFixed(2)}.`,
      code: "BELOW_THRESHOLD",
      current_balance: totalPending,
      minimum_threshold: MINIMUM_PAYOUT_THRESHOLD,
      amount_needed: MINIMUM_PAYOUT_THRESHOLD - totalPending,
    });
  }

  const requestedAt = new Date().toISOString();
  const { error: updateError } = await supabaseClient
    .from("referral_payouts")
    .update({
      status: "requested",
      admin_notes: `Payout requested by user on ${requestedAt}`,
    })
    .eq("referrer_id", userId)
    .eq("status", "pending");

  if (updateError) {
    console.error("Error updating payouts:", updateError);
    return jsonResponse(corsHeaders, 500, {
      error: "Failed to submit payout request",
      code: "PAYOUT_UPDATE_FAILED",
    });
  }

  console.log(`User ${userId} requested payout of $${totalPending.toFixed(2)}`);
  return jsonResponse(corsHeaders, 200, {
    success: true,
    message: `Payout request submitted! Your $${totalPending.toFixed(2)} will be reviewed by our team.`,
    total_requested: totalPending,
    paypal_email: paypalEmail,
  });
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve(handleRequestReferralPayout);
}
