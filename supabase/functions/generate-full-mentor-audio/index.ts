import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ErrorResponseDetails {
  code?: string;
  upstreamStatus?: number;
  upstreamError?: string | null;
}

function normalizeStatus(status: number): number {
  if (!Number.isFinite(status)) return 500;
  if (status < 400 || status > 599) return 500;
  return status;
}

function buildErrorResponse(
  status: number,
  message: string,
  details: ErrorResponseDetails = {},
): Response {
  const payload: Record<string, unknown> = { error: message };

  if (details.code) payload.code = details.code;
  if (typeof details.upstreamStatus === "number") payload.upstream_status = details.upstreamStatus;
  if (typeof details.upstreamError === "string" && details.upstreamError.length > 0) {
    payload.upstream_error = details.upstreamError;
  }

  return new Response(
    JSON.stringify(payload),
    { status: normalizeStatus(status), headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function parseUpstreamError(rawBody: string): string | null {
  const trimmed = rawBody.trim();
  if (trimmed.length === 0) return null;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const message = typeof parsed.error === "string"
      ? parsed.error
      : typeof parsed.message === "string"
        ? parsed.message
        : null;
    return message ?? trimmed.slice(0, 300);
  } catch {
    return trimmed.slice(0, 300);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mentorSlug, topic_category, intensity, emotionalTriggers } = await req.json();

    if (!mentorSlug) {
      return buildErrorResponse(400, "mentorSlug is required", { code: "INVALID_REQUEST" });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return buildErrorResponse(500, "Missing Supabase environment variables", { code: "MISSING_ENV" });
    }

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
      const upstreamRaw = await scriptResponse.text();
      const upstreamError = parseUpstreamError(upstreamRaw);
      console.error("Script generation error:", scriptResponse.status, upstreamRaw);
      return buildErrorResponse(scriptResponse.status, "Failed to generate script", {
        code: "SCRIPT_GENERATION_FAILED",
        upstreamStatus: scriptResponse.status,
        upstreamError,
      });
    }

    let scriptPayload: Record<string, unknown>;
    try {
      scriptPayload = await scriptResponse.json() as Record<string, unknown>;
    } catch {
      return buildErrorResponse(502, "Invalid script generation response", {
        code: "SCRIPT_GENERATION_INVALID_RESPONSE",
      });
    }

    const script = typeof scriptPayload.script === "string" ? scriptPayload.script : null;
    if (!script) {
      return buildErrorResponse(502, "Script generation response missing script", {
        code: "SCRIPT_GENERATION_INCOMPLETE_RESPONSE",
      });
    }

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
      const upstreamRaw = await audioResponse.text();
      const upstreamError = parseUpstreamError(upstreamRaw);
      console.error("Audio generation error:", audioResponse.status, upstreamRaw);
      return buildErrorResponse(audioResponse.status, "Failed to generate audio", {
        code: "AUDIO_GENERATION_FAILED",
        upstreamStatus: audioResponse.status,
        upstreamError,
      });
    }

    let audioPayload: Record<string, unknown>;
    try {
      audioPayload = await audioResponse.json() as Record<string, unknown>;
    } catch {
      return buildErrorResponse(502, "Invalid audio generation response", {
        code: "AUDIO_GENERATION_INVALID_RESPONSE",
      });
    }
    const audioUrl = typeof audioPayload.audioUrl === "string" ? audioPayload.audioUrl : null;
    if (!audioUrl) {
      return buildErrorResponse(502, "Audio generation response missing audioUrl", {
        code: "AUDIO_GENERATION_INCOMPLETE_RESPONSE",
      });
    }
    console.log(`Audio generated: ${audioUrl}`);

    return new Response(
      JSON.stringify({ script, audioUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-full-mentor-audio function:", error);
    return buildErrorResponse(500, error instanceof Error ? error.message : "Unknown error", {
      code: "INTERNAL_ERROR",
    });
  }
});
