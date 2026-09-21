import { describe, expect, it } from "vitest";

import {
  COMPANION_LIFE_STAGE_PROFILES,
  getCompanionInteractionZone,
  getCompanionLifeStageProfile,
  getCompanionSpeciesMotionProfile,
  selectCompanionIdleAction,
} from "@/config/companionLife";

describe("Graceward companion life system", () => {
  it("gives every visual stage a distinct world chapter and growing behavior set", () => {
    expect(COMPANION_LIFE_STAGE_PROFILES).toHaveLength(8);
    expect(new Set(COMPANION_LIFE_STAGE_PROFILES.map((profile) => profile.chapterTitle))).toHaveLength(8);

    for (let index = 1; index < COMPANION_LIFE_STAGE_PROFILES.length; index += 1) {
      expect(COMPANION_LIFE_STAGE_PROFILES[index].unlockedBehaviors.length).toBeGreaterThanOrEqual(
        COMPANION_LIFE_STAGE_PROFILES[index - 1].unlockedBehaviors.length,
      );
    }

    expect(getCompanionLifeStageProfile(0).chapterTitle).toBe("The Quiet Spark");
    expect(getCompanionLifeStageProfile(5).chapterTitle).toBe("The Listening Path");
    expect(getCompanionLifeStageProfile(81).chapterTitle).toBe("The Everward Horizon");
  });

  it("keeps species signatures distinct", () => {
    expect(getCompanionSpeciesMotionProfile(null, "Lamb").signatureActionLabel).toBe("Trusting nuzzle");
    expect(getCompanionSpeciesMotionProfile(null, "Dove").signatureActionLabel).toBe("Peaceful wing");
    expect(getCompanionSpeciesMotionProfile(null, "Eagle").signatureActionLabel).toBe("High-country mantle");
    expect(getCompanionSpeciesMotionProfile(null, "Stag").signatureActionLabel).toBe("Still-water bow");
    expect(getCompanionSpeciesMotionProfile(null, "Wolf").signatureActionLabel).toBe("Faithful call");
    expect(getCompanionSpeciesMotionProfile(null, "Lion").signatureActionLabel).toBe("Courage stance");
    expect(getCompanionSpeciesMotionProfile("phoenix").signatureActionLabel).toBe("Feather flare");
    expect(getCompanionSpeciesMotionProfile("buttercat").signatureActionLabel).toBe("Happy knead");
    expect(getCompanionSpeciesMotionProfile(null, "kitsune").signatureActionLabel).toBe("Tail flourish");
  });

  it("maps portrait coordinates into useful touch zones", () => {
    expect(getCompanionInteractionZone({ x: 0.5, y: 0.25 })).toBe("head");
    expect(getCompanionInteractionZone({ x: 0.5, y: 0.68 })).toBe("heart");
    expect(getCompanionInteractionZone({ x: 0.08, y: 0.7 })).toBe("side");
  });

  it("only chooses idle actions already unlocked at the current stage", () => {
    for (let sequence = 0; sequence < 20; sequence += 1) {
      expect(getCompanionLifeStageProfile(1).unlockedBehaviors).toContain(
        selectCompanionIdleAction({ stage: 1, sequence }),
      );
      expect(getCompanionLifeStageProfile(56).unlockedBehaviors).toContain(
        selectCompanionIdleAction({ stage: 56, sequence }),
      );
    }
  });
});
