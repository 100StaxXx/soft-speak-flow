import { describe, expect, it } from "vitest";

import {
  COSMIQ_TITLE_FLAVOR_DESCRIPTIONS,
  getCompanionCosmiqTitleFlavorDescription,
} from "./companionCosmiqTitleDescriptions";
import type {
  CompanionCosmiqTitle,
  CompanionCosmiqTitleMomentum,
  CompanionCosmiqTitleRarity,
  CompanionCosmiqTitleStability,
} from "./companionStatCosmiqTitles";
import type { CompanionStatAttribute } from "./companionStatSignals";

const KNOWN_TITLES = [
  // TITLE_POOLS base titles
  "The Waking Flame",
  "The Life-Bound Strider",
  "The Verdant Guardian",
  "The Radiant Vanguard",
  "The Curious Seeker",
  "The Pattern Reader",
  "The Astral Scholar",
  "The Celestial Sage",
  "The Promise Keeper",
  "The Iron Apprentice",
  "The Steady Sentinel",
  "The Oathbound Champion",
  "The Rising Survivor",
  "The Ember-Warden",
  "The Ironheart",
  "The Storm-Breaker",
  "The Spark Crafter",
  "The Dreamsmith",
  "The Vision Forger",
  "The Mythmaker",
  "The Inner Compass",
  "The Path Finder",
  "The Soulbound Guide",
  "The Cosmic Harmonizer",
  // Rare variants
  "Sunforged Sentinel",
  "The Blooming Titan",
  "The Dawn-Walker",
  "The Star-Eyed Oracle",
  "The Mindbound Seer",
  "Keeper of the Inner Map",
  "The Unbroken Knight",
  "The Clockwork Guardian",
  "The Iron-Willed Architect",
  "The Scarred Champion",
  "The Phoenix-Bound",
  "The Void-Walker",
  "The Starforged Creator",
  "The Painted Flame",
  "The Reality Weaver",
  "The True North",
  "The Heartbound Voyager",
  "The Purpose-Bearer",
  // Fusion titles
  "The Iron Vanguard",
  "The Storm-Hardened Titan",
  "The Clockwork Sage",
  "The Unbroken Sentinel",
  "The Soulforged Creator",
  "The Inner Oracle",
  "The Oathbound Pathfinder",
  // Slipping titles
  "The Dimmed Flame",
  "The Wandering Seeker",
  "The Restless Guardian",
  "The Sleeping Titan",
  "The Drifting Star",
];

const buildTitle = (overrides: Partial<CompanionCosmiqTitle> = {}): CompanionCosmiqTitle => ({
  title: "The Waking Flame",
  rarity: "common" as CompanionCosmiqTitleRarity,
  momentum: "steady" as CompanionCosmiqTitleMomentum,
  dominantStat: "vitality" as CompanionStatAttribute,
  secondaryStat: "discipline" as CompanionStatAttribute,
  rebalanceStat: "alignment" as CompanionStatAttribute,
  fusion: false,
  rebalancePath: "Strengthen Alignment to evolve toward The Inner Compass.",
  titleStability: "new" as CompanionCosmiqTitleStability,
  ...overrides,
});

describe("companionCosmiqTitleDescriptions", () => {
  it("provides a non-empty fantasy description for every known title", () => {
    for (const title of KNOWN_TITLES) {
      const flavor = COSMIQ_TITLE_FLAVOR_DESCRIPTIONS[title];
      expect(flavor, `missing flavor description for "${title}"`).toBeDefined();
      expect(flavor!.trim().length).toBeGreaterThan(0);
    }
  });

  it("never describes a title using rebalance / evolution language", () => {
    const recommendationCopy = /strengthen|evolve toward|rebalance/i;

    for (const [title, description] of Object.entries(COSMIQ_TITLE_FLAVOR_DESCRIPTIONS)) {
      expect(description, `"${title}" description should be fantasy flavor, not advice`).not.toMatch(
        recommendationCopy,
      );
    }
  });

  it("returns the lookup entry verbatim for a known title", () => {
    const cosmiqTitle = buildTitle({ title: "The Iron Vanguard" });
    expect(getCompanionCosmiqTitleFlavorDescription(cosmiqTitle)).toBe(
      "A front-line force carrying discipline, vitality, and brave momentum.",
    );
  });

  it("returns a fallback description for an unknown title", () => {
    const cosmiqTitle = buildTitle({ title: "Some Brand New Archetype" });
    const result = getCompanionCosmiqTitleFlavorDescription(cosmiqTitle);
    expect(result.trim().length).toBeGreaterThan(0);
    expect(result).not.toMatch(/strengthen|evolve toward/i);
  });
});
