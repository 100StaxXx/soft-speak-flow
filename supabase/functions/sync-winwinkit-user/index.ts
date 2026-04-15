import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuthenticatedUser } from "../_shared/auth.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { syncWinWinKitUserToLocalState } from "../_shared/referralState.ts";
import { createOrUpdateWinWinKitUser } from "../_shared/winwinkit.ts";

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
    const explicitFirstSeenAt = typeof body?.first_seen_at === "string" ? body.first_seen_at : null;
    const explicitIsPremium = typeof body?.is_premium === "boolean" ? body.is_premium : null;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, created_at")
      .eq("id", userAuth.userId)
      .single();

    if (profileError) {
      throw profileError;
    }

    const winWinKitUser = await createOrUpdateWinWinKitUser({
      appUserId: userAuth.userId,
      firstSeenAt: explicitFirstSeenAt ?? profile.created_at ?? new Date().toISOString(),
      isPremium: explicitIsPremium ?? undefined,
      metadata: profile.email
        ? { email: profile.email }
        : undefined,
    });

    await syncWinWinKitUserToLocalState(
      supabase,
      userAuth.userId,
      winWinKitUser,
    );

    return new Response(JSON.stringify({
      success: true,
      user: {
        app_user_id: winWinKitUser.app_user_id,
        referral_code: winWinKitUser.referral_code,
        referred_by: winWinKitUser.referred_by ?? null,
        is_premium: winWinKitUser.is_premium,
        stats: winWinKitUser.stats ?? null,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("sync-winwinkit-user error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Failed to sync WinWinKit user",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
