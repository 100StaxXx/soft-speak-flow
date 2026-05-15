import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  createSafeErrorResponse,
  requireProtectedRequest,
} from "../_shared/abuseProtection.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  createCostGuardrailSupabaseClient,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import {
  loadCompanionAgentContext,
  type UserCompanionRow,
} from "../companion-agent/agent.ts";
import type { CompanionAgentRequest } from "../companion-agent/types.ts";
import {
  buildCompanionOpenerSnapshot,
  buildCompanionOpenerThreadSummary,
  buildFallbackCompanionOpener,
  generateCompanionOpener,
  persistCompanionOpenerTurnBestEffort,
} from "./opener.ts";

const RequestSchema = z.object({
  companionId: z.string().uuid(),
  surface: z.literal("companion").default("companion"),
  sessionId: z.string().min(1).max(200).optional(),
  skipIfSessionHasUserMessage: z.boolean().optional().default(false),
  currentDateTime: z.string().datetime({ offset: true }),
});

const normalizeCompanionRow = (
  row: Record<string, unknown> | null,
): UserCompanionRow | null => {
  if (!row || typeof row.id !== "string") return null;

  return {
    id: row.id,
    companion_name: typeof row.companion_name === "string"
      ? row.companion_name
      : null,
    cached_creature_name: typeof row.cached_creature_name === "string"
      ? row.cached_creature_name
      : null,
    preset_id: typeof row.preset_id === "string" ? row.preset_id : null,
    spirit_animal: typeof row.spirit_animal === "string"
      ? row.spirit_animal
      : null,
    core_element: typeof row.core_element === "string"
      ? row.core_element
      : null,
    current_stage: typeof row.current_stage === "number"
      ? row.current_stage
      : null,
    current_mood: typeof row.current_mood === "string"
      ? row.current_mood
      : null,
  };
};

async function loadCompanionForOpener(
  supabase: any,
  userId: string,
  companionId: string,
) {
  const { data, error } = await supabase
    .from("user_companion")
    .select(
      "id, companion_name, cached_creature_name, preset_id, spirit_animal, core_element, current_stage, current_mood",
    )
    .eq("id", companionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  const companion = normalizeCompanionRow(
    data as Record<string, unknown> | null,
  );
  if (!companion) {
    throw new Response("Companion not found", { status: 404 });
  }
  return companion;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let requestId: string = crypto.randomUUID();

  try {
    const protectedRequest = await requireProtectedRequest(req, {
      profileKey: "companion_agent",
      endpointName: "companion-chat-opener",
      allowServiceRole: false,
      blockedMessage:
        "Too many companion requests right now. Try again in a moment.",
    });

    if (protectedRequest instanceof Response) return protectedRequest;
    requestId = protectedRequest.requestId;

    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "INVALID_REQUEST",
        error: parsed.error.flatten().formErrors[0] ??
          "Invalid companion opener request",
        requestId,
      });
    }

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY")?.trim() || null;

    const costGuardrails = createCostGuardrailSession({
      supabase: createCostGuardrailSupabaseClient(),
      endpointKey: "companion-chat-opener",
      featureKey: "ai_companion_agent",
      userId: protectedRequest.auth.userId,
      requestId,
    });
    if (openAIApiKey) {
      await costGuardrails.enforceAccess({
        capabilities: ["text"],
        providers: ["openai"],
      });
    }

    const sessionId = parsed.data.sessionId ?? crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const companion = await loadCompanionForOpener(
      protectedRequest.supabase,
      protectedRequest.auth.userId,
      parsed.data.companionId,
    );
    const contextRequest: CompanionAgentRequest = {
      surface: "companion",
      sessionId,
      message: "Start a new companion conversation.",
      inputMode: "text",
      currentDateTime: parsed.data.currentDateTime,
      horizonDays: 7,
    };
    const context = await loadCompanionAgentContext({
      supabase: protectedRequest.supabase,
      userId: protectedRequest.auth.userId,
      companionId: companion.id,
      sessionId,
      request: contextRequest,
      requestId,
    });
    const snapshot = buildCompanionOpenerSnapshot({
      companion,
      context,
      currentDateTime: parsed.data.currentDateTime,
    });
    let opener = buildFallbackCompanionOpener(snapshot);
    if (!openAIApiKey) {
      console.warn("[companion-chat-opener] OpenAI opener fallback", {
        requestId,
        sessionId,
        error: "OPENAI_API_KEY not configured",
      });
    } else {
      try {
        opener = await generateCompanionOpener({
          guardedFetch: costGuardrails.wrapFetch(fetch),
          openAIApiKey,
          userId: protectedRequest.auth.userId,
          companionId: companion.id,
          sessionId,
          snapshot,
        });
      } catch (error) {
        console.warn("[companion-chat-opener] OpenAI opener fallback", {
          requestId,
          sessionId,
          error,
        });
        opener = buildFallbackCompanionOpener(snapshot);
      }
    }

    const persistenceReady = await persistCompanionOpenerTurnBestEffort({
      supabase: protectedRequest.supabase,
      userId: protectedRequest.auth.userId,
      companionId: companion.id,
      sessionId,
      reply: opener.reply,
      signal: opener.signal,
      currentDateTime: parsed.data.currentDateTime,
      createdAt,
      openaiConversationId: opener.openaiConversationId,
      lastOpenAIResponseId: opener.lastOpenAIResponseId,
      requestId,
      skipIfSessionHasUserMessage: parsed.data.skipIfSessionHasUserMessage,
    });

    return new Response(
      JSON.stringify({
        sessionId,
        reply: opener.reply,
        speechText: opener.speechText,
        createdAt,
        persistenceReady,
        thread: buildCompanionOpenerThreadSummary({
          companionId: companion.id,
          sessionId,
          reply: opener.reply,
          createdAt,
        }),
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
    if (error instanceof Response) {
      return new Response(error.body, {
        status: error.status,
        headers: {
          ...corsHeaders,
          "Content-Type": error.headers.get("Content-Type") ?? "text/plain",
          "X-Request-Id": requestId,
        },
      });
    }

    console.error("[companion-chat-opener] unhandled error", error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "COMPANION_CHAT_OPENER_FAILED",
      error: "Companion opener hit a snag. Please try again.",
      requestId,
    });
  }
});
