import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import {
  createRateLimitResponse,
  logRateLimitedInvocation,
} from "../_shared/rateLimiter.ts";
import {
  applyAbuseProtection,
  getClientIpAddress,
} from "../_shared/abuseProtection.ts";
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
import {
  type MentorVoiceConfig,
  resolveMentorVoiceConfig,
  resolveTutorialVoice,
} from "../_shared/mentorVoiceConfig.ts";
import { resolveSupportedMentorSlug } from "../_shared/mentorRoster.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-key",
};

const MODEL_NAME = "eleven_multilingual_v2";
const OPENAI_TTS_MODEL_NAME = "gpt-4o-mini-tts";
const RATE_LIMIT_KEY = "mentor-audio";

interface AudioGenerationResult {
  audioBytes: Uint8Array;
  provider: "elevenlabs" | "openai";
  model: string;
}

interface GenerateMentorAudioDeps {
  authorize: (
    req: Request,
    corsHeaders: HeadersInit,
  ) => Promise<UserOrInternalRequestAuth | Response>;
  createSupabaseClient: () => any;
  fetchImpl: typeof fetch;
  checkRateLimitFn?: unknown;
  now: () => number;
}

const defaultDeps: GenerateMentorAudioDeps = {
  authorize: requireUserOrInternalRequest,
  createSupabaseClient: () => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      "";
    return createClient(supabaseUrl, supabaseServiceRoleKey);
  },
  fetchImpl: fetch,
  now: () => Date.now(),
};

async function readErrorSnippet(response: Response): Promise<string> {
  const text = await response.text();
  return text.trim().slice(0, 500);
}

async function fetchAudioWithTimeout({
  fetchImpl,
  url,
  init,
  timeoutMs,
  timeoutMessage,
}: {
  fetchImpl: typeof fetch;
  url: string;
  init: RequestInit;
  timeoutMs: number;
  timeoutMessage: string;
}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    const err = error as { name?: string };
    if (err?.name === "AbortError") {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function generateElevenLabsAudio({
  fetchImpl,
  apiKey,
  voiceId,
  voiceSettings,
  script,
}: {
  fetchImpl: typeof fetch;
  apiKey: string;
  voiceId: string;
  voiceSettings: Record<string, unknown>;
  script: string;
}): Promise<Uint8Array> {
  const response = await fetchAudioWithTimeout({
    fetchImpl,
    url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    init: {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: script,
        model_id: MODEL_NAME,
        voice_settings: voiceSettings,
      }),
    },
    timeoutMs: 55000,
    timeoutMessage: "Audio generation timed out. Please try again.",
  });

  if (!response.ok) {
    const errorText = await readErrorSnippet(response);
    console.error("ElevenLabs API error:", response.status, errorText);
    throw new Error(`ElevenLabs API error: ${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function generateOpenAiAudio({
  fetchImpl,
  apiKey,
  mentorSlug,
  script,
}: {
  fetchImpl: typeof fetch;
  apiKey: string;
  mentorSlug: string;
  script: string;
}): Promise<Uint8Array> {
  const response = await fetchAudioWithTimeout({
    fetchImpl,
    url: "https://api.openai.com/v1/audio/speech",
    init: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_TTS_MODEL_NAME,
        voice: resolveTutorialVoice(mentorSlug),
        input: script,
        response_format: "mp3",
      }),
    },
    timeoutMs: 55000,
    timeoutMessage: "Fallback audio generation timed out. Please try again.",
  });

  if (!response.ok) {
    const errorText = await readErrorSnippet(response);
    console.error("OpenAI TTS API error:", response.status, errorText);
    throw new Error(`OpenAI TTS API error: ${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function generateMentorAudioBytes({
  fetchImpl,
  mentorSlug,
  script,
  voiceConfig,
  voiceSettings,
}: {
  fetchImpl: typeof fetch;
  mentorSlug: string;
  script: string;
  voiceConfig: MentorVoiceConfig;
  voiceSettings: Record<string, unknown>;
}): Promise<AudioGenerationResult> {
  const elevenLabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  let primaryError: Error | null = null;

  if (elevenLabsApiKey) {
    try {
      return {
        audioBytes: await generateElevenLabsAudio({
          fetchImpl,
          apiKey: elevenLabsApiKey,
          voiceId: voiceConfig.voiceId,
          voiceSettings,
          script,
        }),
        provider: "elevenlabs",
        model: MODEL_NAME,
      };
    } catch (error) {
      primaryError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        "ElevenLabs audio generation failed; trying OpenAI TTS fallback",
        {
          error: primaryError.message,
        },
      );
    }
  } else {
    primaryError = new Error("ELEVENLABS_API_KEY is not configured");
    console.warn(
      "ELEVENLABS_API_KEY is not configured; trying OpenAI TTS fallback",
    );
  }

  if (!openAiApiKey) {
    throw primaryError ?? new Error("No TTS provider is configured");
  }

  return {
    audioBytes: await generateOpenAiAudio({
      fetchImpl,
      apiKey: openAiApiKey,
      mentorSlug,
      script,
    }),
    provider: "openai",
    model: OPENAI_TTS_MODEL_NAME,
  };
}

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
      return errorResponse(
        400,
        "mentorSlug and script are required",
        corsHeaders,
      );
    }

    if (!requestAuth.isInternal) {
      if (typeof deps.checkRateLimitFn === "function") {
        const rateLimit = await (deps.checkRateLimitFn as (
          supabase: unknown,
          userId: string,
          rateLimitKey: string,
        ) => Promise<
          {
            allowed: boolean;
            available: boolean;
            remaining: number;
            limit: number;
            resetAt: Date;
          }
        >)(
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
          blockedMessage:
            "Too many audio generation requests. Please try again later.",
          metadata: {
            flow: "generate_mentor_audio",
          },
        });

        if (abuseProtection instanceof Response) {
          return abuseProtection;
        }
      }
    }

    const requestedMentorSlug = String(mentorSlug).trim().toLowerCase();
    const resolvedMentorSlug =
      resolveSupportedMentorSlug(requestedMentorSlug) ?? requestedMentorSlug;
    const voiceConfig = resolveMentorVoiceConfig(requestedMentorSlug);

    if (!voiceConfig) {
      throw new Error(
        `No voice configuration found for mentor: ${requestedMentorSlug}`,
      );
    }

    const voiceSettings = {
      stability: voiceConfig.stability,
      similarity_boost: voiceConfig.similarity_boost,
      style: voiceConfig.style_exaggeration,
      use_speaker_boost: voiceConfig.use_speaker_boost ?? true,
    };

    console.log(
      `Generating audio for mentor ${requestedMentorSlug} (resolved=${resolvedMentorSlug}) with voice ${voiceConfig.voiceId}`,
    );

    const startedAt = deps.now();
    const audioResult = await generateMentorAudioBytes({
      fetchImpl: guardedFetch,
      mentorSlug: resolvedMentorSlug,
      script,
      voiceConfig,
      voiceSettings,
    });
    const timestamp = deps.now();
    const filePath = `${resolvedMentorSlug}_${timestamp}.mp3`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("mentor-audio")
      .upload(filePath, audioResult.audioBytes, {
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
        outputData: { audioUrl, provider: audioResult.provider },
        validationPassed: true,
        modelUsed: audioResult.model,
        responseTimeMs: deps.now() - startedAt,
      });
    }

    console.log(
      `Audio generated via ${audioResult.provider} and uploaded successfully: ${audioUrl}`,
    );

    return new Response(
      JSON.stringify({ audioUrl, provider: audioResult.provider }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }
    console.error("Error in generate-mentor-audio function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleGenerateMentorAudio(req));
}
