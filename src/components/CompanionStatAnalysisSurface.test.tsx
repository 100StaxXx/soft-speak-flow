import type { HTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prefersReducedMotion: true,
  refreshAnalysisMock: vi.fn().mockResolvedValue(undefined),
  regenerateTitleCardMock: vi.fn().mockResolvedValue(undefined),
  useCompanionStatAnalysisMock: vi.fn(),
}));

const originalImage = globalThis.Image;
let imageLoadMode: "load" | "error" | "idle" = "load";

class MockImage {
  complete = false;
  naturalWidth = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    if (imageLoadMode === "idle") return;
    this.complete = true;
    this.naturalWidth = imageLoadMode === "load" ? 100 : 0;
    if (imageLoadMode === "load") {
      this.onload?.();
    } else {
      this.onerror?.();
    }
  }
}

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

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      variants: _variants,
      initial: _initial,
      animate: _animate,
      ...props
    }: HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => (
      <div
        {...props}
        data-motion-animate={_animate === undefined ? undefined : String(_animate)}
        data-motion-initial={_initial === undefined ? undefined : String(_initial)}
      >
        {children}
      </div>
    ),
    details: ({
      children,
      variants: _variants,
      initial: _initial,
      animate: _animate,
      ...props
    }: HTMLAttributes<HTMLDetailsElement> & Record<string, unknown>) => (
      <details
        {...props}
        data-motion-animate={_animate === undefined ? undefined : String(_animate)}
        data-motion-initial={_initial === undefined ? undefined : String(_initial)}
      >
        {children}
      </details>
    ),
  },
  useReducedMotion: () => mocks.prefersReducedMotion,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  RadarChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="radar-chart">{children}</div>
  ),
  PolarGrid: () => <div data-testid="polar-grid" />,
  PolarAngleAxis: () => <div data-testid="polar-angle-axis" />,
  PolarRadiusAxis: ({ domain }: { domain?: number[] }) => (
    <div data-domain={domain?.join("-")} data-testid="polar-radius-axis" />
  ),
  Radar: () => <div data-testid="radar-shape" />,
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
  cosmiqTitle: {
    title: "The Oathbound Pathfinder",
    rarity: "rare",
    momentum: "steady",
    dominantStat: "discipline",
    secondaryStat: "alignment",
    rebalanceStat: "creativity",
    fusion: true,
    rebalancePath: "Strengthen Creativity to evolve toward The Soulforged Creator.",
    titleStability: "new",
  },
  cosmiqTitleCard: {
    profileKey: "v1::the-oathbound-pathfinder",
    imageUrl: "https://example.com/cosmiq-card.png",
    status: "ready",
    cached: true,
    promptVersion: 1,
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
    mocks.prefersReducedMotion = true;
    imageLoadMode = "load";
    globalThis.Image = MockImage as unknown as typeof Image;
    mocks.refreshAnalysisMock.mockClear();
    mocks.regenerateTitleCardMock.mockClear();
    mocks.useCompanionStatAnalysisMock.mockReset();
    mocks.useCompanionStatAnalysisMock.mockReturnValue({
      analysis,
      cached: true,
      error: null,
      isLoading: false,
      isRefreshing: false,
      isRegeneratingTitleCard: false,
      refreshAnalysis: mocks.refreshAnalysisMock,
      regenerateTitleCard: mocks.regenerateTitleCardMock,
    });
  });

  afterEach(() => {
    globalThis.Image = originalImage;
  });

  it("uses a drawer on mobile and renders the RPG stat reading shell", () => {
    render(
      <CompanionStatAnalysisSurface
        open={true}
        onOpenChange={vi.fn()}
        layoutMode="mobile"
      />,
    );

    expect(screen.getByTestId("drawer-root")).toBeInTheDocument();
    expect(screen.getByTestId("companion-stats-analysis-drawer")).toBeInTheDocument();
    expect(screen.getByTestId("companion-cosmiq-title-card")).toBeInTheDocument();
    expect(screen.getByText("Cosmiq Title")).toBeInTheDocument();
    expect(screen.getByText("The Oathbound Pathfinder")).toBeInTheDocument();
    expect(screen.getByText("New Title Unlocked")).toBeInTheDocument();
    expect(screen.getByText("Strengthen Creativity to evolve toward The Soulforged Creator.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show stat analysis" }));

    expect(screen.getByText("Stat Reading")).toBeInTheDocument();
    expect(screen.getByText("Current Build")).toBeInTheDocument();
    expect(screen.getAllByText("Discipline / Alignment").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Eli")).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Show stat analysis" }));

    const flippedCard = screen.getByTestId("companion-cosmiq-title-card");
    expect(within(flippedCard).getByTestId("companion-cosmiq-title-card-back")).toBeInTheDocument();
    expect(within(flippedCard).getByTestId("companion-stat-radar")).toBeInTheDocument();
    expect(within(flippedCard).getByTestId("radar-chart")).toBeInTheDocument();
    expect(within(flippedCard).getByTestId("polar-radius-axis")).toHaveAttribute("data-domain", "0-100");
    expect(screen.getByText("Stat shape based on normalized 0-100 power from your 100-1000 scores.")).toBeInTheDocument();

    fireEvent.click(within(flippedCard).getByRole("button", { name: "Refresh analysis" }));
    expect(mocks.refreshAnalysisMock).toHaveBeenCalledTimes(1);
  });

  it("renders all six RPG stat cards with score ranks", () => {
    render(
      <CompanionStatAnalysisSurface
        open={true}
        onOpenChange={vi.fn()}
        layoutMode="desktop"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show stat analysis" }));

    const vitalityCard = screen.getByTestId("companion-rpg-stat-card-vitality");
    expect(within(vitalityCard).getByText("Vitality")).toBeInTheDocument();
    expect(within(vitalityCard).getByText("420")).toBeInTheDocument();
    expect(within(vitalityCard).getByText("Rank B")).toBeInTheDocument();
    expect(within(vitalityCard).getByRole("progressbar", { name: "Vitality score meter" })).toHaveAttribute(
      "aria-valuenow",
      "36",
    );
    expect(within(vitalityCard).getByRole("progressbar", { name: "Vitality score meter" })).toHaveAttribute(
      "aria-valuetext",
      "420 out of 1000",
    );

    const wisdomCard = screen.getByTestId("companion-rpg-stat-card-wisdom");
    expect(within(wisdomCard).getByText("Wisdom")).toBeInTheDocument();
    expect(within(wisdomCard).getByText("510")).toBeInTheDocument();
    expect(within(wisdomCard).getByText("Rank A")).toBeInTheDocument();

    expect(screen.getByTestId("companion-rpg-stat-card-discipline")).toBeInTheDocument();
    expect(screen.getByTestId("companion-rpg-stat-card-resolve")).toBeInTheDocument();
    expect(screen.getByTestId("companion-rpg-stat-card-creativity")).toBeInTheDocument();
    expect(screen.getByTestId("companion-rpg-stat-card-alignment")).toBeInTheDocument();
  });

  it("uses the animated reveal path when reduced motion is not preferred", () => {
    mocks.prefersReducedMotion = false;

    const { container } = render(
      <CompanionStatAnalysisSurface
        open={true}
        onOpenChange={vi.fn()}
        layoutMode="desktop"
      />,
    );

    expect(container.querySelector("[data-motion-initial='hidden']")).toBeInTheDocument();
    expect(container.querySelector("[data-motion-animate='visible']")).toBeInTheDocument();
  });

  it("skips the initial reveal state when reduced motion is preferred", () => {
    mocks.prefersReducedMotion = true;

    const { container } = render(
      <CompanionStatAnalysisSurface
        open={true}
        onOpenChange={vi.fn()}
        layoutMode="desktop"
      />,
    );

    expect(container.querySelector("[data-motion-initial='false']")).toBeInTheDocument();
    expect(container.querySelector("[data-motion-animate='visible']")).toBeInTheDocument();
  });

  it("frames the suggested action as a recommended quest", () => {
    render(
      <CompanionStatAnalysisSurface
        open={true}
        onOpenChange={vi.fn()}
        layoutMode="mobile"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show stat analysis" }));

    expect(screen.getByText("Recommended Quest")).toBeInTheDocument();
    expect(screen.getByText("Pair one morning check-in with one on-time task today.")).toBeInTheDocument();
    expect(screen.getByText("Rebalance Creativity")).toBeInTheDocument();
  });

  it("keeps the loading state while title-card art is still generating", () => {
    mocks.useCompanionStatAnalysisMock.mockReturnValue({
      analysis: {
        ...analysis,
        cosmiqTitleCard: {
          ...analysis.cosmiqTitleCard,
          imageUrl: null,
          status: "generating",
        },
      },
      cached: false,
      error: null,
      isLoading: false,
      isRefreshing: false,
      isRegeneratingTitleCard: false,
      refreshAnalysis: mocks.refreshAnalysisMock,
      regenerateTitleCard: mocks.regenerateTitleCardMock,
    });

    render(
      <CompanionStatAnalysisSurface
        open={true}
        onOpenChange={vi.fn()}
        layoutMode="desktop"
      />,
    );

    expect(screen.getByText("Revealing your title")).toBeInTheDocument();
    expect(screen.queryByTestId("companion-cosmiq-title-card")).not.toBeInTheDocument();
  });

  it("keeps loading until a ready title-card image actually loads", () => {
    imageLoadMode = "idle";

    render(
      <CompanionStatAnalysisSurface
        open={true}
        onOpenChange={vi.fn()}
        layoutMode="desktop"
      />,
    );

    expect(screen.getByText("Revealing your title")).toBeInTheDocument();
    expect(screen.queryByTestId("companion-cosmiq-title-card")).not.toBeInTheDocument();
  });

  it("forces one title-card regeneration when a ready image fails to load", async () => {
    imageLoadMode = "error";
    mocks.regenerateTitleCardMock.mockRejectedValueOnce(new Error("image retry failed"));

    render(
      <CompanionStatAnalysisSurface
        open={true}
        onOpenChange={vi.fn()}
        layoutMode="desktop"
      />,
    );

    await waitFor(() => {
      expect(mocks.regenerateTitleCardMock).toHaveBeenCalledWith(analysis);
    });
    expect(await screen.findByText("We couldn't load the generated title art. Try regenerating it.")).toBeInTheDocument();
    expect(screen.queryByTestId("companion-cosmiq-title-card")).not.toBeInTheDocument();
  });

  it("shows the inline unavailable card when validated analysis is missing", () => {
    mocks.useCompanionStatAnalysisMock.mockReturnValue({
      analysis: null,
      cached: false,
      error: "Received malformed stat analysis data: analysis.summary must be a non-empty string",
      isLoading: false,
      isRefreshing: false,
      isRegeneratingTitleCard: false,
      refreshAnalysis: mocks.refreshAnalysisMock,
      regenerateTitleCard: mocks.regenerateTitleCardMock,
    });

    render(
      <CompanionStatAnalysisSurface
        open={true}
        onOpenChange={vi.fn()}
        layoutMode="mobile"
      />,
    );

    expect(screen.getByText("Stats analysis is unavailable right now.")).toBeInTheDocument();
    expect(
      screen.getByText("Received malformed stat analysis data: analysis.summary must be a non-empty string"),
    ).toBeInTheDocument();
  });

  it("contains render errors inside the stats surface boundary", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mocks.useCompanionStatAnalysisMock.mockReturnValue({
      analysis: {
        ...analysis,
        statProfile: {
          ...analysis.statProfile,
          dominantStat: undefined,
        },
      },
      cached: true,
      error: null,
      isLoading: false,
      isRefreshing: false,
      isRegeneratingTitleCard: false,
      refreshAnalysis: mocks.refreshAnalysisMock,
      regenerateTitleCard: mocks.regenerateTitleCardMock,
    });

    render(
      <CompanionStatAnalysisSurface
        open={true}
        onOpenChange={vi.fn()}
        layoutMode="desktop"
      />,
    );

    expect(screen.getByText("Stats analysis is unavailable right now.")).toBeInTheDocument();
    expect(
      screen.getByText("We couldn't render this analysis right now. Try refreshing it."),
    ).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
