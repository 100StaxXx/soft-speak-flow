import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSafeErrorResponse, requireProtectedRequest } from "../_shared/abuseProtection.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { registerUserStorageAsset } from "../_shared/storageAssetLedger.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import {
  JOURNEY_PATH_LANDSCAPE_IMAGE_SIZE,
  JOURNEY_PATH_RENDER_VERSION,
  needsJourneyPathLandscapeRefresh,
} from "../../../src/shared/journeyPathConfig.ts";

interface JourneyPathRequestBody {
  epicId: string | null;
  milestoneIndex: number | null;
}

interface ValidJourneyPathRequestBody {
  epicId: string;
  milestoneIndex: number;
}

interface JourneyPathBodyReadResult {
  parseErrorName: string | null;
  parsedBody: JourneyPathRequestBody;
  rawBody: unknown;
}

interface GenerateJourneyPathDependencies {
  getOpenAIApiKey?: () => string | undefined;
  requireProtectedRequestImpl?: typeof requireProtectedRequest;
}

const INVALID_JOURNEY_PATH_INPUT_ERROR = "Missing or invalid journey path parameters.";
const EPIC_SYNC_PENDING_ERROR = "We couldn't load this campaign yet. If you just created it, wait a moment and try again.";
const EPIC_FETCH_RETRY_DELAYS_MS = [400, 1200, 2500] as const;

const normalizeJourneyPathEpicId = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeJourneyPathMilestoneIndex = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isInteger(parsed) ? parsed : null;
  }

  return null;
};

export function parseJourneyPathBody(payload: unknown): JourneyPathRequestBody {
  if (!payload || typeof payload !== "object") {
    return { epicId: null, milestoneIndex: null };
  }

  const requestPayload = payload as Record<string, unknown>;
  return {
    epicId: normalizeJourneyPathEpicId(requestPayload.epicId),
    milestoneIndex: normalizeJourneyPathMilestoneIndex(requestPayload.milestoneIndex),
  };
}

export async function readJourneyPathBody(req: Request): Promise<JourneyPathBodyReadResult> {
  try {
    const rawBody = await req.clone().json();
    return {
      parseErrorName: null,
      parsedBody: parseJourneyPathBody(rawBody),
      rawBody,
    };
  } catch (error) {
    return {
      parseErrorName: error instanceof Error ? error.name : "UnknownError",
      parsedBody: { epicId: null, milestoneIndex: null },
      rawBody: null,
    };
  }
}

export function getJourneyPathValidationError(body: JourneyPathRequestBody): string | null {
  if (!body.epicId || body.milestoneIndex === null || body.milestoneIndex < 0) {
    return INVALID_JOURNEY_PATH_INPUT_ERROR;
  }

  return null;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isValidJourneyPathBody(body: JourneyPathRequestBody): body is ValidJourneyPathRequestBody {
  return getJourneyPathValidationError(body) === null;
}

function logJourneyPathValidationFailure(
  req: Request,
  requestId: string,
  bodyReadResult: JourneyPathBodyReadResult,
) {
  const rawPayload = bodyReadResult.rawBody && typeof bodyReadResult.rawBody === "object"
    ? bodyReadResult.rawBody as Record<string, unknown>
    : null;

  const rawEpicId = rawPayload?.epicId;
  const rawMilestoneIndex = rawPayload?.milestoneIndex;

  console.warn("[generate-journey-path] Invalid input", {
    requestId,
    bodyUsed: req.bodyUsed,
    contentType: req.headers.get("content-type"),
    hasJsonBody: bodyReadResult.rawBody !== null,
    parseErrorName: bodyReadResult.parseErrorName,
    epicIdType: rawEpicId === undefined ? "missing" : typeof rawEpicId,
    epicIdLength: typeof rawEpicId === "string" ? rawEpicId.trim().length : null,
    milestoneIndexType: rawMilestoneIndex === undefined ? "missing" : typeof rawMilestoneIndex,
    normalizedMilestoneIndex: bodyReadResult.parsedBody.milestoneIndex,
  });
}

export async function handleGenerateJourneyPath(
  req: Request,
  deps: GenerateJourneyPathDependencies = {},
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);
  const bodyReadResult = await readJourneyPathBody(req);
  const requireProtectedRequestImpl = deps.requireProtectedRequestImpl ?? requireProtectedRequest;
  const getOpenAIApiKey = deps.getOpenAIApiKey ?? (() => Deno.env.get("OPENAI_API_KEY"));
  let requestId: string = crypto.randomUUID();

  try {
    const protectedRequest = await requireProtectedRequestImpl(req, {
      profileKey: "ai.standard",
      endpointName: "generate-journey-path",
      allowServiceRole: false,
    });
    if (protectedRequest instanceof Response) {
      return protectedRequest;
    }
    const { auth, supabase, requestId: protectedRequestId } = protectedRequest;
    requestId = protectedRequestId;

    if (!isValidJourneyPathBody(bodyReadResult.parsedBody)) {
      logJourneyPathValidationFailure(req, requestId, bodyReadResult);
      return createSafeErrorResponse(req, {
        status: 400,
        code: "INVALID_INPUT",
        error: INVALID_JOURNEY_PATH_INPUT_ERROR,
        requestId,
      });
    }
    const { epicId, milestoneIndex } = bodyReadResult.parsedBody;

    const openAIApiKey = getOpenAIApiKey();
    if (!openAIApiKey) {
      return createSafeErrorResponse(req, {
        status: 500,
        code: "SERVICE_MISCONFIGURED",
        error: "Request could not be processed right now",
        requestId,
      });
    }

    const userId = auth.userId;
    const costGuardrails = createCostGuardrailSession({
      supabase,
      endpointKey: "generate-journey-path",
      featureKey: "ai_journey_images",
      userId,
      requestId,
    });
    const guardedFetch = costGuardrails.wrapFetch(fetch);
    await costGuardrails.enforceAccess({
      capabilities: ["image"],
      providers: ["openai"],
      metadata: {
        epic_id: epicId,
        milestone_index: milestoneIndex,
      },
    });

    const { data: existingPath } = await supabase
      .from("epic_journey_paths")
      .select("id, image_url, prompt_context")
      .eq("epic_id", epicId)
      .eq("user_id", userId)
      .eq("milestone_index", milestoneIndex)
      .maybeSingle();

    if (existingPath && !needsJourneyPathLandscapeRefresh(existingPath.prompt_context)) {
      return new Response(JSON.stringify({
        success: true,
        existing: true,
        imageUrl: existingPath.image_url,
        milestoneIndex,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let epic: {
      id: string;
      user_id: string;
      title: string;
      story_type_slug: string | null;
      theme_color: string | null;
      story_seed: unknown;
    } | null = null;
    let epicError: unknown = null;

    for (let attemptIndex = 0; attemptIndex <= EPIC_FETCH_RETRY_DELAYS_MS.length; attemptIndex += 1) {
      const epicResult = await supabase
        .from("epics")
        .select("id, user_id, title, story_type_slug, theme_color, story_seed")
        .eq("id", epicId)
        .single();

      epic = epicResult.data;
      epicError = epicResult.error;

      if (!epicError && epic) {
        break;
      }

      if (attemptIndex < EPIC_FETCH_RETRY_DELAYS_MS.length) {
        await sleep(EPIC_FETCH_RETRY_DELAYS_MS[attemptIndex]);
      }
    }

    if (epicError || !epic) {
      console.error("[generate-journey-path] Epic fetch error:", epicError);
      return createSafeErrorResponse(req, {
        status: 404,
        code: "NOT_FOUND",
        error: EPIC_SYNC_PENDING_ERROR,
        requestId,
      });
    }

    if (epic.user_id !== userId) {
      const { data: membership, error: membershipError } = await supabase
        .from("epic_members")
        .select("user_id")
        .eq("epic_id", epicId)
        .eq("user_id", userId)
        .maybeSingle();

      if (membershipError) {
        console.error("[generate-journey-path] Membership check error:", membershipError);
        return createSafeErrorResponse(req, {
          status: 500,
          code: "INTERNAL_ERROR",
          error: "Request could not be processed right now",
          requestId,
        });
      }

      if (!membership) {
        return createSafeErrorResponse(req, {
          status: 403,
          code: "FORBIDDEN",
          error: "Forbidden",
          requestId,
        });
      }
    }

    const { data: companion } = await supabase
      .from("user_companion")
      .select("spirit_animal, core_element, favorite_color")
      .eq("user_id", userId)
      .single();

    const worldContext = {
      worldName: "a mystical realm",
      worldEra: "an ancient time",
      currentLocation: "the beginning of the path",
      nextLocation: "mysteries ahead",
    };

    if (epic.story_seed) {
      const storySeed = typeof epic.story_seed === "string"
        ? JSON.parse(epic.story_seed)
        : epic.story_seed;

      if (storySeed?.story_universe) {
        worldContext.worldName = storySeed.story_universe.world_name || worldContext.worldName;
        worldContext.worldEra = storySeed.story_universe.world_era || worldContext.worldEra;
      }

      if (Array.isArray(storySeed?.chapter_blueprints)) {
        const chapters = storySeed.chapter_blueprints;
        if (milestoneIndex === 0) {
          if (chapters[0]) {
            worldContext.nextLocation = chapters[0].location_name || chapters[0].title || "the first waypoint";
          }
        } else {
          const previousChapter = chapters[milestoneIndex - 1];
          const nextChapter = chapters[milestoneIndex];

          if (previousChapter) {
            worldContext.currentLocation = previousChapter.location_name || previousChapter.title || "a conquered realm";
          }

          if (nextChapter) {
            worldContext.nextLocation = nextChapter.location_name || nextChapter.title || "the path ahead";
          }
        }
      }
    }

    const companionType = companion?.spirit_animal || "mystical creature";
    const coreElement = companion?.core_element || "cosmic";
    const themeColor = epic.theme_color || "purple";
    const storyThemes: Record<string, string> = {
      treasure_hunt: "ancient ruins, hidden treasures, mysterious caves",
      heroes_journey: "epic landscapes, dramatic cliffs, heroic vistas",
      pilgrimage: "sacred temples, serene paths, spiritual energy",
      exploration: "uncharted territories, wild nature, discovery",
      rescue_mission: "dangerous terrain, urgent atmosphere, dramatic lighting",
      mystery: "fog-shrouded paths, enigmatic structures, ethereal glow",
    };

    const visualTheme = storyThemes[epic.story_type_slug || ""] || "cosmic fantasy landscapes";
    const prompt = `A beautiful panoramic walk path through ${worldContext.worldName} in ${worldContext.worldEra}.
The path leads from ${worldContext.currentLocation} toward ${worldContext.nextLocation} in a clear left-to-right travel composition.
Visual theme: ${visualTheme}.
The path should feel suitable for a ${companionType} companion with ${coreElement} energy walking alongside, but do not show any visible characters.
Color palette: ${themeColor} tones with cosmic accents.
Style: ethereal fantasy illustration, dreamy atmosphere, magical lighting, wide cinematic landscape composition.
Keep the main path readable across the lower-middle band with open breathing room near the top corners and side edges for UI overlays.
No text, no UI, no readable symbols, no characters visible.
Ultra high resolution.`;

    const aiResponse = await guardedFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
        image_size: JOURNEY_PATH_LANDSCAPE_IMAGE_SIZE,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[generate-journey-path] AI API error:", errorText);
      return createSafeErrorResponse(req, {
        status: 502,
        code: "UPSTREAM_FAILED",
        error: "Request could not be processed right now",
        requestId,
      });
    }

    const aiData = await aiResponse.json();
    const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageData) {
      console.error("[generate-journey-path] No image in response:", JSON.stringify(aiData).slice(0, 500));
      return createSafeErrorResponse(req, {
        status: 502,
        code: "UPSTREAM_FAILED",
        error: "Request could not be processed right now",
        requestId,
      });
    }

    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), (char) => char.charCodeAt(0));
    const fileName = `${userId}/${epicId}/${milestoneIndex}_${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("journey-paths")
      .upload(fileName, imageBytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("[generate-journey-path] Upload error:", uploadError);
      return createSafeErrorResponse(req, {
        status: 500,
        code: "UPLOAD_FAILED",
        error: "Request could not be processed right now",
        requestId,
      });
    }

    const { data: urlData } = supabase.storage
      .from("journey-paths")
      .getPublicUrl(fileName);

    const imageUrl = urlData.publicUrl;
    const { data: journeyPathRow, error: insertError } = await supabase
      .from("epic_journey_paths")
      .upsert({
        epic_id: epicId,
        user_id: userId,
        milestone_index: milestoneIndex,
        image_url: imageUrl,
        prompt_context: {
          worldContext,
          companionType,
          coreElement,
          themeColor,
          storyType: epic.story_type_slug,
          image_size: JOURNEY_PATH_LANDSCAPE_IMAGE_SIZE,
          render_version: JOURNEY_PATH_RENDER_VERSION,
        },
        generated_at: new Date().toISOString(),
      }, {
        onConflict: "epic_id,user_id,milestone_index",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[generate-journey-path] Database insert error:", insertError);
    } else {
      await registerUserStorageAsset({
        supabase,
        userId,
        bucketId: "journey-paths",
        storagePath: fileName,
        sourceKind: "journey_path",
        sourceRecordTable: "epic_journey_paths",
        sourceRecordId: typeof journeyPathRow?.id === "string" ? journeyPathRow.id : undefined,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      imageUrl,
      milestoneIndex,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }
    console.error("[generate-journey-path] Error:", error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Request could not be processed right now",
      requestId,
    });
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleGenerateJourneyPath(req));
}
