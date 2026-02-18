import { describe, expect, it } from "vitest";
import {
  CREATE_QUEST_SUBSTEP_ORDER,
  getMentorInstructionLines,
  safeCompletedSteps,
  sanitizeCreateQuestProgress,
  shouldRestoreTutorialRoute,
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
      "enter_title",
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
      current: "enter_title",
      completed: ["stay_on_quests", "open_add_quest"],
      startedAt: undefined,
      completedAt: undefined,
    });
  });
});

describe("getMentorInstructionLines", () => {
  it("returns mentor-led instructions for each step", () => {
    expect(getMentorInstructionLines("create_quest", "open_add_quest")[0]).toContain(
      "Tap the + in the bottom right"
    );
    expect(getMentorInstructionLines("create_quest", "enter_title")[0]).toContain(
      "Type your quest title"
    );
    expect(getMentorInstructionLines("meet_companion", null)[0]).toContain("Open Companion");
    expect(getMentorInstructionLines("morning_checkin", null)[0]).toContain("Head to Mentor");
  });
});

describe("shouldRestoreTutorialRoute", () => {
  it("returns true when current path is a main tab and differs from the active step route", () => {
    expect(
      shouldRestoreTutorialRoute({
        pathname: "/journeys",
        stepRoute: "/mentor",
        tutorialReady: true,
        tutorialComplete: false,
      })
    ).toBe(true);
  });

  it("returns true for root path mismatch", () => {
    expect(
      shouldRestoreTutorialRoute({
        pathname: "/",
        stepRoute: "/companion",
        tutorialReady: true,
        tutorialComplete: false,
      })
    ).toBe(true);
  });

  it("returns false when already on the correct step route", () => {
    expect(
      shouldRestoreTutorialRoute({
        pathname: "/mentor",
        stepRoute: "/mentor",
        tutorialReady: true,
        tutorialComplete: false,
      })
    ).toBe(false);
  });

  it("returns false for non-main-tab routes", () => {
    expect(
      shouldRestoreTutorialRoute({
        pathname: "/profile",
        stepRoute: "/mentor",
        tutorialReady: true,
        tutorialComplete: false,
      })
    ).toBe(false);
  });

  it("returns false when tutorial is not ready or already complete", () => {
    expect(
      shouldRestoreTutorialRoute({
        pathname: "/journeys",
        stepRoute: "/mentor",
        tutorialReady: false,
        tutorialComplete: false,
      })
    ).toBe(false);

    expect(
      shouldRestoreTutorialRoute({
        pathname: "/journeys",
        stepRoute: "/mentor",
        tutorialReady: true,
        tutorialComplete: true,
      })
    ).toBe(false);
  });
});
