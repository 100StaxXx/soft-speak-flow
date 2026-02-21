import { describe, expect, it } from "vitest";
import { decideTranscriptRetryOutcome } from "../../supabase/functions/retry-missing-pep-talk-transcripts/workerLogic";

describe("decideTranscriptRetryOutcome", () => {
  it("marks a pending row ready when word timestamps are present", () => {
    const decision = decideTranscriptRetryOutcome({
      currentAttemptCount: 2,
      syncPayload: {
        hasWordTimestamps: true,
        wordCount: 18,
      },
      now: new Date("2026-02-21T12:00:00.000Z"),
    });

    expect(decision.outcome).toBe("ready");
    expect(decision.update.transcript_status).toBe("ready");
    expect(decision.update.transcript_ready_at).toBe("2026-02-21T12:00:00.000Z");
    expect(decision.update.transcript_next_retry_at).toBeNull();
  });

  it("queues another retry with backoff on transient sync failure", () => {
    const decision = decideTranscriptRetryOutcome({
      currentAttemptCount: 1,
      syncErrorMessage: "HTTP 502 from sync-daily-pep-talk-transcript",
      now: new Date("2026-02-21T12:00:00.000Z"),
    });

    expect(decision.outcome).toBe("retried");
    expect(decision.update.transcript_status).toBe("pending");
    expect(decision.update.transcript_attempt_count).toBe(2);
    expect(decision.update.transcript_next_retry_at).toBe("2026-02-21T12:20:00.000Z");
    expect(decision.update.transcript_last_error).toContain("HTTP 502");
  });

  it("marks row failed after max attempts are exhausted", () => {
    const decision = decideTranscriptRetryOutcome({
      currentAttemptCount: 11,
      syncPayload: {
        hasWordTimestamps: false,
        wordCount: 0,
        retryRecommended: true,
      },
      now: new Date("2026-02-21T12:00:00.000Z"),
      maxAttempts: 12,
    });

    expect(decision.outcome).toBe("failed");
    expect(decision.update.transcript_status).toBe("failed");
    expect(decision.update.transcript_attempt_count).toBe(12);
    expect(decision.update.transcript_next_retry_at).toBeNull();
    expect(decision.update.transcript_last_error).toContain("no word-level timestamps");
  });
});
