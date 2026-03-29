import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { PromptBuilder } from "../_shared/promptBuilder.ts";
import { OutputValidator } from "../_shared/outputValidator.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { errorResponse, type RequestAuth, requireRequestAuth } from "../_shared/auth.ts";
import {
  checkRateLimit,
  createRateLimitResponse,
  logRateLimitedInvocation,
  RATE_LIMITS,
} from "../_shared/rateLimiter.ts";

const WeeklyInsightsSchema = z.object({
  weeklyData: z.object({
    habitCount: z.number().int().min(0),
    checkInCount: z.number().int().min(0),
    moodCount: z.number().int().min(0),
    activities: z.array(z.any()).max(100),
  }),
});

const MODEL_NAME = "google/gemini-2.5-flash";
const RATE_LIMIT_KEY = "weekly-insights";

interface GenerateWeeklyInsightsDeps {
  authenticate: (req: Request, corsHeaders: HeadersInit) => Promise<RequestAuth | Response>;
  createSupabaseClient: () => any;
  fetchImpl: typeof fetch;
  checkRateLimitFn: typeof checkRateLimit;
  now: () => number;
}

const defaultDeps: GenerateWeeklyInsightsDeps = {
  authenticate: requireRequestAuth,
  createSupabaseClient: () => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    return createClient(supabaseUrl, supabaseKey);
  },
  fetchImpl: fetch,
  checkRateLimitFn: checkRateLimit,
  now: () => Date.now(),
};

export async function handleGenerateWeeklyInsights(
  req: Request,
  deps: GenerateWeeklyInsightsDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);
  const startTime = deps.now();

  try {
    const requestAuth = await deps.authenticate(req, corsHeaders);
    if (requestAuth instanceof Response) {
      return requestAuth;
    }

    if (requestAuth.isServiceRole) {
      return errorResponse(403, "User authentication required", corsHeaders);
    }

    const body = await req.json();
    const validation = WeeklyInsightsSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid input",
          details: validation.error.errors,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = requestAuth.userId;
    const { weeklyData } = validation.data;

    const supabase = deps.createSupabaseClient();

    const rateLimit = await deps.checkRateLimitFn(
      supabase,
      userId,
      RATE_LIMIT_KEY,
      RATE_LIMITS[RATE_LIMIT_KEY],
    );

    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit, corsHeaders);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("selected_mentor_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.selected_mentor_id) {
      throw new Error("No mentor selected");
    }

    const { data: mentor } = await supabase
      .from("mentors")
      .select("name, tone_description")
      .eq("id", profile.selected_mentor_id)
      .maybeSingle();

    if (!mentor) {
      throw new Error("Mentor not found");
    }

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const promptBuilder = new PromptBuilder(supabaseUrl, supabaseKey);

    const activitiesSummary = weeklyData.activities.slice(0, 10)
      .map((activity: any) => `${activity.type}: ${JSON.stringify(activity.data)}`)
      .join("\n");

    const { systemPrompt, userPrompt, validationRules, outputConstraints } = await promptBuilder.build({
      templateKey: "weekly_insights",
      userId,
      variables: {
        mentorName: mentor.name,
        mentorTone: mentor.tone_description,
        habitCount: weeklyData.habitCount,
        checkInCount: weeklyData.checkInCount,
        moodCount: weeklyData.moodCount,
        activitiesSummary,
        maxSentences: 6,
        personalityModifiers: "",
        responseLength: "brief",
      },
    });

    const response = await deps.fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 400,
        temperature: 0.75,
      }),
    });

    if (!response.ok) {
      console.error("AI API error:", await response.text());
      throw new Error("AI generation failed");
    }

    const aiData = await response.json();
    const insight = aiData.choices?.[0]?.message?.content?.trim();

    if (!insight) {
      throw new Error("No insight generated");
    }

    const validator = new OutputValidator(validationRules, outputConstraints);
    const validationResult = validator.validate(insight);
    const responseTime = deps.now() - startTime;

    await logRateLimitedInvocation(supabase, {
      userId,
      templateKey: RATE_LIMIT_KEY,
      inputData: {
        weeklyData,
        promptTemplateKey: "weekly_insights",
      },
      outputData: { insight },
      validationPassed: validationResult.isValid,
      validationErrors: validationResult.errors && validationResult.errors.length > 0 ? validationResult.errors : null,
      modelUsed: MODEL_NAME,
      responseTimeMs: responseTime,
    });

    if (!validationResult.isValid) {
      console.warn("Validation warnings:", validator.getValidationSummary(validationResult));
    }

    return new Response(JSON.stringify({ success: true, insight }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleGenerateWeeklyInsights(req));
}
