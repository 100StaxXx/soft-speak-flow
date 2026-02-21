import { summarizeFunctionInvokeError } from "../_shared/functionInvokeError.ts";
import {
  buildReadyTranscriptState,
  buildRetryTranscriptState,
  parseTranscriptSyncPayload,
  TRANSCRIPT_STATUS_PENDING,
} from "../_shared/transcriptRetryState.ts";

export interface TranscriptSyncLog {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

interface DailyInsertResult {
  data: { id: string; transcript_attempt_count: number | null } | null;
  error: { message?: string } | null;
}

export interface SupabaseLikeClient {
  from: (table: string) => {
    insert: (payload: Record<string, unknown>) => {
      select: (columns?: string) => {
        single: () => Promise<DailyInsertResult>;
      };
    };
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>;
    };
  };
  functions: {
    invoke: (
      fnName: string,
      options: { body: { id: string } },
    ) => Promise<{ data: unknown; error: unknown }>;
  };
}

export interface InsertTomorrowDailyPepTalkArgs {
  supabase: SupabaseLikeClient;
  insertPayload: Record<string, unknown>;
  mentorSlug: string;
  logger: TranscriptSyncLog;
  beforeSync?: (dailyPepTalkId: string) => Promise<void>;
}

export interface InsertTomorrowDailyPepTalkResult {
  dailyPepTalkId: string;
  transcriptSyncAttempted: boolean;
  transcriptSyncError: unknown | null;
  transcriptSyncData: Record<string, unknown> | null;
}

export async function insertTomorrowDailyPepTalkAndSync({
  supabase,
  insertPayload,
  mentorSlug,
  logger,
  beforeSync,
}: InsertTomorrowDailyPepTalkArgs): Promise<InsertTomorrowDailyPepTalkResult> {
  const initialInsertPayload = {
    transcript_status: TRANSCRIPT_STATUS_PENDING,
    transcript_attempt_count: 0,
    transcript_next_retry_at: new Date().toISOString(),
    ...insertPayload,
  };

  const { data: dailyPepTalk, error: insertError } = await supabase
    .from("daily_pep_talks")
    .insert(initialInsertPayload)
    .select("id, transcript_attempt_count")
    .single();

  if (insertError || !dailyPepTalk?.id) {
    throw new Error(insertError?.message || `Failed to insert daily pep talk for ${mentorSlug}`);
  }

  if (beforeSync) {
    await beforeSync(dailyPepTalk.id);
  }

  const currentAttemptCount = dailyPepTalk.transcript_attempt_count ?? 0;
  const persistTranscriptState = async (payload: Record<string, unknown>) => {
    const { error } = await supabase
      .from("daily_pep_talks")
      .update(payload)
      .eq("id", dailyPepTalk.id);

    if (error) {
      logger.error(`Failed to persist transcript state for ${mentorSlug}:`, error.message ?? error);
    }
  };

  try {
    const { data: syncData, error: syncError } = await supabase.functions.invoke(
      "sync-daily-pep-talk-transcript",
      {
        body: { id: dailyPepTalk.id },
      },
    );

    const syncPayload = (syncData && typeof syncData === "object")
      ? syncData as Record<string, unknown>
      : null;

    if (syncError) {
      const summary = await summarizeFunctionInvokeError(syncError);
      logger.warn(`Transcript sync returned error for ${mentorSlug}:`, summary);
      const retryState = buildRetryTranscriptState({
        currentAttemptCount,
        errorMessage: typeof summary === "string" ? summary : "Transcript sync returned error",
      });
      await persistTranscriptState(retryState.update);
      return {
        dailyPepTalkId: dailyPepTalk.id,
        transcriptSyncAttempted: true,
        transcriptSyncError: syncError,
        transcriptSyncData: syncPayload,
      };
    }

    const libraryRowsUpdated =
      syncPayload && typeof syncPayload.libraryRowsUpdated === "number"
        ? syncPayload.libraryRowsUpdated
        : 0;
    const warning =
      syncPayload && typeof syncPayload.warning === "string"
        ? syncPayload.warning
        : null;
    const parsedPayload = parseTranscriptSyncPayload(syncPayload);

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

    logger.log(`✓ Transcript synced for ${mentorSlug}`, {
      updated: syncPayload?.updated === true,
      hasWordTimestamps: parsedPayload.hasWordTimestamps,
      wordCount: parsedPayload.wordCount,
      retryRecommended: parsedPayload.retryRecommended,
      transcriptChanged: syncPayload?.transcriptChanged === true,
      libraryUpdated: syncPayload?.libraryUpdated === true,
      libraryRowsUpdated,
      warning,
    });

    return {
      dailyPepTalkId: dailyPepTalk.id,
      transcriptSyncAttempted: true,
      transcriptSyncError: null,
      transcriptSyncData: syncPayload,
    };
  } catch (syncError) {
    const summary = await summarizeFunctionInvokeError(syncError);
    logger.error(`Failed to sync transcript for ${mentorSlug}:`, summary);
    const retryState = buildRetryTranscriptState({
      currentAttemptCount,
      errorMessage: typeof summary === "string" ? summary : "Failed to sync transcript",
    });
    await persistTranscriptState(retryState.update);
    return {
      dailyPepTalkId: dailyPepTalk.id,
      transcriptSyncAttempted: true,
      transcriptSyncError: syncError,
      transcriptSyncData: null,
    };
  }
}
