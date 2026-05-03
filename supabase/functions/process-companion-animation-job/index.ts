import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errorResponse, requireInternalRequest } from "../_shared/auth.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import {
  getFalKlingResult,
  getFalKlingStatus,
  submitFalKlingVideo,
} from "../_shared/falKlingVideoClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-key",
};

const ANIMATION_BUCKET = "companion-animation-videos";
const MAX_ATTEMPTS = 3;
const STALE_CLAIM_AGE_MS = 5 * 60 * 1000;

interface AnimationJobRow {
  id: string;
  companion_id: string;
  evolution_id: string | null;
  user_id: string;
  source_image_url: string;
  prompt: string | null;
  provider: string;
  provider_model: string | null;
  provider_request_id: string | null;
  status: string;
  attempts: number;
  last_error: string | null;
  result_video_url: string | null;
  result_storage_path: string | null;
  claimed_at: string | null;
  created_at: string;
}

function isFeatureEnabled(): boolean {
  const raw = (Deno.env.get("COMPANION_KLING_ENABLED") ?? "").trim().toLowerCase();
  // Default OFF — operators must explicitly opt in once FAL_KEY is provisioned.
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * fal.ai's image-to-video endpoint must be able to fetch the source image over
 * HTTPS. Bundled preset assets resolve to relative paths like
 * `/companion-presets/...png` that are only served by our own app — fal can't
 * reach them. Detect these and skip the job rather than waste a submission.
 */
function isFetchableSourceUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

async function findClaimable(
  supabase: ReturnType<typeof createClient>,
  batchSize: number,
): Promise<AnimationJobRow[]> {
  const staleCutoff = new Date(Date.now() - STALE_CLAIM_AGE_MS).toISOString();
  const { data, error } = await supabase
    .from("companion_animation_jobs")
    .select("id, companion_id, evolution_id, user_id, source_image_url, prompt, provider, provider_model, provider_request_id, status, attempts, last_error, result_video_url, result_storage_path, claimed_at, created_at")
    .in("status", ["pending", "submitted", "processing"])
    .or(`claimed_at.is.null,claimed_at.lt.${staleCutoff}`)
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (error) throw error;
  return (data ?? []) as AnimationJobRow[];
}

async function claimJob(
  supabase: ReturnType<typeof createClient>,
  job: AnimationJobRow,
): Promise<AnimationJobRow | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("companion_animation_jobs")
    .update({
      status: job.provider_request_id ? "processing" : "submitted",
      claimed_at: nowIso,
      attempts: job.attempts + 1,
      updated_at: nowIso,
    })
    .eq("id", job.id)
    .eq("status", job.status)
    .or(`claimed_at.is.null,claimed_at.eq.${job.claimed_at ?? ""}`)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[AnimationJob] Claim error", error);
    return null;
  }
  return (data ?? null) as AnimationJobRow | null;
}

async function markEvolutionAnimation(
  supabase: ReturnType<typeof createClient>,
  evolutionId: string | null,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!evolutionId) return;
  const { error } = await supabase
    .from("companion_evolutions")
    .update(patch)
    .eq("id", evolutionId);
  if (error) {
    console.error("[AnimationJob] Failed to update evolution", evolutionId, error);
  }
}

async function markJobFailed(
  supabase: ReturnType<typeof createClient>,
  job: AnimationJobRow,
  message: string,
): Promise<void> {
  const nowIso = new Date().toISOString();
  await supabase
    .from("companion_animation_jobs")
    .update({
      status: "failed",
      last_error: message.slice(0, 500),
      updated_at: nowIso,
    })
    .eq("id", job.id);

  await markEvolutionAnimation(supabase, job.evolution_id, {
    animation_status: "failed",
    animation_error: message.slice(0, 500),
  });
}

async function markJobSkipped(
  supabase: ReturnType<typeof createClient>,
  job: AnimationJobRow,
  message: string,
): Promise<void> {
  const nowIso = new Date().toISOString();
  await supabase
    .from("companion_animation_jobs")
    .update({
      status: "skipped",
      last_error: message.slice(0, 500),
      updated_at: nowIso,
    })
    .eq("id", job.id);

  await markEvolutionAnimation(supabase, job.evolution_id, {
    animation_status: "skipped",
    animation_error: message.slice(0, 500),
  });
}

async function downloadAndStore(
  supabase: ReturnType<typeof createClient>,
  job: AnimationJobRow,
  videoUrl: string,
): Promise<{ storagePath: string; publicUrl: string }> {
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Video download failed: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const safeEvolutionSegment = job.evolution_id ?? `companion-${job.companion_id}`;
  const storagePath = `${job.user_id}/${safeEvolutionSegment}-${Date.now()}.mp4`;

  const { error: uploadError } = await supabase.storage
    .from(ANIMATION_BUCKET)
    .upload(storagePath, bytes, {
      contentType: "video/mp4",
      upsert: true,
    });
  if (uploadError) throw uploadError;

  const { data: publicUrlPayload } = supabase.storage
    .from(ANIMATION_BUCKET)
    .getPublicUrl(storagePath);

  return { storagePath, publicUrl: publicUrlPayload.publicUrl };
}

async function processJob(
  supabase: ReturnType<typeof createClient>,
  job: AnimationJobRow,
): Promise<void> {
  const claimed = await claimJob(supabase, job);
  if (!claimed) {
    console.log(`[AnimationJob] Skipping job ${job.id} — claim race lost`);
    return;
  }

  if (claimed.attempts > MAX_ATTEMPTS) {
    await markJobFailed(supabase, claimed, `Exceeded ${MAX_ATTEMPTS} attempts`);
    return;
  }

  // Phase A: submit to fal.ai if we don't yet have a request id.
  if (!claimed.provider_request_id) {
    if (!isFeatureEnabled()) {
      await markJobSkipped(supabase, claimed, "COMPANION_KLING_ENABLED is off");
      return;
    }

    if (!isFetchableSourceUrl(claimed.source_image_url)) {
      await markJobSkipped(
        supabase,
        claimed,
        "source_image_url is not externally fetchable (bundled asset path)",
      );
      return;
    }

    const guardrails = createCostGuardrailSession({
      supabase,
      endpointKey: "process-companion-animation-job",
      featureKey: "ai_companion_images",
      userId: claimed.user_id,
    });
    try {
      await guardrails.enforceAccess({
        capabilities: ["video"],
        providers: ["fal"],
      });
    } catch (error) {
      if (isCostGuardrailBlockedError(error)) {
        await markJobSkipped(supabase, claimed, "Cost guardrail blocked Kling submission");
        return;
      }
      throw error;
    }

    const submission = await submitFalKlingVideo({
      imageUrl: claimed.source_image_url,
      prompt: claimed.prompt ?? undefined,
    });

    await supabase
      .from("companion_animation_jobs")
      .update({
        provider_request_id: submission.requestId,
        status: "submitted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimed.id);

    await markEvolutionAnimation(supabase, claimed.evolution_id, {
      animation_status: "processing",
      animation_provider: claimed.provider,
      animation_provider_request_id: submission.requestId,
    });

    console.log(`[AnimationJob] Submitted job ${claimed.id} → request ${submission.requestId}`);
    return; // Next tick polls.
  }

  // Phase B: poll for completion.
  const status = await getFalKlingStatus(claimed.provider_request_id);
  if (status.status === "IN_QUEUE" || status.status === "IN_PROGRESS") {
    await supabase
      .from("companion_animation_jobs")
      .update({
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimed.id);
    console.log(`[AnimationJob] Job ${claimed.id} still ${status.status}`);
    return;
  }

  if (status.status === "FAILED") {
    await markJobFailed(supabase, claimed, `fal.ai reported FAILED (raw=${status.rawStatus})`);
    return;
  }

  // COMPLETED — fetch the result, persist the MP4, mirror to companion_evolutions.
  const result = await getFalKlingResult(claimed.provider_request_id);
  const stored = await downloadAndStore(supabase, claimed, result.videoUrl);

  const nowIso = new Date().toISOString();
  await supabase
    .from("companion_animation_jobs")
    .update({
      status: "succeeded",
      result_video_url: stored.publicUrl,
      result_storage_path: stored.storagePath,
      updated_at: nowIso,
    })
    .eq("id", claimed.id);

  await markEvolutionAnimation(supabase, claimed.evolution_id, {
    animation_status: "succeeded",
    animation_video_url: stored.publicUrl,
    animation_storage_path: stored.storagePath,
    animation_completed_at: nowIso,
    animation_error: null,
  });

  console.log(`[AnimationJob] Completed job ${claimed.id} → ${stored.publicUrl}`);
}

interface ProcessSummary {
  inspected: number;
  succeeded: number;
  submitted: number;
  failed: number;
  skipped: number;
  inProgress: number;
}

async function drainQueue(
  supabase: ReturnType<typeof createClient>,
  batchSize: number,
): Promise<ProcessSummary> {
  const summary: ProcessSummary = {
    inspected: 0,
    succeeded: 0,
    submitted: 0,
    failed: 0,
    skipped: 0,
    inProgress: 0,
  };

  const candidates = await findClaimable(supabase, batchSize);
  summary.inspected = candidates.length;

  for (const job of candidates) {
    try {
      const before = job.status;
      await processJob(supabase, job);

      const { data: after } = await supabase
        .from("companion_animation_jobs")
        .select("status")
        .eq("id", job.id)
        .maybeSingle();
      const next = after?.status ?? before;
      if (next === "succeeded") summary.succeeded += 1;
      else if (next === "failed") summary.failed += 1;
      else if (next === "skipped") summary.skipped += 1;
      else if (next === "submitted") summary.submitted += 1;
      else summary.inProgress += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[AnimationJob] Job ${job.id} threw`, message);
      try {
        await markJobFailed(supabase, job, message);
        summary.failed += 1;
      } catch (innerError) {
        console.error(`[AnimationJob] Failed to mark job ${job.id} failed`, innerError);
      }
    }
  }

  return summary;
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve(async (req) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const auth = await requireInternalRequest(req, corsHeaders);
      if (auth instanceof Response) {
        return auth;
      }

      const body = await req.json().catch(() => ({}));
      const requestedBatch = typeof body?.batchSize === "number" ? Math.floor(body.batchSize) : 4;
      const batchSize = Math.min(8, Math.max(1, requestedBatch));

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !serviceRoleKey) {
        return errorResponse(500, "Server configuration missing", corsHeaders);
      }

      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const summary = await drainQueue(supabase, batchSize);

      return new Response(JSON.stringify({ success: true, ...summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      if (isCostGuardrailBlockedError(error)) {
        return buildCostGuardrailBlockedResponse(error, corsHeaders);
      }
      console.error("[AnimationJob] Top-level error", error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  });
}

export const __testables = {
  drainQueue,
  isFeatureEnabled,
};
