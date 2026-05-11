import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createSafeErrorResponse, requireProtectedRequest } from "../_shared/abuseProtection.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  createCostGuardrailSupabaseClient,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import {
  buildAccessStateResponse,
  fetchAccountEntitlementForUser,
} from "../_shared/accountEntitlements.ts";

const RequestSchema = z.object({
  text: z.string().min(1).max(5000).trim(),
  companionId: z.string().uuid(),
  voiceStyle: z.string().max(500).nullable().optional(),
  sessionId: z.string().max(200).nullable().optional(),
});

const DAILY_TTS_LIMIT = Number(Deno.env.get("COMPANION_TTS_DAILY_LIMIT") ?? "20");

const startOfTodayUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
};

async function ensurePremiumAccess(supabase: any, userId: string) {
  const entitlement = await fetchAccountEntitlementForUser(supabase, userId);
  const entitlementAccess = buildAccessStateResponse(entitlement);
  if (entitlementAccess.has_access) {
    return true;
  }
  if (entitlementAccess.access_source === "subscription") {
    return false;
  }

  const nowIso = new Date().toISOString();
  const { count, error } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due", "cancelled"])
    .gte("current_period_end", nowIso);

  if (error) throw error;
  return (count ?? 0) > 0;
}

async function enforceDailyTtsCap(supabase: any, userId: string) {
  const { count, error } = await supabase
    .from("ai_interactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("interaction_type", "companion_chat_tts_fallback")
    .gte("created_at", startOfTodayUtc());

  if (error) throw error;
  return (count ?? 0) < DAILY_TTS_LIMIT;
}

const selectVoice = (voiceStyle?: string | null) => {
  const normalized = (voiceStyle ?? "").toLowerCase();
  if (
    normalized.includes("gritty")
    || normalized.includes("streetwise")
    || normalized.includes("raspy")
    || normalized.includes("shadow")
    || normalized.includes("deep")
  ) return "onyx";
  if (normalized.includes("playful") || normalized.includes("bright")) return "nova";
  if (normalized.includes("wise") || normalized.includes("story")) return "fable";
  if (normalized.includes("grounded")) return "onyx";
  if (normalized.includes("calm") || normalized.includes("gentle") || normalized.includes("warm")) return "shimmer";
  return "alloy";
};

const encodeAudioToBase64 = (arrayBuffer: ArrayBuffer) => {
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < uint8Array.length; index += chunkSize) {
    const chunk = uint8Array.subarray(index, Math.min(index + chunkSize, uint8Array.length));
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let requestId: string = crypto.randomUUID();

  try {
    if ((Deno.env.get("COMPANION_TTS_FALLBACK_DISABLED") ?? "").toLowerCase() === "true") {
      return createSafeErrorResponse(req, {
        status: 503,
        code: "TTS_FALLBACK_DISABLED",
        error: "Companion voice fallback is temporarily unavailable.",
        requestId,
      });
    }

    const protectedRequest = await requireProtectedRequest(req, {
      profileKey: "ai.standard",
      endpointName: "generate-companion-tts",
      blockedMessage: "Too many companion voice requests. Please try again shortly.",
      metadata: {
        flow: "companion_tts",
      },
    });

    if (protectedRequest instanceof Response) {
      return protectedRequest;
    }

    requestId = protectedRequest.requestId;
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "INVALID_INPUT",
        error: "Invalid companion speech request",
        requestId,
      });
    }

    const userId = protectedRequest.auth.userId;
    const hasPremiumAccess = await ensurePremiumAccess(protectedRequest.supabase, userId);

    if (!hasPremiumAccess) {
      return createSafeErrorResponse(req, {
        status: 403,
        code: "PREMIUM_REQUIRED",
        error: "Companion voice fallback requires Premium access",
        requestId,
      });
    }

    const underDailyLimit = await enforceDailyTtsCap(protectedRequest.supabase, userId);
    if (!underDailyLimit) {
      return createSafeErrorResponse(req, {
        status: 429,
        code: "DAILY_LIMIT_REACHED",
        error: "You reached today's cloud voice fallback limit.",
        requestId,
      });
    }

    const { data: companionRow, error: companionError } = await protectedRequest.supabase
      .from("user_companion")
      .select("id")
      .eq("id", parsed.data.companionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (companionError) throw companionError;
    if (!companionRow) {
      return createSafeErrorResponse(req, {
        status: 404,
        code: "COMPANION_NOT_FOUND",
        error: "Companion not found",
        requestId,
      });
    }

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const costGuardrails = createCostGuardrailSession({
      supabase: createCostGuardrailSupabaseClient(),
      endpointKey: "generate-companion-tts",
      featureKey: "ai_companion_conversation",
      userId,
      requestId,
    });
    const guardedFetch = costGuardrails.wrapFetch(fetch);
    await costGuardrails.enforceAccess({
      capabilities: ["tts"],
      providers: ["openai"],
    });

    const voice = selectVoice(parsed.data.voiceStyle);
    const model = Deno.env.get("OPENAI_COMPANION_TTS_MODEL") ?? "tts-1";
    const response = await guardedFetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: parsed.data.text,
        voice,
        response_format: "mp3",
        speed: 1,
      }),
    });

    if (!response.ok) {
      console.error("[generate-companion-tts] OpenAI error", await response.text());
      throw new Error("Failed to generate companion voice");
    }

    const audioBuffer = await response.arrayBuffer();
    const audioContent = encodeAudioToBase64(audioBuffer);

    await protectedRequest.supabase
      .from("ai_interactions")
      .insert({
        user_id: userId,
        interaction_type: "companion_chat_tts_fallback",
        input_text: parsed.data.text.slice(0, 2000),
        ai_response: {
          provider: "openai",
          voice,
          companionId: parsed.data.companionId,
          sessionId: parsed.data.sessionId ?? null,
        },
        user_action: "accepted",
        session_id: parsed.data.sessionId ?? null,
      });

    return new Response(
      JSON.stringify({
        audioContent,
        contentType: "audio/mpeg",
        voice,
        provider: "openai",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
      },
    );
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }

    console.error("[generate-companion-tts] unhandled error", error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "COMPANION_TTS_FAILED",
      error: "Companion voice fallback hit a snag.",
      requestId,
    });
  }
});
