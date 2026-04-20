import { describe, expect, it } from "vitest";

import { validateCompanionStatAnalysisResponse } from "./companionStatAnalysis";

const baseResponse = {
  analysis: {
    analysisDate: "2026-04-18",
    timezone: "America/Los_Angeles",
    generatedAt: "2026-04-18T18:30:00.000Z",
    mentor: {
      id: "mentor-1",
      name: "Eli",
      tone: "Supportive and specific",
      avatarUrl: null,
      primaryColor: "#ff7a59",
    },
    companion: {
      id: "companion-1",
      currentStage: 3,
      currentXp: 240,
    },
    activitySnapshot: {
      activityStartDate: "2026-04-12",
      activityEndDate: "2026-04-18",
      provenanceStartDate: "2026-03-20",
      provenanceEndDate: "2026-04-18",
      morningCheckIns: 4,
      eveningReflections: 3,
      habitCompletions: 5,
      onTimeTasks: 2,
      trackedAttributeEvents: 6,
      streakMilestones: 1,
      hardTaskWins: 2,
      recoveryActions: 1,
      healthActions: 2,
      creativeActions: 1,
      relationshipActions: 1,
      epicLinkedCompletions: 1,
      bounceBackDays: 1,
    },
    statProfile: {
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
    },
    statNeeds: {
      vitality: { level: "medium", reasons: ["You've been pushing output harder than recovery."] },
      wisdom: { level: "low", reasons: [] },
      discipline: { level: "low", reasons: [] },
      resolve: { level: "low", reasons: [] },
      creativity: { level: "medium", reasons: ["The week could use a little more originality and play."] },
      alignment: { level: "low", reasons: [] },
    },
    momentumState: "coasting",
    recentMissInterpretation: "normal_variance",
    narrativeBrief: "You've kept Discipline online, but Vitality wants a little more intentional support.",
    dailyNarrative: "Discipline-heavy day",
    weeklyNarrative: "Discipline is leading lately, with Alignment close behind. Vitality is the clearest rebalance need next.",
    identityBootstrap: "Here's who you've been lately: Discipline has been your clearest trait.",
    strongestRecentDrivers: [],
    statBreakdowns: [],
    summary: "Eli sees consistent momentum in your daily rhythm.",
    suggestedAction: "Pair one morning check-in with one on-time task today.",
  },
  cached: false,
};

describe("companionStatAnalysis", () => {
  it("fills missing legacy activity counters with zero", () => {
    const legacyActivitySnapshot = { ...baseResponse.analysis.activitySnapshot } as Record<string, unknown>;
    delete legacyActivitySnapshot.hardTaskWins;

    const validation = validateCompanionStatAnalysisResponse({
      ...baseResponse,
      analysis: {
        ...baseResponse.analysis,
        activitySnapshot: legacyActivitySnapshot,
      },
    });

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    expect(validation.data.analysis.activitySnapshot.hardTaskWins).toBe(0);
  });

  it("coerces numeric string activity counters", () => {
    const validation = validateCompanionStatAnalysisResponse({
      ...baseResponse,
      analysis: {
        ...baseResponse.analysis,
        activitySnapshot: {
          ...baseResponse.analysis.activitySnapshot,
          hardTaskWins: "2",
        },
      },
    });

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    expect(validation.data.analysis.activitySnapshot.hardTaskWins).toBe(2);
  });
});
