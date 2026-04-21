import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createSafeErrorResponse, requireProtectedRequest } from "../_shared/abuseProtection.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  createCostGuardrailSupabaseClient,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import { CompanionAgentRequestSchema } from "./types.ts";
import { runCompanionAgent } from "./agent.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let requestId: string = crypto.randomUUID();

  try {
    const protectedRequest = await requireProtectedRequest(req, {
      profileKey: "companion_agent",
      endpointName: "companion-agent",
      allowServiceRole: false,
      blockedMessage: "Too many companion requests right now. Try again in a moment.",
    });

    if (protectedRequest instanceof Response) return protectedRequest;

    requestId = protectedRequest.requestId;

    const json = await req.json();
    const parsed = CompanionAgentRequestSchema.safeParse(json);
    if (!parsed.success) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "INVALID_REQUEST",
        error: parsed.error.flatten().formErrors[0] ?? "Invalid companion request",
        requestId,
      });
    }

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
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }

    console.error("[companion-agent] unhandled error", error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "COMPANION_AGENT_FAILED",
      error: "Companion agent hit a snag. Please try again.",
      requestId,
    });
  }
});
