import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-key",
};

const PROCESSING_STALE_MS = 5 * 60 * 1000;
const BASE_RETRY_DELAY_MS = 30 * 1000;

interface CompanionEvolutionJob {
  id: string;
  user_id: string;
  companion_id: string;
  requested_stage: number;
  status: "queued" | "processing" | "succeeded" | "failed";
  retry_count: number;
  next_retry_at: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  requested_at: string;
  updated_at: string;
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

const RETRYABLE_PATTERNS = [
  /timeout/i,
  /timed out/i,
  /temporarily unavailable/i,
  /connection/i,
  /network/i,
  /fetch/i,
  /ecconnreset/i,
  /5\d\d/i,
];

const TERMINAL_CODES = new Set([
  "not_enough_xp",
  "max_stage_reached",
  "already_evolved",
  "companion_not_found",
  "rate_limited",
]);

const isRetryableError = (message: string) => RETRYABLE_PATTERNS.some((pattern) => pattern.test(message));

const normalizeErrorCode = (input: string | null | undefined) => {
  if (!input) return "evolution_failed";
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || "evolution_failed";
};

const resolveErrorCode = (status: number, payload: Record<string, unknown> | null, fallbackMessage: string) => {
  const payloadCode = typeof payload?.code === "string" ? normalizeErrorCode(payload.code) : null;
  if (payloadCode) return payloadCode;

  const payloadError = typeof payload?.error === "string" ? normalizeErrorCode(payload.error) : null;
  if (payloadError) return payloadError;

  const payloadMessage = typeof payload?.message === "string" ? normalizeErrorCode(payload.message) : null;
  if (payloadMessage) return payloadMessage;

  if (status === 429) return "rate_limited";
  return normalizeErrorCode(fallbackMessage);
};

const parseJsonSafe = async <T>(response: Response): Promise<T | null> => {
  try {
    return await response.json() as T;
  } catch {
    return null;
  }
};

const fetchJob = async (
  supabase: ReturnType<typeof createClient>,
  userId: string | null,
  jobId?: string,
): Promise<CompanionEvolutionJob | null> => {
  const nowIso = new Date().toISOString();

  if (jobId) {
    const { data, error } = await supabase
      .from("companion_evolution_jobs")
      .select("id, user_id, companion_id, requested_stage, status, retry_count, next_retry_at, error_code, error_message, started_at, requested_at, updated_at")
      .eq("id", jobId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    if (userId && data.user_id !== userId) return null;
    return data as CompanionEvolutionJob;
  }

  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("companion_evolution_jobs")
    .select("id, user_id, companion_id, requested_stage, status, retry_count, next_retry_at, error_code, error_message, started_at, requested_at, updated_at")
    .eq("user_id", userId)
    .in("status", ["queued", "processing"])
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .order("requested_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as CompanionEvolutionJob | null;
};

const claimJob = async (
  supabase: ReturnType<typeof createClient>,
  job: CompanionEvolutionJob,
): Promise<CompanionEvolutionJob | null> => {
  if (job.status === "succeeded" || job.status === "failed") {
    return job;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const staleCutoffIso = new Date(now.getTime() - PROCESSING_STALE_MS).toISOString();

  if (job.status === "processing") {
    const updatedAtMs = new Date(job.updated_at).getTime();
    if (!Number.isFinite(updatedAtMs) || now.getTime() - updatedAtMs < PROCESSING_STALE_MS) {
      return job;
    }
  }

  let claimQuery = supabase
    .from("companion_evolution_jobs")
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
    claimQuery = claimQuery.eq("status", "processing").lte("updated_at", staleCutoffIso);
  }

  const { data, error } = await claimQuery
    .select("id, user_id, companion_id, requested_stage, status, retry_count, next_retry_at, error_code, error_message, started_at, requested_at, updated_at")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as CompanionEvolutionJob | null;
};

const runEvolutionPipeline = async (
  supabaseUrl: string,
  internalSecret: string,
  userId: string,
) => {
  const response = await fetch(`${supabaseUrl}/functions/v1/generate-companion-evolution`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": internalSecret,
    },
    body: JSON.stringify({ userId }),
  });

  const payload = await parseJsonSafe<Record<string, unknown>>(response);

  if (!response.ok) {
    const message =
      (typeof payload?.error === "string" && payload.error) ||
      (typeof payload?.message === "string" && payload.message) ||
      `generate-companion-evolution failed with status ${response.status}`;

    const code = resolveErrorCode(response.status, payload, message);
    const retryable = !TERMINAL_CODES.has(code) && (response.status >= 500 || isRetryableError(message));
    throw new JobProcessingError(message, code, retryable);
  }

  const evolved = payload?.evolved === true;
  if (!evolved) {
    const message =
      (typeof payload?.message === "string" && payload.message) ||
      "evolution_not_performed";

    const code = resolveErrorCode(200, payload, message);
    throw new JobProcessingError(message, code, false);
  }

  return payload;
};

const ensureEvolutionCards = async (
  supabase: ReturnType<typeof createClient>,
  companionId: string,
  stage: number,
) => {
  const { data: companion } = await supabase
    .from("user_companion")
    .select("initial_image_url, created_at, spirit_animal, core_element, favorite_color, vitality, wisdom, discipline, resolve, creativity, alignment")
    .eq("id", companionId)
    .maybeSingle();

  if (!companion) return;

  const { data: existingCards } = await supabase
    .from("companion_evolution_cards")
    .select("evolution_stage")
    .eq("companion_id", companionId);

  const existingStages = new Set((existingCards ?? []).map((card) => card.evolution_stage));

  for (let currentStage = 0; currentStage <= stage; currentStage += 1) {
    if (existingStages.has(currentStage)) {
      continue;
    }

    let evolutionId: string | null = null;
    const { data: evolution } = await supabase
      .from("companion_evolutions")
      .select("id")
      .eq("companion_id", companionId)
      .eq("stage", currentStage)
      .maybeSingle();

    evolutionId = evolution?.id ?? null;

    if (!evolutionId && currentStage === 0 && companion.initial_image_url) {
      const { data: stageZeroEvolution } = await supabase
        .from("companion_evolutions")
        .upsert(
          {
            companion_id: companionId,
            stage: 0,
            image_url: companion.initial_image_url,
            xp_at_evolution: 0,
            evolved_at: companion.created_at,
          },
          { onConflict: "companion_id,stage" },
        )
        .select("id")
        .maybeSingle();

      evolutionId = stageZeroEvolution?.id ?? null;
    }

    if (!evolutionId) {
      continue;
    }

    await supabase.functions.invoke("generate-evolution-card", {
      body: {
        companionId,
        evolutionId,
        stage: currentStage,
        species: companion.spirit_animal,
        element: companion.core_element,
        color: companion.favorite_color,
        userAttributes: {
          vitality: companion.vitality || 300,
          wisdom: companion.wisdom || 300,
          discipline: companion.discipline || 300,
          resolve: companion.resolve || 300,
          creativity: companion.creativity || 300,
          alignment: companion.alignment || 300,
        },
      },
    });
  }
};

const ensureEvolutionStory = async (
  supabase: ReturnType<typeof createClient>,
  companionId: string,
  stage: number,
) => {
  const { data: existingStory } = await supabase
    .from("companion_stories")
    .select("id")
    .eq("companion_id", companionId)
    .eq("stage", stage)
    .maybeSingle();

  if (existingStory) {
    return;
  }

  await supabase.functions.invoke("generate-companion-story", {
    body: {
      companionId,
      stage,
      tonePreference: "heroic",
      themeIntensity: "moderate",
    },
  });
};

const validateReferralStage3 = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  previousStage: number,
  newStage: number,
) => {
  if (!(previousStage < 3 && newStage >= 3)) {
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("referred_by")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.referred_by) {
    return;
  }

  const rpc = supabase.rpc as unknown as (
    name: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;

  await rpc("complete_referral_stage3", {
    p_referee_id: userId,
    p_referrer_id: profile.referred_by,
  });
};

const sendCompletionPush = async (
  supabase: ReturnType<typeof createClient>,
  internalSecret: string,
  userId: string,
) => {
  const { data: deviceTokens } = await supabase
    .from("push_device_tokens")
    .select("device_token")
    .eq("user_id", userId)
    .eq("platform", "ios");

  if (!deviceTokens?.length) {
    return;
  }

  for (const token of deviceTokens) {
    try {
      await supabase.functions.invoke("send-apns-notification", {
        body: {
          deviceToken: token.device_token,
          title: "Your companion evolved",
          body: "Your companion is ready. Tap to see the new form.",
          data: {
            type: "companion_evolution_ready",
            url: "/companion",
          },
        },
        headers: {
          "x-internal-key": internalSecret,
        },
      });
    } catch (pushError) {
      console.error("Failed to send evolution completion push", pushError);
    }
  }
};

const runNonCriticalSideEffects = async (
  supabase: ReturnType<typeof createClient>,
  internalSecret: string,
  job: CompanionEvolutionJob,
  previousStage: number,
  newStage: number,
) => {
  try {
    await ensureEvolutionCards(supabase, job.companion_id, newStage);
  } catch (error) {
    console.error("Evolution card side effect failed", error);
  }

  try {
    await ensureEvolutionStory(supabase, job.companion_id, newStage);
  } catch (error) {
    console.error("Evolution story side effect failed", error);
  }

  try {
    await validateReferralStage3(supabase, job.user_id, previousStage, newStage);
  } catch (error) {
    console.error("Referral validation side effect failed", error);
  }

  try {
    await sendCompletionPush(supabase, internalSecret, job.user_id);
  } catch (error) {
    console.error("Push side effect failed", error);
  }
};

serve(async (req) => {
  let requestedJobId: string | undefined;

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");

    if (!supabaseUrl || !serviceRoleKey || !anonKey || !internalSecret) {
      return new Response(
        JSON.stringify({
          error: "server_configuration_error",
          code: "server_configuration_error",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const providedInternalSecret = req.headers.get("x-internal-key");
    const isInternal = providedInternalSecret === internalSecret;

    let callerUserId: string | null = null;
    if (!isInternal) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const authClient = createClient(supabaseUrl, anonKey, {
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
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      callerUserId = user.id;
    }

    const requestBody = await req.json().catch(() => ({}));
    requestedJobId = typeof requestBody?.jobId === "string" ? requestBody.jobId : undefined;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const job = await fetchJob(supabase, callerUserId, requestedJobId);
    if (!job) {
      return new Response(
        JSON.stringify({ error: "job_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    requestedJobId = job.id;

    if (job.status === "succeeded" || job.status === "failed") {
      return new Response(
        JSON.stringify({
          jobId: job.id,
          status: job.status,
          requestedStage: job.requested_stage,
          errorCode: job.error_code,
          errorMessage: job.error_message,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const claimedJob = await claimJob(supabase, job);
    if (!claimedJob) {
      return new Response(
        JSON.stringify({
          jobId: job.id,
          status: "processing",
          requestedStage: job.requested_stage,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (job.status === "processing" && claimedJob.updated_at === job.updated_at) {
      return new Response(
        JSON.stringify({
          jobId: claimedJob.id,
          status: claimedJob.status,
          requestedStage: claimedJob.requested_stage,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const evolutionPayload = await runEvolutionPipeline(supabaseUrl, internalSecret, claimedJob.user_id);

    const nowIso = new Date().toISOString();
    const { error: successUpdateError } = await supabase
      .from("companion_evolution_jobs")
      .update({
        status: "succeeded",
        result_image_url: typeof evolutionPayload.image_url === "string" ? evolutionPayload.image_url : null,
        result_evolution_id: typeof evolutionPayload.evolution_id === "string" ? evolutionPayload.evolution_id : null,
        completed_at: nowIso,
        updated_at: nowIso,
        error_code: null,
        error_message: null,
      })
      .eq("id", claimedJob.id)
      .eq("status", "processing");

    if (successUpdateError) {
      throw successUpdateError;
    }

    const previousStage = typeof evolutionPayload.previous_stage === "number" ? evolutionPayload.previous_stage : claimedJob.requested_stage - 1;
    const newStage = typeof evolutionPayload.new_stage === "number" ? evolutionPayload.new_stage : claimedJob.requested_stage;

    await runNonCriticalSideEffects(supabase, internalSecret, claimedJob, previousStage, newStage);

    return new Response(
      JSON.stringify({
        jobId: claimedJob.id,
        status: "succeeded",
        requestedStage: claimedJob.requested_stage,
        newStage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.error("process-companion-evolution-job failed", error);

    if (supabaseUrl && serviceRoleKey && requestedJobId) {
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data: currentJob } = await supabase
        .from("companion_evolution_jobs")
        .select("id, status, retry_count")
        .eq("id", requestedJobId)
        .maybeSingle();

      if (currentJob?.status === "processing") {
        const now = new Date();
        const retryCount = (currentJob.retry_count ?? 0) + 1;
        const message = error instanceof Error ? error.message : "Unknown error";

        let errorCode = "evolution_failed";
        let retryable = isRetryableError(message);

        if (error instanceof JobProcessingError) {
          errorCode = error.code;
          retryable = error.retryable;
        }

        const shouldRetry = retryable && retryCount <= 2;

        if (shouldRetry) {
          const nextRetryAt = new Date(now.getTime() + BASE_RETRY_DELAY_MS * 2 ** (retryCount - 1)).toISOString();
          await supabase
            .from("companion_evolution_jobs")
            .update({
              status: "queued",
              retry_count: retryCount,
              next_retry_at: nextRetryAt,
              error_code: errorCode,
              error_message: message.slice(0, 500),
              updated_at: now.toISOString(),
            })
            .eq("id", requestedJobId);

          return new Response(
            JSON.stringify({
              jobId: requestedJobId,
              status: "queued",
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

        await supabase
          .from("companion_evolution_jobs")
          .update({
            status: "failed",
            retry_count: retryCount,
            error_code: errorCode,
            error_message: message.slice(0, 500),
            completed_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq("id", requestedJobId);

        return new Response(
          JSON.stringify({
            jobId: requestedJobId,
            status: "failed",
            error: message,
            code: errorCode,
            retryCount,
            errorCode,
            errorMessage: message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const fallbackMessage = error instanceof Error ? error.message : "Unknown error";
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
});
