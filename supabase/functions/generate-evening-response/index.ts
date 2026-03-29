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

interface GenerateEveningResponseDeps {
  authenticate: (req: Request, corsHeaders: HeadersInit) => Promise<RequestAuth | Response>;
  createSupabaseClient: () => any;
  fetchImpl: typeof fetch;
  now: () => number;
  applyAbuseProtectionFn?: typeof applyAbuseProtection;
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
      .select("id, user_id, mood, wins, additional_reflection, tomorrow_adjustment, gratitude, profiles:user_id(selected_mentor_id)")
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

    let mentorTone = "warm and supportive";
    if (reflection.profiles?.selected_mentor_id) {
      const { data: mentor } = await supabase
        .from("mentors")
        .select("name, tone_description")
        .eq("id", reflection.profiles.selected_mentor_id)
        .single();

      if (mentor) {
        mentorTone = mentor.tone_description || mentorTone;
      }
    }

    const prompt = `You are a supportive wellness mentor with the following tone: ${mentorTone}

A user has completed their evening reflection:
- Mood: ${reflection.mood}
${reflection.wins ? `- What went well: ${reflection.wins}` : ""}
${reflection.additional_reflection ? `- Additional reflection: ${reflection.additional_reflection}` : ""}
${reflection.tomorrow_adjustment ? `- Tomorrow adjustment: ${reflection.tomorrow_adjustment}` : ""}
${reflection.gratitude ? `- Gratitude: ${reflection.gratitude}` : ""}

Write a brief, warm acknowledgment (2-3 sentences max). Be encouraging and validate their feelings. If they shared wins, extra reflection, a tomorrow adjustment, or gratitude, acknowledge those specifically. If they named a tomorrow adjustment, gently reinforce it without sounding prescriptive. Keep it personal and caring.`;

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
            content: "You are a supportive wellness mentor. Keep responses brief, warm, and personal.",
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
    const mentorResponse = aiData.choices?.[0]?.message?.content?.trim();

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
