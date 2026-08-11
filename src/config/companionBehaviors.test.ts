import { describe, expect, it } from "vitest";
import {
  COMPANION_BEHAVIORS,
  getCompanionAmbientBehavior,
  getCompanionInteractionMoment,
  getCompanionInteractionPrompt,
  getCompanionStageSignatureBehavior,
} from "./companionBehaviors";

describe("companion behaviors", () => {
  it("gives every visual form a distinct signature behavior", () => {
    expect([
      getCompanionStageSignatureBehavior(0),
      getCompanionStageSignatureBehavior(1),
      getCompanionStageSignatureBehavior(5),
      getCompanionStageSignatureBehavior(13),
      getCompanionStageSignatureBehavior(21),
      getCompanionStageSignatureBehavior(36),
      getCompanionStageSignatureBehavior(56),
      getCompanionStageSignatureBehavior(81),
    ]).toEqual([
      "egg_wobble",
      "hatchling_hop",
      "initiate_pounce",
      "awakened_flare",
      "guardian_guard",
      "champion_victory",
      "mythic_levitate",
      "ascended_phase",
    ]);
  });

  it("mixes quiet ambient behavior with periodic stage signatures", () => {
    expect(getCompanionAmbientBehavior({ level: 21, hour: 12, cycle: 1 })).toBe("ambient_glance");
    expect(getCompanionAmbientBehavior({ level: 21, hour: 12, cycle: 4 })).toBe("guardian_guard");
    expect(getCompanionAmbientBehavior({ level: 21, hour: 23, cycle: 3 })).toBe("ambient_doze");
  });

  it("provides one safe three-choice daily prompt for every stage", () => {
    [0, 1, 5, 13, 21, 36, 56, 81].forEach((level) => {
      const prompt = getCompanionInteractionPrompt(level);
      expect(prompt.question.length).toBeGreaterThan(10);
      expect(prompt.options).toHaveLength(3);
      prompt.options.forEach((option) => {
        expect(COMPANION_BEHAVIORS[option.behaviorId]).toBeDefined();
        expect(option.response).not.toMatch(/don't leave|forget me|i'm fading|abandon me/i);
      });
    });
  });

  it("turns petting and holding into distinct body language and warm copy", () => {
    const pet = getCompanionInteractionMoment({ level: 56, gesture: "pet", interactionCount: 2 });
    const hold = getCompanionInteractionMoment({ level: 56, gesture: "hold", interactionCount: 2 });

    expect(pet.behaviorId).toBe("touch_nuzzle");
    expect(hold.behaviorId).toBe("touch_eye_contact");
    expect(pet.message).not.toBe(hold.message);
  });
});
