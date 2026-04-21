import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
import { createSafeErrorResponse, requireProtectedRequest } from "../_shared/abuseProtection.ts";
import { cancelPendingAction, confirmPendingAction } from "../companion-agent/executor.ts";
import { CompanionAgentActionRequestSchema } from "../companion-agent/types.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let requestId: string = crypto.randomUUID();

  try {
    const protectedRequest = await requireProtectedRequest(req, {
      profileKey: "companion_agent_action",
      endpointName: "companion-agent-action",
      allowServiceRole: false,
      blockedMessage: "Too many companion action requests right now. Try again in a moment.",
    });

    if (protectedRequest instanceof Response) return protectedRequest;
    requestId = protectedRequest.requestId;

    const parsed = CompanionAgentActionRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "INVALID_REQUEST",
        error: parsed.error.flatten().formErrors[0] ?? "Invalid companion action request",
        requestId,
      });
    }

    const result = parsed.data.action === "confirm"
      ? await confirmPendingAction({
        supabase: protectedRequest.supabase,
        userId: protectedRequest.auth.userId,
        sessionId: parsed.data.sessionId,
        actionId: parsed.data.actionId,
      })
      : await cancelPendingAction({
        supabase: protectedRequest.supabase,
        userId: protectedRequest.auth.userId,
        sessionId: parsed.data.sessionId,
        actionId: parsed.data.actionId,
      });

    return new Response(
      JSON.stringify({
        reply: result.receipt.message,
        mode: "receipt",
        intent: result.action?.intent ?? "unknown",
        confidence: 1,
        receipt: result.receipt,
        threadState: {
          threadId: result.thread.session_id,
          sessionId: result.thread.session_id,
          openaiConversationId: result.thread.openai_conversation_id,
          lastOpenAIResponseId: result.thread.last_openai_response_id,
          hasPendingAction: false,
        },
      }),
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
    console.error("[companion-agent-action] unhandled error", error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "COMPANION_AGENT_ACTION_FAILED",
      error: "I couldn't resolve that action right now.",
      requestId,
    });
  }
});
