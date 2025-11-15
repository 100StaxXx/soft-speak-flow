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

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    console.log(`Starting full audio generation for mentor ${mentorSlug}`);

    // Step 1: Generate script
    console.log("Step 1: Generating script...");
    const scriptResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/generate-mentor-script`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          mentorSlug,
          topic_category,
          intensity,
          emotionalTriggers,
        }),
      }
    );

    if (!scriptResponse.ok) {
      const errorText = await scriptResponse.text();
      console.error("Script generation error:", scriptResponse.status, errorText);
      throw new Error(`Failed to generate script: ${scriptResponse.status}`);
    }

    const { script } = await scriptResponse.json();
    console.log(`Script generated: ${script.substring(0, 100)}...`);

    // Step 2: Generate audio from script
    console.log("Step 2: Generating audio...");
    const audioResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/generate-mentor-audio`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          mentorSlug,
          script,
        }),
      }
    );

    if (!audioResponse.ok) {
      const errorText = await audioResponse.text();
      console.error("Audio generation error:", audioResponse.status, errorText);
      throw new Error(`Failed to generate audio: ${audioResponse.status}`);
    }

    const { audioUrl } = await audioResponse.json();
    console.log(`Audio generated: ${audioUrl}`);

    return new Response(
      JSON.stringify({ script, audioUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-full-mentor-audio function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
