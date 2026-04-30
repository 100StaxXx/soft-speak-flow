import { describe, expect, it } from "vitest";

import {
  buildCompanionFantasyTitle,
  getCompanionFantasyTitleRebalanceStat,
} from "./companionStatFantasyTitles";
import type {
  CompanionStatAttribute,
  CompanionStatNeed,
  CompanionStatProfileSummary,
} from "./companionStatSignals";

const statProfile: CompanionStatProfileSummary = {
  scores: {
    vitality: 420,
    wisdom: 510,
    discipline: 560,
    resolve: 480,
    creativity: 360,
    alignment: 530,
  },
  dominantStat: "discipline",
  secondaryStat: "alignment",
};

const statNeeds: Record<CompanionStatAttribute, CompanionStatNeed> = {
  vitality: { level: "medium", reasons: ["You've been pushing output harder than recovery."] },
  wisdom: { level: "low", reasons: [] },
  discipline: { level: "low", reasons: [] },
  resolve: { level: "low", reasons: [] },
  creativity: { level: "medium", reasons: ["The week could use a little more originality and play."] },
  alignment: { level: "low", reasons: [] },
};

describe("companionStatFantasyTitles", () => {
  it("selects the same title for the same daily stat snapshot", () => {
    const input = {
      analysisDate: "2026-04-18",
      statProfile,
      statNeeds,
      momentumState: "coasting" as const,
    };

    expect(buildCompanionFantasyTitle(input)).toEqual(buildCompanionFantasyTitle(input));
  });

  it("rotates within the same stat pool as the analysis date changes", () => {
    const first = buildCompanionFantasyTitle({
      analysisDate: "2026-04-18",
      statProfile,
      statNeeds,
      momentumState: "coasting",
    });
    const next = buildCompanionFantasyTitle({
      analysisDate: "2026-04-19",
      statProfile,
      statNeeds,
      momentumState: "coasting",
    });

    expect(first.archetype).toBe("Discipline / Alignment");
    expect(next.archetype).toBe("Discipline / Alignment");
    expect(next.title).not.toBe(first.title);
  });

  it("uses dominant and secondary stats in the archetype", () => {
    const creativeTitle = buildCompanionFantasyTitle({
      analysisDate: "2026-04-18",
      statProfile: {
        ...statProfile,
        dominantStat: "creativity",
        secondaryStat: "wisdom",
      },
      statNeeds,
      momentumState: "locked_in",
    });

    expect(creativeTitle.archetype).toBe("Creativity / Wisdom");
    expect(creativeTitle.explanation).toContain("Creativity");
    expect(creativeTitle.explanation).toContain("Wisdom");
  });

  it("names the clearest rebalance stat in the explanation", () => {
    const title = buildCompanionFantasyTitle({
      analysisDate: "2026-04-18",
      statProfile,
      statNeeds,
      momentumState: "rebuilding",
    });

    expect(getCompanionFantasyTitleRebalanceStat({ statProfile, statNeeds })).toBe("creativity");
    expect(title.explanation).toContain("Creativity");
    expect(title.explanation).toContain("gentle support");
  });
});
