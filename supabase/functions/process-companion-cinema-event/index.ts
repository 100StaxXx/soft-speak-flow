import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import {
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
  coerceCompanionVisualAnchors,
  coerceImageLineageMetadata,
  getEvolutionDifferenceFloor,
  synthesizeVisualIdentityProfile,
} from "../_shared/companionLineage.ts";
import { editCompanionImage } from "../_shared/openaiCompanionImageClient.ts";
import { judgeCompanionImage } from "../_shared/companionImageJudge.ts";
import { registerUserStorageAsset } from "../_shared/storageAssetLedger.ts";
import {
  cancelFalKlingRequest,
  downloadFalVideo,
  FalKlingVideoError,
  getFalKlingQueueResult,
  getFalKlingQueueStatus,
  submitFalKlingVideo,
} from "../_shared/falKlingVideoClient.ts";
import {
  buildCompanionCinemaScenePlan,
  buildCompanionCinemaVideoPrompt,
  buildCompanionMythologyPromptBlock,
  COMPANION_CINEMA_PRIVATE_BUCKET,
  COMPANION_CINEMA_PROMPT_VERSION,
  type CompanionCinemaEventRow,
  type CompanionCinemaRenderRow,
  DEFAULT_COMPANION_CINEMA_MODEL,
  resolveCinemaRenderQaScore,
  selectBestCinemaRender,
} from "../_shared/companionCinema.ts";
import {
  assertCompanionCinemaMediaQa,
  inspectCompanionCinemaMp4,
} from "../_shared/companionCinemaMediaQa.ts";
import {
  getCompanionCinemaRolloutConfig,
  isCompanionCinemaUserEligible,
} from "../_shared/companionCinemaRollout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-key",
};

const EVENT_COLUMNS = [
  "id",
  "user_id",
  "companion_id",
  "event_type",
  "event_key",
  "category",
  "rarity",
  "status",
  "boundary_level",
  "previous_boundary_level",
  "lineage_revision",
  "title",
  "reveal_copy",
  "source_table",
  "source_record_id",
  "context_snapshot",
  "scene_plan",
  "start_image_url",
  "canonical_image_bucket",
  "canonical_image_path",
  "canonical_image_focal_x",
  "canonical_image_focal_y",
  "video_bucket",
  "video_path",
  "duration_seconds",
  "audio_strategy",
  "provider",
  "provider_model",
  "priority",
  "render_attempt_count",
  "max_render_attempts",
  "next_retry_at",
  "lease_token",
  "lease_expires_at",
  "error_code",
  "error_message",
  "queued_at",
  "started_at",
  "portrait_completed_at",
  "video_completed_at",
  "ready_at",
  "revealed_at",
  "created_at",
  "updated_at",
  "selected_render_id",
].join(", ");

const RENDER_COLUMNS = [
  "id",
  "event_id",
  "user_id",
  "companion_id",
  "candidate_index",
  "status",
  "provider",
  "provider_model",
  "provider_task_id",
  "provider_status",
  "prompt",
  "prompt_version",
  "start_image_url",
  "end_image_bucket",
  "end_image_path",
  "duration_seconds",
  "generate_audio",
  "video_bucket",
  "video_path",
  "qa_score",
  "qa_payload",
  "selected",
  "retry_count",
  "next_retry_at",
  "error_code",
  "error_message",
  "submitted_at",
  "completed_at",
  "created_at",
  "updated_at",
].join(", ");

const LEASE_MS = 4 * 60 * 1000;
const POLL_DELAY_MS = 30 * 1000;
const PORTRAIT_RETRY_BASE_MS = 60 * 1000;
const MAX_VIDEO_RETRIES = 3;
const IMAGE_SIZE = "1536x1024";

type SupabaseClientLike = any;

const nowIso = () => new Date().toISOString();

const normalizeErrorCode = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    .slice(0, 64) || "cinema_generation_failed";

const parseDataUrl = (dataUrl: string): Uint8Array => {
  const base64 = dataUrl.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
};

const resolveExternalAssetUrl = (value: string, env = Deno.env): string => {
  if (/^https?:\/\//i.test(value)) return value;
  const origin = env.get("APP_URL")?.trim() ||
    env.get("COSMIQ_PUBLIC_ASSET_ORIGIN")?.trim() ||
    "https://app.cosmiq.quest";
  return new URL(value, `${origin.replace(/\/+$/, "")}/`).toString();
};

const updateLeasedEvent = async (
  supabase: SupabaseClientLike,
  eventId: string,
  leaseToken: string,
  payload: Record<string, unknown>,
) => {
  const { data, error } = await supabase.from("companion_cinema_events")
    .update({
      ...payload,
      updated_at: nowIso(),
    })
    .eq("id", eventId)
    .eq("lease_token", leaseToken)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("cinema_lease_lost");
};

const updateRender = async (
  supabase: SupabaseClientLike,
  renderId: string,
  payload: Record<string, unknown>,
) => {
  const { error } = await supabase.from("companion_cinema_renders").update({
    ...payload,
    updated_at: nowIso(),
  }).eq("id", renderId);
  if (error) throw error;
};

const fetchEvent = async ({
  supabase,
  eventId,
  userId,
  excludeEventIds = [],
}: {
  supabase: SupabaseClientLike;
  eventId?: string | null;
  userId?: string | null;
  excludeEventIds?: string[];
}): Promise<CompanionCinemaEventRow | null> => {
  let query = supabase.from("companion_cinema_events").select(EVENT_COLUMNS);
  if (eventId) {
    query = query.eq("id", eventId);
  } else {
    const currentIso = nowIso();
    query = query
      .in("status", ["queued", "rendering_portrait", "rendering_video"])
      .or(`next_retry_at.is.null,next_retry_at.lte.${currentIso}`)
      .order("priority", { ascending: false })
      .order("queued_at", { ascending: true })
      .limit(1);
  }
  if (userId) query = query.eq("user_id", userId);
  if (excludeEventIds.length > 0) {
    query = query.not("id", "in", `(${excludeEventIds.join(",")})`);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data ?? null) as CompanionCinemaEventRow | null;
};

const claimEvent = async (
  supabase: SupabaseClientLike,
  event: CompanionCinemaEventRow,
): Promise<{ event: CompanionCinemaEventRow; leaseToken: string } | null> => {
  const now = new Date();
  const leaseExpiry = event.lease_expires_at
    ? new Date(event.lease_expires_at).getTime()
    : 0;
  if (Number.isFinite(leaseExpiry) && leaseExpiry > now.getTime()) return null;

  const leaseToken = crypto.randomUUID();
  const { data, error } = await supabase
    .from("companion_cinema_events")
    .update({
      lease_token: leaseToken,
      lease_expires_at: new Date(now.getTime() + LEASE_MS).toISOString(),
      started_at: event.started_at ?? now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", event.id)
    .eq("status", event.status)
    .eq("updated_at", event.updated_at)
    .select(EVENT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    console.warn("Cinema event lease claim collision", {
      eventId: event.id,
      status: event.status,
      updatedAt: event.updated_at,
      leaseExpiresAt: event.lease_expires_at,
    });
  }
  return data ? { event: data as CompanionCinemaEventRow, leaseToken } : null;
};

const renewEventLease = async (
  supabase: SupabaseClientLike,
  eventId: string,
  leaseToken: string,
) => {
  const now = new Date();
  const { data, error } = await supabase.from("companion_cinema_events")
    .update({
      lease_expires_at: new Date(now.getTime() + LEASE_MS).toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", eventId)
    .eq("lease_token", leaseToken)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("cinema_lease_lost");
};

const releaseEvent = async (
  supabase: SupabaseClientLike,
  eventId: string,
  leaseToken: string,
  payload: Record<string, unknown>,
) => {
  const { data, error } = await supabase.from("companion_cinema_events").update(
    {
      ...payload,
      lease_token: null,
      lease_expires_at: null,
      updated_at: nowIso(),
    },
  ).eq("id", eventId).eq("lease_token", leaseToken).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("cinema_lease_lost");
};

const deferRolloutIneligibleEvent = async (
  supabase: SupabaseClientLike,
  event: CompanionCinemaEventRow,
) => {
  const nextRetryAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { error } = await supabase.from("companion_cinema_events").update({
    next_retry_at: nextRetryAt,
    error_code: "rollout_paused",
    error_message: "Cinema generation is paused for this rollout cohort",
    updated_at: nowIso(),
  })
    .eq("id", event.id)
    .eq("status", event.status)
    .eq("updated_at", event.updated_at);
  if (error) throw error;
};

const markInteractionRunTerminal = async ({
  supabase,
  event,
  status,
  reason,
}: {
  supabase: SupabaseClientLike;
  event: CompanionCinemaEventRow;
  status: "failed" | "cancelled";
  reason: string;
}) => {
  if (
    event.source_table !== "companion_interaction_runs" ||
    !event.source_record_id
  ) return;
  const { error } = await supabase.from("companion_interaction_runs").update({
    status,
    completed_at: nowIso(),
    outcome: { reason },
    updated_at: nowIso(),
  })
    .eq("id", event.source_record_id)
    .eq("user_id", event.user_id)
    .in("status", ["preparing", "active", "returning"]);
  if (error) throw error;
};

export const isCosmiqCinemaProductMode = (value: unknown): boolean =>
  value === "cosmiq";

const ensureCosmiqEventCompanion = async ({
  supabase,
  event,
  leaseToken,
}: {
  supabase: SupabaseClientLike;
  event: CompanionCinemaEventRow;
  leaseToken: string;
}): Promise<boolean> => {
  const { data: companion, error } = await supabase
    .from("user_companion")
    .select("product_mode")
    .eq("id", event.companion_id)
    .eq("user_id", event.user_id)
    .maybeSingle();
  if (error) throw error;
  if (!companion) throw new Error("Companion not found for cinema event");
  if (isCosmiqCinemaProductMode(companion.product_mode)) return true;

  await releaseEvent(supabase, event.id, leaseToken, {
    status: "cancelled",
    error_code: "product_mode_changed",
    error_message: "Companion is not in Cosmiq mode",
  });
  await markInteractionRunTerminal({
    supabase,
    event,
    status: "cancelled",
    reason: "product_mode_changed",
  });
  return false;
};

const uploadPrivateAsset = async ({
  supabase,
  userId,
  eventId,
  fileName,
  bytes,
  contentType,
}: {
  supabase: SupabaseClientLike;
  userId: string;
  eventId: string;
  fileName: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<string> => {
  const path = `${userId}/events/${eventId}/${fileName}`;
  const { error } = await supabase.storage.from(COMPANION_CINEMA_PRIVATE_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Cinema asset upload failed: ${error.message}`);
  try {
    await registerUserStorageAsset({
      supabase,
      userId,
      bucketId: COMPANION_CINEMA_PRIVATE_BUCKET,
      storagePath: path,
      sourceKind: "companion_cinema_private",
      sourceRecordTable: "companion_cinema_events",
      sourceRecordId: eventId,
    });
  } catch (ledgerError) {
    await supabase.storage.from(COMPANION_CINEMA_PRIVATE_BUCKET)
      .remove([path]).catch(() => null);
    throw ledgerError;
  }
  return path;
};

const createPrivateSignedUrl = async (
  supabase: SupabaseClientLike,
  path: string,
): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(COMPANION_CINEMA_PRIVATE_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) {
    throw new Error(
      `Cinema asset signing failed: ${error?.message ?? "missing_url"}`,
    );
  }
  return data.signedUrl;
};

export const cleanupExpiredPrivateCinemaAssets = async ({
  supabase,
  olderThanHours = 24,
}: {
  supabase: SupabaseClientLike;
  olderThanHours?: number;
}): Promise<{ eventsScanned: number; assetsRemoved: number }> => {
  const retentionHours = Number.isFinite(olderThanHours) && olderThanHours > 0
    ? olderThanHours
    : 24;
  const cutoff = new Date(
    Date.now() - Math.max(1, retentionHours) * 60 * 60 * 1000,
  ).toISOString();
  const { data: events, error: eventError } = await supabase
    .from("companion_cinema_events")
    .select("id,user_id,canonical_image_bucket,canonical_image_path")
    .in("status", ["failed", "cancelled", "superseded", "revealed"])
    .lt("updated_at", cutoff)
    .limit(100);
  if (eventError) throw eventError;
  const eventRows = events ?? [];
  const eventIds = eventRows.map((event: { id: string }) => event.id);
  let terminalRenders: Array<Record<string, unknown>> = [];
  let ledgerRows: Array<Record<string, unknown>> = [];
  if (eventIds.length > 0) {
    const [{ data: renders, error: renderError }, {
      data: ledger,
      error: ledgerLookupError,
    }] = await Promise.all([
      supabase
        .from("companion_cinema_renders")
        .select("id,event_id,status,video_bucket,video_path")
        .in("event_id", eventIds),
      supabase.from("user_storage_assets")
        .select("id,storage_path,source_record_id")
        .eq("bucket_id", COMPANION_CINEMA_PRIVATE_BUCKET)
        .eq("source_record_table", "companion_cinema_events")
        .in("source_record_id", eventIds),
    ]);
    if (renderError) throw renderError;
    if (ledgerLookupError) throw ledgerLookupError;
    terminalRenders = renders ?? [];
    ledgerRows = ledger ?? [];
  }

  // Once selection is complete, failed/rejected/cancelled candidates have no
  // recovery value. Clean them even while the selected event remains ready so
  // an unopened moment cannot retain two paid videos indefinitely.
  const { data: staleDiscardedRenders, error: staleRenderError } =
    await supabase
      .from("companion_cinema_renders")
      .select("id,event_id,status,video_bucket,video_path")
      .in("status", ["failed", "rejected", "cancelled"])
      .lt("updated_at", cutoff)
      .limit(300);
  if (staleRenderError) throw staleRenderError;
  const renders = Array.from(
    new Map(
      [...terminalRenders, ...(staleDiscardedRenders ?? [])].map((render) => [
        render.id,
        render,
      ]),
    ).values(),
  );
  if (
    eventRows.length === 0 && renders.length === 0 && ledgerRows.length === 0
  ) {
    return { eventsScanned: 0, assetsRemoved: 0 };
  }
  const paths = Array.from(
    new Set([
      ...eventRows.map((event: {
        canonical_image_bucket?: unknown;
        canonical_image_path?: unknown;
      }) =>
        event.canonical_image_bucket === COMPANION_CINEMA_PRIVATE_BUCKET &&
          typeof event.canonical_image_path === "string"
          ? event.canonical_image_path
          : null
      ),
      ...renders.map((render: {
        video_bucket?: unknown;
        video_path?: unknown;
      }) =>
        render.video_bucket === COMPANION_CINEMA_PRIVATE_BUCKET &&
          typeof render.video_path === "string"
          ? render.video_path
          : null
      ),
      ...ledgerRows.map((asset: { storage_path?: unknown }) =>
        typeof asset.storage_path === "string" ? asset.storage_path : null
      ),
    ].filter((path): path is string => Boolean(path))),
  );

  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(COMPANION_CINEMA_PRIVATE_BUCKET)
      .remove(paths);
    if (removeError) throw removeError;
    const { error: ledgerError } = await supabase.from("user_storage_assets")
      .delete()
      .eq("bucket_id", COMPANION_CINEMA_PRIVATE_BUCKET)
      .in("storage_path", paths);
    if (ledgerError) throw ledgerError;
  }

  const privatePortraitEventIds = eventRows
    .filter((event: { canonical_image_bucket?: unknown }) =>
      event.canonical_image_bucket === COMPANION_CINEMA_PRIVATE_BUCKET
    )
    .map((event: { id: string }) => event.id);
  if (privatePortraitEventIds.length > 0) {
    const { error } = await supabase.from("companion_cinema_events").update({
      canonical_image_bucket: null,
      canonical_image_path: null,
      updated_at: nowIso(),
    }).in("id", privatePortraitEventIds);
    if (error) throw error;
  }
  const privateRenderIds = renders
    .filter((render: { video_bucket?: unknown }) =>
      render.video_bucket === COMPANION_CINEMA_PRIVATE_BUCKET
    )
    .map((render: { id: string }) => render.id);
  if (privateRenderIds.length > 0) {
    const { error } = await supabase.from("companion_cinema_renders").update({
      video_bucket: null,
      video_path: null,
      updated_at: nowIso(),
    }).in("id", privateRenderIds);
    if (error) throw error;
  }

  return { eventsScanned: eventRows.length, assetsRemoved: paths.length };
};

const judgePasses = ({
  scores,
  previousLevel,
  nextLevel,
}: {
  scores: Awaited<ReturnType<typeof judgeCompanionImage>>;
  previousLevel: number;
  nextLevel: number;
}): boolean =>
  Boolean(
    scores &&
      scores.overall >= 7 &&
      scores.continuity >= 6 &&
      scores.anatomy >= 6 &&
      scores.stageMaturity >= 8 &&
      (scores.backgroundCutout ?? 0) >= 7 &&
      scores.difference >=
        getEvolutionDifferenceFloor(previousLevel, nextLevel),
  );

const rankPortrait = (
  scores: Awaited<ReturnType<typeof judgeCompanionImage>>,
): number =>
  scores
    ? scores.overall * 4 + scores.continuity * 3 + scores.anatomy * 2 +
      scores.stageMaturity * 2 + scores.difference
    : -1;

const renderPortrait = async ({
  supabase,
  event,
  leaseToken,
  guardedFetch,
  openAIApiKey,
}: {
  supabase: SupabaseClientLike;
  event: CompanionCinemaEventRow;
  leaseToken: string;
  guardedFetch: typeof fetch;
  openAIApiKey: string;
}) => {
  const { data: companion, error: companionError } = await supabase
    .from("user_companion")
    .select("*")
    .eq("id", event.companion_id)
    .eq("user_id", event.user_id)
    .maybeSingle();
  if (companionError) throw companionError;
  if (!companion) throw new Error("Companion not found for cinema event");
  if (!isCosmiqCinemaProductMode(companion.product_mode)) {
    await releaseEvent(supabase, event.id, leaseToken, {
      status: "cancelled",
      error_code: "product_mode_changed",
      error_message: "Companion is no longer in Cosmiq mode",
    });
    await markInteractionRunTerminal({
      supabase,
      event,
      status: "cancelled",
      reason: "product_mode_changed",
    });
    return { status: "cancelled" };
  }
  if (companion.current_stage !== event.previous_boundary_level) {
    await releaseEvent(supabase, event.id, leaseToken, {
      status: "superseded",
      error_code: "lineage_stage_changed",
      error_message:
        "Companion stage changed before portrait rendering completed",
    });
    return { status: "superseded" };
  }

  const previousImageUrl = event.start_image_url ??
    companion.current_image_url ??
    companion.initial_image_url;
  if (!previousImageUrl || event.boundary_level === null) {
    throw new Error("Cinema event is missing an evolution endpoint");
  }
  const externalPreviousImageUrl = resolveExternalAssetUrl(previousImageUrl);
  const profile = synthesizeVisualIdentityProfile(
    companion.visual_identity_profile,
    {
      spiritAnimal: companion.spirit_animal,
      coreElement: companion.core_element,
      favoriteColor: companion.favorite_color,
      storyTone: companion.story_tone,
    },
  );
  const lineage = coerceImageLineageMetadata(companion.image_lineage_metadata);
  const previousAnchors = coerceCompanionVisualAnchors(
    lineage.visualAnchorsByLevel[String(event.previous_boundary_level ?? 1)],
    event.previous_boundary_level ?? 1,
    externalPreviousImageUrl,
  );
  const { data: previousEvolution } = await supabase
    .from("companion_evolutions")
    .select("generation_metadata")
    .eq("companion_id", event.companion_id)
    .eq("stage", event.previous_boundary_level)
    .maybeSingle();

  const mythologyBlock = buildCompanionMythologyPromptBlock(
    event.context_snapshot,
  );
  const speciesIdentity = resolveCompanionSpeciesIdentity(
    companion.spirit_animal,
  );
  const spiritLock = resolveCompanionSpiritLockProfile(companion.spirit_animal);
  const prompt = [
    buildBoundaryEvolutionGenerationPrompt({
      profile,
      previousLevel: event.previous_boundary_level ?? 1,
      nextLevel: event.boundary_level,
      previousAnchors,
      previousGenerationMetadata: previousEvolution?.generation_metadata,
    }),
    mythologyBlock,
    speciesIdentity
      ? `Species identity lock:\n${
        buildCompanionSpeciesIdentityPromptBlock(speciesIdentity)
      }`
      : "",
    spiritLock
      ? `Material identity lock:\n${
        buildSpiritLockPromptBlock(spiritLock, "image")
      }`
      : "",
    "This portrait will be the immutable ending frame of a cinematic transformation. Use a centered, readable hero pose with clean silhouette and generous safe space.",
  ].filter(Boolean).join("\n\n");

  await updateLeasedEvent(supabase, event.id, leaseToken, {
    status: "rendering_portrait",
  });

  let best:
    | {
      imageDataUrl: string;
      scores: Awaited<ReturnType<typeof judgeCompanionImage>>;
      attempt: number;
      model?: string;
      size?: string;
    }
    | null = null;
  const attempts = Math.max(2, Math.min(4, event.max_render_attempts));
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await renewEventLease(supabase, event.id, leaseToken);
    const rendered = await editCompanionImage({
      guardedFetch,
      openAIApiKey,
      model: Deno.env.get("COSMIQ_CINEMA_IMAGE_MODEL")?.trim() ||
        "gpt-image-1-mini",
      prompt:
        `${prompt}\n\nRender candidate ${attempt}. Preserve all identity locks; vary only pose energy and environmental accent placement.`,
      size: IMAGE_SIZE,
      quality: "high",
      background: "transparent",
      outputFormat: "png",
      userId: event.user_id,
      referenceImages: [{ imageUrl: externalPreviousImageUrl }],
    });
    const scores = await judgeCompanionImage({
      guardedFetch,
      openAIApiKey,
      profile,
      mode: "evolution",
      candidateImageUrl: rendered.imageDataUrl,
      referenceImageUrl: externalPreviousImageUrl,
      previousLevel: event.previous_boundary_level ?? 1,
      nextLevel: event.boundary_level,
    });
    await renewEventLease(supabase, event.id, leaseToken);
    const candidate = {
      imageDataUrl: rendered.imageDataUrl,
      scores,
      attempt,
      model: rendered.model,
      size: rendered.size,
    };
    if (!best || rankPortrait(scores) > rankPortrait(best.scores)) {
      best = candidate;
    }
    if (
      judgePasses({
        scores,
        previousLevel: event.previous_boundary_level ?? 1,
        nextLevel: event.boundary_level,
      })
    ) {
      best = candidate;
      break;
    }
  }

  if (
    !best?.scores || !judgePasses({
      scores: best.scores,
      previousLevel: event.previous_boundary_level ?? 1,
      nextLevel: event.boundary_level,
    })
  ) {
    throw new Error(
      `Cinema portrait quality gate failed: ${
        best?.scores?.notes ?? "judge unavailable"
      }`,
    );
  }

  const portraitPath = await uploadPrivateAsset({
    supabase,
    userId: event.user_id,
    eventId: event.id,
    fileName: "canonical-portrait.png",
    bytes: parseDataUrl(best.imageDataUrl),
    contentType: "image/png",
  });
  const refreshedEvent = {
    ...event,
    status: "rendering_video",
  } as CompanionCinemaEventRow;
  const scenePlan = buildCompanionCinemaScenePlan({
    event: refreshedEvent,
    element: companion.core_element,
    species: companion.spirit_animal,
  });
  const renderRows = [1, 2].map((candidateIndex) => ({
    event_id: event.id,
    user_id: event.user_id,
    companion_id: event.companion_id,
    candidate_index: candidateIndex,
    status: "queued",
    provider: event.provider,
    provider_model: Deno.env.get("COSMIQ_CINEMA_VIDEO_MODEL")?.trim() ||
      event.provider_model || DEFAULT_COMPANION_CINEMA_MODEL,
    prompt: buildCompanionCinemaVideoPrompt({
      event: refreshedEvent,
      scenePlan,
      candidateIndex,
    }),
    prompt_version: COMPANION_CINEMA_PROMPT_VERSION,
    start_image_url: previousImageUrl,
    end_image_bucket: COMPANION_CINEMA_PRIVATE_BUCKET,
    end_image_path: portraitPath,
    duration_seconds: event.duration_seconds,
    generate_audio: event.audio_strategy === "native",
    provider_task_id: null,
    provider_status: null,
    video_bucket: null,
    video_path: null,
    qa_score: null,
    selected: false,
    retry_count: 0,
    next_retry_at: null,
    error_code: null,
    error_message: null,
    submitted_at: null,
    completed_at: null,
    qa_payload: {
      endpointLocked: true,
      portraitJudge: best.scores,
      portraitAttempt: best.attempt,
      imageModel: best.model ?? null,
      imageSize: best.size ?? IMAGE_SIZE,
    },
  }));
  const { error: renderInsertError } = await supabase
    .from("companion_cinema_renders")
    .upsert(renderRows, { onConflict: "event_id,candidate_index" });
  if (renderInsertError) throw renderInsertError;

  await releaseEvent(supabase, event.id, leaseToken, {
    status: "rendering_video",
    context_snapshot: {
      ...(event.context_snapshot ?? {}),
      portraitGeneration: {
        promptVersion: COMPANION_CINEMA_PROMPT_VERSION,
        selectedAttempt: best.attempt,
        scores: best.scores,
        model: best.model ?? null,
        size: best.size ?? IMAGE_SIZE,
      },
    },
    scene_plan: scenePlan,
    canonical_image_bucket: COMPANION_CINEMA_PRIVATE_BUCKET,
    canonical_image_path: portraitPath,
    canonical_image_focal_x: best.scores.subjectCenterX ?? 0.5,
    canonical_image_focal_y: best.scores.subjectCenterY ?? 0.5,
    portrait_completed_at: nowIso(),
    render_attempt_count: best.attempt,
    error_code: null,
    error_message: null,
    next_retry_at: null,
  });

  return { status: "rendering_video", portraitPath };
};

const prepareInteractionEndpoint = async ({
  supabase,
  event,
  leaseToken,
}: {
  supabase: SupabaseClientLike;
  event: CompanionCinemaEventRow;
  leaseToken: string;
}) => {
  const { data: companion, error: companionError } = await supabase
    .from("user_companion")
    .select(
      "product_mode, current_image_url, initial_image_url, spirit_animal, core_element, current_stage",
    )
    .eq("id", event.companion_id)
    .eq("user_id", event.user_id)
    .maybeSingle();
  if (companionError) throw companionError;
  if (!companion) throw new Error("Companion not found for cinema interaction");
  if (!isCosmiqCinemaProductMode(companion.product_mode)) {
    await releaseEvent(supabase, event.id, leaseToken, {
      status: "cancelled",
      error_code: "product_mode_changed",
      error_message: "Companion is not in Cosmiq mode",
    });
    await markInteractionRunTerminal({
      supabase,
      event,
      status: "cancelled",
      reason: "product_mode_changed",
    });
    return { status: "cancelled" };
  }
  const imageUrl = event.start_image_url ?? companion.current_image_url ??
    companion.initial_image_url;
  if (!imageUrl) {
    throw new Error("Cinema interaction is missing a canonical portrait");
  }

  const externalImageUrl = resolveExternalAssetUrl(imageUrl);
  await renewEventLease(supabase, event.id, leaseToken);
  const imageResponse = await fetch(externalImageUrl);
  if (!imageResponse.ok) {
    throw new Error(
      `Cinema interaction portrait download failed: ${imageResponse.status}`,
    );
  }
  const contentType = imageResponse.headers.get("content-type") || "image/png";
  const portraitPath = await uploadPrivateAsset({
    supabase,
    userId: event.user_id,
    eventId: event.id,
    fileName: "canonical-endpoint.png",
    bytes: new Uint8Array(await imageResponse.arrayBuffer()),
    contentType,
  });
  const scenePlan = buildCompanionCinemaScenePlan({
    event,
    element: companion.core_element,
    species: companion.spirit_animal,
  });
  const renderRows = [1, 2].map((candidateIndex) => ({
    event_id: event.id,
    user_id: event.user_id,
    companion_id: event.companion_id,
    candidate_index: candidateIndex,
    status: "queued",
    provider: event.provider,
    provider_model: Deno.env.get("COSMIQ_CINEMA_VIDEO_MODEL")?.trim() ||
      event.provider_model,
    prompt: buildCompanionCinemaVideoPrompt({
      event,
      scenePlan,
      candidateIndex,
    }),
    prompt_version: COMPANION_CINEMA_PROMPT_VERSION,
    start_image_url: imageUrl,
    end_image_bucket: COMPANION_CINEMA_PRIVATE_BUCKET,
    end_image_path: portraitPath,
    duration_seconds: event.duration_seconds,
    generate_audio: event.audio_strategy === "native",
    provider_task_id: null,
    provider_status: null,
    video_bucket: null,
    video_path: null,
    qa_score: null,
    selected: false,
    retry_count: 0,
    next_retry_at: null,
    error_code: null,
    error_message: null,
    submitted_at: null,
    completed_at: null,
    qa_payload: {
      endpointLocked: true,
      canonicalStage: companion.current_stage,
      interactionType: event.event_type,
    },
  }));
  const { error: renderInsertError } = await supabase
    .from("companion_cinema_renders")
    .upsert(renderRows, { onConflict: "event_id,candidate_index" });
  if (renderInsertError) throw renderInsertError;

  await releaseEvent(supabase, event.id, leaseToken, {
    status: "rendering_video",
    scene_plan: scenePlan,
    canonical_image_bucket: COMPANION_CINEMA_PRIVATE_BUCKET,
    canonical_image_path: portraitPath,
    canonical_image_focal_x: 0.5,
    canonical_image_focal_y: 0.5,
    portrait_completed_at: nowIso(),
    next_retry_at: null,
    error_code: null,
    error_message: null,
  });
  return { status: "rendering_video", portraitPath };
};

const loadRenders = async (
  supabase: SupabaseClientLike,
  eventId: string,
): Promise<CompanionCinemaRenderRow[]> => {
  const { data, error } = await supabase.from("companion_cinema_renders")
    .select(RENDER_COLUMNS)
    .eq("event_id", eventId)
    .order("candidate_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CompanionCinemaRenderRow[];
};

const maybeFinalizeEvent = async ({
  supabase,
  event,
  leaseToken,
  renders,
}: {
  supabase: SupabaseClientLike;
  event: CompanionCinemaEventRow;
  leaseToken: string;
  renders: CompanionCinemaRenderRow[];
}): Promise<{ status: string; renderId?: string } | null> => {
  const active = renders.some((render) =>
    ["queued", "submitted", "processing"].includes(render.status)
  );
  if (active) return null;

  const selected = selectBestCinemaRender(renders);
  if (!selected?.video_path) {
    throw new Error("Every cinema render candidate failed");
  }

  await Promise.all(renders.map((render) =>
    updateRender(
      supabase,
      render.id,
      render.id === selected.id
        ? { status: "selected", selected: true }
        : render.status === "succeeded"
        ? { status: "rejected", selected: false }
        : { selected: false },
    )
  ));
  await releaseEvent(supabase, event.id, leaseToken, {
    status: "ready",
    selected_render_id: selected.id,
    video_bucket: selected.video_bucket,
    video_path: selected.video_path,
    video_completed_at: selected.completed_at ?? nowIso(),
    ready_at: nowIso(),
    next_retry_at: null,
    error_code: null,
    error_message: null,
  });
  return { status: "ready", renderId: selected.id };
};

const processVideo = async ({
  supabase,
  event,
  leaseToken,
  guardedFetch,
  falKey,
}: {
  supabase: SupabaseClientLike;
  event: CompanionCinemaEventRow;
  leaseToken: string;
  guardedFetch: typeof fetch;
  falKey: string;
}) => {
  let renders = await loadRenders(supabase, event.id);
  const immediatelyFinalized = await maybeFinalizeEvent({
    supabase,
    event,
    leaseToken,
    renders,
  });
  if (immediatelyFinalized) return immediatelyFinalized;

  const currentTime = Date.now();
  const render = renders.find((candidate) => {
    if (!["queued", "submitted", "processing"].includes(candidate.status)) {
      return false;
    }
    if (!candidate.next_retry_at) return true;
    return new Date(candidate.next_retry_at).getTime() <= currentTime;
  });

  if (!render) {
    const nextRetry = renders
      .map((candidate) => candidate.next_retry_at)
      .filter((value): value is string => Boolean(value))
      .sort()[0] ?? new Date(currentTime + POLL_DELAY_MS).toISOString();
    await releaseEvent(supabase, event.id, leaseToken, {
      status: "rendering_video",
      next_retry_at: nextRetry,
    });
    return { status: "rendering_video", nextRetryAt: nextRetry };
  }

  try {
    if (!render.provider_task_id) {
      await renewEventLease(supabase, event.id, leaseToken);
      const endImageUrl = await createPrivateSignedUrl(
        supabase,
        render.end_image_path,
      );
      const submitted = await submitFalKlingVideo({
        fetchFn: guardedFetch,
        apiKey: falKey,
        model: render.provider_model,
        imageUrl: resolveExternalAssetUrl(render.start_image_url),
        endImageUrl,
        prompt: render.prompt,
        durationSeconds: render.duration_seconds,
        generateAudio: render.generate_audio,
      });
      try {
        await renewEventLease(supabase, event.id, leaseToken);
      } catch (leaseError) {
        if (
          leaseError instanceof Error &&
          leaseError.message === "cinema_lease_lost"
        ) {
          // Cancellation can race the paid POST before its request id reaches
          // the database. Cancel immediately with the id we just received so
          // the provider job does not become an untracked paid orphan.
          await cancelFalKlingRequest({
            fetchFn: guardedFetch,
            apiKey: falKey,
            model: render.provider_model,
            requestId: submitted.requestId,
          }).catch((cancelError) => {
            console.error("Failed to cancel lease-lost cinema render", {
              eventId: event.id,
              renderId: render.id,
              requestId: submitted.requestId,
              error: cancelError instanceof Error
                ? cancelError.message
                : String(cancelError),
            });
          });
        }
        throw leaseError;
      }
      const nextRetryAt = new Date(currentTime + POLL_DELAY_MS).toISOString();
      await updateRender(supabase, render.id, {
        status: "submitted",
        provider_task_id: submitted.requestId,
        provider_status: "SUBMITTED",
        submitted_at: nowIso(),
        next_retry_at: nextRetryAt,
        error_code: null,
        error_message: null,
      });
      try {
        // Close the second cancellation window: a user can cancel after the
        // pre-write lease check but before the provider id is persisted. The
        // post-write check makes either the cancellation request or this
        // worker responsible for cancelling the now-trackable paid job.
        await renewEventLease(supabase, event.id, leaseToken);
      } catch (leaseError) {
        if (
          leaseError instanceof Error &&
          leaseError.message === "cinema_lease_lost"
        ) {
          await cancelFalKlingRequest({
            fetchFn: guardedFetch,
            apiKey: falKey,
            model: render.provider_model,
            requestId: submitted.requestId,
          }).catch((cancelError) => {
            console.error(
              "Failed to cancel persisted lease-lost cinema render",
              {
                eventId: event.id,
                renderId: render.id,
                requestId: submitted.requestId,
                error: cancelError instanceof Error
                  ? cancelError.message
                  : String(cancelError),
              },
            );
          });
          await updateRender(supabase, render.id, {
            status: "cancelled",
            next_retry_at: null,
            completed_at: nowIso(),
            error_code: "cinema_lease_lost",
            error_message:
              "The cinema event was cancelled after provider submission",
          }).catch((renderUpdateError) => {
            console.error(
              "Failed to mark persisted lease-lost render cancelled",
              {
                eventId: event.id,
                renderId: render.id,
                error: renderUpdateError instanceof Error
                  ? renderUpdateError.message
                  : String(renderUpdateError),
              },
            );
          });
        }
        throw leaseError;
      }
      await releaseEvent(supabase, event.id, leaseToken, {
        status: "rendering_video",
        next_retry_at: nextRetryAt,
      });
      return {
        status: "rendering_video",
        renderId: render.id,
        providerTaskId: submitted.requestId,
        nextRetryAt,
      };
    }

    const queue = await getFalKlingQueueStatus({
      fetchFn: guardedFetch,
      apiKey: falKey,
      model: render.provider_model,
      requestId: render.provider_task_id,
    });
    await renewEventLease(supabase, event.id, leaseToken);
    const providerStatus = queue.status.toUpperCase();
    if (providerStatus === "IN_QUEUE" || providerStatus === "IN_PROGRESS") {
      const nextRetryAt = new Date(currentTime + POLL_DELAY_MS).toISOString();
      await updateRender(supabase, render.id, {
        status: "processing",
        provider_status: providerStatus,
        next_retry_at: nextRetryAt,
      });
      await releaseEvent(supabase, event.id, leaseToken, {
        status: "rendering_video",
        next_retry_at: nextRetryAt,
      });
      return { status: "rendering_video", renderId: render.id, nextRetryAt };
    }
    if (providerStatus !== "COMPLETED") {
      throw new FalKlingVideoError(
        `Cinema provider failed with status ${queue.status}`,
        { code: "cinema_provider_failed", retryable: false },
      );
    }

    const result = await getFalKlingQueueResult({
      fetchFn: guardedFetch,
      apiKey: falKey,
      model: render.provider_model,
      requestId: render.provider_task_id,
    });
    const downloaded = await downloadFalVideo({
      fetchFn: guardedFetch,
      videoUrl: result.videoUrl,
    });
    await renewEventLease(supabase, event.id, leaseToken);
    const mediaQa = inspectCompanionCinemaMp4({
      bytes: downloaded.bytes,
      expectedDurationSeconds: render.duration_seconds,
      audioExpected: render.generate_audio,
    });
    try {
      assertCompanionCinemaMediaQa(mediaQa);
    } catch (error) {
      throw new FalKlingVideoError(
        error instanceof Error ? error.message : "cinema_media_qa_failed",
        { code: "cinema_media_qa_failed", retryable: false },
      );
    }
    const videoPath = await uploadPrivateAsset({
      supabase,
      userId: event.user_id,
      eventId: event.id,
      fileName: `candidate-${render.candidate_index}.mp4`,
      bytes: downloaded.bytes,
      contentType: downloaded.contentType || "video/mp4",
    });
    const qaPayload = {
      ...(render.qa_payload ?? {}),
      endpointLocked: true,
      providerCompleted: true,
      providerStatus,
      ...mediaQa,
      durationSeconds: render.duration_seconds,
      providerModel: render.provider_model,
      selectionStrategy: "iso_bmff_video_audio_duration_v2",
    };
    const qaScore = resolveCinemaRenderQaScore({
      qa_score: null,
      qa_payload: qaPayload,
      candidate_index: render.candidate_index,
    });
    await updateRender(supabase, render.id, {
      status: "succeeded",
      provider_status: providerStatus,
      video_bucket: COMPANION_CINEMA_PRIVATE_BUCKET,
      video_path: videoPath,
      qa_score: qaScore,
      qa_payload: qaPayload,
      next_retry_at: null,
      completed_at: nowIso(),
      error_code: null,
      error_message: null,
    });

    renders = await loadRenders(supabase, event.id);
    const finalized = await maybeFinalizeEvent({
      supabase,
      event,
      leaseToken,
      renders,
    });
    if (finalized) return finalized;
    await releaseEvent(supabase, event.id, leaseToken, {
      status: "rendering_video",
      next_retry_at: null,
    });
    return { status: "rendering_video", renderId: render.id };
  } catch (error) {
    if (error instanceof Error && error.message === "cinema_lease_lost") {
      throw error;
    }
    const retryable = error instanceof FalKlingVideoError
      ? error.retryable
      : true;
    const retryCount = render.retry_count + 1;
    const shouldRetry = retryable && retryCount <= MAX_VIDEO_RETRIES;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const nextRetryAt = shouldRetry
      ? new Date(currentTime + PORTRAIT_RETRY_BASE_MS * 2 ** (retryCount - 1))
        .toISOString()
      : null;
    await updateRender(supabase, render.id, {
      status: shouldRetry ? "processing" : "failed",
      retry_count: retryCount,
      next_retry_at: nextRetryAt,
      error_code: error instanceof FalKlingVideoError
        ? error.code
        : normalizeErrorCode(errorMessage),
      error_message: errorMessage.slice(0, 500),
      completed_at: shouldRetry ? null : nowIso(),
    });
    const updatedRenders = await loadRenders(supabase, event.id);
    const finalized = await maybeFinalizeEvent({
      supabase,
      event,
      leaseToken,
      renders: updatedRenders,
    });
    if (finalized) return finalized;
    await releaseEvent(supabase, event.id, leaseToken, {
      status: "rendering_video",
      next_retry_at: nextRetryAt,
      error_code: shouldRetry
        ? error instanceof FalKlingVideoError
          ? error.code
          : normalizeErrorCode(errorMessage)
        : null,
      error_message: shouldRetry ? errorMessage.slice(0, 500) : null,
    });
    return {
      status: "rendering_video",
      renderId: render.id,
      retryCount,
      nextRetryAt,
    };
  }
};

export const handleProcessCompanionCinemaEvent = async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let currentEvent: CompanionCinemaEventRow | null = null;
  let leaseToken: string | null = null;
  let supabase: SupabaseClientLike | null = null;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET")?.trim();
    const internal = Boolean(internalSecret) &&
      req.headers.get("x-internal-key") === internalSecret;
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const requestedEventId = typeof body.eventId === "string"
      ? body.eventId
      : null;
    const companionId = typeof body.companionId === "string"
      ? body.companionId
      : null;
    const action = typeof body.action === "string" ? body.action : "process";

    let userId: string | null = null;
    if (!internal) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await authClient.auth.getUser();
      if (error || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    supabase = createClient(supabaseUrl, serviceRoleKey);
    if (action === "cleanup") {
      if (!internal) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const cleanup = await cleanupExpiredPrivateCinemaAssets({
        supabase,
        olderThanHours: Number(
          Deno.env.get("COSMIQ_CINEMA_PRIVATE_RETENTION_HOURS") ?? 24,
        ),
      });
      return new Response(JSON.stringify({ status: "cleaned", ...cleanup }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rolloutConfig = getCompanionCinemaRolloutConfig();
    if (!rolloutConfig.enabled) {
      return new Response(
        JSON.stringify({ status: "disabled", code: "cosmiq_cinema_disabled" }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let eventId = requestedEventId;
    if (action === "enqueue") {
      if (!userId || !companionId) {
        return new Response(
          JSON.stringify({
            error: "Authenticated user and companionId are required",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (!isCompanionCinemaUserEligible(userId)) {
        return new Response(
          JSON.stringify({
            status: "unavailable",
            code: "cosmiq_cinema_rollout_ineligible",
          }),
          {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const { data, error } = await supabase.rpc(
        "enqueue_cosmiq_cinema_event_internal",
        { p_user_id: userId, p_companion_id: companionId },
      );
      if (error) throw error;
      eventId = typeof data === "string" ? data : null;
      if (!eventId) {
        return new Response(
          JSON.stringify({ status: "complete", eventId: null }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      // Enqueue is intentionally a short request. The cron-backed worker owns
      // all paid generation so hatch and evolution requests never wait on an
      // image provider or accidentally exceed the Edge request lifetime.
      return new Response(
        JSON.stringify({ status: "queued", eventId }),
        {
          status: 202,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let claimed:
      | { event: CompanionCinemaEventRow; leaseToken: string }
      | null = null;
    if (eventId) {
      currentEvent = await fetchEvent({
        supabase,
        eventId,
        userId: internal ? null : userId,
      });
    } else {
      const claimCollisions: string[] = [];
      for (let attempt = 0; attempt < 25; attempt += 1) {
        const candidate = await fetchEvent({
          supabase,
          userId: internal ? null : userId,
          excludeEventIds: claimCollisions,
        });
        if (!candidate) break;
        if (!isCompanionCinemaUserEligible(candidate.user_id)) {
          await deferRolloutIneligibleEvent(supabase, candidate);
          claimCollisions.push(candidate.id);
          continue;
        }
        const candidateClaim = await claimEvent(supabase, candidate);
        if (candidateClaim) {
          currentEvent = candidateClaim.event;
          claimed = candidateClaim;
          break;
        }
        claimCollisions.push(candidate.id);
      }
    }
    if (!currentEvent) {
      return new Response(
        JSON.stringify({ status: "idle", eventId: eventId ?? null }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!isCompanionCinemaUserEligible(currentEvent.user_id)) {
      if (!currentEvent.lease_token) {
        await deferRolloutIneligibleEvent(supabase, currentEvent);
      }
      return new Response(
        JSON.stringify({
          status: "unavailable",
          code: "cosmiq_cinema_rollout_ineligible",
          eventId: currentEvent.id,
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (
      ["ready", "revealed", "failed", "cancelled", "superseded"].includes(
        currentEvent.status,
      )
    ) {
      return new Response(
        JSON.stringify({
          status: currentEvent.status,
          eventId: currentEvent.id,
          boundaryLevel: currentEvent.boundary_level,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    claimed ??= await claimEvent(supabase, currentEvent);
    if (!claimed) {
      return new Response(
        JSON.stringify({
          status: "processing",
          eventId: currentEvent.id,
        }),
        {
          status: 202,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    currentEvent = claimed.event;
    leaseToken = claimed.leaseToken;

    if (
      !(await ensureCosmiqEventCompanion({
        supabase,
        event: currentEvent,
        leaseToken,
      }))
    ) {
      return new Response(
        JSON.stringify({
          status: "cancelled",
          eventId: currentEvent.id,
          reason: "product_mode_changed",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const costGuardrails = createCostGuardrailSession({
      supabase,
      endpointKey: "process-companion-cinema-event",
      featureKey: "ai_companion_cinema",
      userId: currentEvent.user_id,
      requestId: currentEvent.id,
    });
    const guardedFetch = costGuardrails.wrapFetch(fetch);
    await costGuardrails.enforceAccess({
      capabilities: currentEvent.event_type === "evolution"
        ? ["image", "video"]
        : ["video"],
      providers: currentEvent.event_type === "evolution"
        ? ["openai", "fal"]
        : ["fal"],
      metadata: {
        cinema_event_id: currentEvent.id,
        boundary_level: currentEvent.boundary_level,
      },
    });

    let result: Record<string, unknown>;
    if (!currentEvent.canonical_image_path) {
      if (currentEvent.event_type === "evolution") {
        const openAIApiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
        if (!openAIApiKey) throw new Error("OPENAI_API_KEY is not configured");
        result = await renderPortrait({
          supabase,
          event: currentEvent,
          leaseToken,
          guardedFetch,
          openAIApiKey,
        });
      } else {
        result = await prepareInteractionEndpoint({
          supabase,
          event: currentEvent,
          leaseToken,
        });
      }
    } else {
      const falKey = Deno.env.get("FAL_KEY")?.trim();
      if (!falKey) throw new Error("FAL_KEY is not configured");
      result = await processVideo({
        supabase,
        event: currentEvent,
        leaseToken,
        guardedFetch,
        falKey,
      });
    }

    return new Response(
      JSON.stringify({
        eventId: currentEvent.id,
        boundaryLevel: currentEvent.boundary_level,
        ...result,
      }),
      {
        status: result.status === "ready" ? 200 : 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = isCostGuardrailBlockedError(error)
      ? "cost_guardrail_blocked"
      : normalizeErrorCode(message);
    if (supabase && currentEvent && leaseToken) {
      const nextAttempt = currentEvent.render_attempt_count + 1;
      const retry = !isCostGuardrailBlockedError(error) &&
        nextAttempt < currentEvent.max_render_attempts;
      const nextRetryAt = retry
        ? new Date(Date.now() + PORTRAIT_RETRY_BASE_MS * 2 ** (nextAttempt - 1))
          .toISOString()
        : null;
      try {
        await releaseEvent(supabase, currentEvent.id, leaseToken, {
          status: retry
            ? currentEvent.canonical_image_path ? "rendering_video" : "queued"
            : "failed",
          render_attempt_count: nextAttempt,
          next_retry_at: nextRetryAt,
          error_code: code,
          error_message: message.slice(0, 500),
        });
        if (!retry) {
          await markInteractionRunTerminal({
            supabase,
            event: currentEvent,
            status: "failed",
            reason: code,
          });
        }
      } catch (updateError) {
        console.error("Failed to persist cinema event error", updateError);
      }
    }
    console.error("process-companion-cinema-event failed", error);
    return new Response(
      JSON.stringify({
        error: message,
        code,
        eventId: currentEvent?.id ?? null,
      }),
      {
        status: isCostGuardrailBlockedError(error) ? 503 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
};

if (import.meta.main) {
  serve(handleProcessCompanionCinemaEvent);
}
