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
    const { mentorSlug, category, intensity, emotionalTriggers } = await req.json();

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

    // Build context for triggers
    const triggerContext = emotionalTriggers?.length
      ? `The user is experiencing: ${emotionalTriggers.join(", ")}.`
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
${category ? `- Addresses the "${category}" category naturally (without mentioning it explicitly)` : ""}
${triggerContext ? `- Responds to: ${triggerContext}` : ""}
- Contains 3-6 sentences
- Feels natural and human when spoken aloud
- Uses NO emojis or special formatting
- Sounds conversational, not written

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
