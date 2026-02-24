import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeTaskSchedulingState, normalizeTaskSchedulingUpdate } from "./taskSchedulingRules";

afterEach(() => {
  vi.useRealTimers();
});

describe("taskSchedulingRules", () => {
  it("moves regular dated/no-time tasks to inbox", () => {
    const normalized = normalizeTaskSchedulingState({
      task_date: "2026-02-13",
      scheduled_time: null,
      habit_source_id: null,
      source: "manual",
    });

    expect(normalized.task_date).toBeNull();
    expect(normalized.scheduled_time).toBeNull();
    expect(normalized.source).toBe("inbox");
    expect(normalized.normalizedToInbox).toBe(true);
  });

  it("keeps habit-linked dated/no-time tasks as-is", () => {
    const normalized = normalizeTaskSchedulingState({
      task_date: "2026-02-13",
      scheduled_time: null,
      habit_source_id: "habit-1",
      source: "recurring",
    });

    expect(normalized.task_date).toBe("2026-02-13");
    expect(normalized.scheduled_time).toBeNull();
    expect(normalized.source).toBe("recurring");
    expect(normalized.normalizedToInbox).toBe(false);
  });

  it("promotes timed inbox tasks to today's scheduled quests", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-24T10:15:00"));

    const normalized = normalizeTaskSchedulingState({
      task_date: null,
      scheduled_time: "09:00",
      habit_source_id: null,
      source: "inbox",
    });

    expect(normalized.task_date).toBe("2026-02-24");
    expect(normalized.scheduled_time).toBe("09:00");
    expect(normalized.source).toBe("manual");
    expect(normalized.movedFromInboxToScheduled).toBe(true);
    expect(normalized.strippedScheduledTime).toBe(false);
  });

  it("normalizes updates against existing task state", () => {
    const normalized = normalizeTaskSchedulingUpdate(
      {
        task_date: "2026-02-13",
        scheduled_time: "09:00",
        habit_source_id: null,
        source: "manual",
      },
      {
        scheduled_time: null,
      },
    );

    expect(normalized.task_date).toBeNull();
    expect(normalized.source).toBe("inbox");
    expect(normalized.normalizedToInbox).toBe(true);
  });
});
