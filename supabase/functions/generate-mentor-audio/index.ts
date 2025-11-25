import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { checkRateLimit, RATE_LIMITS, createRateLimitResponse } from "../_shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const mentorVoices: Record<string, any> = {
  atlas: {
    voiceId: "JBFqnCBsd6RMkjVDRZzb", // George
    stability: 0.75,
    similarity_boost: 0.85,
    style_exaggeration: 0.5,
  },
  darius: {
    voiceId: "rWyjfFeMZ6PxkHqD3wGC", // Brian
    stability: 0.8,
    similarity_boost: 0.9,
    style_exaggeration: 0.7,
  },
  eli: {
    voiceId: "iP95p4xoKVk53GoZ742B", // Chris
    stability: 0.7,
    similarity_boost: 0.8,
    style_exaggeration: 0.4,
  },
  nova: {
    voiceId: "onwK4e9ZLuTAKqWW03F9", // Daniel
    stability: 0.65,
    similarity_boost: 0.75,
    style_exaggeration: 0.6,
  },
  sienna: {
    voiceId: "XB0fDUnXU5powFXDhCwa", // Charlotte
    stability: 0.8,
    similarity_boost: 0.85,
    style_exaggeration: 0.3,
  },
  lumi: {
    voiceId: "EXAVITQu4vr4xnSDxMaL", // Sarah
    stability: 0.75,
    similarity_boost: 0.8,
    style_exaggeration: 0.2,
  },
  kai: {
    voiceId: "N2lVS1w4EtoT3dr4eOWO", // Callum
    stability: 0.7,
    similarity_boost: 0.85,
    style_exaggeration: 0.8,
  },
  stryker: {
    voiceId: "pNInz6obpgDQGcFmaJgB", // Rich
    stability: 0.85,
    similarity_boost: 0.9,
    style_exaggeration: 0.7,
  },
  solace: {
    voiceId: "pFZP5JQG7iQjIQuC4Bku", // Lily
    stability: 0.8,
    similarity_boost: 0.85,
    style_exaggeration: 0.2,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mentorSlug, script } = await req.json();

    if (!mentorSlug || !script) {
      throw new Error("mentorSlug and script are required");
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    const voiceConfig = mentorVoices[mentorSlug];
    if (!voiceConfig) {
      throw new Error(`No voice configuration found for mentor: ${mentorSlug}`);
    }

    console.log(`Generating audio for mentor ${mentorSlug} with voice ${voiceConfig.voiceId}`);

    // Call ElevenLabs TTS API with timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55 second timeout
    
    let elevenLabsResponse;
    try {
      elevenLabsResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceConfig.voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: script,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: voiceConfig.stability,
              similarity_boost: voiceConfig.similarity_boost,
              style: voiceConfig.style_exaggeration,
              use_speaker_boost: true,
            },
          }),
          signal: controller.signal,
        }
      );
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error?.name === 'AbortError') {
        console.error("ElevenLabs API timeout after 55 seconds");
        throw new Error("Audio generation timed out. Please try again.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      console.error("ElevenLabs API error:", elevenLabsResponse.status, errorText);
      throw new Error(`ElevenLabs API error: ${elevenLabsResponse.status}`);
    }

    // Get audio as array buffer
    const audioBuffer = await elevenLabsResponse.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Upload to Supabase Storage
    const timestamp = Date.now();
    const fileName = `${mentorSlug}_${timestamp}.mp3`;
    const filePath = `${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("mentor-audio")
      .upload(filePath, audioBytes, {
        contentType: "audio/mpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("mentor-audio")
      .getPublicUrl(filePath);

    const audioUrl = urlData.publicUrl;

    console.log(`Audio generated and uploaded successfully: ${audioUrl}`);

    return new Response(
      JSON.stringify({ audioUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-mentor-audio function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
