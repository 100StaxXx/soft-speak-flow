import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCreatorAccessToken } from "../_shared/influencerAuth.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

interface CreatorDashboardRequest {
  referralCode: string | null;
  creatorAccessToken: string | null;
}

interface GetCreatorStatsDeps {
  createSupabaseClient: () => any;
  verifyToken: typeof verifyCreatorAccessToken;
}

const defaultDeps: GetCreatorStatsDeps = {
  createSupabaseClient: () => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    return createClient(supabaseUrl, supabaseServiceKey);
  },
  verifyToken: verifyCreatorAccessToken,
};

function jsonResponse(corsHeaders: HeadersInit, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function getClientIP(req: Request): string {
  return req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

function maskEmail(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0) {
    if (trimmed.length <= 4) return "*".repeat(trimmed.length);
    return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
  }

  const localPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex + 1);
  const maskedLocal = localPart.length <= 2
    ? `${localPart[0] ?? "*"}*`
    : `${localPart.slice(0, 2)}***`;
  return `${maskedLocal}@${domainPart}`;
}

function maskPayoutDestination(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.includes("@")) return maskEmail(value);
  if (value.length <= 4) return "*".repeat(value.length);
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

async function checkRateLimit(
  supabaseClient: any,
  ip: string,
): Promise<{ allowed: boolean; message?: string }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  const { data: recentRequests, error } = await supabaseClient
    .from("influencer_creation_log")
    .select("id")
    .eq("ip_address", ip)
    .eq("request_type", "stats_lookup")
    .gte("created_at", windowStart);

  if (error) {
    console.error("Rate limit check error:", error);
    return { allowed: true };
  }

  if (recentRequests && recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      message: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per hour.`,
    };
  }

  return { allowed: true };
}

async function logRequest(supabaseClient: any, ip: string, referralCode: string | null): Promise<void> {
  try {
    await supabaseClient
      .from("influencer_creation_log")
      .insert({
        ip_address: ip,
        email: referralCode ? `${referralCode}-stats-lookup` : "stats-lookup",
        request_type: "stats_lookup",
      });
  } catch (error) {
    console.error("Failed to log request:", error);
  }
}

export function normalizeCreatorDashboardRequest(payload: unknown): CreatorDashboardRequest {
  if (!payload || typeof payload !== "object") {
    return {
      referralCode: null,
      creatorAccessToken: null,
    };
  }

  const requestPayload = payload as Record<string, unknown>;
  return {
    referralCode: typeof requestPayload.referral_code === "string"
      ? requestPayload.referral_code.trim().toUpperCase()
      : null,
    creatorAccessToken: typeof requestPayload.creator_access_token === "string"
      ? requestPayload.creator_access_token.trim()
      : null,
  };
}

export async function handleGetCreatorStats(
  req: Request,
  deps: GetCreatorStatsDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseClient = deps.createSupabaseClient();
    const clientIP = getClientIP(req);

    const rateLimitCheck = await checkRateLimit(supabaseClient, clientIP);
    if (!rateLimitCheck.allowed) {
      return jsonResponse(corsHeaders, 429, {
        error: rateLimitCheck.message || "Rate limit exceeded",
        code: "RATE_LIMITED",
      });
    }

    const body = await req.json().catch(() => ({}));
    const { referralCode, creatorAccessToken } = normalizeCreatorDashboardRequest(body);

    if (!referralCode) {
      return jsonResponse(corsHeaders, 400, {
        error: "referral_code is required",
        code: "MISSING_REFERRAL_CODE",
      });
    }

    if (!creatorAccessToken) {
      return jsonResponse(corsHeaders, 401, {
        error: "creator_access_token is required",
        code: "MISSING_CREATOR_TOKEN",
      });
    }

    await logRequest(supabaseClient, clientIP, referralCode);

    const { data: codeData, error: codeError } = await supabaseClient
      .from("referral_codes")
      .select("id, code, influencer_name, influencer_email, influencer_handle, payout_identifier, created_at")
      .eq("owner_type", "influencer")
      .eq("is_active", true)
      .eq("code", referralCode)
      .maybeSingle();

    if (codeError) {
      console.error("Creator lookup failed:", codeError);
      return jsonResponse(corsHeaders, 500, {
        error: "Failed to load creator",
        code: "CREATOR_LOOKUP_FAILED",
      });
    }

    if (!codeData) {
      return jsonResponse(corsHeaders, 404, {
        error: "Creator not found",
        code: "INVALID_CREATOR_CODE",
      });
    }

    const tokenCheck = await deps.verifyToken(codeData.code, creatorAccessToken);
    if (!tokenCheck.valid) {
      if (tokenCheck.reason?.includes("INFLUENCER_DASHBOARD_SECRET")) {
        console.error("Creator dashboard secret is not configured");
        return jsonResponse(corsHeaders, 500, {
          error: "Creator dashboard is temporarily unavailable",
          code: "CREATOR_DASHBOARD_UNAVAILABLE",
        });
      }

      console.warn(`Creator token verification failed for ${codeData.code}: ${tokenCheck.reason}`);
      return jsonResponse(corsHeaders, 401, {
        error: "Unauthorized creator session",
        code: "INVALID_CREATOR_TOKEN",
      });
    }

    const [
      { count: totalSignups, error: totalSignupsError },
      { data: conversions, error: conversionsError },
      { data: payouts, error: payoutsError },
    ] = await Promise.all([
      supabaseClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("referred_by_code", codeData.code),
      supabaseClient
        .from("profiles")
        .select("id, email, created_at, subscription_status")
        .eq("referred_by_code", codeData.code)
        .order("created_at", { ascending: false })
        .limit(10),
      supabaseClient
        .from("referral_payouts")
        .select("amount, status, created_at, paid_at, payout_type")
        .eq("referral_code_id", codeData.id)
        .order("created_at", { ascending: false }),
    ]);

    if (totalSignupsError || conversionsError || payoutsError) {
      console.error("Failed to load creator dashboard data:", {
        totalSignupsError,
        conversionsError,
        payoutsError,
      });
      return jsonResponse(corsHeaders, 500, {
        error: "Failed to load creator dashboard",
        code: "CREATOR_DASHBOARD_LOAD_FAILED",
      });
    }

    const conversionsList = conversions || [];
    const payoutsList = payouts || [];
    const activeSubscribers = conversionsList.filter(
      (conversion: { subscription_status: string | null }) => conversion.subscription_status === "active",
    ).length;
    const pendingEarnings = payoutsList
      .filter((payout: any) => payout.status === "pending")
      .reduce((sum: number, payout: any) => sum + Number(payout.amount || 0), 0);
    const requestedEarnings = payoutsList
      .filter((payout: any) => payout.status === "requested")
      .reduce((sum: number, payout: any) => sum + Number(payout.amount || 0), 0);
    const paidEarnings = payoutsList
      .filter((payout: any) => payout.status === "paid")
      .reduce((sum: number, payout: any) => sum + Number(payout.amount || 0), 0);
    const totalEarnings = pendingEarnings + requestedEarnings + paidEarnings;

    return jsonResponse(corsHeaders, 200, {
      creator: {
        code: codeData.code,
        name: codeData.influencer_name || null,
        handle: codeData.influencer_handle || null,
        contact_email_masked: maskEmail(codeData.influencer_email),
        payout_destination_masked: maskPayoutDestination(codeData.payout_identifier || codeData.influencer_email),
        created_at: codeData.created_at,
      },
      stats: {
        total_signups: totalSignups ?? 0,
        active_subscribers: activeSubscribers,
        pending_earnings: Math.round(pendingEarnings * 100) / 100,
        requested_earnings: Math.round(requestedEarnings * 100) / 100,
        paid_earnings: Math.round(paidEarnings * 100) / 100,
        total_earnings: Math.round(totalEarnings * 100) / 100,
      },
      recent_signups: conversionsList.map((conversion: any) => ({
        id: conversion.id,
        email_masked: maskEmail(conversion.email),
        created_at: conversion.created_at,
        subscription_status: conversion.subscription_status,
      })),
      payout_history: payoutsList.slice(0, 10).map((payout: any) => ({
        amount: Number(payout.amount || 0),
        status: payout.status,
        payout_type: payout.payout_type,
        created_at: payout.created_at,
        paid_at: payout.paid_at,
      })),
    });
  } catch (error) {
    console.error("Error in get-creator-stats:", error);
    return jsonResponse(corsHeaders, 500, {
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleGetCreatorStats(req));
}
