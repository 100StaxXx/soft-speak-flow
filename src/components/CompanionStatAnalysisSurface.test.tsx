import type { HTMLAttributes, ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prefersReducedMotion: true,
  refreshAnalysisMock: vi.fn().mockResolvedValue(undefined),
  regenerateTitleCardMock: vi.fn().mockResolvedValue(undefined),
  useCompanionStatAnalysisMock: vi.fn(),
}));

const originalImage = globalThis.Image;
let imageLoadMode: "load" | "error" | "idle" = "load";
let mockImageInstances: MockImage[] = [];

class MockImage {
  complete = false;
  naturalWidth = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    mockImageInstances.push(this);
  }

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
      transition: _transition,
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
      transition: _transition,
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
import { COMPANION_STAT_ANALYSIS_PRELUDE_CARDS } from "@/shared/companionStatAnalysisPreludeCards";

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
    imageUrls: ["https://example.com/cosmiq-card.png"],
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
    mockImageInstances = [];
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
    vi.useRealTimers();
    globalThis.Image = originalImage;
  });

  it("uses a drawer on mobile and renders the minimal title-card front", () => {
    render(
      <CompanionStatAnalysisSurface
        open={true}
        onOpenChange={vi.fn()}
        layoutMode="mobile"
      />,
    );

    expect(screen.getByTestId("drawer-root")).toBeInTheDocument();
    expect(screen.getByTestId("companion-stats-analysis-drawer")).toBeInTheDocument();
    expect(screen.queryByLabelText("Generating title art")).not.toBeInTheDocument();
    expect(screen.getByTestId("companion-cosmiq-title-card")).toBeInTheDocument();
    expect(screen.getByAltText("The Oathbound Pathfinder archetype illustration")).toHaveAttribute(
      "src",
      "https://example.com/cosmiq-card.png",
    );
    expect(screen.getByText("The Oathbound Pathfinder")).toBeInTheDocument();
    expect(screen.getByText("Strengthen Creativity to evolve toward The Soulforged Creator.")).toBeInTheDocument();
    expect(screen.queryByText("New Title Unlocked")).not.toBeInTheDocument();
    expect(screen.queryByText("Vitality")).not.toBeInTheDocument();
    expect(screen.queryByText("560")).not.toBeInTheDocument();
    expect(screen.queryByText("Strong")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show stat analysis" }));

    expect(screen.getByText("Stat Reading")).toBeInTheDocument();
    expect(screen.getByText("Current Build")).toBeInTheDocument();
    expect(screen.getAllByText("Discipline / Alignment").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Eli")).toBeInTheDocument();
    expect(screen.getByText("Cached for today")).toBeInTheDocument();
  });

  it("shows a title loading indicator in the mobile drawer while title art is generating", () => {
    mocks.useCompanionStatAnalysisMock.mockReturnValue({
      analysis: {
        ...analysis,
        cosmiqTitleCard: {
          ...analysis.cosmiqTitleCard,
          imageUrl: null,
          imageUrls: [],
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
        layoutMode="mobile"
      />,
    );

    expect(screen.getByTestId("companion-stats-analysis-drawer")).toBeInTheDocument();
    expect(screen.getByLabelText("Generating title art")).toBeInTheDocument();
    expect(screen.getByTestId("companion-stats-title-loading-indicator")).toBeInTheDocument();
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
    vi.useFakeTimers();

    const { container } = render(
      <CompanionStatAnalysisSurface
        open={true}
        onOpenChange={vi.fn()}
        layoutMode="desktop"
      />,
    );

    act(() => {
      vi.advanceTimersByTime(4_500);
    });

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

  it("uses generic prelude cards while the initial stat analysis loads", () => {
    const firstPreludeCard = COMPANION_STAT_ANALYSIS_PRELUDE_CARDS[0];
    mocks.useCompanionStatAnalysisMock.mockReturnValue({
      analysis: null,
      cached: false,
      error: null,
      isLoading: true,
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

    const preludeCard = screen.getByTestId("companion-stat-analysis-prelude-card");
    expect(preludeCard).toHaveAttribute("data-card-id", firstPreludeCard.id);
    expect(screen.getByText(firstPreludeCard.title)).toBeInTheDocument();
    expect(screen.getByText(firstPreludeCard.description)).toBeInTheDocument();
    expect(screen.getByLabelText("Analyze My Stats prelude cards")).toBeInTheDocument();
    expect(screen.queryByText("The Oathbound Pathfinder")).not.toBeInTheDocument();
    expect(screen.queryByText("Discipline")).not.toBeInTheDocument();
    expect(screen.queryByText("560")).not.toBeInTheDocument();
  });

  it("does not auto-rotate prelude cards when reduced motion is preferred", () => {
    const firstPreludeCard = COMPANION_STAT_ANALYSIS_PRELUDE_CARDS[0];
    mocks.prefersReducedMotion = true;
    vi.useFakeTimers();
    mocks.useCompanionStatAnalysisMock.mockReturnValue({
      analysis: null,
      cached: false,
      error: null,
      isLoading: true,
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

    expect(screen.getByTestId("companion-stat-analysis-prelude-card")).toHaveAttribute(
      "data-card-id",
      firstPreludeCard.id,
    );

    act(() => {
      vi.advanceTimersByTime(7_200);
    });

    expect(screen.getByTestId("companion-stat-analysis-prelude-card")).toHaveAttribute(
      "data-card-id",
      firstPreludeCard.id,
    );
  });

  it("keeps the loading state while title-card art is still generating", () => {
    const firstPreludeCard = COMPANION_STAT_ANALYSIS_PRELUDE_CARDS[0];
    mocks.useCompanionStatAnalysisMock.mockReturnValue({
      analysis: {
        ...analysis,
        cosmiqTitleCard: {
          ...analysis.cosmiqTitleCard,
          imageUrl: null,
          imageUrls: [],
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

    expect(screen.getByTestId("companion-title-art-loading")).toBeInTheDocument();
    expect(screen.getByTestId("companion-stat-analysis-prelude-card")).toHaveAttribute(
      "data-card-id",
      firstPreludeCard.id,
    );
    expect(screen.getByText(firstPreludeCard.title)).toBeInTheDocument();
    expect(screen.getByText(firstPreludeCard.description)).toBeInTheDocument();
    expect(screen.getByAltText(`${firstPreludeCard.title} preload archetype illustration`)).toHaveAttribute(
      "src",
      expect.stringContaining(firstPreludeCard.imageStoragePath),
    );
    expect(screen.queryByText("The Oathbound Pathfinder")).not.toBeInTheDocument();
    expect(screen.queryByText("Discipline")).not.toBeInTheDocument();
    expect(screen.queryByText("Alignment")).not.toBeInTheDocument();
    expect(screen.queryByText("560")).not.toBeInTheDocument();
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

    expect(screen.getByTestId("companion-title-art-loading")).toBeInTheDocument();
    const preview = screen.getByTestId("companion-title-art-loading-preview");
    expect(preview.querySelector("img")?.getAttribute("src")).toBe("https://example.com/cosmiq-card.png");
    expect(preview.querySelectorAll("img")).toHaveLength(1);
    expect(screen.getByText(COMPANION_STAT_ANALYSIS_PRELUDE_CARDS[0].title)).toBeInTheDocument();
    expect(screen.getByAltText("The Wandering Seeker preload archetype illustration")).toHaveAttribute(
      "src",
      expect.stringContaining("preload-template-cards/v1/the-wandering-seeker.png"),
    );
    expect(screen.queryByText("The Oathbound Pathfinder")).not.toBeInTheDocument();
    expect(screen.queryByText("Discipline")).not.toBeInTheDocument();
    expect(screen.queryByText("560")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Generated title art preview slides")).not.toBeInTheDocument();
    expect(screen.queryByTestId("companion-cosmiq-title-card")).not.toBeInTheDocument();
  });

  it("reveals a ready title card from imageUrls when legacy imageUrl is absent", async () => {
    mocks.useCompanionStatAnalysisMock.mockReturnValue({
      analysis: {
        ...analysis,
        cosmiqTitleCard: {
          ...analysis.cosmiqTitleCard,
          imageUrl: null,
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

    expect(await screen.findByTestId("companion-cosmiq-title-card")).toBeInTheDocument();
    expect(screen.getByAltText("The Oathbound Pathfinder archetype illustration")).toHaveAttribute(
      "src",
      "https://example.com/cosmiq-card.png",
    );
    expect(screen.queryByTestId("companion-title-art-loading")).not.toBeInTheDocument();
  });

  it("reveals fast-path title art as soon as the primary image loads", async () => {
    mocks.prefersReducedMotion = false;
    imageLoadMode = "idle";

    render(
      <CompanionStatAnalysisSurface
        open={true}
        onOpenChange={vi.fn()}
        layoutMode="desktop"
      />,
    );

    expect(screen.getByTestId("companion-title-art-loading")).toBeInTheDocument();
    expect(screen.getByText(COMPANION_STAT_ANALYSIS_PRELUDE_CARDS[0].title)).toBeInTheDocument();

    act(() => {
      const preloadImage = mockImageInstances[0];
      preloadImage.complete = true;
      preloadImage.naturalWidth = 100;
      preloadImage.onload?.();
    });

    expect(await screen.findByTestId("companion-cosmiq-title-card")).toBeInTheDocument();
    expect(screen.queryByTestId("companion-title-art-loading")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Generated title art preview slides")).not.toBeInTheDocument();
  });

  it("still lets legacy multi-image title art preview dwell before reveal", () => {
    mocks.prefersReducedMotion = false;
    imageLoadMode = "idle";
    vi.useFakeTimers();
    mocks.useCompanionStatAnalysisMock.mockReturnValue({
      analysis: {
        ...analysis,
        cosmiqTitleCard: {
          ...analysis.cosmiqTitleCard,
          imageUrls: [
            "https://example.com/cosmiq-card.png",
            "https://example.com/cosmiq-card-variant-2.png",
            "https://example.com/cosmiq-card-variant-3.png",
          ],
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

    expect(screen.getByTestId("companion-title-art-loading")).toBeInTheDocument();
    expect(screen.getByText(COMPANION_STAT_ANALYSIS_PRELUDE_CARDS[0].title)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.getByTestId("companion-title-art-loading")).toBeInTheDocument();
    expect(screen.getByTestId("companion-stat-analysis-prelude-card")).toBeInTheDocument();
    expect(screen.queryByTestId("companion-cosmiq-title-card")).not.toBeInTheDocument();

    act(() => {
      const preloadImage = mockImageInstances[0];
      preloadImage.complete = true;
      preloadImage.naturalWidth = 100;
      preloadImage.onload?.();
    });

    expect(screen.queryByTestId("companion-cosmiq-title-card")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_800);
    });

    expect(screen.queryByTestId("companion-cosmiq-title-card")).not.toBeInTheDocument();

    const preview = screen.getByTestId("companion-title-art-loading-preview");
    act(() => {
      preview.querySelectorAll("img").forEach((previewImage) => {
        fireEvent.load(previewImage);
      });
    });

    act(() => {
      vi.advanceTimersByTime(3_600);
    });

    expect(screen.queryByTestId("companion-cosmiq-title-card")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(screen.getByTestId("companion-cosmiq-title-card")).toBeInTheDocument();
  });

  it("keeps the stat reading visible when ready title-card art fails to load", async () => {
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
    expect(await screen.findByTestId("companion-cosmiq-title-card")).toBeInTheDocument();
    expect(screen.getByTestId("companion-title-art-placeholder")).toBeInTheDocument();
    expect(screen.getByText("The Oathbound Pathfinder")).toBeInTheDocument();
    expect(screen.getByText("Strengthen Creativity to evolve toward The Soulforged Creator.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Regenerate title art" })).not.toBeInTheDocument();
    expect(screen.queryByText("Stats analysis is unavailable right now.")).not.toBeInTheDocument();
    expect(screen.queryByAltText("The Oathbound Pathfinder archetype illustration")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show stat analysis" }));

    expect(screen.getByText("Title art could not load. Tap regenerate to try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate title art" })).toBeInTheDocument();
  });

  it("keeps the stat reading visible when title-card generation is unavailable", () => {
    mocks.useCompanionStatAnalysisMock.mockReturnValue({
      analysis: {
        ...analysis,
        cosmiqTitleCard: {
          ...analysis.cosmiqTitleCard,
          imageUrl: null,
          imageUrls: [],
          status: "unavailable",
          failureCode: "guardrail_blocked",
          failureMessage: "Art generation is paused by the budget guardrail.",
          retryable: false,
          lastAttemptAt: "2026-04-18T18:35:00.000Z",
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
        layoutMode="mobile"
      />,
    );

    expect(screen.getByTestId("companion-cosmiq-title-card")).toBeInTheDocument();
    expect(screen.getByTestId("companion-title-art-placeholder")).toBeInTheDocument();
    expect(screen.queryByText("Art unavailable")).not.toBeInTheDocument();
    expect(screen.queryByText("Art generation is paused by the budget guardrail.")).not.toBeInTheDocument();
    expect(screen.queryByText("Stats analysis is unavailable right now.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show stat analysis" }));

    expect(screen.getByText("Art generation is paused by the budget guardrail.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Regenerate title art" }));
    expect(mocks.regenerateTitleCardMock).toHaveBeenCalledWith(
      expect.objectContaining({ analysisDate: "2026-04-18" }),
    );

    expect(screen.getByText("Current Build")).toBeInTheDocument();
    expect(screen.getByText("Recommended Quest")).toBeInTheDocument();
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
