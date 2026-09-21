import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constellationTrailProps: [] as Array<Record<string, unknown>>,
  editCampaignSheetMock: vi.fn(),
  useCompanionMock: vi.fn(),
  useJourneyPathImageMock: vi.fn(),
  useMilestonesMock: vi.fn(),
  usePreloadedImageUrlMock: vi.fn(),
  useSharedCampaignPathMarkersMock: vi.fn(),
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
  DrawerContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
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
  JourneyDetailDrawer: ({
    children,
    companionFrostedThemeStyle,
  }: {
    children: ReactNode;
    companionFrostedThemeStyle?: CSSProperties;
  }) => (
    <div
      data-testid="mock-journey-detail-drawer"
      style={companionFrostedThemeStyle}
    >
      {children}
    </div>
  ),
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

vi.mock("@/hooks/useSharedCampaignPathMarkers", () => ({
  useSharedCampaignPathMarkers: (...args: unknown[]) => mocks.useSharedCampaignPathMarkersMock(...args),
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
    mocks.useSharedCampaignPathMarkersMock.mockReturnValue({
      markers: [],
    });
  });

  it("passes the epic id to the nested constellation trail", () => {
    render(
      <JourneyPathDrawer epic={baseEpic}>
        <button type="button">Open</button>
      </JourneyPathDrawer>,
    );

    expect(mocks.useJourneyPathImageMock).toHaveBeenCalledWith("epic-1");
    expect(mocks.useSharedCampaignPathMarkersMock).toHaveBeenCalledWith("epic-1");
    expect(mocks.constellationTrailProps[0]).toMatchObject({
      epicId: "epic-1",
      transparentBackground: false,
    });
    expect(screen.getByTestId("constellation-trail")).toBeInTheDocument();
  });

  it("passes shared campaign markers to the nested constellation trail", () => {
    const markers = [{
      userId: "friend-1",
      displayName: "Mira",
      progressPercentage: 72,
      isCurrentUser: false,
      isOwner: false,
      companionImageUrl: "https://example.com/mira.png",
      companionImageFocalX: null,
      companionImageFocalY: null,
      companionMood: "neutral",
      joinedAt: "2026-05-01T00:00:00.000Z",
      lastActivityAt: "2026-05-16T00:00:00.000Z",
    }];
    mocks.useSharedCampaignPathMarkersMock.mockReturnValue({ markers });

    render(
      <JourneyPathDrawer epic={baseEpic}>
        <button type="button">Open</button>
      </JourneyPathDrawer>,
    );

    expect(mocks.constellationTrailProps[0]).toMatchObject({
      companionMarkers: markers,
    });
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
      expect(screen.getByText("Next rhythm")).toBeInTheDocument();
      expect(screen.getByText("Portfolio work")).toBeInTheDocument();
      expect(screen.getByText("7:00 PM")).toBeInTheDocument();
      expect(screen.getByText("This week")).toBeInTheDocument();
      expect(screen.getByText("2 rhythms attached")).toBeInTheDocument();
      expect(screen.getByText("1/2 timed")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2);
      expect(screen.getByRole("button", { name: "Add rhythm" })).toBeInTheDocument();
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

  it("applies companion frosted variables to portaled drawer surfaces", () => {
    mocks.useCompanionMock.mockReturnValue({
      companion: {
        favorite_color: "#9b6bff",
      },
    });

    render(
      <JourneyPathDrawer epic={baseEpic}>
        <button type="button">Open</button>
      </JourneyPathDrawer>,
    );

    const drawerContent = screen.getByTestId("journey-path-drawer-content");
    expect(drawerContent).toHaveClass("companion-frosted-planner-light");
    expect(drawerContent.style.getPropertyValue("--companion-frosted-primary")).toBe("259 78% 70%");
    expect(screen.getByTestId("mock-journey-detail-drawer").style.getPropertyValue("--companion-frosted-primary")).toBe(
      "259 78% 70%",
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);

    expect(mocks.editCampaignSheetMock).toHaveBeenLastCalledWith(expect.objectContaining({
      companionFrostedThemeStyle: expect.objectContaining({
        "--companion-frosted-primary": "259 78% 70%",
      }),
    }));
  });

  it("opens the edit sheet directly in add ritual mode", () => {
    render(
      <JourneyPathDrawer epic={baseEpic}>
        <button type="button">Open</button>
      </JourneyPathDrawer>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add rhythm" }));

    expect(screen.getByTestId("edit-campaign-sheet")).toBeInTheDocument();
    expect(mocks.editCampaignSheetMock).toHaveBeenLastCalledWith(expect.objectContaining({
      epic: expect.objectContaining({ id: "epic-1", title: "Campaign Aurora" }),
      open: true,
      startWithAddRitual: true,
    }));
  });
});
