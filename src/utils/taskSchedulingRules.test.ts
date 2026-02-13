import { describe, expect, it } from "vitest";
import { normalizeTaskSchedulingState, normalizeTaskSchedulingUpdate } from "./taskSchedulingRules";

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

  it("strips time from inbox tasks", () => {
    const normalized = normalizeTaskSchedulingState({
      task_date: null,
      scheduled_time: "09:00",
      habit_source_id: null,
      source: "manual",
    });

    expect(normalized.task_date).toBeNull();
    expect(normalized.scheduled_time).toBeNull();
    expect(normalized.strippedScheduledTime).toBe(true);
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

