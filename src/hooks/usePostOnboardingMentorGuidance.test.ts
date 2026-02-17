import { describe, expect, it } from "vitest";
import {
  CREATE_QUEST_SUBSTEP_ORDER,
  getMentorInstructionLines,
  safeCompletedSteps,
  sanitizeCreateQuestProgress,
} from "./usePostOnboardingMentorGuidance";

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

describe("create quest substep order", () => {
  it("defines deterministic substeps in strict order", () => {
    expect(CREATE_QUEST_SUBSTEP_ORDER).toEqual([
      "stay_on_quests",
      "open_add_quest",
      "select_time",
      "submit_create_quest",
    ]);
  });
});

describe("sanitizeCreateQuestProgress", () => {
  it("drops invalid substep ids and defaults current to first incomplete", () => {
    const result = sanitizeCreateQuestProgress({
      current: "invalid",
      completed: ["stay_on_quests", "invalid", "open_add_quest"],
    });

    expect(result).toEqual({
      current: "select_time",
      completed: ["stay_on_quests", "open_add_quest"],
      startedAt: undefined,
      completedAt: undefined,
    });
  });
});

describe("getMentorInstructionLines", () => {
  it("returns mentor-led instructions for each step", () => {
    expect(getMentorInstructionLines("create_quest", "open_add_quest")[0]).toContain(
      "Tap the + button"
    );
    expect(getMentorInstructionLines("meet_companion", null)[0]).toContain("Open Companion");
    expect(getMentorInstructionLines("morning_checkin", null)[0]).toContain(
      "Open Mentor and complete one Morning Check-in"
    );
  });
});

