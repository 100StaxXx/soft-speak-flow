import { describe, expect, it } from "vitest";
import {
  selectCompanionDialogueEventFromHistory,
  selectDialogueLineCandidate,
  type DialogueHistoryEntry,
  type DialogueSelectionContext,
} from "@/lib/companionDialogueSelector";
import { getAllLinesForBucket, getLinesForToneAndBucket } from "@/config/companionDialoguePacks";

const NOW = new Date("2026-02-22T12:00:00.000Z");

const createContext = (
  overrides: Partial<DialogueSelectionContext> = {},
): DialogueSelectionContext => ({
  userId: "user-1",
  dialogueMood: "content",
  overallCare: 0.62,
  hasDormancyWarning: false,
  inactiveDays: 0,
  progressToNext: 42,
  xpToNext: 88,
  voiceStyle: "balanced",
  triggerSource: "idle",
  now: NOW,
  ...overrides,
});

const createEntry = (
  overrides: Partial<DialogueHistoryEntry> = {},
): DialogueHistoryEntry => {
  const fallbackLine = getLinesForToneAndBucket("soft", "base_greetings")[0];
  return {
    userId: "user-1",
    lineId: fallbackLine.id,
    bucketKey: fallbackLine.bucketKey,
    tonePack: fallbackLine.tonePack,
    shimmerType: "none",
    shownAt: new Date("2026-02-21T11:00:00.000Z").toISOString(),
    ...overrides,
  };
};

const runShimmerDistribution = (
  count: number,
  contextOverrides: Partial<DialogueSelectionContext> = {},
  history: DialogueHistoryEntry[] = [],
) => {
  const counts = {
    none: 0,
    green: 0,
    blue: 0,
    purple: 0,
    red: 0,
    gold: 0,
  } as Record<string, number>;

  for (let index = 0; index < count; index += 1) {
    const result = selectCompanionDialogueEventFromHistory(
      createContext({
        ...contextOverrides,
        seedKey: `seed-${index}`,
      }),
      history,
    );
    counts[result.shimmerType] += 1;
  }

  return counts;
};

const runToneDistribution = (
  count: number,
  contextOverrides: Partial<DialogueSelectionContext> = {},
) => {
  const counts = {
    soft: 0,
    playful: 0,
    witty_sassy: 0,
  } as Record<string, number>;

  for (let index = 0; index < count; index += 1) {
    const result = selectCompanionDialogueEventFromHistory(
      createContext({
        ...contextOverrides,
        forceBaseFallback: true,
        seedKey: `tone-${index}`,
      }),
      [],
    );

    counts[result.tonePack] += 1;
  }

  return counts;
};

describe("companionDialogueSelector", () => {
  it("returns a red-heavier distribution under dormancy warning", () => {
    const baseline = runShimmerDistribution(2000, {
      dialogueMood: "content",
      hasDormancyWarning: false,
      inactiveDays: 0,
    });

    const dormancyWarning = runShimmerDistribution(2000, {
      dialogueMood: "desperate",
      hasDormancyWarning: true,
      inactiveDays: 4,
    });

    expect(dormancyWarning.red).toBeGreaterThan(baseline.red * 2);
    expect(dormancyWarning.red).toBeGreaterThan(dormancyWarning.purple);
    expect(dormancyWarning.gold).toBe(0);
  });

  it("suppresses gold shimmer when gold occurred within seven days", () => {
    const recentGold = createEntry({
      shimmerType: "gold",
      lineId: getLinesForToneAndBucket("soft", "legendary_moments")[0].id,
      bucketKey: "legendary_moments",
      tonePack: "soft",
      shownAt: new Date("2026-02-20T12:00:00.000Z").toISOString(),
    });

    for (let index = 0; index < 400; index += 1) {
      const result = selectCompanionDialogueEventFromHistory(
        createContext({
          dialogueMood: "thriving",
          progressToNext: 95,
          xpToNext: 6,
          triggerSource: "companion-evolved",
          seedKey: `gold-${index}`,
        }),
        [recentGold],
      );

      expect(result.shimmerType).not.toBe("gold");
    }
  });

  it("prevents consecutive purple shimmer", () => {
    const previousPurple = createEntry({
      shimmerType: "purple",
      lineId: getLinesForToneAndBucket("playful", "mystery_moments")[0].id,
      bucketKey: "mystery_moments",
      tonePack: "playful",
      shownAt: new Date("2026-02-22T11:59:00.000Z").toISOString(),
    });

    for (let index = 0; index < 400; index += 1) {
      const result = selectCompanionDialogueEventFromHistory(
        createContext({
          overallCare: 0.95,
          seedKey: `purple-${index}`,
        }),
        [previousPurple],
      );

      expect(result.shimmerType).not.toBe("purple");
    }
  });

  it("boosts green/gold outcomes near evolution", () => {
    const baseline = runShimmerDistribution(3000, {
      progressToNext: 40,
      xpToNext: 110,
      dialogueMood: "content",
    });

    const nearEvolution = runShimmerDistribution(3000, {
      progressToNext: 92,
      xpToNext: 10,
      dialogueMood: "content",
    });

    const baselineGrowth = baseline.green + baseline.gold;
    const nearEvolutionGrowth = nearEvolution.green + nearEvolution.gold;

    expect(nearEvolutionGrowth).toBeGreaterThan(baselineGrowth + 120);
  });

  it("boosts green shimmer for task/focus completion aliases", () => {
    const baseline = runShimmerDistribution(2500, {
      triggerSource: "idle",
    });
    const taskCompleted = runShimmerDistribution(2500, {
      triggerSource: "task-completed",
    });
    const legacyQuestCompleted = runShimmerDistribution(2500, {
      triggerSource: "quest-completed",
    });
    const focusSprintCompleted = runShimmerDistribution(2500, {
      triggerSource: "focus-sprint-completed",
    });

    expect(taskCompleted.green).toBeGreaterThan(baseline.green + 80);
    expect(legacyQuestCompleted.green).toBeGreaterThan(baseline.green + 80);
    expect(focusSprintCompleted.green).toBeGreaterThan(taskCompleted.green);
  });

  it("excludes recent line IDs and falls back to same bucket when the primary tone is exhausted", () => {
    const now = new Date("2026-02-22T12:00:00.000Z");
    const softBaseLines = getLinesForToneAndBucket("soft", "base_greetings");

    const blockedSoftHistory = softBaseLines.map((line, index) =>
      createEntry({
        lineId: line.id,
        bucketKey: "base_greetings",
        tonePack: "soft",
        shimmerType: "none",
        shownAt: new Date(now.getTime() - (index + 1) * 60 * 60 * 1000).toISOString(),
      }),
    );

    const recentBlocks = [
      createEntry({
        lineId: softBaseLines[0].id,
        bucketKey: "base_greetings",
        tonePack: "soft",
        shimmerType: "none",
        shownAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      }),
      createEntry({
        lineId: softBaseLines[1].id,
        bucketKey: "base_greetings",
        tonePack: "soft",
        shimmerType: "none",
        shownAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
      }),
      createEntry({
        lineId: softBaseLines[2].id,
        bucketKey: "base_greetings",
        tonePack: "soft",
        shimmerType: "none",
        shownAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      }),
    ];

    const result = selectDialogueLineCandidate({
      tonePack: "soft",
      bucketKey: "base_greetings",
      shimmerType: "none",
      history: [...blockedSoftHistory, ...recentBlocks],
      now,
      rng: () => 0.1,
    });

    const blockedIds = new Set([...blockedSoftHistory, ...recentBlocks].map((entry) => entry.lineId));

    expect(result.fallbackStage).toBe("same_bucket_any_tone");
    expect(result.tonePack).not.toBe("soft");
    expect(blockedIds.has(result.line.id)).toBe(false);
  });

  it("applies mood priors and voice-style bias for tone selection", () => {
    const desperateTones = runToneDistribution(1800, {
      dialogueMood: "desperate",
      voiceStyle: "balanced",
    });

    expect(desperateTones.soft).toBeGreaterThan(desperateTones.witty_sassy);
    expect(desperateTones.witty_sassy).toBeGreaterThan(desperateTones.playful);

    const contentBaseline = runToneDistribution(1800, {
      dialogueMood: "content",
      voiceStyle: "balanced",
    });

    const contentWarmBias = runToneDistribution(1800, {
      dialogueMood: "content",
      voiceStyle: "warm gentle supportive",
    });

    expect(contentWarmBias.soft).toBeGreaterThan(contentBaseline.soft);
    expect(
      contentWarmBias.soft + contentWarmBias.playful + contentWarmBias.witty_sassy,
    ).toBe(1800);
  });

  it("forces none shimmer once five colored shimmers were already shown today", () => {
    const todayEntries: DialogueHistoryEntry[] = [
      createEntry({ shimmerType: "green", shownAt: "2026-02-22T01:00:00.000Z" }),
      createEntry({ shimmerType: "blue", shownAt: "2026-02-22T02:00:00.000Z" }),
      createEntry({ shimmerType: "purple", shownAt: "2026-02-22T03:00:00.000Z" }),
      createEntry({ shimmerType: "red", shownAt: "2026-02-22T04:00:00.000Z" }),
      createEntry({ shimmerType: "green", shownAt: "2026-02-22T05:00:00.000Z" }),
    ];

    for (let index = 0; index < 200; index += 1) {
      const result = selectCompanionDialogueEventFromHistory(
        createContext({
          dialogueMood: "thriving",
          seedKey: `daily-cap-${index}`,
        }),
        todayEntries,
      );

      expect(result.shimmerType).toBe("none");
    }
  });

  it("uses recovery bucket micro-title override", () => {
    let recoveryResult:
      | ReturnType<typeof selectCompanionDialogueEventFromHistory>
      | null = null;

    for (let index = 0; index < 400; index += 1) {
      const result = selectCompanionDialogueEventFromHistory(
        createContext({
          dialogueMood: "recovering",
          triggerSource: "idle",
          seedKey: `recovery-${index}`,
        }),
        [],
      );

      if (result.bucketKey === "recovery_moments") {
        recoveryResult = result;
        break;
      }
    }

    expect(recoveryResult).not.toBeNull();
    expect(recoveryResult?.shimmerType).toBe("green");
    expect(recoveryResult?.microTitle).toBe("Back Online");
    expect(recoveryResult?.outcomeTag).toBe("momentum_boost");
  });

  it("falls back to base greetings if every line is blocked", () => {
    const allLines = [
      ...getAllLinesForBucket("base_greetings"),
      ...getAllLinesForBucket("growth_moments"),
      ...getAllLinesForBucket("recovery_moments"),
    ];

    const fullyBlockedHistory = allLines.map((line, index) =>
      createEntry({
        lineId: line.id,
        bucketKey: line.bucketKey,
        tonePack: line.tonePack,
        shimmerType: "green",
        shownAt: new Date(NOW.getTime() - (index + 1) * 60 * 1000).toISOString(),
      }),
    );

    const result = selectDialogueLineCandidate({
      tonePack: "soft",
      bucketKey: "growth_moments",
      shimmerType: "green",
      history: fullyBlockedHistory,
      now: NOW,
      rng: () => 0,
    });

    expect(result.fallbackStage).toBe("base_fallback");
    expect(result.bucketKey).toBe("base_greetings");
  });
});
