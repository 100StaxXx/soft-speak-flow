import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CompanionStatAnalysis } from "./useCompanionStatAnalysis";

const mocks = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.invokeMock(...args),
    },
  },
}));

vi.mock("./useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("./useProfile", () => ({
  useProfile: () => ({
    profile: { timezone: "America/Los_Angeles" },
  }),
}));

import { useCompanionStatAnalysis } from "./useCompanionStatAnalysis";

const baseAnalysis: CompanionStatAnalysis = {
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
  strongestRecentDrivers: [
    {
      key: "discipline:habit_complete",
      label: "Habit completions",
      detail: "3 habit completions contributed 12 Discipline in the last 30 days.",
      sourceType: "attribute_event",
      window: "30d",
      count: 3,
      amount: 12,
    },
  ],
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
      recentDrivers: [
        {
          key: "wisdom:habit_complete_learning",
          label: "Learning-linked habits",
          detail: "2 learning awards contributed 16 Wisdom in the last 30 days.",
          sourceType: "attribute_event",
          window: "30d",
          count: 2,
          amount: 16,
        },
      ],
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
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useCompanionStatAnalysis", () => {
  beforeEach(() => {
    mocks.invokeMock.mockReset();
  });

  it("loads today's cached analysis without forcing regeneration", async () => {
    mocks.invokeMock.mockResolvedValue({
      data: { analysis: baseAnalysis, cached: true },
      error: null,
    });

    const { result } = renderHook(() => useCompanionStatAnalysis({ enabled: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.analysis).toEqual(baseAnalysis);
    });

    expect(mocks.invokeMock).toHaveBeenCalledWith("generate-companion-stat-analysis", {
      body: { forceRefresh: false },
    });
    expect(result.current.cached).toBe(true);
  });

  it("refreshes analysis by forcing regeneration and replaces cached data", async () => {
    mocks.invokeMock
      .mockResolvedValueOnce({
        data: { analysis: baseAnalysis, cached: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          analysis: {
            ...baseAnalysis,
            summary: "Eli sees a fresher wave of Discipline momentum today.",
            suggestedAction: "Finish one planned task on time before lunch.",
          },
          cached: false,
        },
        error: null,
      });

    const { result } = renderHook(() => useCompanionStatAnalysis({ enabled: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.analysis?.summary).toBe(baseAnalysis.summary);
    });

    await act(async () => {
      await result.current.refreshAnalysis();
    });

    await waitFor(() => {
      expect(result.current.analysis?.summary).toBe("Eli sees a fresher wave of Discipline momentum today.");
    });

    expect(mocks.invokeMock).toHaveBeenNthCalledWith(2, "generate-companion-stat-analysis", {
      body: { forceRefresh: true },
    });
    expect(result.current.cached).toBe(false);
  });

  it("force-refreshes once when the cached analysis payload is malformed", async () => {
    mocks.invokeMock
      .mockResolvedValueOnce({
        data: {
          analysis: {
            ...baseAnalysis,
            summary: "",
          },
          cached: true,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { analysis: baseAnalysis, cached: false },
        error: null,
      });

    const { result } = renderHook(() => useCompanionStatAnalysis({ enabled: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.analysis).toEqual(baseAnalysis);
    });

    expect(mocks.invokeMock).toHaveBeenNthCalledWith(1, "generate-companion-stat-analysis", {
      body: { forceRefresh: false },
    });
    expect(mocks.invokeMock).toHaveBeenNthCalledWith(2, "generate-companion-stat-analysis", {
      body: { forceRefresh: true },
    });
    expect(result.current.cached).toBe(false);
  });

  it("accepts a refreshed payload that omits statNeeds after a malformed cached response", async () => {
    const refreshedAnalysis = { ...baseAnalysis } as Record<string, unknown>;
    delete refreshedAnalysis.statNeeds;

    mocks.invokeMock
      .mockResolvedValueOnce({
        data: {
          analysis: {
            ...baseAnalysis,
            summary: "",
          },
          cached: true,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          analysis: refreshedAnalysis,
          cached: false,
        },
        error: null,
      });

    const { result } = renderHook(() => useCompanionStatAnalysis({ enabled: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.analysis?.statNeeds).toEqual({
        vitality: { level: "low", reasons: [] },
        wisdom: { level: "low", reasons: [] },
        discipline: { level: "low", reasons: [] },
        resolve: { level: "low", reasons: [] },
        creativity: { level: "low", reasons: [] },
        alignment: { level: "low", reasons: [] },
      });
    });

    expect(mocks.invokeMock).toHaveBeenNthCalledWith(1, "generate-companion-stat-analysis", {
      body: { forceRefresh: false },
    });
    expect(mocks.invokeMock).toHaveBeenNthCalledWith(2, "generate-companion-stat-analysis", {
      body: { forceRefresh: true },
    });
    expect(result.current.error).toBeNull();
    expect(result.current.cached).toBe(false);
  });

  it("accepts legacy analysis payloads that omit newer activity counters", async () => {
    const legacyActivitySnapshot = { ...baseAnalysis.activitySnapshot } as Record<string, unknown>;
    delete legacyActivitySnapshot.hardTaskWins;

    mocks.invokeMock.mockResolvedValue({
      data: {
        analysis: {
          ...baseAnalysis,
          activitySnapshot: legacyActivitySnapshot,
        },
        cached: false,
      },
      error: null,
    });

    const { result } = renderHook(() => useCompanionStatAnalysis({ enabled: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.analysis?.activitySnapshot.hardTaskWins).toBe(0);
    });

    expect(result.current.error).toBeNull();
  });

  it("accepts legacy analysis payloads that omit statProfile", async () => {
    const legacyAnalysis = { ...baseAnalysis } as Record<string, unknown>;
    delete legacyAnalysis.statProfile;

    mocks.invokeMock.mockResolvedValue({
      data: {
        analysis: legacyAnalysis,
        cached: false,
      },
      error: null,
    });

    const { result } = renderHook(() => useCompanionStatAnalysis({ enabled: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.analysis?.statProfile).toEqual({
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

    expect(result.current.error).toBeNull();
  });

  it("surfaces an error when cached and refreshed payloads are both malformed", async () => {
    mocks.invokeMock
      .mockResolvedValueOnce({
        data: {
          analysis: {
            ...baseAnalysis,
            summary: "",
          },
          cached: true,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          analysis: {
            ...baseAnalysis,
            suggestedAction: "",
          },
          cached: false,
        },
        error: null,
      });

    const { result } = renderHook(() => useCompanionStatAnalysis({ enabled: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toContain("Received malformed refreshed stat analysis data");
    });

    expect(result.current.analysis).toBeNull();
  });
});
