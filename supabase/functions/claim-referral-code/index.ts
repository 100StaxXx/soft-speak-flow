import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuthenticatedUser } from "../_shared/auth.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import {
  normalizeReferralCode,
  syncAppleOfferCodeForReferralCode,
} from "../_shared/referralState.ts";

const GENESIS_SPECIAL_CODE = "GENESIS";
const DEFAULT_GENESIS_OFFER_IDENTIFIER = "GENESIS";

const getGenesisOfferIdentifier = () =>
  Deno.env.get("APPLE_GENESIS_OFFER_CODE_IDENTIFIER")?.trim() ||
  DEFAULT_GENESIS_OFFER_IDENTIFIER;

async function claimGenesisSpecialCode(
  supabase: any,
  userId: string,
  profile: { referral_code?: string | null; email?: string | null },
) {
  const now = new Date().toISOString();
  const genesisOfferIdentifier = getGenesisOfferIdentifier();

  const { data: existingCode, error: lookupError } = await supabase
    .from("referral_codes")
    .select("id, total_signups")
    .eq("code", GENESIS_SPECIAL_CODE)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existingCode?.id) {
    const { error: updateCodeError } = await supabase
      .from("referral_codes")
      .update({
        owner_type: "influencer",
        is_active: true,
        affiliate_provider: null,
        payout_method: null,
        apple_offer_code_id: null,
        apple_offer_code_status: "active",
        apple_offer_campaign_identifier: genesisOfferIdentifier,
        apple_offer_code_last_error: null,
        apple_offer_code_synced_at: now,
        total_signups: Number(existingCode.total_signups ?? 0) + 1,
      })
      .eq("id", existingCode.id);

    if (updateCodeError) {
      throw updateCodeError;
    }
  } else {
    const { error: insertCodeError } = await supabase
      .from("referral_codes")
      .insert({
        code: GENESIS_SPECIAL_CODE,
        owner_type: "influencer",
        is_active: true,
        affiliate_provider: null,
        payout_method: null,
        apple_offer_code_id: null,
        apple_offer_code_status: "active",
        apple_offer_campaign_identifier: genesisOfferIdentifier,
        apple_offer_code_last_error: null,
        apple_offer_code_synced_at: now,
        total_signups: 1,
      });

    if (insertCodeError) {
      throw insertCodeError;
    }
  }

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update({ referred_by_code: GENESIS_SPECIAL_CODE })
    .eq("id", userId);

  if (profileUpdateError) {
    throw profileUpdateError;
  }

  return {
    success: true,
    message: "Genesis code applied! Your yearly plan is now eligible for the $49.99 Apple offer.",
    user: {
      app_user_id: userId,
      referral_code: profile.referral_code ?? null,
      referred_by: { code: GENESIS_SPECIAL_CODE, type: "special" },
      is_premium: false,
      stats: null,
    },
    rewards_granted: null,
    code_type: "special",
    offer: {
      identifier: genesisOfferIdentifier,
      yearly_price_cents: 4999,
    },
  };
}

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
    const claimedCode = normalizeReferralCode(typeof body?.code === "string" ? body.code : null);

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
      .select("id, email, created_at, referral_code, referred_by_code")
      .eq("id", userAuth.userId)
      .single();

    if (profileError) {
      throw profileError;
    }

    if (normalizeReferralCode(profile.referred_by_code)) {
      return new Response(JSON.stringify({
        success: false,
        message: "You have already used a referral code",
      }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (claimedCode === GENESIS_SPECIAL_CODE) {
      const result = await claimGenesisSpecialCode(supabase, userAuth.userId, profile);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: codeData, error: codeLookupError } = await supabase
      .from("referral_codes")
      .select("id, code, owner_type, owner_user_id, is_active, total_signups, apple_offer_code_id, apple_offer_campaign_identifier")
      .eq("code", claimedCode)
      .maybeSingle();

    if (codeLookupError) {
      throw codeLookupError;
    }

    if (!codeData?.id || codeData.is_active === false) {
      return new Response(JSON.stringify({
        success: false,
        message: "Invalid referral code",
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (codeData.owner_type === "user" && codeData.owner_user_id === userAuth.userId) {
      return new Response(JSON.stringify({
        success: false,
        message: "Cannot use your own referral code",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const codeType = codeData.owner_type === "influencer" ? "affiliate" : "referral";

    if (codeType === "affiliate") {
      await syncAppleOfferCodeForReferralCode(supabase, {
        id: codeData.id,
        code: claimedCode,
        apple_offer_code_id: codeData.apple_offer_code_id ?? null,
        apple_offer_campaign_identifier: codeData.apple_offer_campaign_identifier ?? null,
      });
    }

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        referred_by_code: claimedCode,
        referred_by: codeData.owner_user_id ?? null,
      })
      .eq("id", userAuth.userId);

    if (profileUpdateError) {
      throw profileUpdateError;
    }

    const { error: signupUpdateError } = await supabase
      .from("referral_codes")
      .update({
        total_signups: Number(codeData.total_signups ?? 0) + 1,
      })
      .eq("id", codeData.id);

    if (signupUpdateError) {
      throw signupUpdateError;
    }

    if (codeData.owner_user_id) {
      const { data: ownerProfile, error: ownerProfileLookupError } = await supabase
        .from("profiles")
        .select("referral_count")
        .eq("id", codeData.owner_user_id)
        .maybeSingle();

      if (ownerProfileLookupError) {
        throw ownerProfileLookupError;
      }

      const { error: ownerProfileUpdateError } = await supabase
        .from("profiles")
        .update({
          referral_count: Number(ownerProfile?.referral_count ?? 0) + 1,
        })
        .eq("id", codeData.owner_user_id);

      if (ownerProfileUpdateError) {
        throw ownerProfileUpdateError;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: codeType === "affiliate"
        ? "Creator code applied! Your yearly plan is now eligible for the Apple discount flow."
        : "Referral code applied! Your friend will earn rewards when you reach Stage 5 • Initiate.",
      user: {
        app_user_id: userAuth.userId,
        referral_code: profile.referral_code ?? null,
        referred_by: { code: claimedCode, type: codeType },
        is_premium: false,
        stats: null,
      },
      rewards_granted: null,
      code_type: codeType,
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
