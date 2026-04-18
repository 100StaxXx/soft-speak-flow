import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createSafeErrorResponse, requireProtectedRequest } from "../_shared/abuseProtection.ts";
import {
  buildPlannerResponse,
  type ClassificationHint,
  type ParsedInputHint,
  type PlannerBuildInput,
  type PlannerSessionState,
} from "./planner.ts";

const PlannerRequestSchema = z.object({
  message: z.string().min(1).max(4000).trim(),
  currentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horizon: z.enum(["day", "week", "month"]),
  tonePack: z.enum(["soft", "playful", "witty_sassy"]),
  sessionState: z.object({
    draft: z.record(z.unknown()),
    openQuestionIds: z.array(z.string()),
    preferredTimeOfDay: z.string().nullable().optional(),
    preferredTimeReason: z.string().nullable().optional(),
    reminderPreference: z.string().nullable().optional(),
    lastClassification: z.enum(["quest", "epic", "habit", "brain-dump"]).nullable().optional(),
  }),
  parsedInput: z.object({
    text: z.string(),
    scheduledTime: z.string().nullable(),
    scheduledDate: z.string().nullable(),
    estimatedDuration: z.number().nullable(),
    recurrencePattern: z.string().nullable(),
    recurrenceDays: z.array(z.number()),
    recurrenceMonthDays: z.array(z.number()),
    recurrenceCustomPeriod: z.enum(["week", "month"]).nullable(),
    recurrenceEndDate: z.string().nullable(),
    notes: z.string().nullable(),
    category: z.string().nullable(),
    newTitle: z.string().nullable(),
  }).optional(),
  classificationHint: z.object({
    type: z.enum(["quest", "epic", "habit", "brain-dump"]),
    confidence: z.number(),
    reasoning: z.string(),
    suggestedDeadline: z.string().optional(),
    suggestedDuration: z.number().optional(),
    timelineAnalysis: z.object({
      statedDays: z.number(),
      typicalDays: z.number(),
      feasibility: z.enum(["realistic", "aggressive", "very_aggressive"]),
      adjustmentFactors: z.array(z.string()),
    }).optional(),
  }).nullable().optional(),
  plannerContext: z.object({
    tasks: z.array(z.object({
      id: z.string(),
      title: z.string(),
      taskDate: z.string().nullable(),
      scheduledTime: z.string().nullable(),
      estimatedDuration: z.number().nullable(),
      recurrencePattern: z.string().nullable(),
      recurrenceEndDate: z.string().nullable().optional(),
      completed: z.boolean().nullable().optional(),
      priority: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
      epicId: z.string().nullable().optional(),
      epicTitle: z.string().nullable().optional(),
    })),
    inboxTasks: z.array(z.object({
      id: z.string(),
      title: z.string(),
      taskDate: z.string().nullable(),
      scheduledTime: z.string().nullable(),
      estimatedDuration: z.number().nullable(),
      recurrencePattern: z.string().nullable(),
      recurrenceEndDate: z.string().nullable().optional(),
      completed: z.boolean().nullable().optional(),
      priority: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
      epicId: z.string().nullable().optional(),
      epicTitle: z.string().nullable().optional(),
    })),
    activeEpics: z.array(z.object({
      id: z.string(),
      title: z.string(),
      endDate: z.string().nullable(),
    })),
    rituals: z.array(z.object({
      id: z.string(),
      epicId: z.string(),
      epicTitle: z.string(),
      title: z.string(),
      frequency: z.string().nullable(),
      preferredTime: z.string().nullable(),
    })),
    scheduleInsights: z.object({
      horizon: z.enum(["day", "week", "month"]),
      selectedDate: z.string(),
      dayLoads: z.array(z.object({
        date: z.string(),
        totalMinutes: z.number(),
        taskCount: z.number(),
        status: z.enum(["open", "balanced", "busy", "overloaded"]),
      })),
      overloadedDates: z.array(z.string()),
      emptyDates: z.array(z.string()),
      conflicts: z.array(z.object({
        date: z.string(),
        taskAId: z.string(),
        taskATitle: z.string(),
        taskBId: z.string(),
        taskBTitle: z.string(),
        overlapMinutes: z.number(),
      })),
      suggestedSlots: z.array(z.object({
        date: z.string(),
        time: z.string(),
        endTime: z.string(),
        score: z.number(),
        reason: z.string(),
      })),
      moveSuggestions: z.array(z.object({
        fromDate: z.string(),
        toDate: z.string(),
        taskId: z.string().nullable().optional(),
        taskTitle: z.string().nullable().optional(),
        suggestedTime: z.string().nullable().optional(),
        reason: z.string(),
      })),
      summary: z.string(),
    }).optional(),
    plannerMemory: z.object({
      tonePack: z.enum(["soft", "playful", "witty_sassy"]).optional(),
      preferredTimeOfDay: z.string().nullable().optional(),
      preferredTimeReason: z.string().nullable().optional(),
      reminderMinutesBefore: z.number().nullable().optional(),
      wakeTime: z.string().nullable().optional(),
      windDownTime: z.string().nullable().optional(),
      peakProductivityTimes: z.array(z.string()).optional(),
      preferredWindows: z.array(z.object({
        timeOfDay: z.string(),
        time: z.string().nullable().optional(),
        reason: z.string().nullable().optional(),
        sourceCount: z.number().optional(),
      })).optional(),
      cadencePatterns: z.record(z.number()).optional(),
      lastConfirmedAt: z.string().nullable().optional(),
    }).optional(),
    aiSignals: z.object({
      preferredDifficulty: z.string().optional(),
      preferredHabitFrequency: z.string().optional(),
      preferredEpicDuration: z.number().optional(),
      commonContexts: z.array(z.string()).optional(),
      suggestedWorkload: z.enum(["light", "normal", "heavy"]).optional(),
    }).optional(),
  }),
});

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

    const response = await fetch(`${supabaseUrl}/functions/v1/classify-task-intent`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: message }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return {
      type: data.type,
      confidence: data.confidence,
      reasoning: data.reasoning,
      suggestedDeadline: data.suggestedDeadline,
      suggestedDuration: data.suggestedDuration,
      timelineAnalysis: data.timelineAnalysis,
    } as ClassificationHint;
  } catch (error) {
    console.warn("[companion-planner-chat] classify-task-intent fallback failed", error);
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
      blockedMessage: "Too many companion planner requests. Please try again shortly.",
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
      parsed.data.classificationHint as ClassificationHint | null | undefined,
    );

    const result = buildPlannerResponse({
      message: parsed.data.message,
      currentDate: parsed.data.currentDate,
      horizon: parsed.data.horizon,
      tonePack: parsed.data.tonePack,
      sessionState: parsed.data.sessionState as PlannerSessionState,
      parsedInput: (parsed.data.parsedInput as ParsedInputHint | undefined) ?? null,
      classificationHint,
      plannerContext: parsed.data.plannerContext,
    } satisfies PlannerBuildInput);

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    console.error("[companion-planner-chat] unhandled error", error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "PLANNER_FAILED",
      error: "Failed to build companion plan",
      requestId,
    });
  }
});
