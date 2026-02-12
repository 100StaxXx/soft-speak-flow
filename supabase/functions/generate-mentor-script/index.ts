import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      mentorSlug, 
      topic_category, 
      intensity, 
      emotionalTriggers,
      time_of_day,
      habit_context 
    } = await req.json();
    
    // topic_category can now be a string or an array
    const categories = Array.isArray(topic_category) ? topic_category : (topic_category ? [topic_category] : []);

    if (!mentorSlug) {
      throw new Error("mentorSlug is required");
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Fetch mentor details
    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
    const { data: mentor, error: mentorError } = await supabase
      .from("mentors")
      .select("*")
      .eq("slug", mentorSlug)
      .single();

    if (mentorError || !mentor) {
      throw new Error(`Mentor not found: ${mentorSlug}`);
    }

    console.log(`Generating script for mentor ${mentor.name}`);

    // WEIGHTING MODEL: Categories 60%, Emotional Triggers 25-30%, Intensity 10-15%

    // 1. CATEGORIES (60% - THE MAIN THEME)
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
      "Self-Doubt": "affirm capability and worth, point to evidence",
      "Feeling Stuck": "offer fresh perspective, encourage decisive action",
      "Frustrated": "help channel emotion productively, reframe challenges",
      "Heavy or Low": "validate difficulty, spark hope through small wins",
      "Emotionally Hurt": "acknowledge pain, guide toward healing without assumptions",
      "Unmotivated": "ignite momentum, focus on getting started",
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
      gentle: "soft, calm, reassuring delivery - like a supportive friend",
      medium: "motivating, direct, confident - balanced energy",
      high: "hype, urgent, energetic - peak state energy, strong but never abusive",
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

    const systemPrompt = `You are writing a spoken motivational message for "Cosmiq" in the voice of ${mentor.name}.

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
• Categories = what the message is ABOUT (60%)
• Triggers = the EMOTIONAL ANGLE (25-30%)
• Intensity = how it's DELIVERED (10-15%)
• Mentor = the FLAVOR

⸻

YOUR TASK:
Write a 45-90 second spoken message that:
- Is built primarily around the PRIMARY CATEGORY theme
- Opens with the PRIMARY EMOTIONAL TRIGGER(s)
- Uses the intensity level to shape delivery (tone, pace, energy)
- Sounds like ${mentor.name} speaking directly to someone
- Contains 8-12 sentences
- Feels PERSONAL, SPECIFIC, and MOTIVATING
- Uses NO emojis or special formatting
- Sounds conversational and human when spoken aloud
- Does NOT explicitly say "category" or "trigger"
- CRITICAL: Do NOT make specific assumptions about the listener's personal feelings (avoid "I can feel your pain", "I know you're hurting", "I sense your struggle")
- Instead, speak to the challenge or state in general terms while remaining empathetic and supportive

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

GOAL: Two scripts on the same topic should feel like different conversations entirely

Write ONLY the script text, nothing else.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate the motivational script." },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const script = data.choices[0].message.content.trim();

    console.log(`Script generated successfully for ${mentor.name}`);

    return new Response(
      JSON.stringify({ script }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-mentor-script function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
