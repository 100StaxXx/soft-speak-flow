import { describe, expect, it, vi } from "vitest";
import { insertTomorrowDailyPepTalkAndSync } from "../../supabase/functions/generate-tomorrow-pep-talks/workflow";

function createMockSupabase() {
  const single = vi.fn().mockResolvedValue({
    data: { id: "daily-123", transcript_attempt_count: 0 },
    error: null,
  });
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq: updateEq }));
  const from = vi.fn(() => ({ insert, update }));
  const invoke = vi.fn();

  return {
    supabase: {
      from,
      functions: { invoke },
    },
    spies: { from, insert, select, single, update, updateEq, invoke },
  };
}

function createLogger() {
  return {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("insertTomorrowDailyPepTalkAndSync", () => {
  it("invokes transcript sync only after daily insert succeeds", async () => {
    const { supabase, spies } = createMockSupabase();
    spies.invoke.mockResolvedValue({
      data: { updated: true, libraryUpdated: true, libraryRowsUpdated: 1 },
      error: null,
    });
    const logger = createLogger();
    const beforeSync = vi.fn().mockResolvedValue(undefined);

    const result = await insertTomorrowDailyPepTalkAndSync({
      supabase,
      mentorSlug: "atlas",
      logger,
      beforeSync,
      insertPayload: { mentor_slug: "atlas", for_date: "2026-02-21" },
    });

    expect(spies.from).toHaveBeenCalledWith("daily_pep_talks");
    expect(spies.insert).toHaveBeenCalledWith(expect.objectContaining({
      mentor_slug: "atlas",
      for_date: "2026-02-21",
      transcript_status: "pending",
      transcript_attempt_count: 0,
    }));
    expect(beforeSync).toHaveBeenCalledWith("daily-123");
    expect(spies.invoke).toHaveBeenCalledWith("sync-daily-pep-talk-transcript", {
      body: { id: "daily-123" },
    });
    expect(spies.update).toHaveBeenCalled();
    expect(spies.updateEq).toHaveBeenCalledWith("id", "daily-123");
    expect(spies.insert.mock.invocationCallOrder[0]).toBeLessThan(beforeSync.mock.invocationCallOrder[0]);
    expect(beforeSync.mock.invocationCallOrder[0]).toBeLessThan(spies.invoke.mock.invocationCallOrder[0]);
    expect(result.dailyPepTalkId).toBe("daily-123");
    expect(result.transcriptSyncError).toBeNull();
  });

  it("keeps generation path non-blocking when transcript sync returns an error", async () => {
    const { supabase, spies } = createMockSupabase();
    spies.invoke.mockResolvedValue({
      data: null,
      error: new Error("sync failed"),
    });
    const logger = createLogger();

    const result = await insertTomorrowDailyPepTalkAndSync({
      supabase,
      mentorSlug: "atlas",
      logger,
      insertPayload: { mentor_slug: "atlas", for_date: "2026-02-21" },
    });

    expect(result.dailyPepTalkId).toBe("daily-123");
    expect(result.transcriptSyncAttempted).toBe(true);
    expect(result.transcriptSyncError).toBeInstanceOf(Error);
    expect(logger.warn).toHaveBeenCalled();
    expect(spies.update).toHaveBeenCalledWith(expect.objectContaining({
      transcript_status: "pending",
      transcript_attempt_count: 1,
      transcript_last_error: expect.stringContaining("returned error"),
    }));
    expect(spies.updateEq).toHaveBeenCalledWith("id", "daily-123");
  });

  it("marks transcript ready when sync returns word timestamps", async () => {
    const { supabase, spies } = createMockSupabase();
    spies.invoke.mockResolvedValue({
      data: {
        updated: true,
        hasWordTimestamps: true,
        wordCount: 14,
        retryRecommended: false,
      },
      error: null,
    });
    const logger = createLogger();

    await insertTomorrowDailyPepTalkAndSync({
      supabase,
      mentorSlug: "atlas",
      logger,
      insertPayload: { mentor_slug: "atlas", for_date: "2026-02-21" },
    });

    expect(spies.update).toHaveBeenCalledWith(expect.objectContaining({
      transcript_status: "ready",
      transcript_attempt_count: 0,
      transcript_next_retry_at: null,
      transcript_last_error: null,
    }));
  });
});
