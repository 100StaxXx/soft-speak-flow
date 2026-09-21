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
  ELEVENLABS_MENTOR_TTS_MODEL,
  type MentorVoiceConfig,
  resolveMentorVoiceConfig,
  resolveTutorialVoice,
} from "../_shared/mentorVoiceConfig.ts";
import { resolveSupportedMentorSlug } from "../_shared/mentorRoster.ts";
import {
  characterAlignmentToWords,
  decodeBase64Audio,
  type TimedTranscriptWord,
} from "../_shared/elevenLabsAlignment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-key",
};

const OPENAI_TTS_MODEL_NAME = "gpt-4o-mini-tts";
const RATE_LIMIT_KEY = "mentor-audio";
const ELEVENLABS_FIRST_ATTEMPT_TIMEOUT_MS = 45000;
const ELEVENLABS_RETRY_TIMEOUT_MS = 25000;
const ELEVENLABS_RETRY_DELAY_MS = 1500;
const ELEVENLABS_V3_NATURAL_STABILITY = 0.5;

interface AudioGenerationResult {
  audioBytes: Uint8Array;
  provider: "elevenlabs" | "openai";
  model: string;
  transcript: TimedTranscriptWord[];
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

async function delay(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function getElevenLabsRetryDelayMs(): number {
  return Deno.env.get("SUPABASE_FUNCTIONS_TEST") === "1"
    ? 0
    : ELEVENLABS_RETRY_DELAY_MS;
}

function isRetriableElevenLabsError(error: Error): boolean {
  const message = error.message.toLowerCase();
  if (message.includes("timed out") || message.includes("timeout")) {
    return true;
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return true;
  }

  const statusMatch = error.message.match(/ElevenLabs API error:\s*(\d{3})/i);
  if (!statusMatch) return false;

  const status = Number(statusMatch[1]);
  return status === 408 || status === 429 || status >= 500;
}

export function buildElevenLabsVoiceSettings(
  voiceConfig: MentorVoiceConfig,
  modelId = ELEVENLABS_MENTOR_TTS_MODEL,
): Record<string, unknown> {
  if (modelId === "eleven_v3") {
    return {
      stability: ELEVENLABS_V3_NATURAL_STABILITY,
    };
  }

  return {
    stability: voiceConfig.stability,
    similarity_boost: voiceConfig.similarity_boost,
    style: voiceConfig.style_exaggeration,
    speed: voiceConfig.speed,
    use_speaker_boost: voiceConfig.use_speaker_boost ?? true,
  };
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
  timeoutMs,
}: {
  fetchImpl: typeof fetch;
  apiKey: string;
  voiceId: string;
  voiceSettings: Record<string, unknown>;
  script: string;
  timeoutMs: number;
}): Promise<{ audioBytes: Uint8Array; transcript: TimedTranscriptWord[] }> {
  const response = await fetchAudioWithTimeout({
    fetchImpl,
    url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
    init: {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: script,
        model_id: ELEVENLABS_MENTOR_TTS_MODEL,
        voice_settings: voiceSettings,
      }),
    },
    timeoutMs,
    timeoutMessage: "Audio generation timed out. Please try again.",
  });

  if (!response.ok) {
    const errorText = await readErrorSnippet(response);
    console.error("ElevenLabs API error:", response.status, errorText);
    throw new Error(
      `ElevenLabs API error: ${response.status}${
        errorText ? `: ${errorText}` : ""
      }`,
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = await response.json() as Record<string, unknown>;
  } catch {
    throw new Error("ElevenLabs timing response was not valid JSON");
  }

  const audioBase64 = typeof payload.audio_base64 === "string"
    ? payload.audio_base64
    : "";
  const alignment = (
    payload.normalized_alignment && typeof payload.normalized_alignment === "object"
      ? payload.normalized_alignment
      : payload.alignment
  ) as Parameters<typeof characterAlignmentToWords>[0];
  const transcript = characterAlignmentToWords(alignment);

  if (transcript.length === 0) {
    throw new Error("ElevenLabs timing response contained no word timestamps");
  }

  return {
    audioBytes: decodeBase64Audio(audioBase64),
    transcript,
  };
}

async function generateOpenAiAudio({
  fetchImpl,
  apiKey,
  mentorSlug,
  script,
  speed,
}: {
  fetchImpl: typeof fetch;
  apiKey: string;
  mentorSlug: string;
  script: string;
  speed: number;
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
        speed,
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
  requirePrimaryVoice,
}: {
  fetchImpl: typeof fetch;
  mentorSlug: string;
  script: string;
  voiceConfig: MentorVoiceConfig;
  voiceSettings: Record<string, unknown>;
  requirePrimaryVoice: boolean;
}): Promise<AudioGenerationResult> {
  const elevenLabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  let primaryError: Error | null = null;
  let allowOpenAiFallback = false;

  if (elevenLabsApiKey) {
    try {
      const generated = await generateElevenLabsAudio({
        fetchImpl,
        apiKey: elevenLabsApiKey,
        voiceId: voiceConfig.voiceId,
        voiceSettings,
        script,
        timeoutMs: ELEVENLABS_FIRST_ATTEMPT_TIMEOUT_MS,
      });
      return {
        ...generated,
        provider: "elevenlabs",
        model: ELEVENLABS_MENTOR_TTS_MODEL,
      };
    } catch (error) {
      primaryError = error instanceof Error ? error : new Error(String(error));
      if (isRetriableElevenLabsError(primaryError)) {
        console.warn(
          "ElevenLabs audio generation failed transiently; retrying primary voice",
          {
            error: primaryError.message,
            retryDelayMs: getElevenLabsRetryDelayMs(),
          },
        );

        await delay(getElevenLabsRetryDelayMs());

        try {
          const generated = await generateElevenLabsAudio({
            fetchImpl,
            apiKey: elevenLabsApiKey,
            voiceId: voiceConfig.voiceId,
            voiceSettings,
            script,
            timeoutMs: ELEVENLABS_RETRY_TIMEOUT_MS,
          });
          return {
            ...generated,
            provider: "elevenlabs",
            model: ELEVENLABS_MENTOR_TTS_MODEL,
          };
        } catch (retryError) {
          const retryFailure = retryError instanceof Error
            ? retryError
            : new Error(String(retryError));
          primaryError = new Error(
            `ElevenLabs primary failed after retry: first (${primaryError.message}); retry (${retryFailure.message})`,
          );
          allowOpenAiFallback = isRetriableElevenLabsError(retryFailure);
        }
      } else {
        throw primaryError;
      }

      if (requirePrimaryVoice) {
        throw primaryError;
      }

      console.warn(
        "ElevenLabs audio generation failed; trying OpenAI TTS fallback as last resort",
        {
          error: primaryError.message,
        },
      );
    }
  } else {
    primaryError = new Error("ELEVENLABS_API_KEY is not configured");
  }

  if (!allowOpenAiFallback) {
    throw primaryError ?? new Error("ElevenLabs audio generation failed");
  }

  if (!openAiApiKey) {
    throw primaryError ?? new Error("No TTS provider is configured");
  }

  try {
    return {
      audioBytes: await generateOpenAiAudio({
        fetchImpl,
        apiKey: openAiApiKey,
        mentorSlug,
        script,
        speed: voiceConfig.speed,
      }),
      provider: "openai",
      model: OPENAI_TTS_MODEL_NAME,
      transcript: [],
    };
  } catch (fallbackError) {
    const fallbackFailure = fallbackError instanceof Error
      ? fallbackError
      : new Error(String(fallbackError));
    throw new Error(
      `ElevenLabs primary failed (${
        primaryError?.message ?? "unknown error"
      }); OpenAI TTS fallback failed (${fallbackFailure.message})`,
    );
  }
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

    const { mentorSlug, script, requirePrimaryVoice } = await req.json();
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

    const voiceSettings = buildElevenLabsVoiceSettings(voiceConfig);

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
      requirePrimaryVoice: requirePrimaryVoice === true,
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
      JSON.stringify({
        audioUrl,
        provider: audioResult.provider,
        storagePath: filePath,
        transcript: audioResult.transcript,
        hasWordTimestamps: audioResult.transcript.length > 0,
      }),
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
