import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Milestone } from "@/hooks/useMilestones";

const mocks = vi.hoisted(() => ({
  useMilestonesMock: vi.fn(),
  rescheduleProps: null as null | { companionFrostedThemeStyle?: CSSProperties; visualStyle?: string },
}));

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DrawerHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DrawerTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
  DrawerTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useMilestones", () => ({
  useMilestones: (...args: unknown[]) => mocks.useMilestonesMock(...args),
}));

vi.mock("@/hooks/useCompanionPostcards", () => ({
  useCompanionPostcards: () => ({
    postcards: [],
    checkMilestoneForPostcard: vi.fn(),
    postcardJustUnlocked: null,
    clearPostcardUnlocked: vi.fn(),
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: null,
  }),
}));

vi.mock("@/hooks/useXPRewards", () => ({
  useXPRewards: () => ({
    awardMilestoneComplete: vi.fn(),
    awardPhaseComplete: vi.fn(),
    awardEpicComplete: vi.fn(),
  }),
}));

vi.mock("@/hooks/useJourneyPathImage", () => ({
  useJourneyPathImage: () => ({
    regeneratePathForMilestone: vi.fn(),
  }),
}));

vi.mock("@/hooks/usePlannerPathfinderAppearance", () => ({
  usePlannerPathfinderAppearance: () => ({
    themeModeClassName: "companion-frosted-planner-light",
  }),
}));

vi.mock("./RescheduleDrawer", () => ({
  RescheduleDrawer: ({
    children,
    companionFrostedThemeStyle,
    visualStyle,
  }: {
    children: ReactNode;
    companionFrostedThemeStyle?: CSSProperties;
    visualStyle?: string;
  }) => {
    mocks.rescheduleProps = { companionFrostedThemeStyle, visualStyle };
    return <div data-testid="reschedule-drawer-trigger">{children}</div>;
  },
}));

vi.mock("./PostcardUnlockCelebration", () => ({
  PostcardUnlockCelebration: () => null,
}));

vi.mock("./journey/MilestoneDetailDrawer", () => ({
  MilestoneDetailDrawer: () => null,
}));

import { JourneyDetailDrawer } from "./JourneyDetailDrawer";

const milestone = (overrides: Partial<Milestone> & Pick<Milestone, "id" | "title">): Milestone => ({
  id: overrides.id,
  epic_id: "epic-1",
  user_id: "user-1",
  title: overrides.title,
  description: null,
  milestone_percent: 25,
  completed_at: null,
  target_date: "2026-05-22T12:00:00.000Z",
  phase_name: "General",
  phase_order: 0,
  is_postcard_milestone: false,
  chapter_number: null,
  is_surfaced: null,
  surfaced_at: null,
  ...overrides,
});

const milestones = [
  milestone({
    id: "pending",
    title: "Nutrition Plan in Place",
    target_date: "2026-05-22T12:00:00.000Z",
  }),
  milestone({
    id: "completed",
    title: "Chapter 1",
    completed_at: "2026-05-10T12:00:00.000Z",
    target_date: "2026-05-24T12:00:00.000Z",
  }),
  milestone({
    id: "overdue",
    title: "Strength Training Routine Started",
    target_date: "2026-05-01T12:00:00.000Z",
  }),
  milestone({
    id: "postcard",
    title: "Final Results Review",
    is_postcard_milestone: true,
    target_date: "2026-06-30T12:00:00.000Z",
  }),
];

describe("JourneyDetailDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rescheduleProps = null;
    mocks.useMilestonesMock.mockReturnValue({
      milestones,
      milestonesByPhase: [{ phaseName: "General", phaseOrder: 0, milestones }],
      isLoading: false,
      completedCount: 1,
      totalCount: milestones.length,
      completeMilestone: { mutate: vi.fn() },
      uncompleteMilestone: { mutate: vi.fn() },
      getCurrentPhase: () => "General",
      isMilestoneOverdue: (candidate: Milestone) => candidate.id === "overdue",
      isCompleting: false,
    });
  });

  it("uses an explicit planner surface for the milestones drawer", () => {
    render(
      <JourneyDetailDrawer
        epicId="epic-1"
        epicTitle="Get shredded for summer (body)"
        currentDeadline="2026-06-30T12:00:00.000Z"
      >
        <button type="button">Milestones</button>
      </JourneyDetailDrawer>,
    );

    const drawer = screen.getByTestId("journey-detail-drawer-content");
    expect(drawer).toHaveClass("companion-frosted-planner-light");
    expect(drawer).toHaveClass("rounded-t-[2.25rem]");
    expect(drawer).toHaveClass("border-2");
    expect(drawer).toHaveClass("text-foreground");
    expect(drawer.className).toContain("bg-[linear-gradient");

    expect(screen.getByText("Get shredded for summer (body)")).toHaveClass("break-words");
    expect(screen.getByText("1 / 4 milestones")).toHaveClass("text-foreground");
    expect(screen.getByText("Current: General")).toHaveClass("text-foreground");
    expect(screen.getByRole("button", { name: /reschedule/i })).toHaveClass("text-foreground");
    expect(mocks.rescheduleProps?.visualStyle).toBe("planner");
  });

  it("renders milestone rows as readable light planner cards", () => {
    render(
      <JourneyDetailDrawer epicId="epic-1" epicTitle="Get shredded for summer (body)">
        <button type="button">Milestones</button>
      </JourneyDetailDrawer>,
    );

    expect(screen.getByTestId("journey-milestone-row-pending").className).toContain(
      "bg-[linear-gradient(180deg,hsl(var(--card)_/_0.97),hsl(var(--secondary)_/_0.68))]",
    );
    expect(screen.getByTestId("journey-milestone-row-completed").className).toContain(
      "bg-[linear-gradient(180deg,hsl(var(--card)_/_0.97),hsl(var(--epic-nature)_/_0.08))]",
    );
    expect(screen.getByTestId("journey-milestone-row-overdue").className).toContain(
      "bg-[linear-gradient(180deg,hsl(var(--card)_/_0.97),hsl(var(--destructive)_/_0.08))]",
    );

    for (const id of ["pending", "completed", "overdue", "postcard"]) {
      expect(screen.getByTestId(`journey-milestone-title-${id}`)).toHaveClass("text-foreground");
    }

    expect(screen.getByTestId("journey-milestone-title-completed")).toHaveClass("line-through");
    expect(screen.getByTestId("journey-milestone-date-pending")).toHaveClass("text-foreground/70");
    expect(screen.getByTestId("journey-milestone-date-overdue")).toHaveClass("text-destructive");
  });
});
