import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuthenticatedUser } from "../_shared/auth.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { syncReferralUserToLocalState } from "../_shared/referralState.ts";

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const explicitIsPremium = typeof body?.is_premium === "boolean" ? body.is_premium : false;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, referral_code, referred_by_code, referral_count")
      .eq("id", userAuth.userId)
      .single();

    if (profileError) {
      throw profileError;
    }

    const referralUser = {
      app_user_id: userAuth.userId,
      referral_code: profile.referral_code ?? null,
      referred_by: profile.referred_by_code
        ? { code: profile.referred_by_code, type: "referral" }
        : null,
      is_premium: explicitIsPremium,
      stats: {
        claims: Number(profile.referral_count ?? 0),
      },
    };

    await syncReferralUserToLocalState(
      supabase,
      userAuth.userId,
      referralUser,
    );

    return new Response(JSON.stringify({
      success: true,
      user: referralUser,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("sync-referral-user error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Failed to sync referral user",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
