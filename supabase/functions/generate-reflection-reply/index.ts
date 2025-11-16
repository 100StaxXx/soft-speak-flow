import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reflection_id, mood, note } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Create prompt based on mood
    let systemPrompt = "You are a supportive, understanding coach providing a brief (1-3 sentences) response to a user's daily reflection. Be warm, empathetic, and encouraging.";
    
    let userPrompt = "";
    if (mood === "good") {
      userPrompt = `The user had a good day${note ? ` and shared: "${note}"` : ''}. Acknowledge their effort and reinforce their wins.`;
    } else if (mood === "neutral") {
      userPrompt = `The user had a neutral day${note ? ` and shared: "${note}"` : ''}. Normalize their feelings and gently suggest perspective.`;
    } else { // tough
      userPrompt = `The user had a tough day${note ? ` and shared: "${note}"` : ''}. Validate their emotions, provide calm reassurance, and offer one actionable thought.`;
    }

    // Call Lovable AI
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
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("Failed to generate AI reply");
    }

    const aiData = await aiResponse.json();
    const ai_reply = aiData.choices[0]?.message?.content || "Thanks for checking in. You're making progress.";

    // Update reflection with AI reply
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: updateError } = await supabase
      .from("user_reflections")
      .update({ ai_reply })
      .eq("id", reflection_id);

    if (updateError) {
      console.error("Error updating reflection:", updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ ai_reply }),
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