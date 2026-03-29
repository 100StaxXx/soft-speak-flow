import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import {
  createRateLimitResponse,
  logRateLimitedInvocation,
} from "../_shared/rateLimiter.ts";
import { applyAbuseProtection, getClientIpAddress } from "../_shared/abuseProtection.ts";
import {
  errorResponse,
  requireUserOrInternalRequest,
  type UserOrInternalRequestAuth,
} from "../_shared/auth.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-key",
};

const MODEL_NAME = "eleven_multilingual_v2";
const RATE_LIMIT_KEY = "mentor-audio";

interface MentorVoiceConfig {
  voiceId: string;
  stability: number;
  similarity_boost: number;
  style_exaggeration: number;
  use_speaker_boost?: boolean;
}

const mentorVoices: Record<string, MentorVoiceConfig> = {
  atlas: { voiceId: "JBFqnCBsd6RMkjVDRZzb", stability: 0.75, similarity_boost: 0.85, style_exaggeration: 0.5 },
  eli: { voiceId: "mcuuWJIofmzgKEGk3EMA", stability: 0.7, similarity_boost: 0.8, style_exaggeration: 0.4 },
  nova: { voiceId: "onwK4e9ZLuTAKqWW03F9", stability: 0.65, similarity_boost: 0.75, style_exaggeration: 0.6 },
  sienna: { voiceId: "XB0fDUnXU5powFXDhCwa", stability: 0.8, similarity_boost: 0.85, style_exaggeration: 0.3 },
  lumi: { voiceId: "EXAVITQu4vr4xnSDxMaL", stability: 0.75, similarity_boost: 0.8, style_exaggeration: 0.2 },
  kai: { voiceId: "N2lVS1w4EtoT3dr4eOWO", stability: 0.7, similarity_boost: 0.85, style_exaggeration: 0.8 },
  stryker: {
    voiceId: "pNInz6obpgDQGcFmaJgB",
    stability: 0.58,
    similarity_boost: 0.96,
    style_exaggeration: 1.0,
    use_speaker_boost: true,
  },
  carmen: { voiceId: "bD9maNcCuQQS75DGuteM", stability: 0.75, similarity_boost: 0.85, style_exaggeration: 0.7 },
  reign: {
    voiceId: "GTQ4ImqrRljZAa9VJX6B",
    stability: 0.52,
    similarity_boost: 0.97,
    style_exaggeration: 1.0,
    use_speaker_boost: true,
  },
  solace: { voiceId: "XrExE9yKIg1WjnnlVkGX", stability: 0.8, similarity_boost: 0.8, style_exaggeration: 0.35 },
};

const legacyVoiceAliases: Record<string, string> = {
  elizabeth: "solace",
};

interface GenerateMentorAudioDeps {
  authorize: (req: Request, corsHeaders: HeadersInit) => Promise<UserOrInternalRequestAuth | Response>;
  createSupabaseClient: () => any;
  fetchImpl: typeof fetch;
  checkRateLimitFn?: unknown;
  now: () => number;
}

const defaultDeps: GenerateMentorAudioDeps = {
  authorize: requireUserOrInternalRequest,
  createSupabaseClient: () => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    return createClient(supabaseUrl, supabaseServiceRoleKey);
  },
  fetchImpl: fetch,
  now: () => Date.now(),
};

export async function handleGenerateMentorAudio(
  req: Request,
  deps: GenerateMentorAudioDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = deps.createSupabaseClient();

    const requestAuth = await deps.authorize(req, corsHeaders);
    if (requestAuth instanceof Response) {
      return requestAuth;
    }

    const costGuardrails = createCostGuardrailSession({
      supabase: supabaseAdmin,
      endpointKey: "generate-mentor-audio",
      featureKey: "ai_pep_talks",
      userId: requestAuth.isInternal ? null : requestAuth.userId,
    });
    const guardedFetch = costGuardrails.wrapFetch(deps.fetchImpl);
    await costGuardrails.enforceAccess({
      capabilities: ["tts"],
      providers: ["elevenlabs"],
    });

    const { mentorSlug, script } = await req.json();
    if (!mentorSlug || !script) {
      return errorResponse(400, "mentorSlug and script are required", corsHeaders);
    }

    if (!requestAuth.isInternal) {
      if (typeof deps.checkRateLimitFn === "function") {
        const rateLimit = await (deps.checkRateLimitFn as (
          supabase: unknown,
          userId: string,
          rateLimitKey: string,
        ) => Promise<{ allowed: boolean; available: boolean; remaining: number; limit: number; resetAt: Date }>)(
          supabaseAdmin,
          requestAuth.userId,
          RATE_LIMIT_KEY,
        );

        if (!rateLimit.allowed) {
          return createRateLimitResponse(rateLimit, corsHeaders);
        }
      } else {
        const abuseProtection = await applyAbuseProtection(req, supabaseAdmin, {
          profileKey: "ai.expensive_export",
          endpointName: "generate-mentor-audio",
          requestId: crypto.randomUUID(),
          userId: requestAuth.userId,
          ipAddress: getClientIpAddress(req),
          blockedMessage: "Too many audio generation requests. Please try again later.",
          metadata: {
            flow: "generate_mentor_audio",
          },
        });

        if (abuseProtection instanceof Response) {
          return abuseProtection;
        }
      }
    }

    const elevenLabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!elevenLabsApiKey) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    const requestedMentorSlug = String(mentorSlug).trim().toLowerCase();
    const resolvedMentorSlug = legacyVoiceAliases[requestedMentorSlug] ?? requestedMentorSlug;
    const voiceConfig = mentorVoices[resolvedMentorSlug];

    if (!voiceConfig) {
      throw new Error(`No voice configuration found for mentor: ${requestedMentorSlug}`);
    }

    const voiceSettings = {
      stability: voiceConfig.stability,
      similarity_boost: voiceConfig.similarity_boost,
      style: voiceConfig.style_exaggeration,
      use_speaker_boost: voiceConfig.use_speaker_boost ?? true,
    };

    console.log(`Generating audio for mentor ${requestedMentorSlug} (resolved=${resolvedMentorSlug}) with voice ${voiceConfig.voiceId}`);

    const startedAt = deps.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    let elevenLabsResponse: Response;
    try {
      elevenLabsResponse = await guardedFetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceConfig.voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": elevenLabsApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: script,
            model_id: MODEL_NAME,
            voice_settings: voiceSettings,
          }),
          signal: controller.signal,
        },
      );
    } catch (error) {
      clearTimeout(timeoutId);
      const err = error as { name?: string };
      if (err?.name === "AbortError") {
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

    const audioBuffer = await elevenLabsResponse.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);
    const timestamp = deps.now();
    const filePath = `${resolvedMentorSlug}_${timestamp}.mp3`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("mentor-audio")
      .upload(filePath, audioBytes, {
        contentType: "audio/mpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("mentor-audio")
      .getPublicUrl(filePath);

    const audioUrl = urlData.publicUrl;

    if (!requestAuth.isInternal) {
      await logRateLimitedInvocation(supabaseAdmin, {
        userId: requestAuth.userId,
        templateKey: RATE_LIMIT_KEY,
        inputData: { mentorSlug: requestedMentorSlug },
        outputData: { audioUrl },
        validationPassed: true,
        modelUsed: MODEL_NAME,
        responseTimeMs: deps.now() - startedAt,
      });
    }

    console.log(`Audio generated and uploaded successfully: ${audioUrl}`);

    return new Response(
      JSON.stringify({ audioUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }
    console.error("Error in generate-mentor-audio function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleGenerateMentorAudio(req));
}
