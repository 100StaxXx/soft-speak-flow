import { describe, expect, it } from "vitest";
import {
  CREATE_QUEST_SUBSTEP_ORDER,
  computeGuidedPanelPlacement,
  safeCompletedSteps,
} from "./TutorialOrchestrator";

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

describe("computeGuidedPanelPlacement", () => {
  const base = {
    panelWidth: 320,
    panelHeight: 180,
    viewportWidth: 390,
    viewportHeight: 844,
  };

  it("places the panel below when target is near the top", () => {
    const result = computeGuidedPanelPlacement({
      ...base,
      targetRect: {
        top: 40,
        left: 100,
        right: 200,
        bottom: 92,
        width: 100,
        height: 52,
      },
      preferredZones: ["bottom", "top", "right", "left"],
    });

    expect(result.zone).toBe("bottom");
    expect(result.lockEnabled).toBe(true);
  });

  it("places the panel above when target is near the bottom", () => {
    const result = computeGuidedPanelPlacement({
      ...base,
      targetRect: {
        top: 700,
        left: 120,
        right: 230,
        bottom: 760,
        width: 110,
        height: 60,
      },
      preferredZones: ["top", "bottom", "left", "right"],
    });

    expect(result.zone).toBe("top");
    expect(result.lockEnabled).toBe(true);
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
