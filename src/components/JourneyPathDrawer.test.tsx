import type { HTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constellationTrailProps: [] as Array<Record<string, unknown>>,
  editCampaignSheetMock: vi.fn(),
  useCompanionMock: vi.fn(),
  useJourneyPathImageMock: vi.fn(),
  useMilestonesMock: vi.fn(),
  usePreloadedImageUrlMock: vi.fn(),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      transition: _transition,
      ...props
    }: HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => <div {...props}>{children}</div>,
  },
}));

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DrawerTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: HTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value }: { value: number }) => <div data-testid="journey-progress">{value}</div>,
}));

vi.mock("@/components/ConstellationTrail", () => ({
  ConstellationTrail: (props: Record<string, unknown>) => {
    mocks.constellationTrailProps.push(props);
    return <div data-testid="constellation-trail" />;
  },
}));

vi.mock("@/components/JourneyDetailDrawer", () => ({
  JourneyDetailDrawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/EditCampaignSheet", () => ({
  EditCampaignSheet: (props: Record<string, unknown>) => {
    mocks.editCampaignSheetMock(props);
    return (props.open as boolean)
      ? <div data-testid="edit-campaign-sheet">Edit campaign sheet</div>
      : null;
  },
}));

vi.mock("@/hooks/useJourneyPathImage", () => ({
  useJourneyPathImage: (...args: unknown[]) => mocks.useJourneyPathImageMock(...args),
}));

vi.mock("@/hooks/usePreloadedImageUrl", () => ({
  usePreloadedImageUrl: (...args: unknown[]) => mocks.usePreloadedImageUrlMock(...args),
}));

vi.mock("@/hooks/useMilestones", () => ({
  useMilestones: (...args: unknown[]) => mocks.useMilestonesMock(...args),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: (...args: unknown[]) => mocks.useCompanionMock(...args),
}));

import { JourneyPathDrawer } from "./JourneyPathDrawer";

const baseEpic = {
  id: "epic-1",
  title: "Campaign Aurora",
  description: "A focused campaign",
  progress_percentage: 42,
  target_days: 30,
  start_date: "2026-03-01",
  end_date: "2026-03-31",
  epic_habits: [],
};

const epicWithRituals = {
  ...baseEpic,
  epic_habits: [
    {
      habit_id: "habit-portfolio",
      habits: {
        id: "habit-portfolio",
        title: "Portfolio work",
        difficulty: "medium",
        preferred_time: "19:00",
      },
    },
    {
      habit_id: "habit-review",
      habits: {
        id: "habit-review",
        title: "Weekly review",
        difficulty: "easy",
      },
    },
  ],
};

describe("JourneyPathDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.constellationTrailProps.length = 0;
    mocks.useJourneyPathImageMock.mockReturnValue({
      pathImageUrl: null,
    });
    mocks.usePreloadedImageUrlMock.mockImplementation((imageUrl: string | null) => ({
      hasError: false,
      isLoaded: !!imageUrl,
      isLoading: false,
      resolvedImageUrl: imageUrl,
    }));
    mocks.useMilestonesMock.mockReturnValue({
      milestones: [],
      totalCount: 0,
    });
    mocks.useCompanionMock.mockReturnValue({
      companion: null,
    });
  });

  it("passes the epic id to the nested constellation trail", () => {
    render(
      <JourneyPathDrawer epic={baseEpic}>
        <button type="button">Open</button>
      </JourneyPathDrawer>,
    );

    expect(mocks.useJourneyPathImageMock).toHaveBeenCalledWith("epic-1");
    expect(mocks.constellationTrailProps[0]).toMatchObject({
      epicId: "epic-1",
      transparentBackground: false,
    });
    expect(screen.getByTestId("constellation-trail")).toBeInTheDocument();
  });

  it("renders quick view image, progress, ritual summary, and actions", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));
    mocks.useJourneyPathImageMock.mockReturnValue({
      pathImageUrl: "https://example.com/journey.png",
    });
    mocks.useMilestonesMock.mockReturnValue({
      milestones: [],
      totalCount: 3,
    });

    try {
      const { container } = render(
        <JourneyPathDrawer epic={epicWithRituals}>
          <button type="button">Open</button>
        </JourneyPathDrawer>,
      );

      expect(container.querySelector('img[src="https://example.com/journey.png"]')).toBeInTheDocument();
      expect(screen.getByText("42% Complete")).toBeInTheDocument();
      expect(screen.getByText("16d left")).toBeInTheDocument();
      expect(screen.getByText("Next ritual")).toBeInTheDocument();
      expect(screen.getByText("Portfolio work")).toBeInTheDocument();
      expect(screen.getByText("7:00 PM")).toBeInTheDocument();
      expect(screen.getByText("This week")).toBeInTheDocument();
      expect(screen.getByText("2 rituals attached")).toBeInTheDocument();
      expect(screen.getByText("1/2 timed")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2);
      expect(screen.getByRole("button", { name: "Add ritual" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Milestones" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders an edit button and opens the campaign edit sheet", () => {
    render(
      <JourneyPathDrawer epic={baseEpic}>
        <button type="button">Open</button>
      </JourneyPathDrawer>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);

    expect(screen.getByTestId("edit-campaign-sheet")).toBeInTheDocument();
    expect(mocks.editCampaignSheetMock).toHaveBeenLastCalledWith(expect.objectContaining({
      epic: expect.objectContaining({ id: "epic-1", title: "Campaign Aurora" }),
      open: true,
      startWithAddRitual: false,
    }));
  });

  it("opens the edit sheet directly in add ritual mode", () => {
    render(
      <JourneyPathDrawer epic={baseEpic}>
        <button type="button">Open</button>
      </JourneyPathDrawer>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add ritual" }));

    expect(screen.getByTestId("edit-campaign-sheet")).toBeInTheDocument();
    expect(mocks.editCampaignSheetMock).toHaveBeenLastCalledWith(expect.objectContaining({
      epic: expect.objectContaining({ id: "epic-1", title: "Campaign Aurora" }),
      open: true,
      startWithAddRitual: true,
    }));
  });
});
