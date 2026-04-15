import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuthenticatedUser } from "../_shared/auth.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { finalizeClaimedReferralCode } from "../_shared/referralState.ts";
import {
  claimWinWinKitCode,
  createOrUpdateWinWinKitUser,
  fetchWinWinKitUser,
  normalizeWinWinKitCode,
} from "../_shared/winwinkit.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const userAuth = await requireAuthenticatedUser(req, corsHeaders);
    if (userAuth instanceof Response) {
      return userAuth;
    }

    const body = await req.json().catch(() => ({}));
    const claimedCode = normalizeWinWinKitCode(typeof body?.code === "string" ? body.code : null);
    const providerClaimed = body?.provider_claimed === true;

    if (!claimedCode) {
      return new Response(JSON.stringify({ error: "Referral code is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, created_at, referred_by_code")
      .eq("id", userAuth.userId)
      .single();

    if (profileError) {
      throw profileError;
    }

    if (normalizeWinWinKitCode(profile.referred_by_code)) {
      return new Response(JSON.stringify({
        success: false,
        message: "You have already used a referral code",
      }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await createOrUpdateWinWinKitUser({
      appUserId: userAuth.userId,
      firstSeenAt: profile.created_at ?? new Date().toISOString(),
      metadata: profile.email ? { email: profile.email } : undefined,
    });

    const result = providerClaimed
      ? {
          user: await fetchWinWinKitUser(userAuth.userId),
          rewardsGranted: null,
        }
      : await claimWinWinKitCode({
          appUserId: userAuth.userId,
          code: claimedCode,
        });

    const finalized = await finalizeClaimedReferralCode({
      supabase,
      appUserId: userAuth.userId,
      user: result.user,
      claimedCode,
      providerClaimed,
    });

    return new Response(JSON.stringify({
      success: true,
      message: finalized.codeType === "affiliate"
        ? "Creator code applied! Your yearly plan is now eligible for the Apple discount flow."
        : "Referral code applied! Your friend will earn rewards when you reach Stage 5 • Initiate.",
      user: {
        app_user_id: result.user.app_user_id,
        referral_code: result.user.referral_code,
        referred_by: result.user.referred_by ?? null,
        is_premium: result.user.is_premium,
        stats: result.user.stats ?? null,
      },
      rewards_granted: result.rewardsGranted,
      code_type: finalized.codeType,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("claim-referral-code error:", error);

    const message = error instanceof Error ? error.message : "Failed to apply referral code";
    const status = /already used|does not match|Missing referral code|Missing/.test(message)
      ? 400
      : 500;

    return new Response(JSON.stringify({
      success: false,
      message,
    }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
