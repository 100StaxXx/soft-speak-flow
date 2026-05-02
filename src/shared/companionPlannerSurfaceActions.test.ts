import { describe, expect, it } from "vitest";

import {
  COMPANION_PLANNER_QUEST_CAPTURE_OPENING,
  COMPANION_PLANNER_SURFACE_ACTIONS,
  createCompanionPlannerQuestCaptureLaunchIntent,
  createCompanionPlannerQuestCaptureOpening,
} from "@/shared/companionPlannerSurfaceActions";

describe("companion planner surface actions", () => {
  it("keeps launcher messages as short direct openers", () => {
    expect(
      COMPANION_PLANNER_SURFACE_ACTIONS.map((action) => ({
        id: action.id,
        message: action.message,
      })),
    ).toEqual([
      { id: "plan-day", message: "Plan my day" },
      { id: "prepare-tomorrow", message: "Prepare me for tomorrow" },
      { id: "advance-campaign", message: "Advance my campaign" },
      { id: "make-room", message: "Make room" },
      { id: "low-energy", message: "I'm low energy" },
      { id: "what-matters", message: "What matters most?" },
      { id: "upcoming", message: "What do I have coming up?" },
      { id: "quest", message: COMPANION_PLANNER_QUEST_CAPTURE_OPENING },
      { id: "goal", message: "Let's lock in a new goal" },
    ]);
  });

  it("builds the shared quest-capture launch intent", () => {
    expect(createCompanionPlannerQuestCaptureLaunchIntent({
      source: "companion_planner",
      companionLabel: "Nova",
    })).toEqual({
      id: expect.any(String),
      message: "Nova's ready. What quest are we capturing?",
      starterIntent: "quest_capture",
      target: "planner",
      briefingContext: null,
    });
  });

  it("personalizes quest-capture openings by source", () => {
    expect(createCompanionPlannerQuestCaptureOpening({
      source: "companion_planner",
      companionLabel: "Atlas",
    })).toBe("Atlas' ready. What quest are we capturing?");
    expect(createCompanionPlannerQuestCaptureOpening({
      source: "empty_journeys",
      dateLabel: "today",
    })).toBe("Clean slate for today. What quest should we add?");
  });

  it("carries a structural selected date when provided", () => {
    expect(createCompanionPlannerQuestCaptureLaunchIntent({
      source: "empty_journeys",
      dateLabel: "Friday, February 13",
      selectedDate: "2026-02-13",
    })).toEqual(expect.objectContaining({
      message: "Clean slate for Friday, February 13. What quest should we add?",
      selectedDate: "2026-02-13",
      starterIntent: "quest_capture",
    }));
  });
});
