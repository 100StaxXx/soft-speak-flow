import type { HTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshAnalysisMock: vi.fn().mockResolvedValue(undefined),
  useCompanionStatAnalysisMock: vi.fn(),
}));

vi.mock("@/hooks/useCompanionStatAnalysis", () => ({
  useCompanionStatAnalysis: (...args: unknown[]) => mocks.useCompanionStatAnalysisMock(...args),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open?: boolean; children: ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ open, children }: { open?: boolean; children: ReactNode }) =>
    open ? <div data-testid="drawer-root">{children}</div> : null,
  DrawerContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DrawerHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DrawerDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

import { CompanionStatAnalysisSurface } from "./CompanionStatAnalysisSurface";

const analysis = {
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

describe("CompanionStatAnalysisSurface", () => {
  beforeEach(() => {
    mocks.refreshAnalysisMock.mockClear();
    mocks.useCompanionStatAnalysisMock.mockReset();
    mocks.useCompanionStatAnalysisMock.mockReturnValue({
      analysis,
      cached: true,
      error: null,
      isLoading: false,
      isRefreshing: false,
      refreshAnalysis: mocks.refreshAnalysisMock,
    });
  });

  it("uses a drawer on mobile and renders the cached analysis content", () => {
    render(
      <CompanionStatAnalysisSurface
        open={true}
        onOpenChange={vi.fn()}
        layoutMode="mobile"
      />,
    );

    expect(screen.getByTestId("drawer-root")).toBeInTheDocument();
    expect(screen.getByTestId("companion-stats-analysis-drawer")).toBeInTheDocument();
    expect(screen.getByText("Eli says your stats make sense.")).toBeInTheDocument();
    expect(screen.getByText("Cached for today")).toBeInTheDocument();
  });

  it("uses a dialog on desktop and refreshes on demand", () => {
    render(
      <CompanionStatAnalysisSurface
        open={true}
        onOpenChange={vi.fn()}
        layoutMode="desktop"
      />,
    );

    expect(screen.getByTestId("dialog-root")).toBeInTheDocument();
    expect(screen.getByTestId("companion-stats-analysis-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh analysis" }));
    expect(mocks.refreshAnalysisMock).toHaveBeenCalledTimes(1);
  });
});
