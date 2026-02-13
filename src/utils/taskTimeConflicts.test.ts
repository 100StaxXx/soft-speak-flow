import { describe, expect, it } from "vitest";
import {
  buildTaskConflictMap,
  detectTaskTimeConflicts,
  getTaskConflictCount,
  getTaskConflictSetForTask,
} from "./taskTimeConflicts";

describe("taskTimeConflicts", () => {
  it("returns no conflicts when tasks do not overlap", () => {
    const conflicts = detectTaskTimeConflicts([
      { id: "a", scheduled_time: "09:00", estimated_duration: 30 },
      { id: "b", scheduled_time: "10:00", estimated_duration: 30 },
    ]);

    expect(conflicts).toEqual([]);
  });

  it("detects a single overlap", () => {
    const conflicts = detectTaskTimeConflicts([
      { id: "a", scheduled_time: "09:00", estimated_duration: 60 },
      { id: "b", scheduled_time: "09:30", estimated_duration: 30 },
    ]);

    expect(conflicts).toEqual([
      expect.objectContaining({
        taskAId: "a",
        taskBId: "b",
        overlapMinutes: 30,
      }),
    ]);
  });

  it("detects multiple overlaps and builds per-task map", () => {
    const tasks = [
      { id: "a", scheduled_time: "09:00", estimated_duration: 90 },
      { id: "b", scheduled_time: "09:30", estimated_duration: 45 },
      { id: "c", scheduled_time: "10:00", estimated_duration: 30 },
    ];

    const conflicts = detectTaskTimeConflicts(tasks);
    const conflictMap = buildTaskConflictMap(tasks);

    expect(conflicts).toHaveLength(3);
    expect(conflictMap.get("a")?.size).toBe(2);
    expect(conflictMap.get("b")?.size).toBe(2);
    expect(conflictMap.get("c")?.size).toBe(2);
    expect(getTaskConflictCount("b", tasks)).toBe(2);
  });

  it("falls back to 30 minute duration when missing", () => {
    const conflicts = detectTaskTimeConflicts([
      { id: "a", scheduled_time: "09:00", estimated_duration: null },
      { id: "b", scheduled_time: "09:20", estimated_duration: null },
    ]);

    expect(conflicts).toEqual([
      expect.objectContaining({
        taskAId: "a",
        taskBId: "b",
        overlapMinutes: 10,
      }),
    ]);
  });

  it("supports scheduled time overrides (preview drag)", () => {
    const tasks = [
      { id: "a", scheduled_time: "09:00", estimated_duration: 30 },
      { id: "b", scheduled_time: "10:00", estimated_duration: 30 },
    ];

    const conflicts = detectTaskTimeConflicts(tasks, { b: "09:20" });
    expect(conflicts).toHaveLength(1);
    expect(getTaskConflictCount("b", tasks, { b: "09:20" })).toBe(1);
  });

  it("returns overlap ids for a specific task efficiently", () => {
    const tasks = [
      { id: "a", scheduled_time: "09:00", estimated_duration: 60 },
      { id: "b", scheduled_time: "09:30", estimated_duration: 30 },
      { id: "c", scheduled_time: "10:30", estimated_duration: 30 },
    ];

    const overlapIds = getTaskConflictSetForTask("a", tasks);
    expect(overlapIds.has("b")).toBe(true);
    expect(overlapIds.has("c")).toBe(false);
    expect(overlapIds.size).toBe(1);
  });
});
