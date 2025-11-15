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
    const { mentorSlug, topic_category, intensity, emotionalTriggers } = await req.json();

    if (!mentorSlug) {
      throw new Error("mentorSlug is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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

    // Build context for emotional triggers
    const triggerContext = emotionalTriggers?.length
      ? `The user is experiencing: ${emotionalTriggers.join(", ")}.`
      : "";

    // Topic category context
    const topicCategoryMap: Record<string, string> = {
      discipline: "habits, consistency, self-respect, taking action",
      confidence: "self-worth, believing in yourself, celebrating past wins",
      physique: "training, body goals, self-image, health and fitness",
      focus: "clarity, priorities, reducing distractions",
      mindset: "perspective, resilience, thinking patterns",
      business: "money, career, taking risks, the long game, responsibility",
    };

    const topicContext = topic_category
      ? `This message is about ${topicCategoryMap[topic_category] || topic_category}.`
      : "";

    // Emotional trigger guidance
    const emotionalGuidanceMap: Record<string, string> = {
      "Exhausted": "acknowledge low energy, encourage pacing and recharge",
      "Avoiding Action": "address procrastination, emphasize small first steps",
      "Anxious & Overthinking": "provide calming perspective, grounding thoughts",
      "Self-Doubt": "affirm worth and ability, point to proof and belief",
      "Feeling Stuck": "offer new angles, encourage small moves and one decision",
      "Frustrated": "channel emotion productively, reframe without quitting",
      "Heavy or Low": "gentle validation, spark hope, celebrate small wins",
      "Emotionally Hurt": "acknowledge heartbreak or betrayal, guide toward healing",
      "Unmotivated": "ignite spark, build momentum, get them moving",
      "In Transition": "normalize change and uncertainty, guide through identity shifts",
      "Needing Discipline": "emphasize structure and accountability, 'do it anyway' energy",
      "Motivated & Ready": "amplify momentum, don't let it fade, double down",
    };

    const emotionalGuidance = emotionalTriggers?.length
      ? `Emotional approach: ${emotionalTriggers.map((t: string) => emotionalGuidanceMap[t] || t).join("; ")}`
      : "";

    const intensityMap: Record<string, string> = {
      gentle: "gentle and compassionate",
      medium: "balanced and motivating",
      high: "intense and direct",
    };

    const intensityStyle = intensityMap[intensity || "medium"] || "balanced and motivating";

    const systemPrompt = `You are writing a spoken motivational message for the app "A Lil Push" in the voice of ${mentor.name}.

Mentor Profile:
- Name: ${mentor.name}
- Tone: ${mentor.tone_description}
- Voice Style: ${mentor.voice_style}
- Description: ${mentor.description}
${mentor.themes ? `- Themes: ${mentor.themes.join(", ")}` : ""}

Your Task:
Write a 15-40 second spoken message that:
- Matches ${mentor.name}'s tone, style, and themes
- Is ${intensityStyle} in approach
${topicContext ? `- ${topicContext}` : ""}
${triggerContext ? `- Responds to: ${triggerContext}` : ""}
${emotionalGuidance ? `- ${emotionalGuidance}` : ""}
- Contains 3-6 sentences
- Feels natural and human when spoken aloud
- Uses NO emojis or special formatting
- Sounds conversational, not written
- Does NOT explicitly mention "category" or "trigger" words

Write ONLY the script text, nothing else.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
