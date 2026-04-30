import { describe, expect, it } from "vitest";

import {
  validateCompanionStatAnalysisResponse,
  validateCompanionStatAnalysisResponseForClient,
} from "./companionStatAnalysis";

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
    fantasyTitle: {
      title: "The Oathbound Navigator",
      archetype: "Discipline / Alignment",
      explanation: "You're carrying Discipline with Alignment close behind, and Creativity is the place your next chapter wants support.",
    },
    momentumState: "coasting",
    recentMissInterpretation: "normal_variance",
    narrativeBrief: "You've kept Discipline online, but Vitality wants a little more intentional support.",
    dailyNarrative: "Discipline-heavy day",
    weeklyNarrative: "Discipline is leading lately, with Alignment close behind. Vitality is the clearest rebalance need next.",
    identityBootstrap: "Here's who you've been lately: Discipline has been your clearest trait.",
    strongestRecentDrivers: [],
    statBreakdowns: [
      {
        attribute: "vitality",
        score: 420,
        band: "Building",
        status: "Building score with no recent tracked boosts yet",
        primaryReasons: ["No recent tracked boosts were found for Vitality, so this score is mostly a long-run snapshot right now."],
        recentDrivers: [],
      },
      {
        attribute: "wisdom",
        score: 510,
        band: "Strong",
        status: "Strong score with recent tracked momentum",
        primaryReasons: ["2 learning awards contributed 16 Wisdom in the last 30 days."],
        recentDrivers: [],
      },
      {
        attribute: "discipline",
        score: 560,
        band: "Strong",
        status: "Strong score with recent tracked momentum",
        primaryReasons: ["3 habit completions awarded 12 Discipline in the last 30 days."],
        recentDrivers: [],
      },
      {
        attribute: "resolve",
        score: 480,
        band: "Building",
        status: "Building score with recent tracked momentum",
        primaryReasons: ["Resolve picked up recent echo gains."],
        recentDrivers: [],
      },
      {
        attribute: "creativity",
        score: 360,
        band: "Building",
        status: "Building score with no recent tracked boosts yet",
        primaryReasons: ["No recent tracked boosts were found for Creativity, so this score is mostly a long-run snapshot right now."],
        recentDrivers: [],
      },
      {
        attribute: "alignment",
        score: 530,
        band: "Strong",
        status: "Strong score with recent tracked momentum",
        primaryReasons: ["4 morning check-ins contributed 24 Alignment in the last 30 days."],
        recentDrivers: [],
      },
    ],
    summary: "Eli sees consistent momentum in your daily rhythm.",
    suggestedAction: "Pair one morning check-in with one on-time task today.",
  },
  cached: false,
};

describe("companionStatAnalysis", () => {
  it("accepts a valid fantasy title on strict responses", () => {
    const validation = validateCompanionStatAnalysisResponse(baseResponse);

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    expect(validation.data.analysis.fantasyTitle).toEqual({
      title: "The Oathbound Navigator",
      archetype: "Discipline / Alignment",
      explanation: "You're carrying Discipline with Alignment close behind, and Creativity is the place your next chapter wants support.",
    });
  });

  it("rejects malformed fantasy titles on strict responses", () => {
    const validation = validateCompanionStatAnalysisResponse({
      ...baseResponse,
      analysis: {
        ...baseResponse.analysis,
        fantasyTitle: {
          ...baseResponse.analysis.fantasyTitle,
          title: "",
        },
      },
    });

    expect(validation.ok).toBe(false);
    if (validation.ok) return;

    expect(validation.error).toBe("analysis.fantasyTitle.title must be a non-empty string");
  });

  it("rebuilds a missing statProfile from stat breakdown scores", () => {
    const legacyAnalysis = { ...baseResponse.analysis } as Record<string, unknown>;
    delete legacyAnalysis.statProfile;

    const validation = validateCompanionStatAnalysisResponse({
      ...baseResponse,
      analysis: legacyAnalysis,
    });

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    expect(validation.data.analysis.statProfile).toEqual({
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
    });
  });

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

  it("keeps the strict validator strict when statNeeds is missing", () => {
    const legacyAnalysis = { ...baseResponse.analysis } as Record<string, unknown>;
    delete legacyAnalysis.statNeeds;

    const validation = validateCompanionStatAnalysisResponse({
      ...baseResponse,
      analysis: legacyAnalysis,
    });

    expect(validation.ok).toBe(false);
    if (validation.ok) return;

    expect(validation.error).toBe("analysis.statNeeds must be an object");
  });

  it("client compatibility fills a missing statNeeds block with defaults", () => {
    const legacyAnalysis = { ...baseResponse.analysis } as Record<string, unknown>;
    delete legacyAnalysis.statNeeds;

    const validation = validateCompanionStatAnalysisResponseForClient({
      ...baseResponse,
      analysis: legacyAnalysis,
    });

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    expect(validation.data.analysis.statNeeds).toEqual({
      vitality: { level: "low", reasons: [] },
      wisdom: { level: "low", reasons: [] },
      discipline: { level: "low", reasons: [] },
      resolve: { level: "low", reasons: [] },
      creativity: { level: "low", reasons: [] },
      alignment: { level: "low", reasons: [] },
    });
  });

  it("client compatibility replaces a null statNeeds block with defaults", () => {
    const validation = validateCompanionStatAnalysisResponseForClient({
      ...baseResponse,
      analysis: {
        ...baseResponse.analysis,
        statNeeds: null,
      },
    });

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    expect(validation.data.analysis.statNeeds.resolve).toEqual({ level: "low", reasons: [] });
  });

  it("client compatibility replaces a non-object statNeeds block with defaults", () => {
    const validation = validateCompanionStatAnalysisResponseForClient({
      ...baseResponse,
      analysis: {
        ...baseResponse.analysis,
        statNeeds: "legacy",
      },
    });

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    expect(validation.data.analysis.statNeeds.creativity).toEqual({ level: "low", reasons: [] });
  });

  it("client compatibility fills missing statNeeds attributes and preserves valid ones", () => {
    const partialStatNeeds = {
      ...baseResponse.analysis.statNeeds,
    } as Record<string, unknown>;
    delete partialStatNeeds.resolve;

    const validation = validateCompanionStatAnalysisResponseForClient({
      ...baseResponse,
      analysis: {
        ...baseResponse.analysis,
        statNeeds: partialStatNeeds,
      },
    });

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    expect(validation.data.analysis.statNeeds.vitality).toEqual(
      baseResponse.analysis.statNeeds.vitality,
    );
    expect(validation.data.analysis.statNeeds.resolve).toEqual({ level: "low", reasons: [] });
  });

  it("client compatibility fills a missing legacy fantasy title", () => {
    const legacyAnalysis = { ...baseResponse.analysis } as Record<string, unknown>;
    delete legacyAnalysis.fantasyTitle;

    const validation = validateCompanionStatAnalysisResponseForClient({
      ...baseResponse,
      analysis: legacyAnalysis,
    });

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    expect(validation.data.analysis.fantasyTitle.title.length).toBeGreaterThan(0);
    expect(validation.data.analysis.fantasyTitle.archetype).toBe("Discipline / Alignment");
    expect(validation.data.analysis.fantasyTitle.explanation).toContain("Creativity");
  });
});
