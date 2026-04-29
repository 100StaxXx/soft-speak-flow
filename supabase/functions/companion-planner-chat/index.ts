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
  buildUpcomingAIResponse,
  sanitizeReadyQuestProposalResponse,
} from "./orchestrator.ts";
import { enrichQuestPlannerResult } from "./questEnrichment.ts";
import {
  collectPlannerRequestNormalizationEvents,
  normalizePlannerClassificationHint,
  PlannerRequestSchema,
} from "./request.ts";
import {
  PLANNER_ORCHESTRATION_TIMEOUT_MS,
  QUEST_ENRICHMENT_TIMEOUT_MS,
  runPlannerStageWithTimeout,
  UPCOMING_AI_TIMEOUT_MS,
} from "./latencyBudget.ts";

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

const shouldReturnDeterministicStarterImmediately = (
  starterIntent:
    | PlannerBuildInput["plannerContext"]["starterIntent"]
    | null
    | undefined,
) =>
  starterIntent === "right_now_start" ||
  starterIntent === "adjust_today" ||
  starterIntent === "low_energy_adjust" ||
  starterIntent === "advance_campaign_start" ||
  starterIntent === "plan_week" ||
  starterIntent === "make_room" ||
  starterIntent === "what_matters" ||
  starterIntent === "relationship_touch" ||
  starterIntent === "briefing_followup" ||
  starterIntent === "plan_day";

const PLANNING_LAUNCHER_CONSENT_QUESTION_IDS = new Set([
  "planning_launcher_consent",
  "plan_day_quest_consent",
]);

const hasPlanningLauncherConsentState = (
  state: PlannerBuildInput["sessionState"],
) =>
  Boolean(state.planningConsent) ||
  state.openQuestionIds.some((id) => PLANNING_LAUNCHER_CONSENT_QUESTION_IDS.has(id));

const hasPlanningLauncherConsentQuestion = (
  result: ReturnType<typeof buildPlannerResponse>,
) =>
  result.followUpQuestions.some((question) =>
    PLANNING_LAUNCHER_CONSENT_QUESTION_IDS.has(question.id)
  ) || hasPlanningLauncherConsentState(result.sessionState);

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
      console.warn("[companion-planner-chat] invalid planner request", {
        requestId,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          code: issue.code,
          message: issue.message,
        })),
      });
      return createSafeErrorResponse(req, {
        status: 400,
        code: "INVALID_INPUT",
        error: "Invalid planner request",
        requestId,
      });
    }

    const normalizationEvents = collectPlannerRequestNormalizationEvents(
      body,
      parsed.data,
    );
    if (normalizationEvents.length > 0) {
      console.info("[companion-planner-chat] normalized planner request", {
        requestId,
        normalizations: normalizationEvents,
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
      timezone: parsed.data.timezone,
      horizon: parsed.data.horizon,
      tonePack: parsed.data.tonePack,
      conversationHistory: parsed.data.conversationHistory,
      sessionState: parsed.data.sessionState as PlannerSessionState,
      parsedInput: (parsed.data.parsedInput as ParsedInputHint | undefined) ??
        null,
      classificationHint,
      plannerContext: parsed.data.plannerContext,
      activeDayPlan: parsed.data.activeDayPlan ?? null,
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

    const requestStarterIntent = plannerInput.plannerContext.starterIntent;
    const starterIntent = requestStarterIntent && requestStarterIntent !== "general"
      ? requestStarterIntent
      : plannerInput.sessionState.planningConsent?.sourceStarterIntent ??
        result.sessionState.planningConsent?.sourceStarterIntent ??
        result.sessionState.pendingStarterIntent ??
      null;
    const isDeterministicPlanDayResult = starterIntent === "plan_day" ||
      Boolean(result.structuredResponse?.planDay);
    const isPlanningLauncherConsentTurn = hasPlanningLauncherConsentState(
      plannerInput.sessionState,
    ) || hasPlanningLauncherConsentQuestion(result);

    if (starterIntent === "upcoming_start") {
      const aiResult = await runPlannerStageWithTimeout({
        work: () =>
          buildUpcomingAIResponse({
            guardedFetch,
            input: plannerInput,
            baseResult: result,
          }),
        timeoutMs: UPCOMING_AI_TIMEOUT_MS,
        operation: "companion planner upcoming ai response",
        timeoutCode: "PLANNER_UPCOMING_TIMEOUT",
        fallbackValue: null,
        onTimeout: () => {
          console.warn(
            "[companion-planner-chat] upcoming_start AI timed out, falling back to deterministic",
            { requestId, timeoutMs: UPCOMING_AI_TIMEOUT_MS },
          );
        },
      });
      if (aiResult) {
        const responseResult = sanitizeReadyQuestProposalResponse(
          normalizePlannerBuildResultText(aiResult),
        );
        return new Response(JSON.stringify(responseResult), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        });
      }
      console.warn(
        "[companion-planner-chat] upcoming_start AI failed, falling back to deterministic",
        { requestId },
      );
    }

    if (
      isPlanningLauncherConsentTurn ||
      isDeterministicPlanDayResult ||
      shouldReturnDeterministicStarterImmediately(starterIntent)
    ) {
      const responseResult = sanitizeReadyQuestProposalResponse(
        normalizePlannerBuildResultText(result),
      );

      return new Response(JSON.stringify(responseResult), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
      });
    }

    const enrichedResult = await runPlannerStageWithTimeout({
      work: () =>
        enrichQuestPlannerResult({
          fetchImpl: guardedFetch,
          input: plannerInput,
          baseResult: result,
        }),
      timeoutMs: QUEST_ENRICHMENT_TIMEOUT_MS,
      operation: "companion planner quest enrichment",
      timeoutCode: "PLANNER_ENRICHMENT_TIMEOUT",
      fallbackValue: result,
      onTimeout: () => {
        console.warn(
          "[companion-planner-chat] quest enrichment timed out, using base result",
          { requestId, timeoutMs: QUEST_ENRICHMENT_TIMEOUT_MS },
        );
      },
    });

    const orchestratedResult = await runPlannerStageWithTimeout({
      work: () =>
        buildOrchestratedPlannerResponse({
          guardedFetch,
          input: plannerInput,
          baseResult: enrichedResult,
        }),
      timeoutMs: PLANNER_ORCHESTRATION_TIMEOUT_MS,
      operation: "companion planner reply orchestration",
      timeoutCode: "PLANNER_ORCHESTRATION_TIMEOUT",
      fallbackValue: enrichedResult,
      onTimeout: () => {
        console.warn(
          "[companion-planner-chat] reply orchestration timed out, using deterministic result",
          { requestId, timeoutMs: PLANNER_ORCHESTRATION_TIMEOUT_MS },
        );
      },
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
