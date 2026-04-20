import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
  buildPlannerResponse,
  type ClassificationHint,
  normalizePlannerBuildResultText,
  type ParsedInputHint,
  type PlannerBuildInput,
  type PlannerSessionState,
} from "./planner.ts";
import {
  buildOrchestratedPlannerResponse,
  sanitizeReadyQuestProposalResponse,
} from "./orchestrator.ts";
import { enrichQuestPlannerResult } from "./questEnrichment.ts";
import {
  normalizePlannerClassificationHint,
  PlannerRequestSchema,
} from "./request.ts";

const getClassificationHint = async (
  req: Request,
  message: string,
  currentHint?: ClassificationHint | null,
): Promise<ClassificationHint | null> => {
  if (currentHint) return currentHint;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) return null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return null;

    const response = await fetch(
      `${supabaseUrl}/functions/v1/classify-task-intent`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: message }),
      },
    );

    if (!response.ok) return null;

    const data = await response.json();
    return normalizePlannerClassificationHint(
      data as ClassificationHint | null | undefined,
    );
  } catch (error) {
    console.warn(
      "[companion-planner-chat] classify-task-intent fallback failed",
      error,
    );
    return null;
  }
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let requestId: string = crypto.randomUUID();

  try {
    const protectedRequest = await requireProtectedRequest(req, {
      profileKey: "ai.standard",
      endpointName: "companion-planner-chat",
      blockedMessage:
        "Too many companion planner requests. Please try again shortly.",
      metadata: {
        flow: "companion_planner",
      },
    });

    if (protectedRequest instanceof Response) {
      return protectedRequest;
    }

    requestId = protectedRequest.requestId;
    const body = await req.json();
    const parsed = PlannerRequestSchema.safeParse(body);

    if (!parsed.success) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "INVALID_INPUT",
        error: "Invalid planner request",
        requestId,
      });
    }

    const classificationHint = await getClassificationHint(
      req,
      parsed.data.message,
      normalizePlannerClassificationHint(parsed.data.classificationHint),
    );

    const plannerInput = {
      message: parsed.data.message,
      currentDate: parsed.data.currentDate,
      currentDateTime: parsed.data.currentDateTime,
      horizon: parsed.data.horizon,
      tonePack: parsed.data.tonePack,
      conversationHistory: parsed.data.conversationHistory,
      sessionState: parsed.data.sessionState as PlannerSessionState,
      parsedInput: (parsed.data.parsedInput as ParsedInputHint | undefined) ??
        null,
      classificationHint,
      plannerContext: parsed.data.plannerContext,
    } satisfies PlannerBuildInput;

    const result = buildPlannerResponse(plannerInput);

    const costGuardrails = createCostGuardrailSession({
      supabase: createCostGuardrailSupabaseClient(),
      endpointKey: "companion-planner-chat",
      featureKey: "ai_companion_planner",
      userId: protectedRequest.auth.userId,
      requestId,
    });
    const guardedFetch = costGuardrails.wrapFetch(fetch);
    await costGuardrails.enforceAccess({
      capabilities: ["text"],
      providers: ["openai"],
    });

    const enrichedResult = await enrichQuestPlannerResult({
      fetchImpl: guardedFetch,
      input: plannerInput,
      baseResult: result,
    });

    const orchestratedResult = await buildOrchestratedPlannerResponse({
      guardedFetch,
      input: plannerInput,
      baseResult: enrichedResult,
    });
    const responseResult = sanitizeReadyQuestProposalResponse(
      normalizePlannerBuildResultText(orchestratedResult),
    );

    return new Response(JSON.stringify(responseResult), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }

    console.error("[companion-planner-chat] unhandled error", error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "PLANNER_FAILED",
      error: "Failed to build companion plan",
      requestId,
    });
  }
});
