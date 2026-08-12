import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSafeErrorResponse, requireProtectedRequest } from "../_shared/abuseProtection.ts";
import { getCorsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import {
  buildFormationInstructions,
  FORMATION_PROMPT_VERSION,
  GENERATED_PRACTICE_SCHEMA,
  parseGeneratedPractice,
  validateGeneratedPractice,
  type FormationCategory,
  type RecentFormationPractice,
} from "./generator.ts";

const ENDPOINT_NAME = "generate-daily-formation";
const DEFAULT_MODEL = "gpt-5.6-luna";
const VALID_CATEGORIES = new Set<FormationCategory>(["Mind", "Body", "Soul"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface OpenAIResponse {
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string; refusal?: string }>;
  }>;
}

function responseText(value: OpenAIResponse): string | null {
  if (typeof value.output_text === "string" && value.output_text.trim()) {
    return value.output_text.trim();
  }
  for (const item of value.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text?.trim()) return content.text.trim();
    }
  }
  return null;
}

function compactContext(value: unknown, limit = 600): string | null {
  if (typeof value === "string") return value.trim().slice(0, limit) || null;
  if (!value || typeof value !== "object") return null;
  try {
    return JSON.stringify(value).slice(0, limit);
  } catch {
    return null;
  }
}

async function privacySafeIdentifier(userId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId));
  return `graceward_${Array.from(new Uint8Array(digest)).slice(0, 12).map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")}`;
}

async function generatedPracticeKey(
  userId: string,
  practiceDate: string,
  category: FormationCategory,
  title: string,
  action: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${userId}:${practiceDate}:${category}:${title}:${action}`),
  );
  const hex = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `generated-${hex.slice(0, 24)}`;
}

function preparedExistingRow(existing: Record<string, unknown>, progress: Record<string, unknown> | null) {
  return {
    assignment_id: existing.id,
    practice_date: existing.practice_date,
    practice_key: existing.practice_key,
    category: existing.category,
    focus: existing.focus,
    practice_source: existing.practice_source,
    title: existing.title,
    action: existing.action,
    benefit: existing.benefit,
    minutes: existing.minutes,
    xp_reward: existing.xp_reward,
    selection_reason: existing.selection_reason,
    scripture_reference: existing.scripture_reference,
    generation_model: existing.generation_model,
    generation_prompt_version: existing.generation_prompt_version,
    task_id: existing.task_id,
    completed_at: existing.completed_at,
    total_xp: progress?.total_xp ?? 0,
    practices_completed: progress?.practices_completed ?? 0,
  };
}

export async function handleGenerateDailyFormation(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return handleCors(req);
  const corsHeaders = getCorsHeaders(req);
  let requestId: string = crypto.randomUUID();

  try {
    if (req.method !== "POST") {
      return createSafeErrorResponse(req, {
        status: 405,
        code: "METHOD_NOT_ALLOWED",
        error: "Method not allowed",
        requestId,
      });
    }

    const context = await requireProtectedRequest(req, {
      profileKey: "ai.standard",
      endpointName: ENDPOINT_NAME,
      allowServiceRole: false,
      blockedMessage: "Daily formation is being prepared too often. Please try again later.",
    });
    if (context instanceof Response) return context;
    requestId = context.requestId;

    const body = await req.json().catch(() => ({}));
    const practiceDate = typeof body?.practiceDate === "string" ? body.practiceDate : "";
    const category = typeof body?.category === "string" ? body.category as FormationCategory : null;
    if (!DATE_PATTERN.test(practiceDate) || !category || !VALID_CATEGORIES.has(category)) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "INVALID_REQUEST",
        error: "A valid practice date and formation category are required",
        requestId,
      });
    }

    const assignmentColumns = [
      "id", "practice_date", "practice_key", "category", "focus", "practice_source",
      "title", "action", "benefit", "minutes", "xp_reward", "selection_reason",
      "scripture_reference", "generation_model", "generation_prompt_version",
      "task_id", "completed_at",
    ].join(", ");
    const { data: existing, error: existingError } = await context.supabase
      .from("daily_formation_assignments")
      .select(assignmentColumns)
      .eq("user_id", context.auth.userId)
      .eq("practice_date", practiceDate)
      .eq("category", category)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing) {
      const { data: progress } = await context.supabase
        .from("formation_progress")
        .select("total_xp, practices_completed")
        .eq("user_id", context.auth.userId)
        .maybeSingle();
      return jsonResponse(req, {
        assignment: preparedExistingRow(
          existing as unknown as Record<string, unknown>,
          progress as unknown as Record<string, unknown> | null,
        ),
        cached: true,
      });
    }

    const [historyResult, learningResult, reflectionsResult, profileResult] = await Promise.all([
      context.supabase
        .from("daily_formation_assignments")
        .select("title, action, category, practice_date, completed_at")
        .eq("user_id", context.auth.userId)
        .eq("category", category)
        .order("practice_date", { ascending: false })
        .limit(20),
      context.supabase
        .from("user_ai_learning")
        .select("successful_patterns, overwhelm_signals")
        .eq("user_id", context.auth.userId)
        .maybeSingle(),
      context.supabase
        .from("evening_reflections")
        .select("mood, wins, additional_reflection, tomorrow_adjustment")
        .eq("user_id", context.auth.userId)
        .order("reflection_date", { ascending: false })
        .limit(3),
      context.supabase
        .from("profiles")
        .select("faction")
        .eq("id", context.auth.userId)
        .maybeSingle(),
    ]);

    const recent = (historyResult.data ?? []) as RecentFormationPractice[];
    const recentSummary = recent.slice(0, 10).map((item) => `- ${item.title}: ${item.action}`).join("\n") || "- None yet";
    const reflectionSummary = (reflectionsResult.data ?? []).map((item: Record<string, unknown>) => [
      compactContext(item.mood, 60),
      compactContext(item.wins, 160),
      compactContext(item.additional_reflection, 240),
      compactContext(item.tomorrow_adjustment, 160),
    ].filter(Boolean).join(" | ")).join("\n").slice(0, 900) || "No recent reflection supplied";
    const userPrompt = `Prepare the ${category} practice for ${practiceDate}.

Recent ${category} practices to avoid repeating:
${recentSummary}

Minimum useful personalization context:
- Path: ${compactContext(profileResult.data?.faction, 60) ?? "not selected"}
- Recent reflection signals: ${reflectionSummary}
- Learned successful patterns: ${compactContext(learningResult.data?.successful_patterns, 500) ?? "none"}
- Overwhelm signal: ${compactContext(learningResult.data?.overwhelm_signals, 60) ?? "none"}`;

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      console.error(`[${ENDPOINT_NAME}] OPENAI_API_KEY is not configured`);
      return jsonResponse(req, { assignment: null, fallback: true });
    }

    const model = Deno.env.get("OPENAI_FORMATION_MODEL")?.trim() || DEFAULT_MODEL;
    const costGuardrails = createCostGuardrailSession({
      supabase: context.supabase,
      endpointKey: ENDPOINT_NAME,
      featureKey: "daily_formation_generation",
      userId: context.auth.userId,
      requestId,
    });
    const guardedFetch = costGuardrails.wrapFetch(fetch);
    const safetyIdentifier = await privacySafeIdentifier(context.auth.userId);
    let validationFailure = "none";

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const response = await guardedFetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          instructions: buildFormationInstructions(category),
          input: attempt === 1
            ? userPrompt
            : `${userPrompt}\n\nThe previous candidate failed server validation: ${validationFailure}. Produce a meaningfully different valid practice.`,
          reasoning: { effort: "low" },
          text: {
            verbosity: "low",
            format: {
              type: "json_schema",
              name: "daily_formation_practice",
              strict: true,
              schema: GENERATED_PRACTICE_SCHEMA,
            },
          },
          max_output_tokens: 350,
          safety_identifier: safetyIdentifier,
          store: false,
        }),
      });

      if (!response.ok) {
        console.error(`[${ENDPOINT_NAME}] OpenAI error`, response.status, (await response.text()).slice(0, 500));
        break;
      }

      const aiResponse = await response.json() as OpenAIResponse;
      const raw = responseText(aiResponse);
      const practice = raw ? parseGeneratedPractice(raw) : null;
      if (!practice) {
        validationFailure = aiResponse.status === "incomplete"
          ? `incomplete_${aiResponse.incomplete_details?.reason ?? "unknown"}`
          : "invalid_structured_output";
        continue;
      }

      const validation = validateGeneratedPractice(practice, category, recent);
      if (!validation.valid) {
        validationFailure = validation.reason;
        continue;
      }

      const practiceKey = await generatedPracticeKey(
        context.auth.userId,
        practiceDate,
        category,
        practice.title,
        practice.action,
      );
      const { data: prepared, error: prepareError } = await context.supabase.rpc(
        "prepare_generated_daily_formation_practice",
        {
          p_user_id: context.auth.userId,
          p_practice_date: practiceDate,
          p_practice_key: practiceKey,
          p_category: category,
          p_focus: practice.focus,
          p_title: practice.title,
          p_action: practice.action,
          p_benefit: practice.benefit,
          p_minutes: practice.minutes,
          p_selection_reason: "Personalized from your recent rhythm",
          p_scripture_reference: practice.scriptureReference,
          p_generation_model: model,
          p_prompt_version: FORMATION_PROMPT_VERSION,
        },
      ).single();
      if (prepareError) throw prepareError;

      return jsonResponse(req, { assignment: prepared, cached: false, source: "generated" });
    }

    console.warn(`[${ENDPOINT_NAME}] Using reviewed fallback`, { requestId, category, validationFailure });
    return jsonResponse(req, { assignment: null, fallback: true });
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }
    console.error(`[${ENDPOINT_NAME}] Failed`, error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Daily formation could not be personalized right now",
      requestId,
      extraHeaders: corsHeaders,
    });
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleGenerateDailyFormation(req));
}
