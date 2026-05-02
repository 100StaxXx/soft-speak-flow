import { describe, expect, it } from "vitest";

import {
  COMPANION_PLANNER_QUEST_CAPTURE_OPENING,
  COMPANION_PLANNER_SURFACE_ACTIONS,
  createCompanionPlannerQuestCaptureLaunchIntent,
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
    expect(createCompanionPlannerQuestCaptureLaunchIntent()).toEqual({
      id: expect.any(String),
      message: COMPANION_PLANNER_QUEST_CAPTURE_OPENING,
      starterIntent: "quest_capture",
      target: "planner",
      briefingContext: null,
    });
  });
});
