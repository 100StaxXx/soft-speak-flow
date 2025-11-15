import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch mentor data
    const { data: mentor, error: mentorError } = await supabase
      .from("mentors")
      .select("*")
      .eq("slug", mentorSlug)
      .single();

    if (mentorError || !mentor) {
      throw new Error(`Mentor not found: ${mentorSlug}`);
    }

    console.log("Generating complete pep talk for mentor:", mentor.name);

    // Generate complete pep talk content using AI
    const emotionalContext = emotionalTriggers && emotionalTriggers.length > 0 
      ? `The listener is currently feeling: ${emotionalTriggers.join(", ")}. Address these emotional states directly and provide relevant support.`
      : "";

    const intensityGuidance = intensity 
      ? `Intensity Level: ${intensity} - Adjust your tone and energy to match this intensity level.`
      : "";

    const systemPrompt = `You are ${mentor.name}, ${mentor.description}.
    
Voice Style: ${mentor.voice_style}
Tone: ${mentor.tone_description}
${mentor.identity_description ? `Identity: ${mentor.identity_description}` : ""}
${mentor.style_description ? `Style: ${mentor.style_description}` : ""}

Generate a complete pep talk that includes:
1. A catchy, motivational title (max 60 characters)
2. A powerful quote (1-2 sentences, max 150 characters)
3. A compelling description (2-3 sentences explaining what the pep talk covers)
4. A full motivational script (2-3 paragraphs, conversational tone, direct address to listener)

Category: ${topic_category || "motivation"}
${intensityGuidance}
${emotionalContext}

Return ONLY a valid JSON object with these exact keys:
{
  "title": "...",
  "quote": "...",
  "description": "...",
  "script": "..."
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate a complete pep talk now." }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (aiResponse.status === 402) {
        throw new Error("Payment required. Please add credits to your Lovable AI workspace.");
      }
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      throw new Error("Failed to generate content from AI");
    }

    const aiData = await aiResponse.json();
    const generatedContent = aiData.choices[0].message.content;

    console.log("Raw AI response:", generatedContent);

    // Parse the JSON response
    let pepTalkData;
    try {
      // Try to extract JSON from the response
      const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        pepTalkData = JSON.parse(jsonMatch[0]);
      } else {
        pepTalkData = JSON.parse(generatedContent);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", generatedContent);
      throw new Error("Failed to parse AI response as JSON");
    }

    // Validate required fields
    if (!pepTalkData.title || !pepTalkData.quote || !pepTalkData.description || !pepTalkData.script) {
      throw new Error("AI response missing required fields");
    }

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
      }
    );
  } catch (error: any) {
    console.error("Error in generate-complete-pep-talk:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
