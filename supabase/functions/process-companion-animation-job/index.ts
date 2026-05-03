import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import { registerUserStorageAsset } from "../_shared/storageAssetLedger.ts";
import {
  COMPANION_ANIMATION_PROVIDER,
  COMPANION_ANIMATION_VIDEO_BUCKET,
  DEFAULT_COMPANION_ANIMATION_DURATION_SECONDS,
  downloadFalVideo,
  FalKlingVideoError,
  getFalKlingQueueResult,
  getFalKlingQueueStatus,
  resolveFalKlingModelFromEnv,
  submitFalKlingVideo,
} from "../_shared/falKlingVideoClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-key",
};

const PROCESSING_STALE_MS = 5 * 60 * 1000;
const POLL_RETRY_DELAY_MS = 30 * 1000;
const BASE_RETRY_DELAY_MS = 45 * 1000;
const MAX_RETRY_COUNT = 3;

type SupabaseServiceClient = any;

interface CompanionAnimationJob {
  id: string;
  user_id: string;
  companion_id: string;
  evolution_id: string;
  stage: number;
  source_image_url: string;
  provider: string;
  provider_model: string;
  provider_task_id: string | null;
  provider_status: string | null;
  status: "queued" | "processing" | "succeeded" | "failed";
  prompt: string;
  retry_count: number;
  next_retry_at: string | null;
  requested_at: string;
  started_at: string | null;
  updated_at: string;
}

interface ProcessCompanionAnimationJobDeps {
  createClient: typeof createClient;
  createCostGuardrailSession: typeof createCostGuardrailSession;
  registerUserStorageAsset: typeof registerUserStorageAsset;
  fetchFn: typeof fetch;
  env: Pick<typeof Deno.env, "get">;
  now: () => Date;
  info: typeof console.info;
  warn: typeof console.warn;
  error: typeof console.error;
}

class JobProcessingError extends Error {
  code: string;
  retryable: boolean;

  constructor(message: string, code: string, retryable: boolean) {
    super(message);
    this.name = "JobProcessingError";
    this.code = code;
    this.retryable = retryable;
  }
}

const defaultDeps: ProcessCompanionAnimationJobDeps = {
  createClient,
  createCostGuardrailSession,
  registerUserStorageAsset,
  fetchFn: fetch,
  env: Deno.env,
  now: () => new Date(),
  info: console.info,
  warn: console.warn,
  error: console.error,
};

const normalizeErrorCode = (input: string | null | undefined) => {
  if (!input) return "animation_failed";
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || "animation_failed";
};

const getJobSelectColumns = () =>
  [
    "id",
    "user_id",
    "companion_id",
    "evolution_id",
    "stage",
    "source_image_url",
    "provider",
    "provider_model",
    "provider_task_id",
    "provider_status",
    "status",
    "prompt",
    "retry_count",
    "next_retry_at",
    "requested_at",
    "started_at",
    "updated_at",
  ].join(", ");

const toIso = (date: Date) => date.toISOString();

const getNextRetryAt = (now: Date, retryCount: number) =>
  new Date(
    now.getTime() + BASE_RETRY_DELAY_MS * 2 ** Math.max(0, retryCount - 1),
  ).toISOString();

const getNextPollAt = (now: Date) =>
  new Date(now.getTime() + POLL_RETRY_DELAY_MS).toISOString();

interface FetchJobOptions {
  allowGlobalQueue?: boolean;
}

const fetchJob = async (
  supabase: SupabaseServiceClient,
  userId: string | null,
  jobId?: string,
  options?: FetchJobOptions,
): Promise<CompanionAnimationJob | null> => {
  const allowGlobalQueue = options?.allowGlobalQueue === true;
  const nowIso = new Date().toISOString();

  if (jobId) {
    const { data, error } = await supabase
      .from("companion_animation_jobs")
      .select(getJobSelectColumns())
      .eq("id", jobId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    if (userId && data.user_id !== userId) return null;
    return data as CompanionAnimationJob;
  }

  if (!userId && !allowGlobalQueue) {
    return null;
  }

  let query = supabase
    .from("companion_animation_jobs")
    .select(getJobSelectColumns())
    .in("status", ["queued", "processing"])
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .order("requested_at", { ascending: true })
    .limit(1);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  return (data ?? null) as CompanionAnimationJob | null;
};

const claimJob = async (
  supabase: SupabaseServiceClient,
  job: CompanionAnimationJob,
  now: Date,
): Promise<CompanionAnimationJob | null> => {
  if (job.status === "succeeded" || job.status === "failed") {
    return job;
  }

  const nowIso = toIso(now);
  const staleCutoffIso = new Date(now.getTime() - PROCESSING_STALE_MS)
    .toISOString();

  if (job.status === "processing") {
    const updatedAtMs = new Date(job.updated_at).getTime();
    if (
      !Number.isFinite(updatedAtMs) ||
      now.getTime() - updatedAtMs < PROCESSING_STALE_MS
    ) {
      return null;
    }
  }

  let claimQuery = supabase
    .from("companion_animation_jobs")
    .update({
      status: "processing",
      started_at: job.started_at ?? nowIso,
      updated_at: nowIso,
      next_retry_at: null,
    })
    .eq("id", job.id);

  if (job.status === "queued") {
    claimQuery = claimQuery.eq("status", "queued");
  } else {
    claimQuery = claimQuery.eq("status", "processing").lte(
      "updated_at",
      staleCutoffIso,
    );
  }

  const { data, error } = await claimQuery
    .select(getJobSelectColumns())
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as CompanionAnimationJob | null;
};

const updateEvolutionAnimation = async (
  supabase: SupabaseServiceClient,
  evolutionId: string,
  payload: Record<string, unknown>,
) => {
  const { error } = await supabase
    .from("companion_evolutions")
    .update(payload)
    .eq("id", evolutionId);

  if (error) {
    throw error;
  }
};

const updateJob = async (
  supabase: SupabaseServiceClient,
  jobId: string,
  payload: Record<string, unknown>,
) => {
  const { error } = await supabase
    .from("companion_animation_jobs")
    .update(payload)
    .eq("id", jobId);

  if (error) {
    throw error;
  }
};

const uploadAnimationVideo = async ({
  supabase,
  job,
  bytes,
  contentType,
  now,
}: {
  supabase: SupabaseServiceClient;
  job: CompanionAnimationJob;
  bytes: Uint8Array;
  contentType: string;
  now: Date;
}): Promise<{ storagePath: string; publicUrl: string }> => {
  const storagePath =
    `${job.user_id}/evolutions/${job.companion_id}_stage_${job.stage}_${now.getTime()}.mp4`;

  const { error: uploadError } = await supabase.storage
    .from(COMPANION_ANIMATION_VIDEO_BUCKET)
    .upload(storagePath, bytes, {
      contentType: contentType || "video/mp4",
      upsert: false,
    });

  if (uploadError) {
    throw new JobProcessingError(
      `Failed to upload companion animation video: ${
        uploadError.message ?? "unknown_storage_error"
      }`,
      "animation_upload_failed",
      true,
    );
  }

  const { data } = supabase.storage
    .from(COMPANION_ANIMATION_VIDEO_BUCKET)
    .getPublicUrl(storagePath);

  if (!data?.publicUrl) {
    throw new JobProcessingError(
      "Failed to resolve companion animation video URL",
      "animation_public_url_failed",
      true,
    );
  }

  return {
    storagePath,
    publicUrl: data.publicUrl,
  };
};

export const processClaimedCompanionAnimationJob = async ({
  supabase,
  job,
  deps = defaultDeps,
}: {
  supabase: SupabaseServiceClient;
  job: CompanionAnimationJob;
  deps?: ProcessCompanionAnimationJobDeps;
}) => {
  const falKey = deps.env.get("FAL_KEY")?.trim();
  if (!falKey) {
    throw new JobProcessingError(
      "FAL_KEY is not configured",
      "fal_key_missing",
      false,
    );
  }

  if (job.provider !== COMPANION_ANIMATION_PROVIDER) {
    throw new JobProcessingError(
      `Unsupported animation provider: ${job.provider}`,
      "unsupported_animation_provider",
      false,
    );
  }

  const providerModel = job.provider_model?.trim() ||
    resolveFalKlingModelFromEnv(deps.env);
  const now = deps.now();

  if (!job.provider_task_id) {
    const costGuardrails = deps.createCostGuardrailSession({
      supabase,
      endpointKey: "process-companion-animation-job",
      featureKey: "ai_companion_animation",
      userId: job.user_id,
    });
    const guardedFetch = costGuardrails.wrapFetch(deps.fetchFn);
    let submitted: Awaited<ReturnType<typeof submitFalKlingVideo>>;
    try {
      submitted = await submitFalKlingVideo({
        fetchFn: guardedFetch,
        apiKey: falKey,
        model: providerModel,
        imageUrl: job.source_image_url,
        prompt: job.prompt,
        durationSeconds: DEFAULT_COMPANION_ANIMATION_DURATION_SECONDS,
      });
    } catch (error) {
      if (isCostGuardrailBlockedError(error)) {
        throw new JobProcessingError(
          "Companion animation generation is blocked by cost guardrails",
          "cost_guardrail_blocked",
          false,
        );
      }
      throw error;
    }
    const nextPollAt = getNextPollAt(now);

    await updateJob(supabase, job.id, {
      status: "queued",
      provider_task_id: submitted.requestId,
      provider_status: "SUBMITTED",
      next_retry_at: nextPollAt,
      error_code: null,
      error_message: null,
      updated_at: toIso(now),
    });
    await updateEvolutionAnimation(supabase, job.evolution_id, {
      animation_provider: COMPANION_ANIMATION_PROVIDER,
      animation_provider_model: providerModel,
      animation_provider_task_id: submitted.requestId,
      animation_status: "processing",
      animation_error_code: null,
      animation_error_message: null,
    });

    return {
      jobId: job.id,
      status: "processing",
      providerTaskId: submitted.requestId,
      nextRetryAt: nextPollAt,
    };
  }

  const queueStatus = await getFalKlingQueueStatus({
    fetchFn: deps.fetchFn,
    apiKey: falKey,
    model: providerModel,
    requestId: job.provider_task_id,
  });
  const normalizedStatus = queueStatus.status.toUpperCase();

  if (normalizedStatus === "IN_QUEUE" || normalizedStatus === "IN_PROGRESS") {
    const nextPollAt = getNextPollAt(now);
    await updateJob(supabase, job.id, {
      status: "queued",
      provider_status: normalizedStatus,
      next_retry_at: nextPollAt,
      updated_at: toIso(now),
    });
    await updateEvolutionAnimation(supabase, job.evolution_id, {
      animation_status: "processing",
      animation_provider_task_id: job.provider_task_id,
    });

    return {
      jobId: job.id,
      status: "processing",
      providerTaskId: job.provider_task_id,
      providerStatus: normalizedStatus,
      nextRetryAt: nextPollAt,
    };
  }

  if (normalizedStatus !== "COMPLETED") {
    throw new JobProcessingError(
      `fal animation job failed with status ${queueStatus.status}`,
      "fal_job_failed",
      false,
    );
  }

  const result = await getFalKlingQueueResult({
    fetchFn: deps.fetchFn,
    apiKey: falKey,
    model: providerModel,
    requestId: job.provider_task_id,
  });
  const downloadedVideo = await downloadFalVideo({
    fetchFn: deps.fetchFn,
    videoUrl: result.videoUrl,
  });
  const uploadedVideo = await uploadAnimationVideo({
    supabase,
    job,
    bytes: downloadedVideo.bytes,
    contentType: downloadedVideo.contentType,
    now,
  });

  await deps.registerUserStorageAsset({
    supabase,
    userId: job.user_id,
    bucketId: COMPANION_ANIMATION_VIDEO_BUCKET,
    storagePath: uploadedVideo.storagePath,
    sourceKind: "companion_animation_video",
    sourceRecordTable: "companion_evolutions",
    sourceRecordId: job.evolution_id,
  });

  await updateJob(supabase, job.id, {
    status: "succeeded",
    provider_status: normalizedStatus,
    video_url: uploadedVideo.publicUrl,
    storage_path: uploadedVideo.storagePath,
    completed_at: toIso(now),
    next_retry_at: null,
    error_code: null,
    error_message: null,
    updated_at: toIso(now),
  });
  await updateEvolutionAnimation(supabase, job.evolution_id, {
    animation_video_url: uploadedVideo.publicUrl,
    animation_storage_path: uploadedVideo.storagePath,
    animation_provider: COMPANION_ANIMATION_PROVIDER,
    animation_provider_model: providerModel,
    animation_provider_task_id: job.provider_task_id,
    animation_status: "succeeded",
    animation_completed_at: toIso(now),
    animation_error_code: null,
    animation_error_message: null,
  });

  return {
    jobId: job.id,
    status: "succeeded",
    videoUrl: uploadedVideo.publicUrl,
  };
};

type AnimationPipelineAuthContext =
  | {
    mode: "internal";
    userId: string | null;
  }
  | {
    mode: "user";
    userId: string;
    authHeader: string;
  };

export const handleProcessCompanionAnimationJob = async (
  req: Request,
  deps: ProcessCompanionAnimationJobDeps = defaultDeps,
) => {
  let requestedJobId: string | undefined;

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = deps.env.get("SUPABASE_URL");
    const serviceRoleKey = deps.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = deps.env.get("SUPABASE_ANON_KEY");
    const internalSecret = deps.env.get("INTERNAL_FUNCTION_SECRET");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(
        JSON.stringify({
          error: "server_configuration_error",
          code: "server_configuration_error",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const providedInternalSecret = req.headers.get("x-internal-key");
    const hasInternalSecret = typeof internalSecret === "string" &&
      internalSecret.length > 0;
    const isInternal = hasInternalSecret &&
      providedInternalSecret === internalSecret;

    if (providedInternalSecret !== null && !hasInternalSecret) {
      return new Response(
        JSON.stringify({
          error: "server_configuration_error",
          code: "internal_function_secret_missing",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let authContext: AnimationPipelineAuthContext;
    if (isInternal) {
      authContext = { mode: "internal", userId: null };
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "unauthorized" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const authClient = deps.createClient(supabaseUrl, anonKey, {
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
          JSON.stringify({ error: "unauthorized" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      authContext = { mode: "user", userId: user.id, authHeader };
    }

    const requestBody = await req.json().catch(() => ({}));
    requestedJobId = typeof requestBody?.jobId === "string"
      ? requestBody.jobId
      : undefined;

    const supabase = deps.createClient(supabaseUrl, serviceRoleKey);
    const callerUserId = authContext.mode === "user"
      ? authContext.userId
      : null;
    const allowGlobalQueue = authContext.mode === "internal" && !requestedJobId;
    const job = await fetchJob(supabase, callerUserId, requestedJobId, {
      allowGlobalQueue,
    });

    if (!job) {
      if (allowGlobalQueue) {
        return new Response(
          JSON.stringify({
            status: "idle",
            message: "no_job_available",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ error: "job_not_found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    requestedJobId = job.id;

    if (job.status === "succeeded" || job.status === "failed") {
      return new Response(
        JSON.stringify({
          jobId: job.id,
          status: job.status,
          providerTaskId: job.provider_task_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const claimedJob = await claimJob(supabase, job, deps.now());
    if (!claimedJob) {
      return new Response(
        JSON.stringify({
          jobId: job.id,
          status: "processing",
          providerTaskId: job.provider_task_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await processClaimedCompanionAnimationJob({
      supabase,
      job: claimedJob,
      deps,
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const supabaseUrl = deps.env.get("SUPABASE_URL");
    const serviceRoleKey = deps.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const now = deps.now();

    deps.error("process-companion-animation-job failed", error);

    if (supabaseUrl && serviceRoleKey && requestedJobId) {
      const supabase = deps.createClient(supabaseUrl, serviceRoleKey);
      const { data: currentJob } = await supabase
        .from("companion_animation_jobs")
        .select("id, status, retry_count, evolution_id")
        .eq("id", requestedJobId)
        .maybeSingle();

      if (currentJob?.status === "processing") {
        const retryCount = (currentJob.retry_count ?? 0) + 1;
        const message = error instanceof Error
          ? error.message
          : "Unknown error";
        const errorCode = error instanceof JobProcessingError
          ? error.code
          : error instanceof FalKlingVideoError
          ? error.code
          : normalizeErrorCode(message);
        const retryable = error instanceof JobProcessingError
          ? error.retryable
          : error instanceof FalKlingVideoError
          ? error.retryable
          : true;
        const shouldRetry = retryable && retryCount <= MAX_RETRY_COUNT;

        if (shouldRetry) {
          const nextRetryAt = getNextRetryAt(now, retryCount);
          await updateJob(supabase, requestedJobId, {
            status: "queued",
            retry_count: retryCount,
            next_retry_at: nextRetryAt,
            error_code: errorCode,
            error_message: message.slice(0, 500),
            updated_at: toIso(now),
          });

          return new Response(
            JSON.stringify({
              jobId: requestedJobId,
              status: "processing",
              retryCount,
              nextRetryAt,
              errorCode,
            }),
            {
              status: 202,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        await updateJob(supabase, requestedJobId, {
          status: "failed",
          retry_count: retryCount,
          error_code: errorCode,
          error_message: message.slice(0, 500),
          completed_at: toIso(now),
          updated_at: toIso(now),
        });
        if (typeof currentJob.evolution_id === "string") {
          await updateEvolutionAnimation(supabase, currentJob.evolution_id, {
            animation_status: "failed",
            animation_error_code: errorCode,
            animation_error_message: message.slice(0, 500),
            animation_completed_at: toIso(now),
          });
        }

        return new Response(
          JSON.stringify({
            jobId: requestedJobId,
            status: "failed",
            error: message,
            code: errorCode,
            retryCount,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const fallbackMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return new Response(
      JSON.stringify({
        error: fallbackMessage,
        code: normalizeErrorCode(fallbackMessage),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
};

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleProcessCompanionAnimationJob(req));
}
