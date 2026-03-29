import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireRequestAuth } from "../_shared/auth.ts";

const USER_ATTEMPT_LIMIT = 5;
const IP_ATTEMPT_LIMIT = 15;
const WINDOW_HOURS = 24;

interface PromoRedeemRequest {
  promoCode: string;
}

export interface PromoRedeemResult {
  success: boolean;
  status: string;
  message: string;
  access_expires_at: string | null;
}

export function normalizePromoRedeemRequest(payload: unknown): PromoRedeemRequest | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const promoCode = Reflect.get(payload, "promoCode") ?? Reflect.get(payload, "promo_code");
  if (typeof promoCode !== "string") {
    return null;
  }

  const normalized = promoCode.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  return { promoCode: normalized };
}

export function extractPromoRedemptionClientIp(req: Request): string | null {
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwardedFor = req.headers.get("x-forwarded-for");
  if (!forwardedFor) return null;

  const first = forwardedFor.split(",")[0]?.trim();
  return first || null;
}

async function countRecentAttempts(
  supabaseClient: any,
  userId: string,
  ipAddress: string | null,
) {
  const windowStart = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const [userAttempts, ipAttempts] = await Promise.all([
    supabaseClient
      .from("promo_code_redemption_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", windowStart),
    ipAddress
      ? supabaseClient
        .from("promo_code_redemption_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip_address", ipAddress)
        .gte("created_at", windowStart)
      : Promise.resolve({ count: 0, error: null }),
  ]);

  if (userAttempts.error) throw userAttempts.error;
  if (ipAttempts.error) throw ipAttempts.error;

  return {
    userAttempts: userAttempts.count ?? 0,
    ipAttempts: ipAttempts.count ?? 0,
  };
}

async function logAttempt(
  supabaseClient: any,
  payload: {
    userId: string;
    ipAddress: string | null;
    promoCode: string;
    succeeded: boolean;
    outcome: string;
  },
) {
  const { error } = await supabaseClient
    .from("promo_code_redemption_attempts")
    .insert({
      user_id: payload.userId,
      ip_address: payload.ipAddress,
      promo_code: payload.promoCode,
      succeeded: payload.succeeded,
      outcome: payload.outcome,
    });

  if (error) {
    console.error("Failed to log promo redemption attempt:", error);
  }
}

export async function handleRedeemPromoCode(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await requireRequestAuth(req, corsHeaders);
    if (auth instanceof Response) {
      return auth;
    }

    if (auth.isServiceRole) {
      return new Response(JSON.stringify({ error: "User authentication is required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      payload = null;
    }

    const normalizedRequest = normalizePromoRedeemRequest(payload);
    if (!normalizedRequest) {
      return new Response(JSON.stringify({
        success: false,
        status: "invalid",
        message: "Enter a valid promo code.",
        access_expires_at: null,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const ipAddress = extractPromoRedemptionClientIp(req);
    const attempts = await countRecentAttempts(supabaseClient, auth.userId, ipAddress);

    if (attempts.userAttempts >= USER_ATTEMPT_LIMIT || attempts.ipAttempts >= IP_ATTEMPT_LIMIT) {
      await logAttempt(supabaseClient, {
        userId: auth.userId,
        ipAddress,
        promoCode: normalizedRequest.promoCode,
        succeeded: false,
        outcome: "rate_limited",
      });

      return new Response(JSON.stringify({
        success: false,
        status: "rate_limited",
        message: "Too many promo redemption attempts. Please try again later.",
        access_expires_at: null,
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await (supabaseClient.rpc as any)(
      "redeem_promo_code_secure",
      {
        p_user_id: auth.userId,
        p_promo_code: normalizedRequest.promoCode,
      },
    ) as { data: PromoRedeemResult[] | PromoRedeemResult | null; error: Error | null };

    if (error) {
      throw error;
    }

    const result = (Array.isArray(data) ? data[0] : data) as PromoRedeemResult | undefined;
    const normalizedResult: PromoRedeemResult = result ?? {
      success: false,
      status: "unknown",
      message: "Unable to redeem promo code right now.",
      access_expires_at: null,
    };

    await logAttempt(supabaseClient, {
      userId: auth.userId,
      ipAddress,
      promoCode: normalizedRequest.promoCode,
      succeeded: normalizedResult.success,
      outcome: normalizedResult.status,
    });

    return new Response(JSON.stringify(normalizedResult), {
      status: normalizedResult.success ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error redeeming promo code:", error);
    return new Response(JSON.stringify({
      success: false,
      status: "unknown",
      message: error instanceof Error ? error.message : "Internal server error",
      access_expires_at: null,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve(handleRedeemPromoCode);
}
