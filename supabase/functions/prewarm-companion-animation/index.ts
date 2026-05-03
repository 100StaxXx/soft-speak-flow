import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  errorResponse,
  requireAuthenticatedUser,
  type UserRequestAuth,
} from "../_shared/auth.ts";
import { maybeEnqueueCompanionAnimationJob } from "../_shared/companionAnimationJobs.ts";
import { createCostGuardrailSession } from "../_shared/costGuardrails.ts";
import { getHiddenBoundaryAnchor } from "../_shared/companionLineage.ts";
import {
  coerceCompanionElementId,
  coerceCompanionPresetId,
  COMPANION_PRESET_BUCKET,
  resolveCompanionAssetPath,
} from "../../../src/config/companionCatalog.ts";
import { getProgressionThreshold } from "../../../src/config/progression.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CompanionRecord {
  id: string;
  user_id: string;
  preset_id: string | null;
  core_element: string | null;
  current_stage: number | null;
  current_xp: number | null;
  image_lineage_metadata: unknown;
}

interface PrewarmCompanionAnimationDeps {
  authenticate: (
    req: Request,
    corsHeaders: HeadersInit,
  ) => Promise<UserRequestAuth | Response>;
  createSupabaseClient: () => any;
  createCostGuardrailSessionFn: typeof createCostGuardrailSession;
  enqueueAnimationJob: typeof maybeEnqueueCompanionAnimationJob;
  now: () => Date;
}

const defaultDeps: PrewarmCompanionAnimationDeps = {
  authenticate: requireAuthenticatedUser,
  createSupabaseClient: () => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  },
  createCostGuardrailSessionFn: createCostGuardrailSession,
  enqueueAnimationJob: maybeEnqueueCompanionAnimationJob,
  now: () => new Date(),
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const parseStage = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.trunc(value);
};

const resolvePrewarmImageUrl = ({
  supabase,
  companion,
  stage,
}: {
  supabase: any;
  companion: CompanionRecord;
  stage: number;
}): string | null => {
  const presetId = coerceCompanionPresetId(companion.preset_id);
  if (presetId) {
    const assetPath = resolveCompanionAssetPath({
      presetId,
      stage,
      state: "normal",
      element: coerceCompanionElementId(companion.core_element),
    });
    return supabase.storage.from(COMPANION_PRESET_BUCKET).getPublicUrl(
      assetPath,
    ).data.publicUrl;
  }

  if (stage === 1) {
    return getHiddenBoundaryAnchor(companion.image_lineage_metadata, 1)
      ?.imageUrl ?? null;
  }

  return null;
};

const fetchExistingAnimationJobId = async (
  supabase: any,
  evolutionId: string,
): Promise<string | null> => {
  const { data, error } = await supabase
    .from("companion_animation_jobs")
    .select("id")
    .eq("evolution_id", evolutionId)
    .maybeSingle();

  if (error) {
    console.warn(
      "[CompanionAnimationPrewarm] Failed to look up animation job",
      {
        evolutionId,
        error: error.message ?? String(error),
      },
    );
    return null;
  }

  return typeof data?.id === "string" ? data.id : null;
};

export const handlePrewarmCompanionAnimation = async (
  req: Request,
  deps: PrewarmCompanionAnimationDeps = defaultDeps,
) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await deps.authenticate(req, corsHeaders);
    if (auth instanceof Response) return auth;

    const body = await req.json().catch(() => ({}));
    const companionId = typeof body?.companionId === "string"
      ? body.companionId.trim()
      : "";
    const stage = parseStage(body?.stage);

    if (!companionId) {
      return errorResponse(400, "companionId is required", corsHeaders);
    }

    if (stage !== 1) {
      return errorResponse(400, "stage is not prewarmable", corsHeaders);
    }

    const supabase = deps.createSupabaseClient();
    const { data: companion, error: companionError } = await supabase
      .from("user_companion")
      .select(
        "id, user_id, preset_id, core_element, current_stage, current_xp, image_lineage_metadata",
      )
      .eq("id", companionId)
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (companionError) {
      throw companionError;
    }

    if (!companion) {
      return errorResponse(404, "Companion not found", corsHeaders);
    }

    const companionRecord = companion as CompanionRecord;
    const currentStage = typeof companionRecord.current_stage === "number"
      ? Math.max(0, Math.floor(companionRecord.current_stage))
      : 0;
    const existingEvolution = await supabase
      .from("companion_evolutions")
      .select("id, image_url, animation_status, animation_video_url")
      .eq("companion_id", companionId)
      .eq("stage", stage)
      .maybeSingle();

    if (existingEvolution.error) {
      throw existingEvolution.error;
    }

    const hatchThreshold = getProgressionThreshold(1) ?? 0;
    const isHatchReady = (companionRecord.current_xp ?? 0) >= hatchThreshold;
    const existingEvolutionId = typeof existingEvolution.data?.id === "string"
      ? existingEvolution.data.id
      : null;
    const canCreatePreHatchEvolution = currentStage === 0 && isHatchReady;
    const canReuseClaimedEvolution = currentStage >= stage &&
      Boolean(existingEvolutionId);
    if (!canCreatePreHatchEvolution && !canReuseClaimedEvolution) {
      return jsonResponse({
        status: "skipped",
        reason: currentStage === 0
          ? "hatch_not_ready"
          : "evolution_record_unavailable",
        stage,
      });
    }

    const imageUrl = typeof existingEvolution.data?.image_url === "string" &&
        existingEvolution.data.image_url.trim().length > 0
      ? existingEvolution.data.image_url
      : resolvePrewarmImageUrl({ supabase, companion: companionRecord, stage });

    if (!imageUrl) {
      return jsonResponse({
        status: "skipped",
        reason: "source_image_unavailable",
        stage,
      });
    }

    const generationMetadata = {
      animationPrewarmedAt: deps.now().toISOString(),
      animationPrewarmStage: stage,
      animationPrewarmSource: stage > currentStage
        ? "future_stage_reveal"
        : "current_stage_replay",
    };
    const stageThreshold = getProgressionThreshold(stage) ?? 0;
    const xpAtEvolution = canCreatePreHatchEvolution
      ? Math.max(0, stageThreshold - 1)
      : Math.max(companionRecord.current_xp ?? 0, stageThreshold);
    const { data: evolution, error: evolutionError } = await supabase
      .from("companion_evolutions")
      .upsert(
        {
          companion_id: companionId,
          stage,
          image_url: imageUrl,
          xp_at_evolution: xpAtEvolution,
          generation_metadata: generationMetadata,
        },
        { onConflict: "companion_id,stage" },
      )
      .select("id, animation_status, animation_video_url")
      .single();

    if (evolutionError) {
      throw evolutionError;
    }

    const evolutionId = typeof evolution?.id === "string" ? evolution.id : null;
    if (!evolutionId) {
      return errorResponse(
        500,
        "Evolution record was not returned",
        corsHeaders,
      );
    }

    if (
      evolution.animation_status === "queued" ||
      evolution.animation_status === "processing"
    ) {
      return jsonResponse({
        status: evolution.animation_status,
        evolutionId,
        jobId: await fetchExistingAnimationJobId(supabase, evolutionId),
        stage,
      });
    }

    if (
      evolution.animation_status === "succeeded" &&
      evolution.animation_video_url
    ) {
      return jsonResponse({
        status: "succeeded",
        evolutionId,
        videoUrl: evolution.animation_video_url,
        stage,
      });
    }

    const enqueueResult = await deps.enqueueAnimationJob({
      supabase,
      createCostGuardrailSession: deps.createCostGuardrailSessionFn,
      userId: auth.userId,
      companionId,
      evolutionId,
      stage,
      imageUrl,
      element: companionRecord.core_element,
    });

    return jsonResponse({
      ...enqueueResult,
      evolutionId,
      stage,
    });
  } catch (error) {
    console.error("[CompanionAnimationPrewarm] Failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({
      error: message,
      code: "companion_animation_prewarm_failed",
    }, 500);
  }
};

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handlePrewarmCompanionAnimation(req));
}
