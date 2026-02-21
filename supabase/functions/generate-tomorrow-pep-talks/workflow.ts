import { summarizeFunctionInvokeError } from "../_shared/functionInvokeError.ts";

export interface TranscriptSyncLog {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

interface DailyInsertResult {
  data: { id: string } | null;
  error: { message?: string } | null;
}

export interface SupabaseLikeClient {
  from: (table: string) => {
    insert: (payload: Record<string, unknown>) => {
      select: (columns?: string) => {
        single: () => Promise<DailyInsertResult>;
      };
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
  const { data: dailyPepTalk, error: insertError } = await supabase
    .from("daily_pep_talks")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertError || !dailyPepTalk?.id) {
    throw new Error(insertError?.message || `Failed to insert daily pep talk for ${mentorSlug}`);
  }

  if (beforeSync) {
    await beforeSync(dailyPepTalk.id);
  }

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

    logger.log(`✓ Transcript synced for ${mentorSlug}`, {
      updated: syncPayload?.updated === true,
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
    return {
      dailyPepTalkId: dailyPepTalk.id,
      transcriptSyncAttempted: true,
      transcriptSyncError: syncError,
      transcriptSyncData: null,
    };
  }
}
