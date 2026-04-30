import { describe, expect, it } from "vitest";

import {
  buildCompanionCosmiqTitle,
  buildCompanionCosmiqTitleCardProfileKey,
} from "./companionStatCosmiqTitles";
import type {
  CompanionStatAttribute,
  CompanionStatNeed,
  CompanionStatProfileSummary,
} from "./companionStatSignals";

const statNeeds: Record<CompanionStatAttribute, CompanionStatNeed> = {
  vitality: { level: "medium", reasons: ["Vitality could use a steadier recent signal."] },
  wisdom: { level: "low", reasons: [] },
  discipline: { level: "low", reasons: [] },
  resolve: { level: "low", reasons: [] },
  creativity: { level: "high", reasons: ["Creativity has not had a recent tracked push."] },
  alignment: { level: "low", reasons: [] },
};

const buildBreakdowns = (scores: CompanionStatProfileSummary["scores"]) =>
  Object.entries(scores).map(([attribute, score]) => ({
    attribute: attribute as CompanionStatAttribute,
    score,
    band: score <= 299
      ? "Emerging" as const
      : score <= 499
        ? "Building" as const
        : score <= 699
          ? "Strong" as const
          : "Exceptional" as const,
    status: "status",
    primaryReasons: ["reason"],
    recentDrivers: [],
  }));

describe("companionStatCosmiqTitles", () => {
  it("uses approved fusion titles when the top two stats are close", () => {
    const statProfile: CompanionStatProfileSummary = {
      scores: {
        vitality: 360,
        wisdom: 680,
        discipline: 430,
        resolve: 390,
        creativity: 660,
        alignment: 620,
      },
      dominantStat: "wisdom",
      secondaryStat: "creativity",
    };

    const title = buildCompanionCosmiqTitle({
      statProfile,
      statNeeds,
      statBreakdowns: buildBreakdowns(statProfile.scores),
      momentumState: "locked_in",
      recentExpression: { wisdom: 8, creativity: 7 },
      activityMetrics: {
        activeDays7: 6,
        completionRate7: 0.78,
        currentStreak: 8,
        epicLinkedCompletions: 1,
        totalRecentExpression: 30,
      },
    });

    expect(title.title).toBe("The Reality Weaver");
    expect(title.rarity).toBe("epic");
    expect(title.momentum).toBe("rising");
    expect(title.fusion).toBe(true);
  });

  it("activity-gates rarity below a score-only ceiling", () => {
    const statProfile: CompanionStatProfileSummary = {
      scores: {
        vitality: 390,
        wisdom: 420,
        discipline: 505,
        resolve: 510,
        creativity: 300,
        alignment: 470,
      },
      dominantStat: "resolve",
      secondaryStat: "discipline",
    };

    const title = buildCompanionCosmiqTitle({
      statProfile,
      statNeeds,
      statBreakdowns: buildBreakdowns(statProfile.scores),
      momentumState: "coasting",
      recentExpression: { resolve: 3, discipline: 3 },
      activityMetrics: {
        activeDays7: 5,
        completionRate7: 0.6,
        currentStreak: 2,
        epicLinkedCompletions: 0,
        totalRecentExpression: 16,
      },
    });

    expect(title.title).toBe("The Unbroken Sentinel");
    expect(title.rarity).toBe("rare");
    expect(title.fusion).toBe(true);
  });

  it("builds a rebalance path from the highest-need stat", () => {
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

    const title = buildCompanionCosmiqTitle({
      statProfile,
      statNeeds,
      statBreakdowns: buildBreakdowns(statProfile.scores),
      momentumState: "coasting",
      activityMetrics: { activeDays7: 4, completionRate7: 0.67 },
    });

    expect(title.rebalanceStat).toBe("creativity");
    expect(title.rebalancePath).toContain("Strengthen Creativity");
    expect(title.titleStability).toBe("new");
  });

  it("keeps non-slipping momentum out of title selection", () => {
    const statProfile: CompanionStatProfileSummary = {
      scores: {
        vitality: 420,
        wisdom: 380,
        discipline: 360,
        resolve: 340,
        creativity: 320,
        alignment: 300,
      },
      dominantStat: "vitality",
      secondaryStat: "wisdom",
    };
    const sharedInput = {
      statProfile,
      statNeeds,
      statBreakdowns: buildBreakdowns(statProfile.scores),
      activityMetrics: {
        activeDays7: 4,
        completionRate7: 0.67,
        currentStreak: 6,
        epicLinkedCompletions: 0,
        totalRecentExpression: 18,
      },
    };

    const rising = buildCompanionCosmiqTitle({
      ...sharedInput,
      momentumState: "locked_in",
    });
    const steady = buildCompanionCosmiqTitle({
      ...sharedInput,
      momentumState: "coasting",
    });
    const recovering = buildCompanionCosmiqTitle({
      ...sharedInput,
      momentumState: "rebuilding",
    });

    expect(rising.momentum).toBe("rising");
    expect(steady.momentum).toBe("steady");
    expect(recovering.momentum).toBe("recovering");
    expect(rising.title).toBe(steady.title);
    expect(recovering.title).toBe(steady.title);
  });

  it("uses slipping titles before fusion", () => {
    const statProfile: CompanionStatProfileSummary = {
      scores: {
        vitality: 390,
        wisdom: 420,
        discipline: 505,
        resolve: 510,
        creativity: 300,
        alignment: 470,
      },
      dominantStat: "resolve",
      secondaryStat: "discipline",
    };

    const title = buildCompanionCosmiqTitle({
      statProfile,
      statNeeds,
      statBreakdowns: buildBreakdowns(statProfile.scores),
      momentumState: "slipping",
      recentExpression: { resolve: 3, discipline: 3 },
      activityMetrics: {
        activeDays7: 5,
        completionRate7: 0.6,
        currentStreak: 2,
        epicLinkedCompletions: 0,
        totalRecentExpression: 16,
      },
    });

    expect(title.momentum).toBe("slipping");
    expect(title.title).toBe("The Sleeping Titan");
    expect(title.fusion).toBe(false);
  });

  it("marks held titles as evolving near the next gate", () => {
    const statProfile: CompanionStatProfileSummary = {
      scores: {
        vitality: 475,
        wisdom: 430,
        discipline: 410,
        resolve: 390,
        creativity: 360,
        alignment: 350,
      },
      dominantStat: "vitality",
      secondaryStat: "wisdom",
    };

    const first = buildCompanionCosmiqTitle({
      statProfile,
      statNeeds,
      statBreakdowns: buildBreakdowns(statProfile.scores),
      momentumState: "coasting",
      activityMetrics: { activeDays7: 4, completionRate7: 0.67 },
    });
    const next = buildCompanionCosmiqTitle({
      statProfile,
      statNeeds,
      statBreakdowns: buildBreakdowns(statProfile.scores),
      momentumState: "coasting",
      activityMetrics: { activeDays7: 4, completionRate7: 0.67 },
      previousTitle: first,
    });

    expect(next.title).toBe(first.title);
    expect(next.titleStability).toBe("evolving");
  });

  it("keeps shared card keys free of exact scores and dates", () => {
    const statProfile: CompanionStatProfileSummary = {
      scores: {
        vitality: 720,
        wisdom: 440,
        discipline: 690,
        resolve: 610,
        creativity: 380,
        alignment: 510,
      },
      dominantStat: "vitality",
      secondaryStat: "discipline",
    };
    const cosmiqTitle = buildCompanionCosmiqTitle({
      statProfile,
      statNeeds,
      statBreakdowns: buildBreakdowns(statProfile.scores),
      momentumState: "locked_in",
      activityMetrics: {
        activeDays7: 7,
        completionRate7: 0.9,
        currentStreak: 30,
        epicLinkedCompletions: 2,
        totalRecentExpression: 32,
      },
    });

    const key = buildCompanionCosmiqTitleCardProfileKey({
      cosmiqTitle,
      statBreakdowns: buildBreakdowns(statProfile.scores),
      promptVersion: 1,
    });

    expect(key).toContain("radiant-vanguard");
    expect(key).not.toContain("720");
    expect(key).not.toContain("2026");
  });

  it("keeps shared card keys stable across non-slipping momentum changes", () => {
    const statProfile: CompanionStatProfileSummary = {
      scores: {
        vitality: 420,
        wisdom: 380,
        discipline: 360,
        resolve: 340,
        creativity: 320,
        alignment: 300,
      },
      dominantStat: "vitality",
      secondaryStat: "wisdom",
    };
    const sharedInput = {
      statProfile,
      statNeeds,
      statBreakdowns: buildBreakdowns(statProfile.scores),
      activityMetrics: {
        activeDays7: 4,
        completionRate7: 0.67,
        currentStreak: 6,
        epicLinkedCompletions: 0,
        totalRecentExpression: 18,
      },
    };
    const rising = buildCompanionCosmiqTitle({
      ...sharedInput,
      momentumState: "locked_in",
    });
    const steady = buildCompanionCosmiqTitle({
      ...sharedInput,
      momentumState: "coasting",
    });

    const risingKey = buildCompanionCosmiqTitleCardProfileKey({
      cosmiqTitle: rising,
      statBreakdowns: buildBreakdowns(statProfile.scores),
      promptVersion: 1,
    });
    const steadyKey = buildCompanionCosmiqTitleCardProfileKey({
      cosmiqTitle: steady,
      statBreakdowns: buildBreakdowns(statProfile.scores),
      promptVersion: 1,
    });

    expect(risingKey).toBe(steadyKey);
    expect(risingKey).not.toContain("rising");
    expect(steadyKey).not.toContain("steady");
  });
});
