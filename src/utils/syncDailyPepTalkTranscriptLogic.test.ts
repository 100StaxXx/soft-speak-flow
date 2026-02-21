import { describe, expect, it } from "vitest";
import {
  buildTranscriptSyncPlan,
  buildTranscriptionFailurePayload,
} from "../../supabase/functions/sync-daily-pep-talk-transcript/syncLogic";

describe("buildTranscriptSyncPlan", () => {
  it("plans daily + library updates when transcript changes", () => {
    const plan = buildTranscriptSyncPlan({
      currentScript: "Old script",
      currentTranscript: [{ word: "old", start: 0, end: 0.3 }],
      transcribedText: "New script",
      transcribedTranscript: [{ word: "new", start: 0, end: 0.4 }],
      libraryRows: [
        { id: "library-1", transcript: [{ word: "old", start: 0, end: 0.3 }] },
        { id: "library-2", transcript: [{ word: "new", start: 0, end: 0.4 }] },
      ],
    });

    expect(plan.updated).toBe(true);
    expect(plan.scriptChanged).toBe(true);
    expect(plan.transcriptChanged).toBe(true);
    expect(plan.hasWordTimestamps).toBe(true);
    expect(plan.wordCount).toBe(1);
    expect(plan.retryRecommended).toBe(false);
    expect(plan.nextTranscript).toEqual([{ word: "new", start: 0, end: 0.4 }]);
    expect(plan.libraryIdsToUpdate).toEqual(["library-1"]);
    expect(plan.warning).toBeUndefined();
  });

  it("preserves existing transcript when upstream timestamps are empty", () => {
    const existingTranscript = [{ word: "kept", start: 0, end: 0.5 }];
    const plan = buildTranscriptSyncPlan({
      currentScript: "Existing script",
      currentTranscript: existingTranscript,
      transcribedText: "Existing script",
      transcribedTranscript: [],
      libraryRows: [{ id: "library-1", transcript: [] }],
    });

    expect(plan.transcriptChanged).toBe(false);
    expect(plan.hasWordTimestamps).toBe(false);
    expect(plan.wordCount).toBe(0);
    expect(plan.retryRecommended).toBe(true);
    expect(plan.nextTranscript).toEqual(existingTranscript);
    expect(plan.libraryIdsToUpdate).toEqual(["library-1"]);
    expect(plan.warning).toContain("no word timestamps");
  });
});

describe("buildTranscriptionFailurePayload", () => {
  it("returns non-blocking transcript sync error payload fields", () => {
    const payload = buildTranscriptionFailurePayload("upstream down", 502);

    expect(payload).toEqual({
      error: "Transcription failed",
      details: "upstream down",
      hasWordTimestamps: false,
      wordCount: 0,
      retryRecommended: true,
      updated: false,
      scriptChanged: false,
      transcriptChanged: false,
      libraryUpdated: false,
      libraryRowsUpdated: 0,
      upstreamStatus: 502,
    });
  });
});
