import { describe, expect, it } from "vitest";

import {
  buildCompanionStatAnalysisPreludeCardImageUrl,
  COMPANION_STAT_ANALYSIS_PRELUDE_CARD_PATH_PREFIX,
  COMPANION_STAT_ANALYSIS_PRELUDE_CARDS,
} from "./companionStatAnalysisPreludeCards";

describe("companionStatAnalysisPreludeCards", () => {
  it("ships exactly 10 reusable prelude cards", () => {
    expect(COMPANION_STAT_ANALYSIS_PRELUDE_CARDS).toHaveLength(10);
  });

  it("uses unique stable ids and non-empty display fields", () => {
    const ids = new Set<string>();
    const storagePaths = new Set<string>();

    for (const card of COMPANION_STAT_ANALYSIS_PRELUDE_CARDS) {
      expect(card.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(ids.has(card.id)).toBe(false);
      expect(card.title.trim()).not.toBe("");
      expect(card.description.trim()).not.toBe("");
      expect(card.imageStoragePath).toBe(`${COMPANION_STAT_ANALYSIS_PRELUDE_CARD_PATH_PREFIX}/${card.id}.png`);
      expect(storagePaths.has(card.imageStoragePath)).toBe(false);
      expect(buildCompanionStatAnalysisPreludeCardImageUrl(card, "https://example.supabase.co")).toBe(
        `https://example.supabase.co/storage/v1/object/public/cosmiq-title-cards/${card.imageStoragePath}`,
      );
      ids.add(card.id);
      storagePaths.add(card.imageStoragePath);
    }
  });

  it("uses the locked title archetype order", () => {
    expect(COMPANION_STAT_ANALYSIS_PRELUDE_CARDS.map((card) => card.title)).toEqual([
      "The Wandering Seeker",
      "The Verdant Guardian",
      "The Astral Scholar",
      "The Iron Vanguard",
      "The Unbroken Sentinel",
      "The Reality Weaver",
      "The Soulforged Creator",
      "The Inner Oracle",
      "The Storm-Breaker",
      "The Cosmic Harmonizer",
    ]);
  });

  it("keeps the copy generic and free of personalization placeholders", () => {
    const forbiddenCopy = /\{|\}|companionName|mentorName|cosmiqTitle|dominantStat|secondaryStat|rebalanceStat/i;

    for (const card of COMPANION_STAT_ANALYSIS_PRELUDE_CARDS) {
      expect(`${card.title} ${card.description}`).not.toMatch(forbiddenCopy);
    }
  });
});
