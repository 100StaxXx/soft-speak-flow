import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const { emotionalTrigger, category } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    // Build context-specific prompt
    let context = "";
    if (emotionalTrigger && category) {
      context = `The user is feeling "${emotionalTrigger}" and needs help with "${category}".`;
    } else if (emotionalTrigger) {
      context = `The user is feeling "${emotionalTrigger}".`;
    } else if (category) {
      context = `The user needs help with "${category}".`;
    } else {
      context = "The user needs motivation.";
    }

    const systemPrompt = `You are a motivational quote generator. Generate a powerful, inspiring quote that speaks directly to the user's current state. ${context}

The quote should be:
- Short and impactful (1-3 sentences max)
- Action-oriented and empowering
- Specific to their emotional state and needs
- Written in a bold, confident voice
- Do NOT use em-dashes (—), en-dashes (–), or " - " in the text
- Use commas or periods instead of dashes

Do NOT include the author name or attribution. Just the quote itself.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate an inspiring quote for me." }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const quote = data.choices?.[0]?.message?.content?.trim() || "Keep pushing forward.";

    return new Response(
      JSON.stringify({ quote }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
