import {
  buildCompanionAnimationPrompt,
  COMPANION_ANIMATION_PROVIDER,
  resolveFalKlingModelFromEnv,
} from "./falKlingVideoClient.ts";
import {
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "./costGuardrails.ts";
import { isTierBoundaryLevel } from "../../../src/config/progression.ts";
import {
  coerceCompanionPresetId,
  hasBundledYouthCompanionPresetAssets,
} from "../../../src/config/companionCatalog.ts";
import { isBundledCosmiqCanonicalCompanionAssetUrl } from "../../../src/config/cosmiqCanonicalCompanionAssets.ts";

export interface CompanionAnimationEligibilityParams {
  stage: number;
  generationMetadata?: unknown;
  sourceImageUrl?: string | null;
  previousImageUrl?: string | null;
}

export interface CompanionAnimationIneligibility {
  code: string;
  message: string;
}

const truthyEnvValue = (value: string | null | undefined): boolean => {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized === "1" || normalized === "true" || normalized === "yes" ||
    normalized === "on";
};

export const hasPublicHttpUrl = (
  value: string | null | undefined,
): value is string => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

const isBundledGracewardEggUrl = (
  value: string | null | undefined,
): value is string =>
  typeof value === "string" &&
  /^\/companion-eggs\/(?:v2\/)?egg__t0_egg__normal__[a-z0-9_-]+\.(?:png|webp)$/i
    .test(value.trim());

const isBundledCompanionYouthUrl = (
  value: string | null | undefined,
): value is string => {
  if (typeof value !== "string") return false;

  const match = value.trim().match(
    /^\/companion-presets\/([a-z0-9_-]+)\/t1_youth\/normal\/([a-z0-9_-]+)__t1_youth__normal__[a-z0-9_-]+\.png$/i,
  );
  if (!match || match[1] !== match[2]) return false;

  const presetId = coerceCompanionPresetId(match[1]);
  return Boolean(presetId && hasBundledYouthCompanionPresetAssets(presetId));
};

export const isSupportedCompanionAnimationImageUrl = (
  value: string | null | undefined,
): value is string =>
  hasPublicHttpUrl(value) ||
  isBundledGracewardEggUrl(value) ||
  isBundledCompanionYouthUrl(value) ||
  isBundledCosmiqCanonicalCompanionAssetUrl(value);

const normalizeComparableImageUrl = (
  value: string | null | undefined,
): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const getGenerationMetadataRecord = (
  value: unknown,
): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const isReuseGenerationMetadata = (value: unknown): boolean => {
  const metadata = getGenerationMetadataRecord(value);
  return metadata?.sourceType === "reuse";
};

export const getCompanionAnimationIneligibility = ({
  stage,
  generationMetadata,
  sourceImageUrl,
  previousImageUrl,
}: CompanionAnimationEligibilityParams):
  | CompanionAnimationIneligibility
  | null => {
  if (!isTierBoundaryLevel(stage)) {
    return {
      code: "stage_not_animatable",
      message:
        "Companion animation generation is only available for visual evolution boundary stages",
    };
  }

  if (isReuseGenerationMetadata(generationMetadata)) {
    return {
      code: "image_unchanged",
      message:
        "Companion animation generation was skipped because this evolution reuses the prior image",
    };
  }

  const normalizedSourceImageUrl = normalizeComparableImageUrl(sourceImageUrl);
  const normalizedPreviousImageUrl = normalizeComparableImageUrl(
    previousImageUrl,
  );
  if (
    normalizedSourceImageUrl &&
    normalizedPreviousImageUrl &&
    normalizedSourceImageUrl === normalizedPreviousImageUrl
  ) {
    return {
      code: "image_unchanged",
      message:
        "Companion animation generation was skipped because the evolution image did not change",
    };
  }

  return null;
};

interface EnqueueCompanionAnimationJobParams {
  supabase: any;
  createCostGuardrailSession: typeof createCostGuardrailSession;
  userId: string;
  companionId: string;
  evolutionId: string | null | undefined;
  stage: number;
  imageUrl: string | null | undefined;
  generationMetadata?: unknown;
  previousImageUrl?: string | null;
  element?: string | null;
  env?: Pick<typeof Deno.env, "get">;
  now?: () => Date;
  info?: typeof console.info;
  error?: typeof console.error;
}

const markCompanionAnimationSkipped = async ({
  supabase,
  evolutionId,
  providerModel,
  prompt,
  nowIso,
  code,
  message,
}: {
  supabase: any;
  evolutionId: string;
  providerModel: string;
  prompt: string;
  nowIso: string;
  code: string;
  message: string;
}) => {
  await supabase
    .from("companion_evolutions")
    .update({
      animation_provider: COMPANION_ANIMATION_PROVIDER,
      animation_provider_model: providerModel,
      animation_status: "skipped",
      animation_prompt: prompt,
      animation_error_code: code,
      animation_error_message: message,
      animation_requested_at: nowIso,
      animation_completed_at: nowIso,
    })
    .eq("id", evolutionId);
};

export const maybeEnqueueCompanionAnimationJob = async ({
  supabase,
  createCostGuardrailSession: createCostGuardrailSessionFn,
  userId,
  companionId,
  evolutionId,
  stage,
  imageUrl,
  generationMetadata,
  previousImageUrl,
  element,
  env = Deno.env,
  now = () => new Date(),
  info = console.info,
  error = console.error,
}: EnqueueCompanionAnimationJobParams): Promise<{
  status: "queued" | "skipped" | "failed";
  reason?: string;
  jobId?: string;
}> => {
  if (!truthyEnvValue(env.get("COMPANION_ANIMATION_ENABLED"))) {
    return { status: "skipped", reason: "disabled" };
  }

  if (!evolutionId) {
    return { status: "skipped", reason: "missing_evolution_id" };
  }

  const providerModel = resolveFalKlingModelFromEnv(env);
  const prompt = buildCompanionAnimationPrompt({ element, stage });
  const nowIso = now().toISOString();

  const markSkipped = async (code: string, message: string) => {
    try {
      await markCompanionAnimationSkipped({
        supabase,
        evolutionId,
        providerModel,
        prompt,
        nowIso,
        code,
        message,
      });
    } catch (skipError) {
      error(
        "[CompanionEvolution] Failed to record skipped companion animation",
        skipError,
      );
    }
    return { status: "skipped" as const, reason: code };
  };

  const ineligibility = getCompanionAnimationIneligibility({
    stage,
    generationMetadata,
    sourceImageUrl: imageUrl,
    previousImageUrl,
  });
  if (ineligibility) {
    return await markSkipped(ineligibility.code, ineligibility.message);
  }

  if (!env.get("FAL_KEY")?.trim()) {
    return await markSkipped("fal_key_missing", "FAL_KEY is not configured");
  }

  if (!isSupportedCompanionAnimationImageUrl(imageUrl)) {
    return await markSkipped(
      "source_image_url_unavailable",
      "Evolution ending image is not publicly accessible",
    );
  }

  const animationStartImageUrl = previousImageUrl?.trim() || null;
  if (!isSupportedCompanionAnimationImageUrl(animationStartImageUrl)) {
    return await markSkipped(
      stage === 1
        ? "hatch_start_image_url_unavailable"
        : "evolution_start_image_url_unavailable",
      stage === 1
        ? "Hatch animation requires an accessible egg starting image"
        : "Evolution animation requires the prior approved portrait as its starting image",
    );
  }

  try {
    const costGuardrails = createCostGuardrailSessionFn({
      supabase,
      endpointKey: "process-companion-animation-job",
      featureKey: "ai_companion_animation",
      userId,
    });
    await costGuardrails.enforceAccess({
      capabilities: ["video"],
      providers: [COMPANION_ANIMATION_PROVIDER],
      metadata: {
        model: providerModel,
        stage,
        phase: "enqueue",
      },
    });
  } catch (guardrailError) {
    if (isCostGuardrailBlockedError(guardrailError)) {
      return await markSkipped(
        "cost_guardrail_blocked",
        "Companion animation generation is blocked by cost guardrails",
      );
    }
    error(
      "[CompanionEvolution] Failed to check companion animation cost guardrails",
      guardrailError,
    );
    try {
      await supabase
        .from("companion_evolutions")
        .update({
          animation_provider: COMPANION_ANIMATION_PROVIDER,
          animation_provider_model: providerModel,
          animation_status: "failed",
          animation_prompt: prompt,
          animation_error_code: "animation_guardrail_check_failed",
          animation_error_message: guardrailError instanceof Error
            ? guardrailError.message.slice(0, 500)
            : "Unknown error",
          animation_requested_at: nowIso,
          animation_completed_at: nowIso,
        })
        .eq("id", evolutionId);
    } catch (updateError) {
      error(
        "[CompanionEvolution] Failed to record companion animation guardrail failure",
        updateError,
      );
    }
    return { status: "failed", reason: "animation_guardrail_check_failed" };
  }

  try {
    const { data, error: upsertJobError } = await supabase
      .from("companion_animation_jobs")
      .upsert(
        {
          user_id: userId,
          companion_id: companionId,
          evolution_id: evolutionId,
          stage,
          source_image_url: imageUrl,
          start_image_url: animationStartImageUrl,
          provider: COMPANION_ANIMATION_PROVIDER,
          provider_model: providerModel,
          provider_task_id: null,
          provider_status: null,
          status: "queued",
          prompt,
          video_url: null,
          storage_path: null,
          error_code: null,
          error_message: null,
          retry_count: 0,
          next_retry_at: nowIso,
          requested_at: nowIso,
          started_at: null,
          completed_at: null,
          updated_at: nowIso,
        },
        { onConflict: "evolution_id" },
      )
      .select("id")
      .single();

    if (upsertJobError) {
      throw upsertJobError;
    }

    const { error: updateEvolutionError } = await supabase
      .from("companion_evolutions")
      .update({
        animation_provider: COMPANION_ANIMATION_PROVIDER,
        animation_provider_model: providerModel,
        animation_provider_task_id: null,
        animation_status: "queued",
        animation_prompt: prompt,
        animation_error_code: null,
        animation_error_message: null,
        animation_requested_at: nowIso,
        animation_completed_at: null,
      })
      .eq("id", evolutionId);

    if (updateEvolutionError) {
      throw updateEvolutionError;
    }

    info("[CompanionEvolution] Enqueued companion animation job", {
      companionId,
      evolutionId,
      jobId: data?.id,
      stage,
      providerModel,
    });

    return {
      status: "queued",
      jobId: typeof data?.id === "string" ? data.id : undefined,
    };
  } catch (enqueueError) {
    error(
      "[CompanionEvolution] Failed to enqueue companion animation job",
      enqueueError,
    );
    try {
      await supabase
        .from("companion_evolutions")
        .update({
          animation_provider: COMPANION_ANIMATION_PROVIDER,
          animation_provider_model: providerModel,
          animation_status: "failed",
          animation_prompt: prompt,
          animation_error_code: "animation_enqueue_failed",
          animation_error_message: enqueueError instanceof Error
            ? enqueueError.message.slice(0, 500)
            : "Unknown error",
          animation_requested_at: nowIso,
          animation_completed_at: nowIso,
        })
        .eq("id", evolutionId);
    } catch (updateError) {
      error(
        "[CompanionEvolution] Failed to record companion animation enqueue failure",
        updateError,
      );
    }

    return { status: "failed", reason: "animation_enqueue_failed" };
  }
};
