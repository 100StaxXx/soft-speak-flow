import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const { reflectionId } = await req.json();

    if (!reflectionId) {
      return new Response(JSON.stringify({ error: "Missing reflectionId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the reflection
    const { data: reflection, error: fetchError } = await supabase
      .from("evening_reflections")
      .select("*, profiles:user_id(selected_mentor_id)")
      .eq("id", reflectionId)
      .single();

    if (fetchError || !reflection) {
      console.error("Failed to fetch reflection:", fetchError);
      return new Response(JSON.stringify({ error: "Reflection not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch mentor for tone
    let mentorTone = "warm and supportive";
    if (reflection.profiles?.selected_mentor_id) {
      const { data: mentor } = await supabase
        .from("mentors")
        .select("name, tone_description")
        .eq("id", reflection.profiles.selected_mentor_id)
        .single();

      if (mentor) {
        mentorTone = mentor.tone_description || mentorTone;
      }
    }

    // Build prompt
    const prompt = `You are a supportive wellness mentor with the following tone: ${mentorTone}

A user has completed their evening reflection:
- Mood: ${reflection.mood}
${reflection.wins ? `- What went well: ${reflection.wins}` : ""}
${reflection.gratitude ? `- Gratitude: ${reflection.gratitude}` : ""}

Write a brief, warm acknowledgment (2-3 sentences max). Be encouraging and validate their feelings. If they shared wins or gratitude, acknowledge those specifically. Keep it personal and caring.`;

    // Call OpenAI
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a supportive wellness mentor. Keep responses brief, warm, and personal." },
          { role: "user", content: prompt },
        ],
        max_tokens: 200,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI response error:", await aiResponse.text());
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const mentorResponse = aiData.choices?.[0]?.message?.content?.trim();

    if (mentorResponse) {
      // Update reflection with mentor response
      await supabase
        .from("evening_reflections")
        .update({ mentor_response: mentorResponse })
        .eq("id", reflectionId);
    }

    return new Response(JSON.stringify({ success: true, response: mentorResponse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-evening-response:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});