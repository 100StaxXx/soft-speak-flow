import { describe, expect, it } from "vitest";
import {
  buildCompletionFeedbackDaySignals,
  getCompletionFeedbackTaskDate,
  mergeCompletionFeedbackDaySignalTasks,
} from "./completionFeedbackDaySignals";

describe("completionFeedbackDaySignals", () => {
  it("does not infer day signals without a cached task list", () => {
    expect(buildCompletionFeedbackDaySignals({
      completedTaskId: "task-1",
      tasks: undefined,
    })).toEqual({});
  });

  it("counts the just-completed task when the cached day list is empty", () => {
    expect(buildCompletionFeedbackDaySignals({
      completedTaskId: "task-1",
      tasks: [],
    })).toEqual({
      firstCompletionToday: true,
      isBuildingMomentum: false,
      isOverloaded: false,
    });
  });

  it("counts a missing completed task alongside cached day tasks", () => {
    expect(buildCompletionFeedbackDaySignals({
      completedTaskId: "inbox-task-1",
      tasks: [
        { id: "task-1", completed: true, completed_at: "2026-02-20T08:00:00.000Z" },
        { id: "task-2", completed: true, completed_at: "2026-02-20T09:00:00.000Z" },
        { id: "task-3", completed: false, completed_at: null },
        { id: "task-4", completed: false, completed_at: null },
        { id: "task-5", completed: false, completed_at: null },
        { id: "task-6", completed: false, completed_at: null },
        { id: "task-7", completed: false, completed_at: null },
      ],
    })).toEqual({
      firstCompletionToday: false,
      isBuildingMomentum: true,
      isOverloaded: true,
    });
  });

  it("dedupes planned and completed snapshots before counting day progress", () => {
    expect(buildCompletionFeedbackDaySignals({
      completedTaskId: "task-1",
      tasks: [
        { id: "task-1", completed: false, completed_at: null },
        { id: "task-1", completed: true, completed_at: "2026-02-20T08:00:00.000Z" },
        { id: "task-2", completed: true, completed_at: "2026-02-20T08:30:00.000Z" },
      ],
    })).toEqual({
      firstCompletionToday: false,
      isBuildingMomentum: false,
      isOverloaded: false,
    });
  });

  it("prefers completed duplicate signal rows when merging", () => {
    expect(mergeCompletionFeedbackDaySignalTasks([
      { id: "task-1", completed: false, completed_at: null },
      { id: "task-1", completed: true, completed_at: "2026-02-20T08:00:00.000Z" },
    ])).toEqual([
      { id: "task-1", completed: true, completed_at: "2026-02-20T08:00:00.000Z" },
    ]);
  });

  it("resolves inbox completion dates from completedAt when there is no task date", () => {
    expect(getCompletionFeedbackTaskDate(
      null,
      "2026-02-20T18:00:00.000Z",
      new Date("2026-02-21T12:00:00.000Z"),
    )).toBe("2026-02-20");
  });
});
