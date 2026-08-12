import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { summarizeFunctionInvokeError } from "../_shared/functionInvokeError.ts";
import { selectThemeForDate, resolveMentorSlug } from "../_shared/mentorPepTalkConfig.ts";
import { invokeInternalFunction } from "../_shared/internalFunctionAuth.ts";
import {
  buildReadyTranscriptState,
  buildRetryTranscriptState,
  parseTranscriptSyncPayload,
  TRANSCRIPT_STATUS_PENDING,
} from "../_shared/transcriptRetryState.ts";
import { requireUserAuth } from "../_shared/auth.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import {
  getDailyEncouragementSummary,
  getDailyEncouragementTitle,
} from "../_shared/dailyEncouragementCopy.ts";
import {
  resolveSingleDailyPepTalkDateContext,
  type ProfileTimezoneSupabaseClient,
} from "./workflow.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PEP_TALK_REQUEST_IN_PROGRESS_STATUS = 409;
const REPLAY_AUDIO_HEAD_TIMEOUT_MS = 2500;

interface ErrorResponseDetails {
  code?: string;
  upstreamStatus?: number;
  upstreamError?: string | null;
}

interface PepTalkGenerationRpcClient {
  rpc: (
    functionName: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
}

type PepTalkGenerationRequestState =
  | { action: "disabled"; requestKey: null }
  | { action: "started"; requestKey: string }
  | { action: "completed"; requestKey: string; responsePayload: Record<string, unknown> }
  | { action: "in_progress"; requestKey: string };

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
  if (typeof details.upstreamStatus === "number") payload.upstream_status = details.upstreamStatus;
  if (typeof details.upstreamError === "string" && details.upstreamError.length > 0) {
    payload.upstream_error = details.upstreamError;
  }

  return new Response(
    JSON.stringify(payload),
    { status: normalizeStatus(status), headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function parseUpstreamError(rawBody: string): string | null {
  const trimmed = rawBody.trim();
  if (trimmed.length === 0) return null;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const message = typeof parsed.upstream_error === "string"
      ? parsed.upstream_error
      : typeof parsed.upstreamError === "string"
        ? parsed.upstreamError
      : typeof parsed.error === "string"
        ? parsed.error
      : typeof parsed.message === "string"
        ? parsed.message
        : null;
    return message ?? trimmed.slice(0, 300);
  } catch {
    return trimmed.slice(0, 300);
  }
}

function buildPepTalkRequestKey(mentorSlug: string, forDate: string): string {
  return `daily:${mentorSlug}:${forDate}`;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";
  return code === "23505" || message.includes("duplicate key");
}

function getPepTalkPayloadAudioUrl(responsePayload: Record<string, unknown>): string | null {
  const pepTalk = responsePayload.pepTalk;
  if (!pepTalk || typeof pepTalk !== "object" || Array.isArray(pepTalk)) {
    return null;
  }

  const audioUrl = (pepTalk as Record<string, unknown>).audio_url;
  return typeof audioUrl === "string" && audioUrl.trim().length > 0 ? audioUrl.trim() : null;
}

async function headWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function isReplayPepTalkPayloadUsable(
  responsePayload: Record<string, unknown>,
): Promise<boolean> {
  const audioUrl = getPepTalkPayloadAudioUrl(responsePayload);
  if (!audioUrl) {
    console.warn("[PepTalkIdempotency] Completed replay payload has no audio_url");
    return false;
  }

  try {
    const response = await headWithTimeout(audioUrl, REPLAY_AUDIO_HEAD_TIMEOUT_MS);

    if (response.status === 404 || response.status === 410) {
      console.warn("[PepTalkIdempotency] Completed replay audio is missing", {
        audioUrl,
        status: response.status,
      });
      return false;
    }

    if (!response.ok) {
      console.warn("[PepTalkIdempotency] Completed replay audio HEAD was inconclusive; reusing cached response", {
        audioUrl,
        status: response.status,
      });
    }

    return true;
  } catch (error) {
    console.warn("[PepTalkIdempotency] Completed replay audio HEAD threw; reusing cached response", {
      audioUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
}

async function beginPepTalkGenerationRequest({
  supabase,
  requestKey,
  mentorSlug,
  forDate,
  userId,
}: {
  supabase: PepTalkGenerationRpcClient;
  requestKey: string;
  mentorSlug: string;
  forDate: string;
  userId: string;
}): Promise<PepTalkGenerationRequestState> {
  try {
    const { data, error } = await supabase.rpc("begin_pep_talk_generation_request", {
      p_request_key: requestKey,
      p_mentor_slug: mentorSlug,
      p_for_date: forDate,
      p_started_by_user_id: userId,
    });

    if (error) {
      console.warn("[PepTalkIdempotency] Begin request failed; continuing with database uniqueness only", {
        requestKey,
        error: error.message ?? "unknown_rpc_error",
      });
      return { action: "disabled", requestKey: null };
    }

    const row = Array.isArray(data)
      ? (data[0] as Record<string, unknown> | undefined)
      : (data as Record<string, unknown> | undefined);
    const action = typeof row?.action === "string" ? row.action : "started";

    if (action === "completed") {
      const responsePayload =
        row?.response_payload && typeof row.response_payload === "object" && !Array.isArray(row.response_payload)
          ? row.response_payload as Record<string, unknown>
          : {};
      return { action: "completed", requestKey, responsePayload };
    }

    if (action === "in_progress") {
      return { action: "in_progress", requestKey };
    }

    return { action: "started", requestKey };
  } catch (error) {
    console.warn("[PepTalkIdempotency] Begin request threw; continuing with database uniqueness only", {
      requestKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return { action: "disabled", requestKey: null };
  }
}

async function completePepTalkGenerationRequestBestEffort({
  supabase,
  requestKey,
  status,
  responsePayload,
  errorMessage,
}: {
  supabase: PepTalkGenerationRpcClient;
  requestKey: string | null;
  status: "completed" | "failed";
  responsePayload?: Record<string, unknown> | null;
  errorMessage?: string | null;
}): Promise<void> {
  if (!requestKey) return;

  try {
    const { error } = await supabase.rpc("complete_pep_talk_generation_request", {
      p_request_key: requestKey,
      p_status: status,
      p_response_payload: responsePayload ?? null,
      p_error_message: errorMessage ?? null,
    });

    if (error) {
      console.warn("[PepTalkIdempotency] Complete request failed", {
        requestKey,
        status,
        error: error.message ?? "unknown_rpc_error",
      });
    }
  } catch (error) {
    console.warn("[PepTalkIdempotency] Complete request threw", {
      requestKey,
      status,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let idempotencySupabase: PepTalkGenerationRpcClient | null = null;
  let idempotencyRequestKey: string | null = null;
  let idempotencyStarted = false;

  try {
    const auth = await requireUserAuth(req, corsHeaders);
    if (auth instanceof Response) {
      return auth;
    }

    let mentorSlugInput: string | null = null;
    let forceRegenerate = false;
    try {
      const body = await req.json();
      mentorSlugInput = body && typeof body.mentorSlug === "string" ? body.mentorSlug : null;
      forceRegenerate = body && typeof body === "object" && !Array.isArray(body) &&
        (body as Record<string, unknown>).forceRegenerate === true;
    } catch {
      return buildErrorResponse(400, "Invalid request payload", { code: "INVALID_JSON" });
    }

    if (!mentorSlugInput || mentorSlugInput.trim().length === 0) {
      return buildErrorResponse(400, "mentorSlug is required", { code: "INVALID_REQUEST" });
    }

    const requestedMentorSlug = mentorSlugInput.trim().toLowerCase();
    const resolvedMentorSlug = resolveMentorSlug(requestedMentorSlug) ?? requestedMentorSlug;
    console.log(`Starting single pep talk generation for mentor: ${requestedMentorSlug} (resolved=${resolvedMentorSlug})`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      return buildErrorResponse(500, "Missing Supabase environment variables", { code: "MISSING_ENV" });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    idempotencySupabase = supabase as unknown as PepTalkGenerationRpcClient;

    const { effectiveDate: todayDate, themeAnchorDate, timezone } = await resolveSingleDailyPepTalkDateContext({
      supabase: supabase as unknown as ProfileTimezoneSupabaseClient,
      userId: auth.userId,
      now: new Date(),
    });
    console.log(`Generating pep talk for effective date: ${todayDate} (${timezone})`);

    // Check if already generated for today
    const { data: existing, error: checkError } = await supabase
      .from('daily_pep_talks')
      .select('*')
      .eq('mentor_slug', resolvedMentorSlug)
      .eq('for_date', todayDate)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing pep talk:', checkError);
      return buildErrorResponse(500, "Failed to check existing pep talk", { code: "DB_CHECK_FAILED" });
    }

    // If already exists, return it unless the caller explicitly asked for fresh audio.
    if (existing && !forceRegenerate) {
      console.log(`Pep talk already exists for ${resolvedMentorSlug} on ${todayDate}, returning existing`);
      return new Response(
        JSON.stringify({ pepTalk: existing, status: 'existing' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const costGuardrails = createCostGuardrailSession({
      supabase,
      endpointKey: "generate-single-daily-pep-talk",
      featureKey: "ai_pep_talks",
      userId: auth.userId,
    });
    await costGuardrails.enforceAccess({
      capabilities: ["text", "tts"],
      providers: ["openai", "elevenlabs"],
    });

    const { theme, usedFallbackTheme } = selectThemeForDate(resolvedMentorSlug, themeAnchorDate);
    if (usedFallbackTheme) {
      console.warn(`Using fallback pep talk theme for mentor: ${resolvedMentorSlug}`);
    }

    console.log(`Selected theme for ${resolvedMentorSlug}:`, theme);

    // Fetch mentor details
    const { data: mentor, error: mentorError } = await supabase
      .from('graceward_guides')
      .select('*')
      .eq('slug', resolvedMentorSlug)
      .maybeSingle();

    if (mentorError) {
      return buildErrorResponse(500, "Failed to fetch mentor", { code: "MENTOR_FETCH_FAILED" });
    }

    if (!mentor) {
      return buildErrorResponse(404, `Mentor not found: ${resolvedMentorSlug}`, { code: "MENTOR_NOT_FOUND" });
    }

    const markGenerationFailed = async (errorMessage: string) => {
      if (!idempotencyStarted || !idempotencySupabase) return;
      await completePepTalkGenerationRequestBestEffort({
        supabase: idempotencySupabase,
        requestKey: idempotencyRequestKey,
        status: "failed",
        errorMessage,
      });
    };

    const failGeneration = async (response: Response, errorMessage: string): Promise<Response> => {
      await markGenerationFailed(errorMessage);
      return response;
    };

    const responseForPayload = (payload: Record<string, unknown>, status = 200) =>
      new Response(
        JSON.stringify(payload),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );

    const requestKey = forceRegenerate
      ? `${buildPepTalkRequestKey(resolvedMentorSlug, todayDate)}:force:${crypto.randomUUID()}`
      : buildPepTalkRequestKey(resolvedMentorSlug, todayDate);
    let idempotencyState = await beginPepTalkGenerationRequest({
      supabase,
      requestKey,
      mentorSlug: resolvedMentorSlug,
      forDate: todayDate,
      userId: auth.userId,
    });

    if (idempotencyState.action === "completed") {
      if (await isReplayPepTalkPayloadUsable(idempotencyState.responsePayload)) {
        return responseForPayload({
          ...idempotencyState.responsePayload,
          idempotencyReplay: true,
        });
      }

      await completePepTalkGenerationRequestBestEffort({
        supabase,
        requestKey: idempotencyState.requestKey,
        status: "failed",
        errorMessage: "Completed replay audio URL was unavailable",
      });
      idempotencyState = await beginPepTalkGenerationRequest({
        supabase,
        requestKey,
        mentorSlug: resolvedMentorSlug,
        forDate: todayDate,
        userId: auth.userId,
      });
    }

    if (idempotencyState.action === "completed") {
      if (await isReplayPepTalkPayloadUsable(idempotencyState.responsePayload)) {
        return responseForPayload({
          ...idempotencyState.responsePayload,
          idempotencyReplay: true,
        });
      }

      console.warn("[PepTalkIdempotency] Completed replay remained unusable after restart attempt; continuing with database uniqueness only", {
        requestKey: idempotencyState.requestKey,
      });
      idempotencyState = { action: "disabled", requestKey: null };
    }

    if (idempotencyState.action === "in_progress") {
      return buildErrorResponse(
        PEP_TALK_REQUEST_IN_PROGRESS_STATUS,
        "Pep talk generation is already in progress.",
        { code: "PEP_TALK_REQUEST_IN_PROGRESS" },
      );
    }

    if (idempotencyState.action === "started") {
      idempotencyRequestKey = idempotencyState.requestKey;
      idempotencyStarted = true;
    }

    // Generate pep talk using existing function via direct fetch (edge-to-edge call)
    console.log(`Calling generate-full-mentor-audio for ${resolvedMentorSlug}...`);
    
    const audioResponse = await invokeInternalFunction("generate-full-mentor-audio", {
      mentorSlug: resolvedMentorSlug,
      topic_category: theme.topic_category,
      intensity: theme.intensity,
      emotionalTriggers: theme.triggers,
    });

    if (!audioResponse.ok) {
      const upstreamRaw = await audioResponse.text();
      const upstreamError = parseUpstreamError(upstreamRaw);
      console.error('Error generating audio:', audioResponse.status, upstreamRaw);

      return await failGeneration(
        buildErrorResponse(
          audioResponse.status,
          "Failed to prepare pep talk audio",
          {
            code: "AUDIO_PIPELINE_FAILED",
            upstreamStatus: audioResponse.status,
            upstreamError,
          },
        ),
        upstreamError ?? `Audio pipeline failed with status ${audioResponse.status}`,
      );
    }

    let generatedData: Record<string, unknown>;
    try {
      generatedData = await audioResponse.json() as Record<string, unknown>;
    } catch {
      return await failGeneration(
        buildErrorResponse(502, "Invalid response from audio generation pipeline", {
          code: "AUDIO_PIPELINE_INVALID_RESPONSE",
        }),
        "Invalid response from audio generation pipeline",
      );
    }

    const script = typeof generatedData.script === "string" ? generatedData.script : null;
    const audioUrl = typeof generatedData.audioUrl === "string" ? generatedData.audioUrl : null;
    const audioStoragePath = typeof generatedData.audioStoragePath === "string"
      ? generatedData.audioStoragePath
      : typeof generatedData.storagePath === "string"
        ? generatedData.storagePath
        : null;
    const audioProvider = typeof generatedData.audioProvider === "string"
      ? generatedData.audioProvider
      : null;
    const transcript = Array.isArray(generatedData.transcript)
      ? generatedData.transcript
      : [];
    const hasWordTimestamps = transcript.length > 0;
    
    if (!script || !audioUrl) {
      return await failGeneration(
        buildErrorResponse(502, "Incomplete generation response", {
          code: "AUDIO_PIPELINE_INCOMPLETE_RESPONSE",
        }),
        "Incomplete generation response",
      );
    }

    // Generate title and summary
    const title = getDailyEncouragementTitle(theme.topic_category);
    const summary = getDailyEncouragementSummary(theme.topic_category);

    console.log(`Generated content for ${resolvedMentorSlug}: ${title}`);

    const dailyPepTalkPayload = {
      mentor_slug: resolvedMentorSlug,
      topic_category: theme.topic_category,
      emotional_triggers: theme.triggers,
      intensity: theme.intensity,
      title,
      summary,
      script,
      audio_url: audioUrl,
      for_date: todayDate,
      transcript,
      transcript_status: hasWordTimestamps ? "ready" : TRANSCRIPT_STATUS_PENDING,
      transcript_attempt_count: 0,
      transcript_next_retry_at: hasWordTimestamps ? null : new Date().toISOString(),
      transcript_ready_at: hasWordTimestamps ? new Date().toISOString() : null,
      transcript_last_error: null,
    };

    const dailyPepTalkWrite = existing && forceRegenerate
      ? await supabase
        .from('daily_pep_talks')
        .update(dailyPepTalkPayload)
        .eq('id', existing.id)
        .select()
        .single()
      : await supabase
        .from('daily_pep_talks')
        .insert(dailyPepTalkPayload)
        .select()
        .single();

    const dailyPepTalk = dailyPepTalkWrite.data;
    const dailyInsertError = dailyPepTalkWrite.error;

    if (dailyInsertError) {
      console.error('Error writing daily pep talk:', dailyInsertError);

      if (isUniqueViolation(dailyInsertError)) {
        const { data: existingAfterConflict, error: conflictFetchError } = await supabase
          .from('daily_pep_talks')
          .select('*')
          .eq('mentor_slug', resolvedMentorSlug)
          .eq('for_date', todayDate)
          .maybeSingle();

        if (!conflictFetchError && existingAfterConflict) {
          const responsePayload = { pepTalk: existingAfterConflict, status: 'existing' };
          await completePepTalkGenerationRequestBestEffort({
            supabase,
            requestKey: idempotencyRequestKey,
            status: "completed",
            responsePayload,
          });
          return responseForPayload(responsePayload);
        }
      }

      return await failGeneration(
        buildErrorResponse(500, "Failed to save pep talk", { code: "DAILY_PEP_TALK_INSERT_FAILED" }),
        dailyInsertError.message ?? "Failed to save pep talk",
      );
    }

    const generationResponsePayload = {
      pepTalk: dailyPepTalk,
      status: existing && forceRegenerate ? 'regenerated' : 'generated',
      audioStoragePath,
      audioProvider,
    };

    await completePepTalkGenerationRequestBestEffort({
      supabase,
      requestKey: idempotencyRequestKey,
      status: "completed",
      responsePayload: generationResponsePayload,
    });

    // Also insert into main pep_talks library
    const { error: libraryInsertError } = await supabase
      .from('pep_talks')
      .insert({
        title,
        description: summary,
        quote: script.substring(0, 200) + '...',
        audio_url: audioUrl,
        category: theme.topic_category,
        topic_category: [theme.topic_category],
        emotional_triggers: theme.triggers,
        intensity: theme.intensity,
        mentor_slug: resolvedMentorSlug,
        mentor_id: mentor.id,
        source: 'user_generated',
        for_date: todayDate,
        is_featured: false,
        is_premium: false,
        transcript,
      });
    if (libraryInsertError) {
      console.error("Error inserting pep talk into library (non-blocking):", libraryInsertError);
    }

    const currentAttemptCount = dailyPepTalk.transcript_attempt_count ?? 0;
    const persistTranscriptState = async (payload: Record<string, unknown>) => {
      const { error } = await supabase
        .from('daily_pep_talks')
        .update(payload)
        .eq('id', dailyPepTalk.id);

      if (error) {
        console.error(`Failed to persist transcript state for ${dailyPepTalk.id}:`, error);
      }
    };

    // ElevenLabs returns exact timing alongside new audio. Older/fallback audio
    // still enters the repair path below.
    if (!hasWordTimestamps) try {
      console.log(`Syncing transcript for daily pep talk ${dailyPepTalk.id}...`);
      const syncResponse = await invokeInternalFunction("sync-daily-pep-talk-transcript", {
        id: dailyPepTalk.id,
      });
      const syncRaw = await syncResponse.text();
      const syncData = syncRaw.length > 0 ? JSON.parse(syncRaw) : null;

      if (!syncResponse.ok) {
        const summary = await summarizeFunctionInvokeError(new Error(syncRaw || `HTTP ${syncResponse.status}`));
        console.error(`Transcript sync failed for ${dailyPepTalk.id}:`, summary);
        const retryState = buildRetryTranscriptState({
          currentAttemptCount,
          errorMessage: typeof summary.body === "string" ? summary.body : summary.message,
        });
        await persistTranscriptState(retryState.update);
      } else {
        const syncPayload = (syncData && typeof syncData === "object")
          ? syncData as Record<string, unknown>
          : {};
        const parsedPayload = parseTranscriptSyncPayload(syncPayload);
        const libraryRowsUpdated =
          typeof syncPayload.libraryRowsUpdated === "number" ? syncPayload.libraryRowsUpdated : 0;
        const warning = typeof syncPayload.warning === "string" ? syncPayload.warning : null;

        if (parsedPayload.hasWordTimestamps && parsedPayload.wordCount > 0) {
          await persistTranscriptState(buildReadyTranscriptState(currentAttemptCount));
        } else {
          const retryState = buildRetryTranscriptState({
            currentAttemptCount,
            errorMessage:
              parsedPayload.error ??
              warning ??
              "Transcription returned no word-level timestamps",
          });
          await persistTranscriptState(retryState.update);
        }

        console.log(`✓ Transcript synced for ${dailyPepTalk.id}`, {
          updated: syncPayload.updated === true,
          hasWordTimestamps: parsedPayload.hasWordTimestamps,
          wordCount: parsedPayload.wordCount,
          retryRecommended: parsedPayload.retryRecommended,
          transcriptChanged: syncPayload.transcriptChanged === true,
          libraryUpdated: syncPayload.libraryUpdated === true,
          libraryRowsUpdated,
          warning,
        });
      }
    } catch (syncError) {
      const summary = await summarizeFunctionInvokeError(syncError);
      console.error(`Transcript sync threw for ${dailyPepTalk.id}:`, summary);
      const retryState = buildRetryTranscriptState({
        currentAttemptCount,
        errorMessage: typeof summary.body === "string" ? summary.body : summary.message,
      });
      await persistTranscriptState(retryState.update);
      // Keep pep talk generation successful even when transcript sync fails.
    }

    console.log(`✓ Successfully generated daily pep talk for ${resolvedMentorSlug}`);

    return new Response(
      JSON.stringify(generationResponsePayload),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }
    if (idempotencyStarted && idempotencySupabase) {
      await completePepTalkGenerationRequestBestEffort({
        supabase: idempotencySupabase,
        requestKey: idempotencyRequestKey,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
    console.error('Error in generate-single-daily-pep-talk:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return buildErrorResponse(500, errorMessage, { code: "INTERNAL_ERROR" });
  }
});
