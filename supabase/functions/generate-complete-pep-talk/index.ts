import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { applyAbuseProtection, createSafeErrorResponse, getClientIpAddress } from "../_shared/abuseProtection.ts";
import {
  createRateLimitResponse,
  logRateLimitedInvocation,
} from "../_shared/rateLimiter.ts";
import { errorResponse, type RequestAuth, requireRequestAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL_NAME = "google/gemini-2.5-flash";
const RATE_LIMIT_KEY = "pep-talk-generation";

interface GenerateCompletePepTalkDeps {
  authenticate: (req: Request, corsHeaders: HeadersInit) => Promise<RequestAuth | Response>;
  createSupabaseClient: () => any;
  fetchImpl: typeof fetch;
  checkRateLimitFn?: unknown;
  now: () => number;
  applyAbuseProtectionFn?: typeof applyAbuseProtection;
}

const defaultDeps: GenerateCompletePepTalkDeps = {
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

export async function handleGenerateCompletePepTalk(
  req: Request,
  deps: GenerateCompletePepTalkDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let requestId: string = crypto.randomUUID();

  try {
    const requestAuth = await deps.authenticate(req, corsHeaders);
    if (requestAuth instanceof Response) {
      return requestAuth;
    }

    if (requestAuth.isServiceRole) {
      return errorResponse(403, "User authentication required", corsHeaders);
    }

    const {
      mentorSlug,
      userId: _ignoredUserId,
      topic_category,
      intensity,
      emotionalTriggers,
      time_of_day,
      habit_context,
    } = await req.json();

    const categories = Array.isArray(topic_category) ? topic_category : (topic_category ? [topic_category] : []);

    if (!mentorSlug) {
      return errorResponse(400, "mentorSlug is required", corsHeaders);
    }

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const supabase = deps.createSupabaseClient();
    if (typeof deps.checkRateLimitFn === "function") {
      const rateLimit = await (deps.checkRateLimitFn as (
        supabase: unknown,
        userId: string,
        rateLimitKey: string,
      ) => Promise<{ allowed: boolean; available: boolean; remaining: number; limit: number; resetAt: Date }>)(
        supabase,
        requestAuth.userId,
        RATE_LIMIT_KEY,
      );

      if (!rateLimit.allowed) {
        return createRateLimitResponse(rateLimit, corsHeaders);
      }
    } else if (typeof supabase.rpc === "function") {
      const abuseResult = await (deps.applyAbuseProtectionFn ?? applyAbuseProtection)(req, supabase, {
        profileKey: "ai.standard",
        endpointName: "generate-complete-pep-talk",
        userId: requestAuth.userId,
        requestId,
        ipAddress: getClientIpAddress(req),
      });
      if (abuseResult instanceof Response) {
        return abuseResult;
      }
      requestId = abuseResult.requestId;
    }

    const { data: mentor, error: mentorError } = await supabase
      .from("mentors")
      .select("*")
      .eq("slug", mentorSlug)
      .single();

    if (mentorError || !mentor) {
      throw new Error(`Mentor not found: ${mentorSlug}`);
    }

    console.log("Generating complete pep talk for mentor:", mentor.name);

    const categoryRules: Record<string, string> = {
      discipline: "habits, consistency, self-respect, taking action",
      confidence: "self-worth, believing in yourself, celebrating past wins",
      physique: "training, body goals, self-image, health and fitness",
      focus: "clarity, priorities, reducing distractions",
      mindset: "perspective, resilience, thinking patterns",
      business: "money, career, taking risks, the long game, responsibility",
    };

    let categoryGuidance = "";
    if (categories.length > 0) {
      const primaryCategory = categories[0];
      const secondaryCategories = categories.slice(1);

      categoryGuidance = `
PRIMARY CATEGORY (60% of content focus): ${categoryRules[primaryCategory] || primaryCategory}
- Build the TITLE, QUOTE, DESCRIPTION, and SCRIPT around this theme
- This is what the pep talk is ABOUT`;

      if (secondaryCategories.length > 0) {
        const secondaryThemes = secondaryCategories.map((category) => categoryRules[category] || category).join(", ");
        categoryGuidance += `
SECONDARY CATEGORIES (light references only, 1-2 mentions max): ${secondaryThemes}`;
      }
    }

    const emotionalGuidanceMap: Record<string, string> = {
      Exhausted: "address low energy states, encourage sustainable pacing",
      "Avoiding Action": "speak to procrastination, emphasize starting small",
      "Anxious & Overthinking": "provide calming perspective and grounding",
      "Self-Doubt": "affirm capability and worth, point to evidence",
      "Feeling Stuck": "offer fresh perspective, encourage decisive action",
      Frustrated: "help channel emotion productively, reframe challenges",
      "Heavy or Low": "validate difficulty, spark hope through small wins",
      "Emotionally Hurt": "acknowledge pain, guide toward healing without assumptions",
      Unmotivated: "ignite momentum, focus on getting started",
      "In Transition": "normalize change, guide through uncertainty",
      "Needing Discipline": "emphasize structure and commitment",
      "Motivated & Ready": "amplify existing energy, maintain momentum",
    };

    let emotionalContext = "";
    if (emotionalTriggers?.length > 0) {
      const primaryTriggers = emotionalTriggers.slice(0, 2);
      const backgroundTriggers = emotionalTriggers.slice(2);

      emotionalContext = `
PRIMARY EMOTIONAL TRIGGERS (25-30% of content, shape opening):
${primaryTriggers.map((trigger: string) => `- ${trigger}: ${emotionalGuidanceMap[trigger] || trigger}`).join("\n")}
- Address this general state WITHOUT making specific assumptions about the listener's personal feelings
- Speak to the trigger universally, not as if you know their exact situation`;

      if (backgroundTriggers.length > 0) {
        emotionalContext += `
BACKGROUND TRIGGERS (subtle mentions only): ${backgroundTriggers.join(", ")}`;
      }
    }

    const intensityMap: Record<string, string> = {
      gentle: "soft, calm, reassuring - like a supportive friend",
      medium: "motivating, direct, confident - balanced energy",
      high: "hype, urgent, energetic - peak state, strong but never abusive",
    };

    const intensityGuidance = `
INTENSITY LEVEL (10-15% - affects delivery, not message):
${intensityMap[intensity || "medium"] || intensityMap.medium}`;

    let contextGuidance = "";

    if (time_of_day) {
      const timeMap: Record<string, string> = {
        morning: "Set tone for the day - fresh start energy",
        afternoon: "Reset and refocus - mid-day realignment",
        night: "Reflect and prep for tomorrow - wind down but stay ready",
      };
      contextGuidance += `
TIME OF DAY: ${timeMap[time_of_day] || time_of_day}`;
    }

    if (habit_context) {
      const habitMap: Record<string, string> = {
        starting: "Identity shift + small steps",
        restarting: "Compassion + rebuilding trust",
        maintaining: "Momentum + identity reinforcement",
      };
      contextGuidance += `
HABIT CONTEXT: ${habitMap[habit_context] || habit_context}`;
    }

    const systemPrompt = `You are ${mentor.name}, ${mentor.description}.

Voice Style: ${mentor.voice_style}
Tone: ${mentor.tone_description}
${mentor.identity_description ? `Identity: ${mentor.identity_description}` : ""}
${mentor.style_description ? `Style: ${mentor.style_description}` : ""}

---

WEIGHTING MODEL (CRITICAL):
${categoryGuidance}
${emotionalContext}
${intensityGuidance}
${contextGuidance}

---

SIMPLE RULE:
- Categories = what it's ABOUT (60%)
- Triggers = the EMOTIONAL ANGLE (25-30%)
- Intensity = how it's DELIVERED (10-15%)
- Mentor = the FLAVOR

---

Generate a complete pep talk with:
1. TITLE (max 60 chars) - reflects the PRIMARY CATEGORY theme
2. QUOTE (1-2 sentences, max 150 chars) - captures the core message + emotional angle
3. DESCRIPTION (2-3 sentences) - explains what this pep talk covers, tied to PRIMARY CATEGORY
4. SCRIPT (2-3 paragraphs, conversational) -
   - Opens with PRIMARY EMOTIONAL TRIGGER(s)
   - 60% built around PRIMARY CATEGORY
   - Light references to secondary categories if any
   - Direct address to listener
   - Sounds like you speaking to someone face-to-face
   - Personal, specific, motivating
   - CRITICAL: Do NOT make specific assumptions about the listener's personal feelings (avoid phrases like "I can feel your pain" or "I know you're hurting right now")
   - Instead, speak to the general state or challenge WITHOUT claiming to know their exact emotional experience
   - Be empathetic and understanding while maintaining appropriate distance

Return ONLY a valid JSON object:
{
  "title": "...",
  "quote": "...",
  "description": "...",
  "script": "..."
}`;

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
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate a complete pep talk now." },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (aiResponse.status === 402) {
        throw new Error("Payment required. Please add credits to your OpenAI workspace.");
      }
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      throw new Error("Failed to generate content from AI");
    }

    const aiData = await aiResponse.json();
    const generatedContent = aiData.choices[0].message.content;

    console.log("Raw AI response:", generatedContent);

    let pepTalkData;
    try {
      const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
      pepTalkData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(generatedContent);
    } catch (_error) {
      console.error("Failed to parse AI response:", generatedContent);
      throw new Error("Failed to parse AI response as JSON");
    }

    if (!pepTalkData.title || !pepTalkData.quote || !pepTalkData.description || !pepTalkData.script) {
      throw new Error("AI response missing required fields");
    }

    await logRateLimitedInvocation(supabase, {
      userId: requestAuth.userId,
      templateKey: RATE_LIMIT_KEY,
      inputData: {
        mentorSlug,
        topic_category,
        intensity,
        emotionalTriggers,
        time_of_day,
        habit_context,
      },
      outputData: {
        title: pepTalkData.title,
        quote: pepTalkData.quote,
      },
      validationPassed: true,
      modelUsed: MODEL_NAME,
      responseTimeMs: deps.now() - startedAt,
    });

    console.log("Successfully generated pep talk content:", pepTalkData.title);

    return new Response(
      JSON.stringify({
        title: pepTalkData.title,
        quote: pepTalkData.quote,
        description: pepTalkData.description,
        script: pepTalkData.script,
        category: topic_category || "motivation",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in generate-complete-pep-talk:", error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Request could not be processed right now",
      requestId,
    });
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleGenerateCompletePepTalk(req));
}
