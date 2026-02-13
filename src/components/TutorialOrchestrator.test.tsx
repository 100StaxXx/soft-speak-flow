import { describe, expect, it } from "vitest";
import { safeCompletedSteps } from "./TutorialOrchestrator";

describe("safeCompletedSteps", () => {
  it("returns only valid guided step ids", () => {
    const result = safeCompletedSteps([
      "create_quest",
      "invalid-step",
      "morning_checkin",
      42,
      null,
    ]);

    expect(result).toEqual(["create_quest", "morning_checkin"]);
  });

  it("returns an empty array for malformed values", () => {
    expect(safeCompletedSteps(undefined)).toEqual([]);
    expect(safeCompletedSteps("create_quest")).toEqual([]);
    expect(safeCompletedSteps({ completedSteps: ["create_quest"] })).toEqual([]);
    expect(safeCompletedSteps(null)).toEqual([]);
  });
});
