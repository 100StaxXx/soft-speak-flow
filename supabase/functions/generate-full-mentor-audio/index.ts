import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { requireInternalRequest } from "../_shared/auth.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import { invokeInternalFunction } from "../_shared/internalFunctionAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
  if (typeof details.upstreamStatus === "number") {
    payload.upstream_status = details.upstreamStatus;
  }
  if (
    typeof details.upstreamError === "string" &&
    details.upstreamError.length > 0
  ) {
    payload.upstream_error = details.upstreamError;
  }

  return new Response(
    JSON.stringify(payload),
    {
      status: normalizeStatus(status),
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
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

function shouldUseFallbackScript(
  status: number,
  upstreamError: string | null,
): boolean {
  if (status === 402 || status === 429 || status >= 500) {
    return true;
  }

  const normalizedError = (upstreamError ?? "").toLowerCase();
  return (
    normalizedError.includes("rate limit") ||
    normalizedError.includes("too many requests") ||
    normalizedError.includes("quota") ||
    normalizedError.includes("credits")
  );
}

function firstString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    const match = value.find((item) =>
      typeof item === "string" && item.trim().length > 0
    );
    return typeof match === "string" ? match.trim() : null;
  }
  return null;
}

function buildFallbackMentorScript({
  mentorSlug,
  topicCategory,
  intensity,
  emotionalTriggers,
}: {
  mentorSlug: string;
  topicCategory: unknown;
  intensity: unknown;
  emotionalTriggers: unknown;
}): string {
  const mentorNames: Record<string, string> = {
    sage: "The Sage",
    lyra: "Lyra",
    icon: "The Icon",
    charles: "Charles",
    princess: "The Princess",
    operator: "The Operator",
    rival: "The Rival",
    reign: "Reign",
  };
  const category = firstString(topicCategory)?.toLowerCase() ?? "mindset";
  const trigger = firstString(emotionalTriggers)?.toLowerCase() ??
    "the day feels uncertain";
  const delivery = firstString(intensity)?.toLowerCase() ?? "medium";
  const mentorName = mentorNames[mentorSlug] ?? "your mentor";

  const categoryGuidance: Record<string, { focus: string; move: string }> = {
    boundaries: {
      focus: "protecting your standard without explaining it to everyone",
      move:
        "choose the one boundary that keeps your energy pointed in the right direction",
    },
    business: {
      focus:
        "making the highest-value move instead of circling the same decision",
      move: "pick the action that creates leverage, clarity, or revenue",
    },
    confidence: {
      focus: "remembering that confidence is built by evidence, not waiting",
      move: "do one small thing that proves you can trust yourself",
    },
    discipline: {
      focus: "returning to structure even when motivation is not loud",
      move: "start the habit before your mind has time to negotiate",
    },
    focus: {
      focus:
        "clearing the noise and giving your attention a single place to land",
      move: "remove one distraction and finish one visible piece of work",
    },
    habits: {
      focus: "making consistency feel simple enough to repeat",
      move: "choose the smallest version of the habit and complete it fully",
    },
    identity: {
      focus: "acting in alignment with the person you are becoming",
      move:
        "make the next choice match your future self instead of your old pattern",
    },
    mindset: {
      focus: "changing the way you meet the moment in front of you",
      move:
        "name the thought that is slowing you down, then answer it with action",
    },
    physique: {
      focus: "respecting the body you are building through ordinary choices",
      move:
        "complete the next training, nutrition, or recovery choice with intention",
    },
    reflection: {
      focus: "learning from the season without getting trapped inside it",
      move: "take the lesson, release the extra weight, and step forward",
    },
    strategy: {
      focus: "separating signal from noise and choosing what actually matters",
      move:
        "identify the highest-leverage next move and give it your best attention",
    },
  };
  const guidance = categoryGuidance[category] ?? categoryGuidance.mindset;
  const energy = delivery === "strong" || delivery === "high"
    ? "Be direct with yourself, but do not turn that directness into punishment."
    : "Keep this calm, clean, and honest.";

  return [
    `${mentorName} wants you to come back to what is real today.`,
    `When ${trigger}, it is easy to make the whole day feel bigger than it is.`,
    `Your work is ${guidance.focus}.`,
    energy,
    `You do not need a perfect mood to move in the right direction.`,
    `You need one clear decision, one grounded breath, and one action you can finish.`,
    `So ${guidance.move}.`,
    `Let that action become proof that you are still participating in your own becoming.`,
    `By tonight, you do not need to have solved everything; you only need to be able to say you chose alignment when it counted.`,
  ].join(" ");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireInternalRequest(req, corsHeaders);
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const { mentorSlug, topic_category, intensity, emotionalTriggers } =
      await req.json();

    if (!mentorSlug) {
      return buildErrorResponse(400, "mentorSlug is required", {
        code: "INVALID_REQUEST",
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return buildErrorResponse(500, "Missing Supabase environment variables", {
        code: "MISSING_ENV",
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const costGuardrails = createCostGuardrailSession({
      supabase,
      endpointKey: "generate-full-mentor-audio",
      featureKey: "ai_pep_talks",
    });
    await costGuardrails.enforceAccess({
      capabilities: ["text", "tts"],
      providers: ["openai", "elevenlabs"],
    });

    console.log(`Starting full audio generation for mentor ${mentorSlug}`);

    // Step 1: Generate script
    console.log("Step 1: Generating script...");
    const scriptResponse = await invokeInternalFunction(
      "generate-mentor-script",
      {
        mentorSlug,
        topic_category,
        intensity,
        emotionalTriggers,
      },
    );

    let script = "";
    let usedFallbackScript = false;

    if (!scriptResponse.ok) {
      const upstreamRaw = await scriptResponse.text();
      const upstreamError = parseUpstreamError(upstreamRaw);
      console.error(
        "Script generation error:",
        scriptResponse.status,
        upstreamRaw,
      );
      if (shouldUseFallbackScript(scriptResponse.status, upstreamError)) {
        script = buildFallbackMentorScript({
          mentorSlug,
          topicCategory: topic_category,
          intensity,
          emotionalTriggers,
        });
        usedFallbackScript = true;
        console.warn(
          "Using local fallback script because script generation was unavailable",
          {
            status: scriptResponse.status,
            upstreamError,
          },
        );
      } else {
        return buildErrorResponse(
          scriptResponse.status,
          "Failed to generate script",
          {
            code: "SCRIPT_GENERATION_FAILED",
            upstreamStatus: scriptResponse.status,
            upstreamError,
          },
        );
      }
    }

    if (scriptResponse.ok) {
      let scriptPayload: Record<string, unknown> | null = null;
      try {
        scriptPayload = await scriptResponse.json() as Record<string, unknown>;
      } catch {
        console.warn(
          "Using local fallback script because script response was invalid JSON",
        );
      }

      const generatedScript = typeof scriptPayload?.script === "string"
        ? scriptPayload.script.trim()
        : "";
      if (generatedScript) {
        script = generatedScript;
      } else {
        script = buildFallbackMentorScript({
          mentorSlug,
          topicCategory: topic_category,
          intensity,
          emotionalTriggers,
        });
        usedFallbackScript = true;
        console.warn(
          "Using local fallback script because script response was incomplete",
        );
      }
    }

    console.log(`Script generated: ${script.substring(0, 100)}...`);

    // Step 2: Generate audio from script
    console.log("Step 2: Generating audio...");
    const audioResponse = await invokeInternalFunction(
      "generate-mentor-audio",
      {
        mentorSlug,
        script,
      },
    );

    if (!audioResponse.ok) {
      const upstreamRaw = await audioResponse.text();
      const upstreamError = parseUpstreamError(upstreamRaw);
      console.error(
        "Audio generation error:",
        audioResponse.status,
        upstreamRaw,
      );
      return buildErrorResponse(
        audioResponse.status,
        "Failed to generate audio",
        {
          code: "AUDIO_GENERATION_FAILED",
          upstreamStatus: audioResponse.status,
          upstreamError,
        },
      );
    }

    let audioPayload: Record<string, unknown>;
    try {
      audioPayload = await audioResponse.json() as Record<string, unknown>;
    } catch {
      return buildErrorResponse(502, "Invalid audio generation response", {
        code: "AUDIO_GENERATION_INVALID_RESPONSE",
      });
    }
    const audioUrl = typeof audioPayload.audioUrl === "string"
      ? audioPayload.audioUrl
      : null;
    const storagePath = typeof audioPayload.storagePath === "string"
      ? audioPayload.storagePath
      : null;
    if (!audioUrl) {
      return buildErrorResponse(
        502,
        "Audio generation response missing audioUrl",
        {
          code: "AUDIO_GENERATION_INCOMPLETE_RESPONSE",
        },
      );
    }
    console.log(`Audio generated: ${audioUrl}`);

    return new Response(
      JSON.stringify({
        script,
        audioUrl,
        audioStoragePath: storagePath,
        scriptFallback: usedFallbackScript,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }
    console.error("Error in generate-full-mentor-audio function:", error);
    return buildErrorResponse(
      500,
      error instanceof Error ? error.message : "Unknown error",
      {
        code: "INTERNAL_ERROR",
      },
    );
  }
});
