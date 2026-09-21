import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  createSafeErrorResponse,
  requireProtectedRequest,
} from "../_shared/abuseProtection.ts";
import {
  createCostGuardrailSession,
  createCostGuardrailSupabaseClient,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import { CompanionAgentRequestSchema } from "./types.ts";
import {
  isCompanionScheduleReadFastPathRequest,
  runCompanionAgent,
} from "./agent.ts";
import {
  buildErrorLog,
  type CompanionAgentFailureStage,
  getCompanionAgentFailureReason,
} from "./failureDiagnostics.ts";
import { createCallerSupabaseClient } from "../_shared/callerSupabase.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let requestId: string = crypto.randomUUID();
  let stage: CompanionAgentFailureStage = "auth";

  try {
    const protectedRequest = await requireProtectedRequest(req, {
      profileKey: "companion_agent",
      endpointName: "companion-agent",
      allowServiceRole: false,
      blockedMessage:
        "Too many companion requests right now. Try again in a moment.",
    });

    if (protectedRequest instanceof Response) return protectedRequest;

    requestId = protectedRequest.requestId;

    stage = "request_parse";
    const json = await req.json();
    const parsed = CompanionAgentRequestSchema.safeParse(json);
    if (!parsed.success) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "INVALID_REQUEST",
        error: parsed.error.flatten().formErrors[0] ??
          "Invalid companion request",
        requestId,
        stage,
        failureReason: "invalid_request",
      });
    }

    const scheduleReadFastPath = isCompanionScheduleReadFastPathRequest(
      parsed.data,
    );
    let guardedFetch: typeof fetch = fetch;
    if (!scheduleReadFastPath) {
      stage = "cost_guardrail";
      const costGuardrails = createCostGuardrailSession({
        supabase: createCostGuardrailSupabaseClient(),
        endpointKey: "companion-agent",
        featureKey: "ai_companion_agent",
        userId: protectedRequest.auth.userId,
        requestId,
      });
      await costGuardrails.enforceAccess({
        capabilities: ["text"],
        providers: ["openai"],
      });
      guardedFetch = costGuardrails.wrapFetch(fetch);
    }

    stage = "agent_run";
    const result = await runCompanionAgent({
      guardedFetch,
      supabase: protectedRequest.supabase,
      actorSupabase: createCallerSupabaseClient(req),
      userId: protectedRequest.auth.userId,
      request: parsed.data,
      requestId,
    });

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
      },
    );
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return createSafeErrorResponse(req, {
        status: error.status,
        code: error.code,
        error: error.message,
        requestId,
        stage: "cost_guardrail",
        failureReason: "blocked",
      });
    }

    const failureReason = getCompanionAgentFailureReason(error, stage);
    console.error("[companion-agent] unhandled error", {
      ...buildErrorLog(error),
      stage,
      failureReason,
      requestId,
    });
    return createSafeErrorResponse(req, {
      status: 500,
      code: failureReason.includes("schema_mismatch")
        ? "COMPANION_AGENT_SETUP_FAILED"
        : "COMPANION_AGENT_FAILED",
      error: "Companion agent hit a snag. Please try again.",
      requestId,
      stage,
      failureReason,
    });
  }
});
