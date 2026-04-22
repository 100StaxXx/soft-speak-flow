import type { HTMLAttributes, ReactNode } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  campaignCardMock: vi.fn((_props?: unknown) => <div data-testid="campaign-card" />),
  renameCampaignMock: vi.fn(),
}));

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
  CampaignCard: (props: unknown) => mocks.campaignCardMock(props),
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
    activeCampaigns: [
      {
        id: "active-1",
        userId: "user-1",
        title: "Active Campaign",
        description: null,
        status: "active",
        progressPercentage: 10,
        targetDays: 14,
        startDate: "2026-04-01",
        endDate: null,
        themeColor: null,
        habitCount: 0,
        milestoneCount: 0,
        latestJourneyPathUrl: null,
        latestJourneyPathGeneratedAt: null,
        latestJourneyPathMilestoneIndex: null,
        createdAt: "2026-04-01T00:00:00.000Z",
        completedAt: null,
        xpReward: 140,
        isPublic: false,
        inviteCode: null,
        storyTypeSlug: null,
        rituals: [],
      },
    ],
    completedCampaigns: [
      {
        id: "complete-1",
        userId: "user-1",
        title: "Completed Campaign",
        description: null,
        status: "completed",
        progressPercentage: 100,
        targetDays: 14,
        startDate: "2026-03-01",
        endDate: "2026-03-14",
        themeColor: null,
        habitCount: 0,
        milestoneCount: 0,
        latestJourneyPathUrl: null,
        latestJourneyPathGeneratedAt: null,
        latestJourneyPathMilestoneIndex: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        completedAt: "2026-03-14T00:00:00.000Z",
        xpReward: 140,
        isPublic: false,
        inviteCode: null,
        storyTypeSlug: null,
        rituals: [],
      },
    ],
    isLoading: false,
    createCampaign: vi.fn(),
    isCreating: false,
    renameCampaign: mocks.renameCampaignMock,
    updateCampaignStatus: vi.fn(),
  }),
}));

import Campaigns from "./Campaigns";

describe("Campaigns rename wiring", () => {
  it("passes onRename only to active campaign cards", () => {
    render(<Campaigns />);

    expect(mocks.campaignCardMock).toHaveBeenCalledTimes(2);

    const activeCallProps = mocks.campaignCardMock.mock.calls[0]?.[0] as { onRename?: unknown };
    const completedCallProps = mocks.campaignCardMock.mock.calls[1]?.[0] as { onRename?: unknown };

    expect(typeof activeCallProps.onRename).toBe("function");
    expect(completedCallProps.onRename).toBeUndefined();
  });
});
