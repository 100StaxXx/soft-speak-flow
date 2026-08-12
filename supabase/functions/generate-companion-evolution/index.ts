import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  checkRateLimit,
  createRateLimitResponse,
  RATE_LIMITS,
} from "../_shared/rateLimiter.ts";
import {
  getCompanionEvolutionRenderAttempts,
  getCompanionFinalImageQuality,
  resolveCompanionImageSizeForUser,
} from "../_shared/companionImagePolicy.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import {
  buildSpiritLockPromptBlock,
  resolveCompanionSpiritLockProfile,
} from "../_shared/companionSpiritLock.ts";
import {
  buildCompanionSpeciesIdentityPromptBlock,
  resolveCompanionSpeciesIdentity,
} from "../_shared/companionSpeciesIdentity.ts";
import {
  buildBoundaryEvolutionGenerationPrompt,
  buildCompanionGenerationMetadata,
  buildStage1BootstrapPrompt,
  coerceCompanionVisualAnchors,
  coerceImageLineageMetadata,
  getEvolutionDifferenceFloor,
  getApprovedHiddenBoundaryAnchor,
  shouldGeneratePortraitForStage,
  synthesizeVisualIdentityProfile,
  updateLineageMetadataAfterBoundaryEvolution,
  updateLineageMetadataAfterReveal,
  updateLineageMetadataWithVisualAnchors,
} from "../_shared/companionLineage.ts";
import {
  editCompanionImage,
  generateCompanionImage,
} from "../_shared/openaiCompanionImageClient.ts";
import { judgeCompanionImage } from "../_shared/companionImageJudge.ts";
import { extractCompanionVisualAnchors } from "../_shared/companionVisualAnchors.ts";
import { maybeEnqueueCompanionAnimationJob } from "../_shared/companionAnimationJobs.ts";
import {
  coerceCompanionElementId,
  coerceCompanionPresetId,
  COMPANION_PRESET_BUCKET,
  hasBundledYouthCompanionPresetAssets,
  hasRemoteCompanionPresetStageAssetCoverage,
  resolveBundledYouthCompanionAssetPath,
  resolveCompanionAssetPath,
} from "../../../src/config/companionCatalog.ts";
import {
  COSMIQ_CANONICAL_ASSET_BUCKET,
  getCosmiqCanonicalCompanionAssetDescriptor,
} from "../../../src/config/cosmiqCanonicalCompanionAssets.ts";
import {
  getNextUnclaimedVisualStageBoundaryLevel,
  resolveProgressionLevelFromXp,
} from "../../../src/config/progression.ts";
import { isPresetBackedCompanion } from "../../../src/lib/companionPredicates.ts";
import { registerUserStorageAsset } from "../_shared/storageAssetLedger.ts";

export { maybeEnqueueCompanionAnimationJob } from "../_shared/companionAnimationJobs.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-key",
};

const IMAGE_BUCKET = "evolution-cards";
const COMPANION_IMAGE_BACKGROUND = "transparent" as const;
const COMPANION_IMAGE_OUTPUT_FORMAT = "png" as const;
const JUDGE_MINIMUMS = {
  overall: 7,
  continuity: 6,
  anatomy: 6,
  stageMaturity: 8,
  backgroundCutout: 7,
};
const EVOLUTION_QUALITY_GATE_CODE = "evolution_quality_gate_failed";
const EVOLUTION_CONTINUITY_UNVERIFIED_CODE = "evolution_continuity_unverified";
const EVOLUTION_VALIDATION_UNAVAILABLE_CODE =
  "evolution_validation_unavailable";
const CANONICAL_CHRISTIAN_COMPANION_BUCKET = "mentors-avatars";
const CANONICAL_CHRISTIAN_COMPANION_PATH = "canonical/christian/v2";
const CANONICAL_CHRISTIAN_COMPANION_IDS = new Map<string, string>([
  ["dove", "dove"],
  ["eagle", "eagle"],
  ["lamb", "lamb"],
  ["lion", "lion"],
  ["stag", "stag"],
  ["wolf", "wolf"],
]);

export const resolveCanonicalChristianCompanionImageUrl = ({
  supabaseUrl,
  spiritAnimal,
}: {
  supabaseUrl: string;
  spiritAnimal: string | null | undefined;
}): string | null => {
  const normalizedSpiritAnimal = typeof spiritAnimal === "string"
    ? spiritAnimal.trim().toLowerCase()
    : "";
  const companionId = CANONICAL_CHRISTIAN_COMPANION_IDS.get(
    normalizedSpiritAnimal,
  );

  if (!companionId) return null;

  return `${
    supabaseUrl.replace(/\/+$/, "")
  }/storage/v1/object/public/${CANONICAL_CHRISTIAN_COMPANION_BUCKET}/${CANONICAL_CHRISTIAN_COMPANION_PATH}/${companionId}.webp`;
};

const getJudgeBackgroundCutoutScore = (
  scores: Awaited<ReturnType<typeof judgeCompanionImage>>,
): number =>
  scores && typeof scores.backgroundCutout === "number"
    ? scores.backgroundCutout
    : 0;

class EvolutionQualityGateError extends Error {
  code: string;
  status: number;

  constructor(
    message: string,
    code = EVOLUTION_QUALITY_GATE_CODE,
    status = 422,
  ) {
    super(message);
    this.name = "EvolutionQualityGateError";
    this.code = code;
    this.status = status;
  }
}

const normalizeErrorCode = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || "evolution_service_unavailable";

const resolveServerErrorCode = (message: string) => {
  const normalized = message.toLowerCase();
  if (normalized.includes("not enough xp")) return "not_enough_xp";
  if (normalized.includes("max stage")) return "max_stage_reached";
  if (normalized.includes("already evolved")) return "already_evolved";
  if (normalized.includes("companion not found")) return "companion_not_found";
  if (normalized.includes("image generation failed")) {
    return "image_generation_failed";
  }
  if (normalized.includes("no image returned")) return "image_generation_empty";
  if (normalized.includes("failed to upload image")) {
    return "image_upload_failed";
  }
  if (normalized.includes("failed to save evolution record")) {
    return "evolution_record_failed";
  }
  if (normalized.includes("failed to update companion")) {
    return "companion_update_failed";
  }
  if (normalized.includes("evolution thresholds not available")) {
    return "evolution_thresholds_unavailable";
  }
  if (normalized.includes("quality gate")) {
    return EVOLUTION_QUALITY_GATE_CODE;
  }
  if (normalized.includes("continuity could not be verified")) {
    return EVOLUTION_CONTINUITY_UNVERIFIED_CODE;
  }
  if (normalized.includes("openai_api_key")) return "openai_api_key_missing";
  return normalizeErrorCode(message);
};

const parseDataUrl = (dataUrl: string): Uint8Array => {
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  return Uint8Array.from(atob(base64Data), (char) => char.charCodeAt(0));
};

const uploadGeneratedImage = async ({
  supabase,
  userId,
  companionId,
  nextStage,
  generatedImageDataUrl,
}: {
  supabase: any;
  userId: string;
  companionId: string;
  nextStage: number;
  generatedImageDataUrl: string;
}): Promise<{ fileName: string; publicUrl: string }> => {
  const buffer = parseDataUrl(generatedImageDataUrl);
  const fileName =
    `${userId}/evolutions/${companionId}_stage_${nextStage}_${Date.now()}.png`;

  const { error: uploadError } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(fileName, buffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (uploadError) {
    const uploadMessage = typeof uploadError.message === "string" &&
        uploadError.message.trim().length > 0
      ? uploadError.message
      : "unknown_storage_error";
    throw new Error(`Failed to upload image: ${uploadMessage}`);
  }

  const { data: urlData } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(
    fileName,
  );
  return { fileName, publicUrl: urlData.publicUrl };
};

const upsertEvolutionRecord = async ({
  supabase,
  companionId,
  stage,
  imageUrl,
  xpAtEvolution,
  generationMetadata,
}: {
  supabase: any;
  companionId: string;
  stage: number;
  imageUrl: string;
  xpAtEvolution: number;
  generationMetadata?: unknown;
}) => {
  const { data, error } = await supabase
    .from("companion_evolutions")
    .upsert(
      {
        companion_id: companionId,
        stage,
        image_url: imageUrl,
        xp_at_evolution: xpAtEvolution,
        evolved_at: new Date().toISOString(),
        generation_metadata: generationMetadata ?? null,
      },
      { onConflict: "companion_id,stage" },
    )
    .select()
    .single();

  if (error) {
    throw new Error("Failed to save evolution record");
  }

  return (data ?? {}) as Record<string, unknown>;
};

const judgeScoresPass = ({
  mode,
  scores,
  previousLevel,
  nextLevel,
}: {
  mode: "bootstrap" | "egg" | "evolution";
  scores: Awaited<ReturnType<typeof judgeCompanionImage>>;
  previousLevel?: number;
  nextLevel?: number;
}): boolean => {
  if (!scores) return true;

  if (
    scores.overall < JUDGE_MINIMUMS.overall ||
    scores.continuity < JUDGE_MINIMUMS.continuity ||
    scores.anatomy < JUDGE_MINIMUMS.anatomy ||
    (mode === "bootstrap" && scores.stageMaturity < JUDGE_MINIMUMS.stageMaturity) ||
    getJudgeBackgroundCutoutScore(scores) < JUDGE_MINIMUMS.backgroundCutout
  ) {
    return false;
  }

  if (
    mode === "evolution" &&
    typeof previousLevel === "number" &&
    typeof nextLevel === "number" &&
    scores.difference < getEvolutionDifferenceFloor(previousLevel, nextLevel)
  ) {
    return false;
  }

  return true;
};

const rankJudgeScores = (
  scores: Awaited<ReturnType<typeof judgeCompanionImage>>,
): number => {
  if (!scores) return 0;
  return (
    scores.overall * 4 +
    scores.continuity * 3 +
    scores.anatomy * 2 +
    getJudgeBackgroundCutoutScore(scores) * 2 +
    scores.centering +
    scores.difference
  );
};

const resolveJudgeFocalValue = (value: number | null | undefined): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 0.5;

const appendJudgeCritique = (
  prompt: string,
  notes: string | null | undefined,
): string => {
  const critique = typeof notes === "string" ? notes.trim() : "";
  if (!critique) return prompt;
  return `${prompt}\n\nRetry critique:\n- ${critique}`;
};

export interface GenerateCompanionEvolutionDeps {
  createClient: typeof createClient;
  checkRateLimit: typeof checkRateLimit;
  createRateLimitResponse: typeof createRateLimitResponse;
  resolveCompanionImageSizeForUser: typeof resolveCompanionImageSizeForUser;
  createCostGuardrailSession: typeof createCostGuardrailSession;
  generateCompanionImage: typeof generateCompanionImage;
  editCompanionImage?: typeof editCompanionImage;
  judgeCompanionImage: typeof judgeCompanionImage;
  extractCompanionVisualAnchors: typeof extractCompanionVisualAnchors;
  registerUserStorageAsset: typeof registerUserStorageAsset;
  uploadGeneratedImage: typeof uploadGeneratedImage;
  upsertEvolutionRecord: typeof upsertEvolutionRecord;
  enqueueCompanionAnimationJob?: typeof maybeEnqueueCompanionAnimationJob;
  info: typeof console.info;
  error: typeof console.error;
}

const defaultGenerateCompanionEvolutionDeps: GenerateCompanionEvolutionDeps = {
  createClient,
  checkRateLimit,
  createRateLimitResponse,
  resolveCompanionImageSizeForUser,
  createCostGuardrailSession,
  generateCompanionImage,
  editCompanionImage,
  judgeCompanionImage,
  extractCompanionVisualAnchors,
  registerUserStorageAsset,
  uploadGeneratedImage,
  upsertEvolutionRecord,
  enqueueCompanionAnimationJob: maybeEnqueueCompanionAnimationJob,
  info: console.info,
  error: console.error,
};

export const handleGenerateCompanionEvolution = async (
  req: Request,
  deps: GenerateCompanionEvolutionDeps = defaultGenerateCompanionEvolutionDeps,
) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestStartedAt = Date.now();
  const {
    createClient: createSupabaseClient,
    checkRateLimit: checkRateLimitFn,
    createRateLimitResponse: createRateLimitResponseFn,
    resolveCompanionImageSizeForUser: resolveCompanionImageSizeForUserFn,
    createCostGuardrailSession: createCostGuardrailSessionFn,
    generateCompanionImage: generateCompanionImageFn,
    editCompanionImage: editCompanionImageFn,
    judgeCompanionImage: judgeCompanionImageFn,
    extractCompanionVisualAnchors: extractCompanionVisualAnchorsFn,
    registerUserStorageAsset: registerUserStorageAssetFn,
    uploadGeneratedImage: uploadGeneratedImageFn,
    upsertEvolutionRecord: upsertEvolutionRecordFn,
    enqueueCompanionAnimationJob: enqueueCompanionAnimationJobFn =
      maybeEnqueueCompanionAnimationJob,
    info: infoLog,
    error: errorLog,
  } = deps;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
    const providedInternalSecret = req.headers.get("x-internal-key");
    const isInternalCall = Boolean(internalSecret) &&
      providedInternalSecret === internalSecret;
    const authHeader = req.headers.get("Authorization");
    const requestBody = await req.json().catch(() => ({}));
    const requestedUserId = typeof requestBody?.userId === "string"
      ? requestBody.userId
      : null;

    let resolvedUserId: string | null = null;

    if (isInternalCall) {
      if (!requestedUserId) {
        return new Response(
          JSON.stringify({
            error: "userId is required for internal evolution calls",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      resolvedUserId = requestedUserId;
    } else {
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Missing Authorization header" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const authClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      });

      const {
        data: { user },
        error: authError,
      } = await authClient.auth.getUser();

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      resolvedUserId = requestedUserId ?? user.id;
      if (resolvedUserId !== user.id) {
        return new Response(
          JSON.stringify({ error: "User mismatch" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    if (!resolvedUserId) {
      return new Response(
        JSON.stringify({
          error: "Unable to resolve user for evolution request",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

    const rateLimit = await checkRateLimitFn(
      supabase,
      resolvedUserId,
      "companion-evolution",
      RATE_LIMITS["companion-evolution"],
    );
    if (!rateLimit.allowed) {
      return createRateLimitResponseFn(rateLimit, corsHeaders);
    }

    const { data: companion, error: companionError } = await supabase
      .from("user_companion")
      .select("*")
      .eq("user_id", resolvedUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (companionError) {
      throw new Error(`Failed to fetch companion: ${companionError.message}`);
    }

    if (!companion) {
      throw new Error("Companion not found");
    }

    const currentStage = companion.current_stage;
    const currentXP = companion.current_xp;

    const { data: thresholds, error: thresholdsError } = await supabase
      .from("evolution_thresholds")
      .select("*")
      .order("stage", { ascending: true });

    if (thresholdsError || !thresholds?.length) {
      throw new Error("Evolution thresholds not available");
    }

    const maxStage = thresholds[thresholds.length - 1].stage;
    if (currentStage >= maxStage) {
      return new Response(
        JSON.stringify({
          evolved: false,
          message: "Max stage reached",
          current_stage: currentStage,
          xp: currentXP,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const earnedLevel = resolveProgressionLevelFromXp(currentXP);
    const nextStage = getNextUnclaimedVisualStageBoundaryLevel(
      currentStage,
      earnedLevel,
    );

    if (nextStage === null) {
      const nextVisualThresholdData = thresholds.find((threshold) =>
        threshold.stage > currentStage &&
        getNextUnclaimedVisualStageBoundaryLevel(
            currentStage,
            threshold.stage,
          ) === threshold.stage
      );

      return new Response(
        JSON.stringify({
          evolved: false,
          message: nextVisualThresholdData
            ? "Not enough XP"
            : "Max stage reached",
          current_stage: currentStage,
          earned_level: earnedLevel,
          xp: currentXP,
          next_threshold: nextVisualThresholdData?.xp_required ?? null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const nextThresholdData = thresholds.find((threshold) =>
      threshold.stage === nextStage
    );
    if (!nextThresholdData) {
      throw new Error(`No threshold found for stage ${nextStage}`);
    }

    if (currentXP < nextThresholdData.xp_required) {
      return new Response(
        JSON.stringify({
          evolved: false,
          message: "Not enough XP",
          current_stage: currentStage,
          xp: currentXP,
          next_threshold: nextThresholdData.xp_required,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const enqueueAnimationForEvolution = async (
      evolutionRecord: Record<string, unknown> | null | undefined,
      imageUrl: string | null | undefined,
      options: {
        generationMetadata?: unknown;
        previousImageUrl?: string | null;
      } = {},
    ) => {
      const existingAnimationStatus =
        typeof evolutionRecord?.animation_status === "string"
          ? evolutionRecord.animation_status
          : null;
      if (
        existingAnimationStatus === "queued" ||
        existingAnimationStatus === "processing" ||
        existingAnimationStatus === "succeeded"
      ) {
        return;
      }

      await enqueueCompanionAnimationJobFn({
        supabase,
        createCostGuardrailSession: createCostGuardrailSessionFn,
        userId: resolvedUserId,
        companionId: companion.id,
        evolutionId: typeof evolutionRecord?.id === "string"
          ? evolutionRecord.id
          : null,
        stage: nextStage,
        imageUrl,
        generationMetadata: options.generationMetadata ??
          evolutionRecord?.generation_metadata,
        previousImageUrl: options.previousImageUrl,
        element: typeof companion.core_element === "string"
          ? companion.core_element
          : null,
        info: infoLog,
        error: errorLog,
      });
    };

    if (isPresetBackedCompanion(companion)) {
      const normalizedPresetId = coerceCompanionPresetId(companion.preset_id);
      if (!normalizedPresetId) {
        throw new Error("Companion preset could not be resolved");
      }

      const normalizedElement = coerceCompanionElementId(
        companion.core_element,
      );
      const canonicalAsset = getCosmiqCanonicalCompanionAssetDescriptor({
        species: normalizedPresetId,
        element: normalizedElement,
        stage: nextStage,
      });
      let newImageUrl: string | null = null;
      let presetAssetSource = "legacy_reuse";

      if (canonicalAsset) {
        newImageUrl = canonicalAsset.source === "bundled"
          ? `/${COSMIQ_CANONICAL_ASSET_BUCKET}/${canonicalAsset.storagePath}`
          : supabase.storage
            .from(COSMIQ_CANONICAL_ASSET_BUCKET)
            .getPublicUrl(canonicalAsset.storagePath).data.publicUrl;
        presetAssetSource = `canonical_cosmiq_${canonicalAsset.source}`;
      } else if (
        nextStage === 1 &&
        hasBundledYouthCompanionPresetAssets(normalizedPresetId)
      ) {
        newImageUrl = `/${COMPANION_PRESET_BUCKET}/${
          resolveBundledYouthCompanionAssetPath({
            presetId: normalizedPresetId,
            element: normalizedElement,
          })
        }`;
        presetAssetSource = "legacy_bundled_youth";
      } else if (
        hasRemoteCompanionPresetStageAssetCoverage({
          presetId: normalizedPresetId,
          stage: nextStage,
          state: "normal",
        })
      ) {
        const assetPath = resolveCompanionAssetPath({
          presetId: normalizedPresetId,
          stage: nextStage,
          state: "normal",
          element: normalizedElement,
        });
        newImageUrl = supabase.storage
          .from(COMPANION_PRESET_BUCKET)
          .getPublicUrl(assetPath).data.publicUrl;
        presetAssetSource = "legacy_remote_verified";
      } else {
        newImageUrl = companion.current_image_url ??
          companion.initial_image_url ?? null;
      }

      if (!newImageUrl) {
        throw new Error("No verified companion portrait is available");
      }

      const reusedPortrait = presetAssetSource === "legacy_reuse";
      const generationMetadata = {
        sourceType: reusedPortrait ? "reuse" : "canonical_preset",
        portraitRegenerated: !reusedPortrait,
        presetAssetSource,
        presetId: normalizedPresetId,
        element: normalizedElement,
        boundaryLevel: nextStage,
      };
      const evolutionRecord = await upsertEvolutionRecordFn({
        supabase,
        companionId: companion.id,
        stage: nextStage,
        imageUrl: newImageUrl,
        xpAtEvolution: currentXP,
        generationMetadata,
      });

      const { error: updateError } = await supabase
        .from("user_companion")
        .update({
          current_stage: nextStage,
          current_image_url: newImageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", companion.id);

      if (updateError) {
        throw new Error("Failed to update companion");
      }

      await enqueueAnimationForEvolution(evolutionRecord, newImageUrl, {
        generationMetadata,
        previousImageUrl: companion.current_image_url ??
          companion.initial_image_url ??
          null,
      });

      return new Response(
        JSON.stringify({
          evolved: true,
          previous_stage: currentStage,
          new_stage: nextStage,
          image_url: newImageUrl,
          xp_at_evolution: currentXP,
          evolution_id: evolutionRecord.id,
          portrait_regenerated: !reusedPortrait,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const visualIdentityProfile = synthesizeVisualIdentityProfile(
      companion.visual_identity_profile,
      {
        spiritAnimal: companion.spirit_animal,
        coreElement: companion.core_element,
        favoriteColor: companion.favorite_color,
        storyTone: companion.story_tone,
      },
    );
    const imageLineageMetadata = coerceImageLineageMetadata(
      companion.image_lineage_metadata,
    );

    const hiddenStageOneAnchor = nextStage === 1
      ? getApprovedHiddenBoundaryAnchor(companion.image_lineage_metadata, 1)
      : null;
    const stageOneRevealAnchor = hiddenStageOneAnchor?.imageUrl
      ? hiddenStageOneAnchor
      : null;

    if (nextStage === 1 && stageOneRevealAnchor?.imageUrl) {
      const lineageMetadataAfterReveal = updateLineageMetadataAfterReveal({
        existing: companion.image_lineage_metadata,
        revealedLevel: 1,
        imageUrl: stageOneRevealAnchor.imageUrl,
        focalX: stageOneRevealAnchor.focalX,
        focalY: stageOneRevealAnchor.focalY,
      });
      const generationMetadata = buildCompanionGenerationMetadata({
        sourceType: "reveal",
        boundaryLevel: 1,
        portraitRegenerated: false,
        reusedFromStage: 1,
      });

      const evolutionRecord = await upsertEvolutionRecordFn({
        supabase,
        companionId: companion.id,
        stage: nextStage,
        imageUrl: stageOneRevealAnchor.imageUrl,
        xpAtEvolution: currentXP,
        generationMetadata,
      });

      const { error: updateError } = await supabase
        .from("user_companion")
        .update({
          current_stage: nextStage,
          current_image_url: stageOneRevealAnchor.imageUrl,
          current_image_focal_x: stageOneRevealAnchor.focalX,
          current_image_focal_y: stageOneRevealAnchor.focalY,
          visual_identity_profile: visualIdentityProfile,
          image_lineage_metadata: lineageMetadataAfterReveal,
          updated_at: new Date().toISOString(),
        })
        .eq("id", companion.id);

      if (updateError) {
        throw new Error("Failed to update companion");
      }

      await enqueueAnimationForEvolution(
        evolutionRecord,
        stageOneRevealAnchor.imageUrl,
        {
          generationMetadata,
          previousImageUrl: companion.current_image_url ??
            companion.initial_image_url ??
            null,
        },
      );

      return new Response(
        JSON.stringify({
          evolved: true,
          previous_stage: currentStage,
          new_stage: nextStage,
          image_url: stageOneRevealAnchor.imageUrl,
          xp_at_evolution: currentXP,
          evolution_id: evolutionRecord.id,
          portrait_regenerated: false,
          visual_identity_profile: visualIdentityProfile,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const isLegacyStageOneBackfill = nextStage === 1 &&
      !hiddenStageOneAnchor?.imageUrl;
    if (isLegacyStageOneBackfill) {
      infoLog(
        "[CompanionEvolution] Missing hidden stage-1 anchor for AI companion; generating legacy backfill stage 1",
        {
          companionId: companion.id,
          currentStage,
          nextStage,
        },
      );
    }

    if (!shouldGeneratePortraitForStage(nextStage)) {
      const reusedImageUrl = companion.current_image_url ??
        companion.initial_image_url ??
        "";

      if (!reusedImageUrl) {
        throw new Error("Companion is missing a portrait to reuse");
      }

      const generationMetadata = buildCompanionGenerationMetadata({
        sourceType: "reuse",
        boundaryLevel: currentStage,
        portraitRegenerated: false,
        reusedFromStage: currentStage,
      });

      const evolutionRecord = await upsertEvolutionRecordFn({
        supabase,
        companionId: companion.id,
        stage: nextStage,
        imageUrl: reusedImageUrl,
        xpAtEvolution: currentXP,
        generationMetadata,
      });

      const { error: updateError } = await supabase
        .from("user_companion")
        .update({
          current_stage: nextStage,
          current_image_url: reusedImageUrl,
          visual_identity_profile: visualIdentityProfile,
          image_lineage_metadata: imageLineageMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", companion.id);

      if (updateError) {
        throw new Error("Failed to update companion");
      }

      await enqueueAnimationForEvolution(evolutionRecord, reusedImageUrl, {
        generationMetadata,
        previousImageUrl: companion.current_image_url ??
          companion.initial_image_url ??
          null,
      });

      return new Response(
        JSON.stringify({
          evolved: true,
          previous_stage: currentStage,
          new_stage: nextStage,
          image_url: reusedImageUrl,
          xp_at_evolution: currentXP,
          evolution_id: evolutionRecord.id,
          portrait_regenerated: false,
          visual_identity_profile: visualIdentityProfile,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({
          error: "OPENAI_API_KEY not configured",
          code: "openai_api_key_missing",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const costGuardrails = createCostGuardrailSessionFn({
      supabase,
      endpointKey: "generate-companion-evolution",
      featureKey: "ai_companion_evolution",
      userId: resolvedUserId,
    });
    const guardedFetch = costGuardrails.wrapFetch(fetch);
    await costGuardrails.enforceAccess({
      capabilities: ["image", "text"],
      providers: ["openai"],
    });

    const imageSize = resolveCompanionImageSizeForUserFn(resolvedUserId);
    const spiritLockProfile = resolveCompanionSpiritLockProfile(
      companion.spirit_animal,
    );
    const spiritLockPromptBlock = spiritLockProfile
      ? buildSpiritLockPromptBlock(spiritLockProfile, "image")
      : null;
    const speciesIdentity = resolveCompanionSpeciesIdentity(
      companion.spirit_animal,
    );
    const speciesIdentityPromptBlock = speciesIdentity
      ? buildCompanionSpeciesIdentityPromptBlock(speciesIdentity)
      : null;
    const renderAttempts = getCompanionEvolutionRenderAttempts();
    const finalImageQuality = getCompanionFinalImageQuality();
    const runJudgedRender = async ({
      mode,
      basePrompt,
      referenceImageUrl,
      previousLevel,
      nextLevel,
      render,
    }: {
      mode: "bootstrap" | "egg" | "evolution";
      basePrompt: string;
      referenceImageUrl?: string | null;
      previousLevel?: number;
      nextLevel?: number;
      render: (
        prompt: string,
      ) => Promise<{ imageDataUrl: string; revisedPrompt: string | null }>;
    }) => {
      let promptForAttempt = basePrompt;
      let bestAttempt:
        | {
          imageDataUrl: string;
          revisedPrompt: string | null;
          scores: Awaited<ReturnType<typeof judgeCompanionImage>>;
          retryCount: number;
          passed: boolean;
          judgeUnavailable: boolean;
        }
        | null = null;

      for (let attempt = 0; attempt < renderAttempts; attempt += 1) {
        const rendered = await render(promptForAttempt);
        const scores = await judgeCompanionImageFn({
          guardedFetch,
          openAIApiKey,
          profile: visualIdentityProfile,
          mode,
          candidateImageUrl: rendered.imageDataUrl,
          referenceImageUrl,
          previousLevel,
          nextLevel,
        });

        const passed = judgeScoresPass({
          mode,
          scores,
          previousLevel,
          nextLevel,
        });
        const attemptResult = {
          imageDataUrl: rendered.imageDataUrl,
          revisedPrompt: rendered.revisedPrompt,
          scores,
          retryCount: attempt,
          passed,
          judgeUnavailable: !scores,
        };

        if (
          !bestAttempt ||
          rankJudgeScores(scores) >= rankJudgeScores(bestAttempt.scores)
        ) {
          bestAttempt = attemptResult;
        }

        if (passed) {
          return attemptResult;
        }

        promptForAttempt = appendJudgeCritique(basePrompt, scores?.notes);
      }

      if (!bestAttempt) {
        throw new Error("No companion evolution render attempt succeeded");
      }

      return bestAttempt;
    };

    if (nextStage === 1) {
      const starterPromptBase = buildStage1BootstrapPrompt(
        visualIdentityProfile,
      );
      const starterPrompt = [
        starterPromptBase,
        "If a mature canonical reference is attached, use it only for permanent species identity, face, markings, palette, and illustration language. Transform the candidate into an unmistakable infant; do not preserve adult age markers.",
        speciesIdentityPromptBlock
          ? `Species identity lock:\n${speciesIdentityPromptBlock}`
          : "",
        spiritLockPromptBlock
          ? `Material identity lock:\n${spiritLockPromptBlock}`
          : "",
      ].filter(Boolean).join("\n\n");

      const canonicalStageOneReferenceUrl = resolveCanonicalChristianCompanionImageUrl({
        supabaseUrl,
        spiritAnimal: companion.spirit_animal,
      });
      let stageOneReferenceEditFailure: string | null = null;
      const stageOneAttempt = await runJudgedRender({
        mode: "bootstrap",
        basePrompt: starterPrompt,
        referenceImageUrl: canonicalStageOneReferenceUrl,
        previousLevel: 0,
        nextLevel: 1,
        render: async (prompt) => {
          if (
            canonicalStageOneReferenceUrl &&
            editCompanionImageFn &&
            !stageOneReferenceEditFailure
          ) {
            try {
              return await editCompanionImageFn({
                guardedFetch,
                openAIApiKey,
                prompt,
                size: imageSize,
                quality: finalImageQuality,
                background: COMPANION_IMAGE_BACKGROUND,
                outputFormat: COMPANION_IMAGE_OUTPUT_FORMAT,
                userId: resolvedUserId,
                referenceImages: [{ imageUrl: canonicalStageOneReferenceUrl }],
              });
            } catch (referenceEditError) {
              stageOneReferenceEditFailure = referenceEditError instanceof Error
                ? referenceEditError.message.slice(0, 500)
                : String(referenceEditError).slice(0, 500);
              infoLog(
                "[CompanionEvolution] Canonical infant reference edit failed; falling back to lineage generation",
                {
                  companionId: companion.id,
                  nextStage,
                  error: stageOneReferenceEditFailure,
                },
              );
            }
          }

          return await generateCompanionImageFn({
            guardedFetch,
            openAIApiKey,
            prompt,
            size: imageSize,
            quality: finalImageQuality,
            background: COMPANION_IMAGE_BACKGROUND,
            outputFormat: COMPANION_IMAGE_OUTPUT_FORMAT,
            userId: resolvedUserId,
          });
        },
      });

      if (stageOneAttempt.judgeUnavailable) {
        throw new EvolutionQualityGateError(
          "Companion stage-1 render could not be validated because judge scores were unavailable.",
          EVOLUTION_VALIDATION_UNAVAILABLE_CODE,
          502,
        );
      }

      if (!stageOneAttempt.passed && !stageOneAttempt.judgeUnavailable) {
        throw new EvolutionQualityGateError(
          `Companion stage-1 render failed quality gate: ${
            stageOneAttempt.scores?.notes || "candidate did not pass judge"
          }`,
        );
      }

      const { fileName, publicUrl: newImageUrl } = await uploadGeneratedImageFn(
        {
          supabase,
          userId: resolvedUserId,
          companionId: companion.id,
          nextStage,
          generatedImageDataUrl: stageOneAttempt.imageDataUrl,
        },
      );
      const stageOneFocalX = resolveJudgeFocalValue(
        stageOneAttempt.scores?.subjectCenterX,
      );
      const stageOneFocalY = resolveJudgeFocalValue(
        stageOneAttempt.scores?.subjectCenterY,
      );

      const lineageMetadataAfterReveal = updateLineageMetadataAfterReveal({
        existing: companion.image_lineage_metadata,
        revealedLevel: 1,
        imageUrl: newImageUrl,
        focalX: stageOneFocalX,
        focalY: stageOneFocalY,
        sourceType: isLegacyStageOneBackfill
          ? "legacy_backfill"
          : "generation",
      });
      const generationMetadata = buildCompanionGenerationMetadata({
        sourceType: isLegacyStageOneBackfill ? "legacy_backfill" : "generation",
        boundaryLevel: 1,
        portraitRegenerated: true,
        retryCount: stageOneAttempt.retryCount,
        scores: stageOneAttempt.scores ?? undefined,
        notes: isLegacyStageOneBackfill
          ? "Legacy AI companion missing hidden stage-1 anchor; generated stage-1 backfill from traits."
          : stageOneAttempt.scores?.notes ?? stageOneAttempt.revisedPrompt,
      });

      const evolutionRecord = await upsertEvolutionRecordFn({
        supabase,
        companionId: companion.id,
        stage: nextStage,
        imageUrl: newImageUrl,
        xpAtEvolution: currentXP,
        generationMetadata,
      });

      await registerUserStorageAssetFn({
        supabase,
        userId: resolvedUserId,
        bucketId: IMAGE_BUCKET,
        storagePath: fileName,
        sourceKind: "companion_evolution",
        sourceRecordTable: "companion_evolutions",
        sourceRecordId: typeof evolutionRecord?.id === "string"
          ? evolutionRecord.id
          : undefined,
      });

      const { error: updateError } = await supabase
        .from("user_companion")
        .update({
          current_stage: nextStage,
          current_image_url: newImageUrl,
          current_image_focal_x: stageOneFocalX,
          current_image_focal_y: stageOneFocalY,
          dormant_image_url: null,
          dormant_image_focal_x: null,
          dormant_image_focal_y: null,
          neglected_image_url: null,
          neglected_image_focal_x: null,
          neglected_image_focal_y: null,
          visual_identity_profile: visualIdentityProfile,
          image_lineage_metadata: lineageMetadataAfterReveal,
          updated_at: new Date().toISOString(),
        })
        .eq("id", companion.id);

      if (updateError) {
        throw new Error("Failed to update companion");
      }

      await enqueueAnimationForEvolution(evolutionRecord, newImageUrl, {
        generationMetadata,
        previousImageUrl: companion.current_image_url ??
          companion.initial_image_url ??
          null,
      });

      return new Response(
        JSON.stringify({
          evolved: true,
          previous_stage: currentStage,
          new_stage: nextStage,
          image_url: newImageUrl,
          xp_at_evolution: currentXP,
          evolution_id: evolutionRecord.id,
          portrait_regenerated: true,
          visual_identity_profile: visualIdentityProfile,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const previousImageUrl = companion.current_image_url ??
      companion.initial_image_url ?? null;
    if (!previousImageUrl) {
      throw new Error("Companion is missing a portrait to evolve from");
    }

    let previousGenerationMetadata: unknown = null;
    const { data: previousEvolutionRecord, error: previousEvolutionError } =
      await supabase
        .from("companion_evolutions")
        .select("generation_metadata")
        .eq("companion_id", companion.id)
        .eq("stage", currentStage)
        .maybeSingle();

    if (previousEvolutionError) {
      infoLog(
        "[CompanionEvolution] Previous evolution metadata lookup failed",
        {
          companionId: companion.id,
          currentStage,
          error: previousEvolutionError.message,
        },
      );
    } else {
      previousGenerationMetadata =
        previousEvolutionRecord?.generation_metadata ?? null;
    }

    const extractedVisualAnchors = await extractCompanionVisualAnchorsFn({
      guardedFetch,
      openAIApiKey,
      profile: visualIdentityProfile,
      imageUrl: previousImageUrl,
      level: currentStage,
      priorGenerationMetadata: previousGenerationMetadata,
    });
    const normalizedExtractedVisualAnchors = coerceCompanionVisualAnchors(
      extractedVisualAnchors,
      currentStage,
      previousImageUrl,
    );
    const previousVisualAnchors = normalizedExtractedVisualAnchors ??
      imageLineageMetadata.visualAnchorsByLevel[String(currentStage)] ??
      null;
    const lineageMetadataWithPreviousAnchors =
      updateLineageMetadataWithVisualAnchors({
        existing: imageLineageMetadata,
        level: currentStage,
        visualAnchors: previousVisualAnchors,
      });

    const evolutionPromptBase = buildBoundaryEvolutionGenerationPrompt({
      profile: visualIdentityProfile,
      previousLevel: currentStage,
      nextLevel: nextStage,
      previousAnchors: previousVisualAnchors,
      previousGenerationMetadata,
    });
    const evolutionPrompt = [
      evolutionPromptBase,
      speciesIdentityPromptBlock
        ? `Species identity lock:\n${speciesIdentityPromptBlock}`
        : "",
      spiritLockPromptBlock
        ? `Material identity lock:\n${spiritLockPromptBlock}`
        : "",
    ].filter(Boolean).join("\n\n");

    let evolutionSourceType:
      | "previous_portrait_reference_edit"
      | "lineage_generation" = editCompanionImageFn
        ? "previous_portrait_reference_edit"
        : "lineage_generation";
    let evolutionReferenceEditFailure: string | null = null;

    const evolutionAttempt = await runJudgedRender({
      mode: "evolution",
      basePrompt: evolutionPrompt,
      previousLevel: currentStage,
      nextLevel: nextStage,
      referenceImageUrl: previousImageUrl,
      render: async (prompt) => {
        if (editCompanionImageFn && !evolutionReferenceEditFailure) {
          try {
            return await editCompanionImageFn({
              guardedFetch,
              openAIApiKey,
              prompt,
              size: imageSize,
              quality: finalImageQuality,
              background: COMPANION_IMAGE_BACKGROUND,
              outputFormat: COMPANION_IMAGE_OUTPUT_FORMAT,
              userId: resolvedUserId,
              referenceImages: [{ imageUrl: previousImageUrl }],
            });
          } catch (referenceEditError) {
            evolutionSourceType = "lineage_generation";
            evolutionReferenceEditFailure = referenceEditError instanceof Error
              ? referenceEditError.message.slice(0, 500)
              : String(referenceEditError).slice(0, 500);
            infoLog(
              "[CompanionEvolution] Previous-portrait reference edit failed; falling back to lineage generation",
              {
                companionId: companion.id,
                currentStage,
                nextStage,
                error: evolutionReferenceEditFailure,
              },
            );
          }
        }

        return await generateCompanionImageFn({
          guardedFetch,
          openAIApiKey,
          prompt,
          size: imageSize,
          quality: finalImageQuality,
          background: COMPANION_IMAGE_BACKGROUND,
          outputFormat: COMPANION_IMAGE_OUTPUT_FORMAT,
          userId: resolvedUserId,
        });
      },
    });

    if (!previousVisualAnchors && evolutionAttempt.judgeUnavailable) {
      throw new EvolutionQualityGateError(
        "Companion evolution continuity could not be verified because visual anchors and judge scores were unavailable.",
        EVOLUTION_CONTINUITY_UNVERIFIED_CODE,
      );
    }

    if (evolutionAttempt.judgeUnavailable) {
      throw new EvolutionQualityGateError(
        "Companion evolution render could not be validated because judge scores were unavailable.",
        EVOLUTION_VALIDATION_UNAVAILABLE_CODE,
        502,
      );
    }

    if (!evolutionAttempt.passed && !evolutionAttempt.judgeUnavailable) {
      throw new EvolutionQualityGateError(
        `Companion evolution render failed quality gate: ${
          evolutionAttempt.scores?.notes || "candidate did not pass judge"
        }`,
      );
    }

    const { fileName, publicUrl: newImageUrl } = await uploadGeneratedImageFn({
      supabase,
      userId: resolvedUserId,
      companionId: companion.id,
      nextStage,
      generatedImageDataUrl: evolutionAttempt.imageDataUrl,
    });
    const evolutionFocalX = resolveJudgeFocalValue(
      evolutionAttempt.scores?.subjectCenterX,
    );
    const evolutionFocalY = resolveJudgeFocalValue(
      evolutionAttempt.scores?.subjectCenterY,
    );

    const lineageMetadataAfterEvolution =
      updateLineageMetadataAfterBoundaryEvolution({
        existing: lineageMetadataWithPreviousAnchors,
        boundaryLevel: nextStage,
        imageUrl: newImageUrl,
        focalX: evolutionFocalX,
        focalY: evolutionFocalY,
      });
    const generationMetadata = {
      ...buildCompanionGenerationMetadata({
        sourceType: "lineage_generation",
        boundaryLevel: nextStage,
        portraitRegenerated: true,
        retryCount: evolutionAttempt.retryCount,
        scores: evolutionAttempt.scores ?? undefined,
        notes: evolutionAttempt.scores?.notes ?? evolutionAttempt.revisedPrompt,
      }),
      visualAnchorLevel: currentStage,
      renderSourceType: evolutionSourceType,
      referenceEditFailure: evolutionReferenceEditFailure,
      visualAnchorSourceImageUrl: previousVisualAnchors?.sourceImageUrl ??
        previousImageUrl,
      visualAnchorExtraction: normalizedExtractedVisualAnchors
        ? "fresh"
        : previousVisualAnchors
        ? "cached"
        : "unavailable",
      ...(evolutionAttempt.judgeUnavailable
        ? {
          qualityWarning: {
            code: "JUDGE_UNAVAILABLE",
            retryCount: evolutionAttempt.retryCount,
            message:
              "Saved metadata-first boundary evolution without judge scores.",
          },
        }
        : {}),
    };

    const evolutionRecord = await upsertEvolutionRecordFn({
      supabase,
      companionId: companion.id,
      stage: nextStage,
      imageUrl: newImageUrl,
      xpAtEvolution: currentXP,
      generationMetadata,
    });

    await registerUserStorageAssetFn({
      supabase,
      userId: resolvedUserId,
      bucketId: IMAGE_BUCKET,
      storagePath: fileName,
      sourceKind: "companion_evolution",
      sourceRecordTable: "companion_evolutions",
      sourceRecordId: typeof evolutionRecord?.id === "string"
        ? evolutionRecord.id
        : undefined,
    });

    const { error: updateError } = await supabase
      .from("user_companion")
      .update({
        current_stage: nextStage,
        current_image_url: newImageUrl,
        current_image_focal_x: evolutionFocalX,
        current_image_focal_y: evolutionFocalY,
        dormant_image_url: null,
        dormant_image_focal_x: null,
        dormant_image_focal_y: null,
        neglected_image_url: null,
        neglected_image_focal_x: null,
        neglected_image_focal_y: null,
        visual_identity_profile: visualIdentityProfile,
        image_lineage_metadata: lineageMetadataAfterEvolution,
        updated_at: new Date().toISOString(),
      })
      .eq("id", companion.id);

    if (updateError) {
      throw new Error("Failed to update companion");
    }

    await enqueueAnimationForEvolution(evolutionRecord, newImageUrl, {
      generationMetadata,
      previousImageUrl,
    });

    return new Response(
      JSON.stringify({
        evolved: true,
        previous_stage: currentStage,
        new_stage: nextStage,
        image_url: newImageUrl,
        xp_at_evolution: currentXP,
        evolution_id: evolutionRecord.id,
        portrait_regenerated: true,
        visual_identity_profile: visualIdentityProfile,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }

    errorLog("Error in generate-companion-evolution:", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    const errorCode = error instanceof EvolutionQualityGateError
      ? error.code
      : resolveServerErrorCode(errorMessage);
    const status = error instanceof EvolutionQualityGateError
      ? error.status
      : 500;
    return new Response(
      JSON.stringify({
        error: errorMessage,
        code: errorCode,
      }),
      {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } finally {
    console.log(
      `[CompanionEvolutionTiming] total_ms=${Date.now() - requestStartedAt}`,
    );
  }
};

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleGenerateCompanionEvolution(req));
}
