export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

export interface LibraryTranscriptRow {
  id: string;
  transcript: unknown;
}

export interface TranscriptSyncPlanInput {
  currentScript: string | null | undefined;
  currentTranscript: unknown;
  transcribedText: string;
  transcribedTranscript: unknown;
  libraryRows: LibraryTranscriptRow[];
}

export interface TranscriptSyncPlan {
  nextScript: string;
  nextTranscript: TranscriptWord[];
  hasWordTimestamps: boolean;
  wordCount: number;
  retryRecommended: boolean;
  scriptChanged: boolean;
  transcriptChanged: boolean;
  updated: boolean;
  libraryIdsToUpdate: string[];
  warning?: string;
}

export interface TranscriptSyncFailurePayload {
  error: string;
  details: string;
  hasWordTimestamps: false;
  wordCount: 0;
  retryRecommended: true;
  updated: false;
  scriptChanged: false;
  transcriptChanged: false;
  libraryUpdated: false;
  libraryRowsUpdated: 0;
  upstreamStatus: number;
}

const EMPTY_TIMESTAMPS_WARNING =
  "Transcription returned no word timestamps; preserved existing transcript.";

export function normalizeTranscript(input: unknown): TranscriptWord[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((word): word is TranscriptWord => {
      if (!word || typeof word !== "object") {
        return false;
      }

      const candidate = word as { word?: unknown; start?: unknown; end?: unknown };
      return (
        typeof candidate.word === "string" &&
        typeof candidate.start === "number" &&
        Number.isFinite(candidate.start) &&
        typeof candidate.end === "number" &&
        Number.isFinite(candidate.end)
      );
    })
    .map((word) => ({
      word: word.word,
      start: word.start,
      end: word.end,
    }));
}

export function transcriptsEqual(a: TranscriptWord[], b: TranscriptWord[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((word, index) => {
    const other = b[index];
    return (
      word.word === other.word &&
      word.start === other.start &&
      word.end === other.end
    );
  });
}

export function buildTranscriptSyncPlan(input: TranscriptSyncPlanInput): TranscriptSyncPlan {
  const currentText = input.currentScript ?? "";
  const nextScript = input.transcribedText;
  const scriptChanged = currentText.trim() !== nextScript.trim();

  const currentTranscript = normalizeTranscript(input.currentTranscript);
  const transcribedTranscript = normalizeTranscript(input.transcribedTranscript);
  const wordCount = transcribedTranscript.length;
  const hasWordTimestamps = wordCount > 0;
  const retryRecommended = !hasWordTimestamps;

  let nextTranscript = transcribedTranscript;
  let warning: string | undefined;

  // Guard against erasing a good transcript when upstream text exists but timestamps are missing.
  if (transcribedTranscript.length === 0 && currentTranscript.length > 0) {
    nextTranscript = currentTranscript;
    warning = EMPTY_TIMESTAMPS_WARNING;
  }

  const transcriptChanged = !transcriptsEqual(currentTranscript, nextTranscript);
  const updated = scriptChanged || transcriptChanged;

  // Never push empty transcript arrays into library rows.
  const canSyncLibraryTranscript = nextTranscript.length > 0;
  const libraryIdsToUpdate = canSyncLibraryTranscript
    ? input.libraryRows
      .filter((row) => !transcriptsEqual(normalizeTranscript(row.transcript), nextTranscript))
      .map((row) => row.id)
    : [];

  return {
    nextScript,
    nextTranscript,
    hasWordTimestamps,
    wordCount,
    retryRecommended,
    scriptChanged,
    transcriptChanged,
    updated,
    libraryIdsToUpdate,
    warning,
  };
}

export function buildTranscriptionFailurePayload(
  details: string,
  upstreamStatus: number,
): TranscriptSyncFailurePayload {
  return {
    error: "Transcription failed",
    details,
    hasWordTimestamps: false,
    wordCount: 0,
    retryRecommended: true,
    updated: false,
    scriptChanged: false,
    transcriptChanged: false,
    libraryUpdated: false,
    libraryRowsUpdated: 0,
    upstreamStatus,
  };
}
