import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mood } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Map moods to categories and triggers
    const moodMapping: Record<string, { category: string; trigger: string }> = {
      "Unmotivated": { category: "discipline", trigger: "Unmotivated" },
      "Overthinking": { category: "mindset", trigger: "Anxious & Overthinking" },
      "Confident": { category: "confidence", trigger: "Motivated & Ready" },
      "Focused": { category: "focus", trigger: "Motivated & Ready" },
      "Frustrated": { category: "mindset", trigger: "Frustrated" },
      "Inspired": { category: "confidence", trigger: "Motivated & Ready" },
      "Heavy / Low": { category: "mindset", trigger: "Heavy or Low" },
      "In Transition": { category: "mindset", trigger: "In Transition" }
    };

    const mapping = moodMapping[mood] || { category: "mindset", trigger: "Unmotivated" };

    const systemPrompt = `You are a motivational coach for A Lil Push. Generate a short, impactful push for someone feeling "${mood}".

Return a JSON object with:
- quote: A powerful 1-sentence quote (max 15 words)
- mini_pep_talk: A 2-4 sentence motivational message that's direct, grounded, and actionable

The tone should be: strong but supportive, masculine but not aggressive, practical not preachy.
Category context: ${mapping.category}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a lil push for mood: ${mood}` }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("Failed to generate mood push");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0]?.message?.content || "";
    
    // Parse JSON from response
    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      result = {
        quote: "You've got this. Keep moving.",
        mini_pep_talk: "Right now might feel tough, but you're tougher. Small steps still count. Keep going."
      };
    }

    return new Response(
      JSON.stringify({
        quote: result.quote || "You've got this.",
        mini_pep_talk: result.mini_pep_talk || "Keep pushing forward.",
        audio_url: null,
        image_url: null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});