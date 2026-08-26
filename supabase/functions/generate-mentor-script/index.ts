import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { requireInternalRequest } from "../_shared/auth.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import {
  CHRISTIAN_GUIDANCE_POLICY,
  enforceChristianGuidanceOutput,
} from "../_shared/christianGuidancePolicy.ts";
import { buildLocalDailyEncouragementScript } from "../_shared/dailyEncouragementScript.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_ENCOURAGEMENT_FALLBACK =
  "God’s grace is not measured by how much you accomplish today. Take a breath, receive your limits without shame, and choose one honest act of love, faithfulness, or repair. You do not have to force certainty about the future. Bring what feels heavy to God in prayer, seek wise support when you need it, and take the next small step with humility and hope.";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractGeneratedScript(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return "";

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== "object") return "";

  const message = (firstChoice as { message?: unknown }).message;
  if (!message || typeof message !== "object") return "";

  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content.trim() : "";
}

function scriptMentionsMentorName(script: string, mentorName: string): boolean {
  const trimmedName = mentorName.trim();
  if (!trimmedName) return false;

  const unprefixedName = trimmedName.replace(/^the\s+/i, "").trim();
  const names = Array.from(new Set([trimmedName, unprefixedName]))
    .filter((name) => name.length >= 4);

  return names.some((name) => {
    const escapedName = escapeRegExp(name);
    const introPatterns = [
      new RegExp(`^\\s*${escapedName}\\s*[:,.-]`, "i"),
      new RegExp(`\\b(?:i\\s*(?:am|'m)|this is|it's)\\s+${escapedName}\\b`, "i"),
      new RegExp(`\\b${escapedName}\\s+(?:wants|says|here|speaking|knows|believes)\\b`, "i"),
    ];

    return introPatterns.some((pattern) => pattern.test(script));
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireInternalRequest(req, corsHeaders);
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const { 
      mentorSlug, 
      topic_category, 
      intensity, 
      emotionalTriggers,
      time_of_day,
      habit_context,
      productMode: requestedProductMode,
    } = await req.json();
    const productMode = requestedProductMode === "cosmiq" ? "cosmiq" : "graceward";
    
    // topic_category can now be a string or an array
    const categories = Array.isArray(topic_category) ? topic_category : (topic_category ? [topic_category] : []);

    if (!mentorSlug) {
      throw new Error("mentorSlug is required");
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase service credentials are not configured");
    }

    // Fetch mentor details
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const costGuardrails = createCostGuardrailSession({
      supabase,
      endpointKey: "generate-mentor-script",
      featureKey: "ai_pep_talks",
    });
    const guardedFetch = costGuardrails.wrapFetch(fetch);
    await costGuardrails.enforceAccess({
      capabilities: ["text"],
      providers: ["openai"],
    });

    const { data: mentor, error: mentorError } = await supabase
      .from(productMode === "graceward" ? "graceward_guides" : "mentors")
      .select("*")
      .eq("slug", mentorSlug)
      .single();

    if (mentorError || !mentor) {
      throw new Error(`Mentor not found: ${mentorSlug}`);
    }

    console.log(`Generating script for mentor ${mentor.name}`);

    const buildAuthoredFallback = () => productMode === "graceward"
      ? enforceChristianGuidanceOutput(
        buildLocalDailyEncouragementScript({
          mentorSlug,
          category: categories[0],
          intensity,
          emotionalTriggers: Array.isArray(emotionalTriggers) ? emotionalTriggers : [],
        }),
        { fallback: DAILY_ENCOURAGEMENT_FALLBACK },
      )
      : "Take a breath and narrow the field. Choose one useful next step, make it small enough to begin now, and let steady action rebuild momentum without turning today into a verdict on your worth.";

    // WEIGHTING MODEL: Categories 60%, Emotional Triggers 25-30%, Intensity 10-15%

    // 1. CATEGORIES (60% - THE MAIN THEME)
    const categoryRules: Record<string, string> = {
      discipline: "faithful habits, consistency without perfectionism, and taking one honest next step",
      confidence: "courage grounded beyond achievement, receiving grace, and acting without self-exaltation",
      wellbeing: "grateful care for the body, honoring limits, rest, health, and sustainable effort",
      focus: "clarity, wise priorities, reducing distractions, and attending to what is truly ours to do",
      mindset: "hope, humility, resilience, truthful perspective, and freedom from shame",
      stewardship: "work, money, time, gifts, responsibility, generosity, integrity, and the long view",
      strategy: "discernment, patient decision-making, separating signal from noise, and choosing a wise next step",
      boundaries: "loving limits, discernment, honest communication, rest, safety, and seeking wise counsel",
      habits: "small faithful rhythms, sustainable consistency, and returning without shame after disruption",
      identity: "worth beyond productivity or approval, belonging, humility, and choices shaped by love",
      reflection: "honest review, gratitude, lament, repentance, repair, emotional clarity, and learning from the current season",
    };

    let categoryGuidance = "";
    if (categories.length > 0) {
      const primaryCategory = categories[0];
      const secondaryCategories = categories.slice(1);
      
      categoryGuidance = `
PRIMARY CATEGORY (60% of script focus): ${categoryRules[primaryCategory] || primaryCategory}
- This is the MAIN THEME of the message
- Build the core message around this`;

      if (secondaryCategories.length > 0) {
        const secondaryThemes = secondaryCategories.map(cat => categoryRules[cat] || cat).join(", ");
        categoryGuidance += `
SECONDARY CATEGORIES (light references only, 1-2 mentions max): ${secondaryThemes}`;
      }
    }

    // 2. EMOTIONAL TRIGGERS (25-30% - THE EMOTIONAL ANGLE)
    const emotionalGuidanceMap: Record<string, string> = {
      "Exhausted": "address low energy states, encourage sustainable pacing",
      "Avoiding Action": "speak to procrastination, emphasize starting small",
      "Anxious & Overthinking": "provide calming perspective and grounding",
      "Self-Doubt": "affirm dignity without promising outcomes or making achievement the source of worth",
      "Feeling Stuck": "offer fresh perspective, encourage decisive action",
      "Frustrated": "help channel emotion productively, reframe challenges",
      "Heavy or Low": "validate difficulty, allow lament, and offer realistic hope without spiritual bypassing",
      "Emotionally Hurt": "acknowledge pain, guide toward healing without assumptions",
      "Late Night Spiral": "reduce urgency, interrupt rumination, and guide toward one calming next step",
      "Unmotivated": "reduce shame and focus on one sustainable beginning",
      "In Transition": "normalize change, guide through uncertainty",
      "Needing Discipline": "emphasize structure and commitment",
      "Motivated & Ready": "amplify existing energy, maintain momentum",
    };

    let triggerGuidance = "";
    if (emotionalTriggers?.length > 0) {
      const primaryTriggers = emotionalTriggers.slice(0, 2);
      const backgroundTriggers = emotionalTriggers.slice(2);
      
      triggerGuidance = `
PRIMARY EMOTIONAL TRIGGERS (25-30% of script, shape opening tone):
${primaryTriggers.map((t: string) => `- ${t}: ${emotionalGuidanceMap[t] || t}`).join('\n')}
- Open addressing this general state
- Speak to it universally WITHOUT claiming to know the listener's exact feelings or situation`;

      if (backgroundTriggers.length > 0) {
        triggerGuidance += `
BACKGROUND TRIGGERS (subtle, don't force):
${backgroundTriggers.map((t: string) => `- ${t}`).join(', ')}`;
      }
    }

    // 3. INTENSITY (10-15% - DELIVERY STYLE)
    const intensityMap: Record<string, string> = {
      soft: "soft, calm, reassuring delivery - grounded and emotionally safe",
      gentle: "soft, calm, reassuring delivery - like a supportive friend",
      medium: "motivating, direct, confident - balanced energy",
      strong: "firm, energized, and decisive - clear encouragement without contempt, shame, or spiritual pressure",
      high: "energetic and urgent without hype, coercion, fear, shame, or promises of guaranteed results",
    };

    const intensityGuidance = `
INTENSITY LEVEL (10-15% - affects delivery style, not message):
${intensityMap[intensity || "medium"] || intensityMap.medium}`;

    // 4. OPTIONAL CONTEXT
    let contextGuidance = "";
    
    if (time_of_day) {
      const timeMap: Record<string, string> = {
        morning: "Set the tone for the day ahead - fresh start energy",
        afternoon: "Reset and refocus - mid-day realignment",
        night: "Reflect and prep for tomorrow - wind down but stay ready",
      };
      contextGuidance += `
TIME OF DAY CONTEXT: ${timeMap[time_of_day] || time_of_day}`;
    }

    if (habit_context) {
      const habitMap: Record<string, string> = {
        starting: "Identity shift + small steps - you're becoming this person",
        restarting: "Compassion + rebuilding trust with yourself",
        maintaining: "Momentum + identity reinforcement - you ARE this now",
      };
      contextGuidance += `
HABIT CONTEXT: ${habitMap[habit_context] || habit_context}`;
    }

    const variationSeed = crypto.randomUUID();
    const gracewardSystemPrompt = `You are writing a short spoken Christian encouragement for "Graceward" using the communication style of the fictional Guide ${mentor.name}. You are not ${mentor.name}, a pastor, or a spiritual authority, and the script must not claim otherwise.

MENTOR PROFILE:
- Name: ${mentor.name}
- Tone: ${mentor.tone_description}
- Voice Style: ${mentor.voice_style}
- Description: ${mentor.description}
${mentor.themes ? `- Themes: ${mentor.themes.join(", ")}` : ""}

⸻

WEIGHTING MODEL (CRITICAL):
${categoryGuidance}
${triggerGuidance}
${intensityGuidance}
${contextGuidance}

⸻

SIMPLE RULE:
• Categories = what the encouragement is ABOUT (60%)
• Triggers = the EMOTIONAL ANGLE (25-30%)
• Intensity = how it is DELIVERED (10-15%)
• Guide = the communication style only

⸻

YOUR TASK:
Write a 45-90 second daily encouragement that:
- Is built primarily around the PRIMARY CATEGORY theme
- Opens with the PRIMARY EMOTIONAL TRIGGER(s)
- Uses the intensity level to shape delivery (tone, pace, energy)
- Uses ${mentor.name}'s communication style while remaining transparently an AI-generated Graceward reflection
- Contains 8-12 sentences
- Feels warm, specific, hopeful, and grounded in a broadly Christian worldview
- Naturally connects the subject to grace, faithful stewardship, love of God and neighbor, prayer, humility, hope, rest, repentance, or repair when relevant
- Makes clear through the wording that worth is not earned through productivity, discipline, wealth, appearance, or a perfect spiritual record
- Offers one small, optional next step rather than turning the encouragement into a command or spiritual test
- Uses NO emojis or special formatting
- Sounds conversational and human when spoken aloud
- Does NOT explicitly say "category" or "trigger"
- Does NOT say, introduce, label, or mention the Guide's name in the script
- Does NOT impersonate the Guide, God, Jesus, the Holy Spirit, clergy, or any human authority
- Does NOT quote, paraphrase as a quotation, or cite Scripture because no approved Scripture text is supplied to this request
- CRITICAL: Do NOT make specific assumptions about the listener's personal feelings (avoid "I can feel your pain", "I know you're hurting", "I sense your struggle")
- Instead, speak to the challenge or state in general terms while remaining empathetic and supportive

${CHRISTIAN_GUIDANCE_POLICY}

CRITICAL VARIATION REQUIREMENT - CREATE MAXIMUM DIVERSITY:
Every script MUST sound completely different. Vary these aggressively:

OPENINGS (rotate through different approaches):
• Provocative question / Bold statement / Observation / Challenge / Reframe / Quick story beat

STRUCTURAL FLOW (use different patterns):
• Problem→solution / Contrast pattern / Build to climax / Circular reasoning / Call-and-response

CONTENT TOOLS (mix it up):
• Metaphors: Draw from sports / nature / building / combat / creation / journey (use different ones)
• Examples: Vary between abstract concepts and concrete scenarios
• Angles: Identity / action / emotion / systems / habits

STYLE VARIATION (change the feel):
• Sentence rhythm: Punchy short / Flowing long / Mixed cadence
• Energy shifts: Start strong→settle / Build momentum / Even intensity
• Language register: Raw & direct / Thoughtful / Grounded & practical

NEVER USE:
• Repeated opening phrases like "Look", "Here's the thing", "Listen"
• Same metaphors or analogies
• Identical sentence patterns
• Generic motivational clichés
• The mentor's name or third-person mentor references

GOAL: Two scripts on the same topic should feel like different conversations while both remaining recognizably Christian, grace-centered, emotionally safe, and practical.

Write ONLY the script text, nothing else.`;
    const systemPrompt = productMode === "graceward"
      ? gracewardSystemPrompt
      : `You are writing a short spoken encouragement for Cosmiq using the communication style of the fictional guide ${mentor.name}. You are software, not ${mentor.name}, a human mentor, or a professional adviser.

MENTOR PROFILE:
- Tone: ${mentor.tone_description}
- Voice Style: ${mentor.voice_style}
- Description: ${mentor.description}

${categoryGuidance}
${triggerGuidance}
${intensityGuidance}
${contextGuidance}

Write 8-12 conversational sentences for a 45-90 second spoken message. Be practical, specific, and grounded. Offer one small optional next step. Never use Scripture, prayer, theology, religious claims, or Graceward framing. Never diagnose, shame, promise an outcome, infer private feelings, mention the guide's name, or claim professional authority. Return only the script text.`;

    const response = await guardedFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate the daily ${productMode === "graceward" ? "Christian " : ""}encouragement. Variation seed: ${variationSeed}. Do not mention the seed.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.warn("AI script provider unavailable; using authored Christian encouragement", {
        mentorSlug,
        status: response.status,
      });
      return new Response(
        JSON.stringify({ script: buildAuthoredFallback(), source: "authored_fallback" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    let script = extractGeneratedScript(data);
    if (!script) {
      return new Response(
        JSON.stringify({ script: buildAuthoredFallback(), source: "authored_fallback" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (scriptMentionsMentorName(script, mentor.name)) {
      console.warn(`Generated script mentioned mentor name for ${mentor.name}; retrying once`);
      const retryResponse = await guardedFetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content:
                `Regenerate the script. The previous draft mentioned "${mentor.name}". ` +
                "Do not say the mentor name, do not introduce yourself, and do not use third-person mentor references.",
            },
          ],
        }),
      });

      if (!retryResponse.ok) {
        console.warn("AI script retry unavailable; using authored Christian encouragement", {
          mentorSlug,
          status: retryResponse.status,
        });
        return new Response(
          JSON.stringify({ script: buildAuthoredFallback(), source: "authored_fallback" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const retryData = await retryResponse.json();
      const retryScript = extractGeneratedScript(retryData);
      if (!retryScript || scriptMentionsMentorName(retryScript, mentor.name)) {
        return new Response(
          JSON.stringify({ script: buildAuthoredFallback(), source: "authored_fallback" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      script = retryScript;
    }

    if (productMode === "graceward") {
      script = enforceChristianGuidanceOutput(script, {
        fallback: DAILY_ENCOURAGEMENT_FALLBACK,
      });
    }

    console.log(`Script generated successfully for ${mentor.name}`);

    return new Response(
      JSON.stringify({ script }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }
    console.error("Error in generate-mentor-script function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
