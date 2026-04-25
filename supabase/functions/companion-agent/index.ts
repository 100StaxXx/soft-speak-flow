import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createSafeErrorResponse, requireProtectedRequest } from "../_shared/abuseProtection.ts";
import {
  createCostGuardrailSession,
  createCostGuardrailSupabaseClient,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import { CompanionAgentRequestSchema } from "./types.ts";
import { runCompanionAgent } from "./agent.ts";

type CompanionAgentFailureStage =
  | "auth"
  | "request_parse"
  | "cost_guardrail"
  | "agent_run";

const normalizeErrorSource = (error: unknown) => {
  if (!error) return "";
  if (typeof error === "string") return error.toLowerCase();
  if (typeof error !== "object") return String(error).toLowerCase();

  const source = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    details?: unknown;
    hint?: unknown;
    error?: unknown;
  };

  return [
    source.name,
    source.message,
    source.code,
    source.details,
    source.hint,
    source.error,
  ]
    .filter((value): value is string =>
      typeof value === "string" && value.length > 0
    )
    .join(" ")
    .toLowerCase();
};

const hasSchemaSignal = (source: string) =>
  source.includes("does not exist") ||
  source.includes("undefined_table") ||
  source.includes("undefined_column") ||
  source.includes("undefined_function") ||
  source.includes("schema cache") ||
  source.includes("relation") ||
  source.includes("column");

const isCompanionAgentSetupFailure = (source: string) => {
  if (!hasSchemaSignal(source)) return false;

  return [
    "companion_chats",
    "companion_chat_threads",
    "companion_pending_actions",
    "openai_conversation_id",
    "last_openai_response_id",
    "companion_mode",
    "companion_mode_adaptation_enabled",
    "consume_abuse_protection",
    "abuse_protection_config",
    "cost_guardrail_config",
    "cost_guardrail_state",
    "daily_tasks",
    "external_calendar_events",
    "companion_memories",
    "user_reflections",
    "daily_check_ins",
  ].some((token) => source.includes(token));
};

const getCompanionAgentFailureReason = (
  error: unknown,
  stage: CompanionAgentFailureStage,
) => {
  const source = normalizeErrorSource(error);

  if (isCompanionAgentSetupFailure(source)) return "schema_mismatch";
  if (source.includes("cost_guardrail")) return "cost_guardrail_setup";
  if (source.includes("abuse protection")) return "abuse_protection_setup";
  if (source.includes("openai")) return "openai_provider_error";
  if (source.includes("timeout") || source.includes("timed out")) {
    return "timeout";
  }

  return `${stage}_failed`;
};

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
      blockedMessage: "Too many companion requests right now. Try again in a moment.",
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
        error: parsed.error.flatten().formErrors[0] ?? "Invalid companion request",
        requestId,
        stage,
        failureReason: "invalid_request",
      });
    }

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

    stage = "agent_run";
    const result = await runCompanionAgent({
      guardedFetch: costGuardrails.wrapFetch(fetch),
      supabase: protectedRequest.supabase,
      userId: protectedRequest.auth.userId,
      request: parsed.data,
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

    console.error("[companion-agent] unhandled error", error);
    const failureReason = getCompanionAgentFailureReason(error, stage);
    return createSafeErrorResponse(req, {
      status: 500,
      code: failureReason === "schema_mismatch"
        ? "COMPANION_AGENT_SETUP_FAILED"
        : "COMPANION_AGENT_FAILED",
      error: "Companion agent hit a snag. Please try again.",
      requestId,
      stage,
      failureReason,
    });
  }
});
