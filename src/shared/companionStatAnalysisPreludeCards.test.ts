import { describe, expect, it } from "vitest";

import { COMPANION_STAT_ANALYSIS_PRELUDE_CARDS } from "./companionStatAnalysisPreludeCards";

describe("companionStatAnalysisPreludeCards", () => {
  it("ships exactly 10 reusable prelude cards", () => {
    expect(COMPANION_STAT_ANALYSIS_PRELUDE_CARDS).toHaveLength(10);
  });

  it("uses unique stable ids and non-empty display fields", () => {
    const ids = new Set<string>();

    for (const card of COMPANION_STAT_ANALYSIS_PRELUDE_CARDS) {
      expect(card.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(ids.has(card.id)).toBe(false);
      expect(card.title.trim()).not.toBe("");
      expect(card.description.trim()).not.toBe("");
      ids.add(card.id);
    }
  });

  it("keeps the copy generic and free of personalization placeholders", () => {
    const forbiddenCopy = /\{|\}|companionName|mentorName|cosmiqTitle|dominantStat|secondaryStat|rebalanceStat/i;

    for (const card of COMPANION_STAT_ANALYSIS_PRELUDE_CARDS) {
      expect(`${card.title} ${card.description}`).not.toMatch(forbiddenCopy);
    }
  });
});
