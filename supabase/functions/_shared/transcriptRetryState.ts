export const TRANSCRIPT_STATUS_PENDING = "pending";
export const TRANSCRIPT_STATUS_PROCESSING = "processing";
export const TRANSCRIPT_STATUS_READY = "ready";
export const TRANSCRIPT_STATUS_FAILED = "failed";

export type TranscriptStatus =
  | typeof TRANSCRIPT_STATUS_PENDING
  | typeof TRANSCRIPT_STATUS_PROCESSING
  | typeof TRANSCRIPT_STATUS_READY
  | typeof TRANSCRIPT_STATUS_FAILED;

export const DEFAULT_TRANSCRIPT_MAX_ATTEMPTS = 12;
const DEFAULT_TRANSCRIPT_RETRY_BASE_MS = 10 * 60 * 1000;
const DEFAULT_TRANSCRIPT_RETRY_MAX_MS = 6 * 60 * 60 * 1000;

export interface ParsedTranscriptSyncPayload {
  hasWordTimestamps: boolean;
  wordCount: number;
  retryRecommended: boolean;
  warning: string | null;
  error: string | null;
}

export interface TranscriptRetryStateUpdate {
  [key: string]: unknown;
  transcript_status: TranscriptStatus;
  transcript_attempt_count: number;
  transcript_next_retry_at: string | null;
  transcript_last_attempt_at: string;
  transcript_last_error: string | null;
  transcript_ready_at: string | null;
}

export interface BuildRetryStateResult {
  update: TranscriptRetryStateUpdate;
  exhausted: boolean;
}

function getObjectValue(payload: unknown, key: string): unknown {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  return (payload as Record<string, unknown>)[key];
}

export function parseTranscriptSyncPayload(payload: unknown): ParsedTranscriptSyncPayload {
  const explicitWordCount = getObjectValue(payload, "wordCount");
  const transcript = getObjectValue(payload, "transcript");
  const transcriptCount = Array.isArray(transcript) ? transcript.length : 0;

  const wordCount =
    typeof explicitWordCount === "number" && Number.isFinite(explicitWordCount) && explicitWordCount >= 0
      ? Math.floor(explicitWordCount)
      : transcriptCount;

  const explicitHasWordTimestamps = getObjectValue(payload, "hasWordTimestamps");
  const hasWordTimestamps =
    typeof explicitHasWordTimestamps === "boolean"
      ? explicitHasWordTimestamps
      : wordCount > 0;

  const explicitRetryRecommended = getObjectValue(payload, "retryRecommended");
  const retryRecommended =
    typeof explicitRetryRecommended === "boolean"
      ? explicitRetryRecommended
      : !hasWordTimestamps;

  const warningValue = getObjectValue(payload, "warning");
  const warning = typeof warningValue === "string" && warningValue.length > 0 ? warningValue : null;

  const errorValue = getObjectValue(payload, "error");
  const error = typeof errorValue === "string" && errorValue.length > 0 ? errorValue : null;

  return {
    hasWordTimestamps,
    wordCount,
    retryRecommended,
    warning,
    error,
  };
}

export function getTranscriptRetryDelayMs(attemptCount: number): number {
  const normalizedAttempt = Math.max(1, Math.floor(attemptCount));
  const exponent = Math.max(0, normalizedAttempt - 1);
  const delay = DEFAULT_TRANSCRIPT_RETRY_BASE_MS * (2 ** exponent);
  return Math.min(DEFAULT_TRANSCRIPT_RETRY_MAX_MS, delay);
}

export function getTranscriptNextRetryAt(attemptCount: number, now = new Date()): string {
  return new Date(now.getTime() + getTranscriptRetryDelayMs(attemptCount)).toISOString();
}

export function buildReadyTranscriptState(attemptCount: number, now = new Date()): TranscriptRetryStateUpdate {
  const nowIso = now.toISOString();
  return {
    transcript_status: TRANSCRIPT_STATUS_READY,
    transcript_attempt_count: Math.max(0, Math.floor(attemptCount)),
    transcript_next_retry_at: null,
    transcript_last_attempt_at: nowIso,
    transcript_last_error: null,
    transcript_ready_at: nowIso,
  };
}

export function buildRetryTranscriptState(params: {
  currentAttemptCount: number;
  errorMessage: string;
  now?: Date;
  maxAttempts?: number;
}): BuildRetryStateResult {
  const now = params.now ?? new Date();
  const maxAttempts = params.maxAttempts ?? DEFAULT_TRANSCRIPT_MAX_ATTEMPTS;
  const nextAttemptCount = Math.max(0, Math.floor(params.currentAttemptCount)) + 1;
  const exhausted = nextAttemptCount >= maxAttempts;
  const nowIso = now.toISOString();

  return {
    exhausted,
    update: {
      transcript_status: exhausted ? TRANSCRIPT_STATUS_FAILED : TRANSCRIPT_STATUS_PENDING,
      transcript_attempt_count: nextAttemptCount,
      transcript_next_retry_at: exhausted ? null : getTranscriptNextRetryAt(nextAttemptCount, now),
      transcript_last_attempt_at: nowIso,
      transcript_last_error: params.errorMessage,
      transcript_ready_at: null,
    },
  };
}
