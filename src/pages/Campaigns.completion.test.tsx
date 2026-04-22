import type { HTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

type MockEpic = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: "active" | "completed";
  progressPercentage: number | null;
  targetDays: number;
  startDate: string;
  endDate: string | null;
  themeColor: string | null;
  habitCount: number;
  milestoneCount: number;
  latestJourneyPathUrl: string | null;
  latestJourneyPathGeneratedAt: string | null;
  latestJourneyPathMilestoneIndex: number | null;
  createdAt: string | null;
  completedAt: string | null;
  xpReward: number | null;
  isPublic: boolean | null;
  inviteCode: string | null;
  storyTypeSlug: string | null;
  rituals: [];
};

const mocks = vi.hoisted(() => ({
  activeCampaigns: [] as MockEpic[],
  completedCampaigns: [] as MockEpic[],
}));

const createEpic = ({
  id,
  status,
  progress_percentage,
}: {
  id: string;
  status: "active" | "completed";
  progress_percentage: number | null;
}): MockEpic => ({
  id,
  userId: "user-1",
  title: `${status}-${id}`,
  description: null,
  status,
  progressPercentage: progress_percentage,
  targetDays: 14,
  startDate: "2026-04-01",
  endDate: status === "completed" ? "2026-04-14" : null,
  themeColor: null,
  habitCount: 0,
  milestoneCount: 0,
  latestJourneyPathUrl: null,
  latestJourneyPathGeneratedAt: null,
  latestJourneyPathMilestoneIndex: null,
  createdAt: "2026-04-01T00:00:00.000Z",
  completedAt: status === "completed" ? "2026-04-14T00:00:00.000Z" : null,
  xpReward: 140,
  isPublic: false,
  inviteCode: null,
  storyTypeSlug: null,
  rituals: [],
});

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  useReducedMotion: () => false,
}));

vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/CinematicPageBackground", () => ({
  CinematicPageBackground: () => null,
}));

vi.mock("@/components/PageInfoButton", () => ({
  PageInfoButton: () => null,
}));

vi.mock("@/components/PageInfoModal", () => ({
  PageInfoModal: () => null,
}));

vi.mock("@/components/CampaignCard", () => ({
  CampaignCard: () => <div data-testid="campaign-card" />,
}));

vi.mock("@/components/Pathfinder", () => ({
  Pathfinder: () => null,
}));

vi.mock("@/components/CampaignCreatedAnimation", () => ({
  CampaignCreatedAnimation: () => null,
}));

vi.mock("@/contexts/MainTabVisibilityContext", () => ({
  useMainTabVisibility: () => ({
    isTabActive: true,
  }),
}));

vi.mock("@/hooks/useCampaigns", () => ({
  useCampaigns: () => ({
    activeCampaigns: mocks.activeCampaigns,
    completedCampaigns: mocks.completedCampaigns,
    isLoading: false,
    createCampaign: vi.fn(),
    isCreating: false,
    renameCampaign: vi.fn(),
    updateCampaignStatus: vi.fn(),
  }),
}));

import Campaigns from "./Campaigns";

describe("Campaigns populated layout", () => {
  beforeEach(() => {
    mocks.activeCampaigns = [];
    mocks.completedCampaigns = [];
  });

  it("places the create button inside the existing campaigns section above the active campaign cards", () => {
    mocks.activeCampaigns = [createEpic({ id: "active-1", status: "active", progress_percentage: 40 })];
    mocks.completedCampaigns = [
      createEpic({ id: "completed-1", status: "completed", progress_percentage: 100 }),
      createEpic({ id: "completed-2", status: "completed", progress_percentage: 100 }),
    ];

    render(<Campaigns />);

    const existingSection = screen.getByTestId("campaigns-existing-section");
    const createButton = within(existingSection).getByTestId("campaigns-create-button");
    const firstCampaignCard = within(existingSection).getAllByTestId("campaign-card")[0];

    expect(within(existingSection).getByText("Existing campaigns")).toBeInTheDocument();
    expect(
      createButton.compareDocumentPosition(firstCampaignCard) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("does not render the removed campaign summary stats", () => {
    mocks.activeCampaigns = [
      createEpic({ id: "active-1", status: "active", progress_percentage: 10 }),
      createEpic({ id: "active-2", status: "active", progress_percentage: 90 }),
    ];
    mocks.completedCampaigns = [createEpic({ id: "completed-1", status: "completed", progress_percentage: 100 })];

    render(<Campaigns />);

    expect(screen.queryByTestId("campaigns-stat-active")).not.toBeInTheDocument();
    expect(screen.queryByTestId("campaigns-stat-completed")).not.toBeInTheDocument();
    expect(screen.queryByTestId("campaigns-stat-completion")).not.toBeInTheDocument();
  });
});
