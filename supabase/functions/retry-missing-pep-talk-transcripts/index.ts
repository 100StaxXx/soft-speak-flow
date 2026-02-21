import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireRequestAuth } from "../_shared/auth.ts";
import { summarizeFunctionInvokeError } from "../_shared/functionInvokeError.ts";
import {
  TRANSCRIPT_STATUS_PENDING,
  TRANSCRIPT_STATUS_PROCESSING,
  type TranscriptRetryStateUpdate,
} from "../_shared/transcriptRetryState.ts";
import { decideTranscriptRetryOutcome } from "./workerLogic.ts";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const DEFAULT_LOOKBACK_DAYS = 30;
const MAX_ATTEMPTS = 12;

type RunMode = "scheduled" | "backfill";

interface TranscriptRetryRequestBody {
  limit?: number;
  lookbackDays?: number;
  mode?: RunMode;
}

function normalizeLimit(input: unknown): number {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(input)));
}

function normalizeLookbackDays(input: unknown): number {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return DEFAULT_LOOKBACK_DAYS;
  }
  return Math.max(1, Math.floor(input));
}

function normalizeMode(input: unknown): RunMode {
  return input === "backfill" ? "backfill" : "scheduled";
}

function toISODateDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function applyTranscriptUpdate(
  supabase: any,
  id: string,
  update: TranscriptRetryStateUpdate,
): Promise<boolean> {
  const { error } = await supabase
    .from("daily_pep_talks")
    .update(update)
    .eq("id", id)
    .eq("transcript_status", TRANSCRIPT_STATUS_PROCESSING);

  if (!error) {
    return true;
  }

  console.error(`Failed to persist transcript status for ${id}:`, error);

  // Safety net: avoid rows getting stuck in processing on update failures.
  const fallback = {
    transcript_status: TRANSCRIPT_STATUS_PENDING,
    transcript_next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    transcript_last_error: `State persistence error: ${error.message ?? "unknown"}`,
    transcript_last_attempt_at: new Date().toISOString(),
  };
  await supabase
    .from("daily_pep_talks")
    .update(fallback)
    .eq("id", id);

  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await requireRequestAuth(req, corsHeaders);
    if (auth instanceof Response) {
      return auth;
    }

    if (!auth.isServiceRole) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({})) as TranscriptRetryRequestBody;
    const limit = normalizeLimit(body.limit);
    const lookbackDays = normalizeLookbackDays(body.lookbackDays);
    const mode = normalizeMode(body.mode);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Backend configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey) as any;

    let backfillQueued = 0;
    if (mode === "backfill") {
      const lookbackDate = toISODateDaysAgo(lookbackDays);
      const { data: failedRows, error: failedRowsError } = await supabase
        .from("daily_pep_talks")
        .select("id")
        .eq("transcript_status", "failed")
        .gte("for_date", lookbackDate)
        .order("for_date", { ascending: false })
        .limit(limit);

      if (failedRowsError) {
        throw failedRowsError;
      }

      const failedIds = (failedRows ?? [])
        .map((row: { id?: unknown }) => row.id)
        .filter((id: unknown): id is string => typeof id === "string");
      backfillQueued = failedIds.length;

      if (failedIds.length > 0) {
        const { error: promoteError } = await supabase
          .from("daily_pep_talks")
          .update({
            transcript_status: TRANSCRIPT_STATUS_PENDING,
            transcript_attempt_count: 0,
            transcript_next_retry_at: new Date().toISOString(),
            transcript_last_error: null,
            transcript_ready_at: null,
          })
          .in("id", failedIds);

        if (promoteError) {
          throw promoteError;
        }
      }
    }

    const nowIso = new Date().toISOString();
    const { data: candidates, error: candidatesError } = await supabase
      .from("daily_pep_talks")
      .select("id, transcript_attempt_count")
      .eq("transcript_status", TRANSCRIPT_STATUS_PENDING)
      .lte("transcript_next_retry_at", nowIso)
      .order("transcript_next_retry_at", { ascending: true })
      .limit(limit);

    if (candidatesError) {
      throw candidatesError;
    }

    let scanned = (candidates ?? []).length;
    let attempted = 0;
    let ready = 0;
    let retried = 0;
    let failed = 0;
    let skipped = 0;
    let nextRetryQueued = 0;

    for (const candidate of candidates ?? []) {
      const pepTalkId = typeof candidate.id === "string" ? candidate.id : null;
      if (!pepTalkId) {
        skipped += 1;
        continue;
      }

      const { data: claimedRow, error: claimError } = await supabase
        .from("daily_pep_talks")
        .update({
          transcript_status: TRANSCRIPT_STATUS_PROCESSING,
          transcript_last_attempt_at: new Date().toISOString(),
        })
        .eq("id", pepTalkId)
        .eq("transcript_status", TRANSCRIPT_STATUS_PENDING)
        .select("id, transcript_attempt_count")
        .maybeSingle();

      if (claimError) {
        console.error(`Failed to claim transcript retry row ${pepTalkId}:`, claimError);
        skipped += 1;
        continue;
      }

      if (!claimedRow) {
        skipped += 1;
        continue;
      }

      attempted += 1;
      const currentAttemptCount =
        typeof claimedRow.transcript_attempt_count === "number"
          ? claimedRow.transcript_attempt_count
          : 0;

      let syncPayload: unknown = null;
      let syncErrorMessage: string | null = null;

      try {
        const { data, error } = await supabase.functions.invoke("sync-daily-pep-talk-transcript", {
          body: { id: pepTalkId },
        });
        syncPayload = data;

        if (error) {
          const summary = await summarizeFunctionInvokeError(error);
          syncErrorMessage = typeof summary === "string" ? summary : "Transcript sync invocation returned an error";
        }
      } catch (error) {
        const summary = await summarizeFunctionInvokeError(error);
        syncErrorMessage = typeof summary === "string" ? summary : "Transcript sync invocation failed";
      }

      const decision = decideTranscriptRetryOutcome({
        currentAttemptCount,
        syncPayload,
        syncErrorMessage,
        maxAttempts: MAX_ATTEMPTS,
      });

      const stateApplied = await applyTranscriptUpdate(supabase, pepTalkId, decision.update);
      if (!stateApplied) {
        skipped += 1;
        continue;
      }

      if (decision.outcome === "ready") {
        ready += 1;
      } else if (decision.outcome === "failed") {
        failed += 1;
      } else {
        retried += 1;
        nextRetryQueued += 1;
      }
    }

    const response = {
      scanned,
      attempted,
      ready,
      retried,
      failed,
      skipped,
      nextRetryQueued,
      backfillQueued,
      mode,
      lookbackDays: mode === "backfill" ? lookbackDays : null,
      limit,
    };

    console.log("retry-missing-pep-talk-transcripts summary", response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("retry-missing-pep-talk-transcripts error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
