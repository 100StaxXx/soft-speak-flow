import {
  buildReadyTranscriptState,
  buildRetryTranscriptState,
  type TranscriptRetryStateUpdate,
  parseTranscriptSyncPayload,
} from "../_shared/transcriptRetryState.ts";

export type TranscriptRetryOutcome = "ready" | "retried" | "failed";

export interface TranscriptRetryDecision {
  outcome: TranscriptRetryOutcome;
  update: TranscriptRetryStateUpdate;
  reason: string;
}

export interface DecideTranscriptRetryOutcomeInput {
  currentAttemptCount: number;
  syncPayload?: unknown;
  syncErrorMessage?: string | null;
  now?: Date;
  maxAttempts?: number;
}

export function decideTranscriptRetryOutcome(
  input: DecideTranscriptRetryOutcomeInput,
): TranscriptRetryDecision {
  const now = input.now ?? new Date();
  const syncErrorMessage = input.syncErrorMessage?.trim() ?? "";

  if (syncErrorMessage.length > 0) {
    const retryState = buildRetryTranscriptState({
      currentAttemptCount: input.currentAttemptCount,
      errorMessage: syncErrorMessage,
      now,
      maxAttempts: input.maxAttempts,
    });

    return {
      outcome: retryState.exhausted ? "failed" : "retried",
      update: retryState.update,
      reason: syncErrorMessage,
    };
  }

  const parsed = parseTranscriptSyncPayload(input.syncPayload);
  if (parsed.hasWordTimestamps && parsed.wordCount > 0) {
    return {
      outcome: "ready",
      update: buildReadyTranscriptState(input.currentAttemptCount, now),
      reason: "Word-level transcript timestamps created",
    };
  }

  const retryState = buildRetryTranscriptState({
    currentAttemptCount: input.currentAttemptCount,
    errorMessage:
      parsed.error ??
      parsed.warning ??
      "Transcription returned no word-level timestamps",
    now,
    maxAttempts: input.maxAttempts,
  });

  return {
    outcome: retryState.exhausted ? "failed" : "retried",
    update: retryState.update,
    reason: parsed.warning ?? parsed.error ?? "Missing word-level timestamps",
  };
}
