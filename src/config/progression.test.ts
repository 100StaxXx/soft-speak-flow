import { describe, expect, it } from "vitest";

import {
  PROGRESSION_LEVEL_CAP,
  didTierChange,
  getNextProgressionLevelXp,
  getNextTierBoundary,
  getProgressPercentToNextLevel,
  getProgressionLevelDisplay,
  getProgressionTier,
  resolveProgressionLevelFromXp,
} from "./progression";

describe("progression helpers", () => {
  it("assigns tiers at every major boundary", () => {
    expect(getProgressionTier(0)).toBe("egg");
    expect(getProgressionTier(1)).toBe("hatchling");
    expect(getProgressionTier(5)).toBe("initiate");
    expect(getProgressionTier(13)).toBe("awakened");
    expect(getProgressionTier(21)).toBe("guardian");
    expect(getProgressionTier(36)).toBe("champion");
    expect(getProgressionTier(56)).toBe("mythic");
    expect(getProgressionTier(81)).toBe("ascended");
    expect(getProgressionTier(100)).toBe("ascended");
  });

  it("resolves levels from xp across early, mid, and capped ranges", () => {
    expect(resolveProgressionLevelFromXp(0)).toBe(0);
    expect(resolveProgressionLevelFromXp(10)).toBe(1);
    expect(resolveProgressionLevelFromXp(1199)).toBe(12);
    expect(resolveProgressionLevelFromXp(1200)).toBe(13);
    expect(resolveProgressionLevelFromXp(30000)).toBe(81);
    expect(resolveProgressionLevelFromXp(999999)).toBe(PROGRESSION_LEVEL_CAP);
  });

  it("returns next-level and next-tier helpers correctly", () => {
    expect(getNextProgressionLevelXp(0)).toBe(10);
    expect(getNextProgressionLevelXp(100)).toBeNull();
    expect(getNextTierBoundary(0)).toBe(1);
    expect(getNextTierBoundary(1)).toBe(5);
    expect(getNextTierBoundary(80)).toBe(81);
    expect(getNextTierBoundary(100)).toBeNull();
  });

  it("calculates progress percent to the next level", () => {
    expect(getProgressPercentToNextLevel(0, 0)).toBe(0);
    expect(getProgressPercentToNextLevel(0, 5)).toBe(50);
    expect(getProgressPercentToNextLevel(20, 3825)).toBe(50);
    expect(getProgressPercentToNextLevel(100, 38000)).toBe(100);
  });

  it("detects tier changes and formats stage labels", () => {
    expect(didTierChange(4, 5)).toBe(true);
    expect(didTierChange(5, 12)).toBe(false);
    expect(getProgressionLevelDisplay(56)).toBe("Stage 56 • Mythic");
  });
});
