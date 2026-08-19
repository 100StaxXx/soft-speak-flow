import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applyAbuseProtection, createSafeErrorResponse, getClientIpAddress } from "../_shared/abuseProtection.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { errorResponse, type RequestAuth, requireRequestAuth } from "../_shared/auth.ts";
import {
  logRateLimitedInvocation,
} from "../_shared/rateLimiter.ts";
import {
  CHRISTIAN_GUIDANCE_POLICY,
  enforceChristianGuidanceOutput,
} from "../_shared/christianGuidancePolicy.ts";
import { resolveUserProductMode } from "../_shared/productBoundary.ts";

interface GenerateEveningResponseDeps {
  authenticate: (req: Request, corsHeaders: HeadersInit) => Promise<RequestAuth | Response>;
  createSupabaseClient: () => any;
  fetchImpl: typeof fetch;
  now: () => number;
  applyAbuseProtectionFn?: typeof applyAbuseProtection;
  resolveProductMode?: (supabase: any, userId: string) => Promise<"graceward" | "cosmiq">;
}

const MODEL_NAME = "google/gemini-2.5-flash";
const RATE_LIMIT_KEY = "evening-response";

const defaultDeps: GenerateEveningResponseDeps = {
  authenticate: requireRequestAuth,
  createSupabaseClient: () => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    return createClient(supabaseUrl, supabaseKey);
  },
  fetchImpl: fetch,
  now: () => Date.now(),
  applyAbuseProtectionFn: applyAbuseProtection,
};

export function resolveReflectionAccess(
  requestAuth: RequestAuth,
  reflectionOwnerUserId: string | null | undefined,
): { status: number; error: string } | null {
  if (requestAuth.isServiceRole) {
    return { status: 403, error: "User authentication required" };
  }

  if (!reflectionOwnerUserId || reflectionOwnerUserId !== requestAuth.userId) {
    return { status: 403, error: "Not allowed to access this reflection" };
  }

  return null;
}

export async function handleGenerateEveningResponse(
  req: Request,
  deps: GenerateEveningResponseDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);
  let requestId: string = crypto.randomUUID();

  try {
    const requestAuth = await deps.authenticate(req, corsHeaders);
    if (requestAuth instanceof Response) {
      return requestAuth;
    }

    if (requestAuth.isServiceRole) {
      return errorResponse(403, "User authentication required", corsHeaders);
    }

    const body = await req.json().catch(() => ({}));
    const reflectionId = typeof body?.reflectionId === "string" ? body.reflectionId : null;

    if (!reflectionId) {
      return errorResponse(400, "Missing reflectionId", corsHeaders);
    }

    const supabase = deps.createSupabaseClient();

    const { data: reflectionAccessRow, error: accessError } = await supabase
      .from("evening_reflections")
      .select("id, user_id, mentor_response")
      .eq("id", reflectionId)
      .maybeSingle();

    if (accessError) {
      console.error("Failed to fetch reflection access row:", accessError);
      return errorResponse(500, "Failed to load reflection", corsHeaders);
    }

    if (!reflectionAccessRow) {
      return errorResponse(404, "Reflection not found", corsHeaders);
    }

    const accessErrorResult = resolveReflectionAccess(requestAuth, reflectionAccessRow.user_id);
    if (accessErrorResult) {
      return errorResponse(accessErrorResult.status, accessErrorResult.error, corsHeaders);
    }

    if (reflectionAccessRow.mentor_response) {
      return new Response(
        JSON.stringify({ success: true, response: reflectionAccessRow.mentor_response, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: reflection, error: fetchError } = await supabase
      .from("evening_reflections")
      .select("id, user_id, reflection_date, mood, wins, additional_reflection, tomorrow_adjustment, gratitude, profiles:user_id(selected_mentor_id)")
      .eq("id", reflectionId)
      .eq("user_id", requestAuth.userId)
      .maybeSingle();

    if (fetchError) {
      console.error("Failed to fetch reflection details:", fetchError);
      return errorResponse(500, "Failed to load reflection", corsHeaders);
    }

    if (!reflection) {
      return errorResponse(404, "Reflection not found", corsHeaders);
    }

    const productMode = await (deps.resolveProductMode ?? resolveUserProductMode)(
      supabase,
      requestAuth.userId,
    );

    if (typeof supabase.rpc === "function") {
      const abuseResult = await (deps.applyAbuseProtectionFn ?? applyAbuseProtection)(req, supabase, {
        profileKey: "ai.standard",
        endpointName: "generate-evening-response",
        userId: requestAuth.userId,
        requestId,
        ipAddress: getClientIpAddress(req),
      });
      if (abuseResult instanceof Response) {
        return abuseResult;
      }
      requestId = abuseResult.requestId;
    }

    const { data: dailyThread } = await supabase
      .from("daily_guide_threads")
      .select("focus_label, focus_category, practice_completed_at, companion_answer_label, mentor_name")
      .eq("user_id", requestAuth.userId)
      .eq("thread_date", reflection.reflection_date)
      .maybeSingle();

    let mentorName = dailyThread?.mentor_name || "the user's Guide";
    let mentorTone = "warm and supportive";
    if (reflection.profiles?.selected_mentor_id) {
      const { data: mentor } = await supabase
        .from(productMode === "graceward" ? "graceward_guides" : "mentors")
        .select("name, tone_description")
        .eq("id", reflection.profiles.selected_mentor_id)
        .single();

      if (mentor) {
        mentorName = mentor.name || mentorName;
        mentorTone = mentor.tone_description || mentorTone;
      }
    }

    const prompt = `You are an AI reflection assistant using this communication style: ${mentorTone}

A user has completed their evening reflection:
- Mood: ${reflection.mood}
${reflection.wins ? `- What went well: ${reflection.wins}` : ""}
${reflection.additional_reflection ? `- Additional reflection: ${reflection.additional_reflection}` : ""}
${reflection.tomorrow_adjustment ? `- Tomorrow adjustment: ${reflection.tomorrow_adjustment}` : ""}
${reflection.gratitude ? `- Gratitude: ${reflection.gratitude}` : ""}
${dailyThread?.focus_label ? `- Focus they chose with ${mentorName} this morning: ${dailyThread.focus_label}` : ""}
${dailyThread?.focus_label ? `- Connected ${productMode === "graceward" ? "Faithful Step" : "next step"}: ${dailyThread.practice_completed_at ? "completed" : "not recorded as complete"}` : ""}
${dailyThread?.companion_answer_label ? `- Companion check-in answer: ${dailyThread.companion_answer_label}` : ""}

Write a brief, warm acknowledgment (2-3 sentences max) in ${mentorName}'s Guide voice. When a morning focus or Companion check-in is present, gently return to at most one relevant detail without implying success or failure. Notice gratitude, difficulty, repair, rest, or a small next step without turning the day into a score.${productMode === "graceward" ? " Do not make theological claims about why events happened." : " Do not introduce religious or theological framing."}`;

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
      console.error("OPENAI_API_KEY not configured");
      return new Response(JSON.stringify({ success: true, response: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startedAt = deps.now();
    const aiResponse = await deps.fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          {
            role: "system",
            content: productMode === "graceward"
              ? `You are Graceward's AI reflection assistant. Keep responses brief, warm, and transparent about your limits.\n\n${CHRISTIAN_GUIDANCE_POLICY}`
              : "You are Cosmiq's clearly identified AI reflection guide. Keep responses brief, practical, warm, and non-religious. Do not import Graceward's Christian framing or claim professional authority.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 200,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI response error:", await aiResponse.text());
      return new Response(JSON.stringify({ success: true, response: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const rawResponse = aiData.choices?.[0]?.message?.content?.trim();
    const mentorResponse = rawResponse
      ? (productMode === "graceward" ? enforceChristianGuidanceOutput(rawResponse) : rawResponse)
      : null;

    if (mentorResponse) {
      const { error: updateError } = await supabase
        .from("evening_reflections")
        .update({ mentor_response: mentorResponse })
        .eq("id", reflectionId)
        .eq("user_id", requestAuth.userId);

      if (updateError) {
        console.error("Failed to save mentor response:", updateError);
      } else {
        await logRateLimitedInvocation(supabase, {
          userId: requestAuth.userId,
          templateKey: RATE_LIMIT_KEY,
          inputData: { reflectionId },
          outputData: { response: mentorResponse },
          validationPassed: true,
          modelUsed: MODEL_NAME,
          responseTimeMs: deps.now() - startedAt,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, response: mentorResponse ?? null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-evening-response:", error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Request could not be processed right now",
      requestId,
    });
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleGenerateEveningResponse(req));
}
