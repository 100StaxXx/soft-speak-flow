import { describe, expect, it } from "vitest";

import {
  COMPANION_PLANNER_SURFACE_ACTIONS,
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
      { id: "advance-campaign", message: "Continue my journey" },
      { id: "make-room", message: "Make room" },
      { id: "low-energy", message: "I'm low energy" },
      { id: "what-matters", message: "What matters most?" },
      { id: "upcoming", message: "What do I have coming up?" },
      { id: "goal", message: "Let's lock in a new goal" },
    ]);
  });
});
