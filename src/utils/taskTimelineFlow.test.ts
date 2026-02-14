import { describe, expect, it } from "vitest";
import { buildTaskTimelineFlow } from "./taskTimelineFlow";

describe("taskTimelineFlow", () => {
  it("keeps non-overlapping tasks in a single lane", () => {
    const result = buildTaskTimelineFlow([
      { id: "a", scheduled_time: "09:00", estimated_duration: 30 },
      { id: "b", scheduled_time: "10:00", estimated_duration: 30 },
    ]);

    expect(result.orderedTaskIds).toEqual(["a", "b"]);
    expect(result.byTaskId.get("a")).toEqual(
      expect.objectContaining({
        laneIndex: 0,
        laneCount: 1,
        overlapCount: 0,
        gapBeforeMinutes: 0,
      }),
    );
    expect(result.byTaskId.get("b")).toEqual(
      expect.objectContaining({
        laneIndex: 0,
        laneCount: 1,
        overlapCount: 0,
        gapBeforeMinutes: 60,
      }),
    );
  });

  it("assigns overlap lanes and cluster lane counts", () => {
    const result = buildTaskTimelineFlow([
      { id: "a", scheduled_time: "09:00", estimated_duration: 90 },
      { id: "b", scheduled_time: "09:30", estimated_duration: 45 },
      { id: "c", scheduled_time: "10:00", estimated_duration: 30 },
      { id: "d", scheduled_time: "11:00", estimated_duration: 30 },
    ]);

    expect(result.byTaskId.get("a")).toEqual(
      expect.objectContaining({ laneIndex: 0, laneCount: 3, overlapCount: 2 }),
    );
    expect(result.byTaskId.get("b")).toEqual(
      expect.objectContaining({ laneIndex: 1, laneCount: 3, overlapCount: 2 }),
    );
    expect(result.byTaskId.get("c")).toEqual(
      expect.objectContaining({ laneIndex: 2, laneCount: 3, overlapCount: 2 }),
    );
    expect(result.byTaskId.get("d")).toEqual(
      expect.objectContaining({ laneIndex: 0, laneCount: 1, overlapCount: 0 }),
    );
  });

  it("applies scheduled-time overrides to ordering and lane assignment", () => {
    const tasks = [
      { id: "a", scheduled_time: "09:00", estimated_duration: 30 },
      { id: "b", scheduled_time: "10:00", estimated_duration: 60 },
      { id: "c", scheduled_time: "11:00", estimated_duration: 30 },
    ];

    const baseline = buildTaskTimelineFlow(tasks);
    expect(baseline.orderedTaskIds).toEqual(["a", "b", "c"]);
    expect(baseline.byTaskId.get("c")).toEqual(
      expect.objectContaining({ laneIndex: 0, overlapCount: 0 }),
    );

    const preview = buildTaskTimelineFlow(tasks, { c: "09:20" });
    expect(preview.orderedTaskIds).toEqual(["a", "c", "b"]);
    expect(preview.byTaskId.get("c")).toEqual(
      expect.objectContaining({ laneIndex: 1, overlapCount: 1 }),
    );
  });

  it("uses a 30-minute fallback duration when estimated duration is missing", () => {
    const result = buildTaskTimelineFlow([
      { id: "a", scheduled_time: "09:00", estimated_duration: null },
      { id: "b", scheduled_time: "09:20", estimated_duration: null },
    ]);

    expect(result.byTaskId.get("a")).toEqual(
      expect.objectContaining({
        endMinute: 570,
        laneIndex: 0,
        laneCount: 2,
        overlapCount: 1,
      }),
    );
    expect(result.byTaskId.get("b")).toEqual(
      expect.objectContaining({
        endMinute: 590,
        laneIndex: 1,
        laneCount: 2,
        overlapCount: 1,
      }),
    );
  });
});

