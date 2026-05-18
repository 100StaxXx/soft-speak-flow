import type { HTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { Pathfinder } from "@/components/Pathfinder";

type MockEpic = {
  id: string;
  title: string;
  user_id: string;
  description: string | null;
  status: "active" | "completed";
  progress_percentage: number | null;
  target_days: number;
  start_date: string;
  end_date: string | null;
  xp_reward: number;
  epic_habits: [];
};

const mocks = vi.hoisted(() => ({
  activeEpics: [] as MockEpic[],
  completedEpics: [] as MockEpic[],
  creationMarker: null as null | {
    surface: "campaign";
    route: "/campaigns";
    selectedDate: null;
    updatedAt: string;
  },
  campaignDraft: null as null | { updatedAt: string; goalInput: string },
  lastPathfinderProps: null as null | ComponentProps<typeof Pathfinder>,
  pathfinderMountCount: 0,
  lastPathfinderMountId: null as number | null,
  writeCreationPopupMarker: vi.fn(),
  clearCreationPopupMarker: vi.fn(),
  clearCampaignBuilderDraftSnapshot: vi.fn(),
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
  title: `${status}-${id}`,
  user_id: "user-1",
  description: null,
  status,
  progress_percentage,
  target_days: 14,
  start_date: "2026-04-01",
  end_date: status === "completed" ? "2026-04-14" : null,
  xp_reward: 140,
  epic_habits: [],
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

vi.mock("@/components/Pathfinder", async () => {
  const React = await import("react");

  return {
    Pathfinder: (props: ComponentProps<typeof Pathfinder>) => {
      const mountIdRef = React.useRef<number | null>(null);

      if (mountIdRef.current === null) {
        mocks.pathfinderMountCount += 1;
        mountIdRef.current = mocks.pathfinderMountCount;
      }

      mocks.lastPathfinderProps = props;
      mocks.lastPathfinderMountId = mountIdRef.current;

      return React.createElement("div", {
        "data-testid": "pathfinder",
        "data-open": String(props.open),
        "data-mount-id": mountIdRef.current,
      });
    },
  };
});

vi.mock("@/components/CampaignCreatedAnimation", () => ({
  CampaignCreatedAnimation: () => null,
}));

vi.mock("@/contexts/MainTabVisibilityContext", () => ({
  useMainTabVisibility: () => ({
    isTabActive: true,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useJourneysCompanionVisual", () => ({
  useJourneysCompanionVisual: () => ({
    favoriteColor: "#58d68d",
  }),
}));

vi.mock("@/utils/creationPopupPersistence", () => ({
  readCreationPopupMarker: () => mocks.creationMarker,
  readCampaignBuilderDraftSnapshot: () => mocks.campaignDraft,
  writeCreationPopupMarker: mocks.writeCreationPopupMarker,
  clearCreationPopupMarker: mocks.clearCreationPopupMarker,
  clearCampaignBuilderDraftSnapshot: mocks.clearCampaignBuilderDraftSnapshot,
}));

vi.mock("@/hooks/useEpics", () => ({
  useEpics: () => ({
    activeEpics: mocks.activeEpics,
    completedEpics: mocks.completedEpics,
    isLoading: false,
    createEpic: vi.fn(),
    isCreating: false,
    renameEpic: vi.fn(),
    updateEpicStatus: vi.fn(),
  }),
}));

import Campaigns from "./Campaigns";

describe("Campaigns populated layout", () => {
  beforeEach(() => {
    mocks.activeEpics = [];
    mocks.completedEpics = [];
    mocks.creationMarker = null;
    mocks.campaignDraft = null;
    mocks.lastPathfinderProps = null;
    mocks.pathfinderMountCount = 0;
    mocks.lastPathfinderMountId = null;
    mocks.writeCreationPopupMarker.mockClear();
    mocks.clearCreationPopupMarker.mockClear();
    mocks.clearCampaignBuilderDraftSnapshot.mockClear();
  });

  it("places the create button inside the existing campaigns section above the active campaign cards", () => {
    mocks.activeEpics = [createEpic({ id: "active-1", status: "active", progress_percentage: 40 })];
    mocks.completedEpics = [
      createEpic({ id: "completed-1", status: "completed", progress_percentage: 100 }),
      createEpic({ id: "completed-2", status: "completed", progress_percentage: 100 }),
    ];

    render(<Campaigns />);

    expect(screen.getByTestId("campaigns-theme-scope")).not.toHaveClass("companion-frosted-theme-scope");
    expect(screen.getByTestId("campaigns-theme-scope").style.getPropertyValue("--companion-frosted-primary")).toBe(
      "145 61% 59%",
    );
    const existingSection = screen.getByTestId("campaigns-existing-section");
    const createButton = within(existingSection).getByTestId("campaigns-create-button");
    const firstCampaignCard = within(existingSection).getAllByTestId("campaign-card")[0];

    expect(within(existingSection).getByText("Existing campaigns")).toBeInTheDocument();
    expect(
      createButton.compareDocumentPosition(firstCampaignCard) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("does not render the removed campaign summary stats", () => {
    mocks.activeEpics = [
      createEpic({ id: "active-1", status: "active", progress_percentage: 10 }),
      createEpic({ id: "active-2", status: "active", progress_percentage: 90 }),
    ];
    mocks.completedEpics = [createEpic({ id: "completed-1", status: "completed", progress_percentage: 100 })];

    render(<Campaigns />);

    expect(screen.queryByTestId("campaigns-stat-active")).not.toBeInTheDocument();
    expect(screen.queryByTestId("campaigns-stat-completed")).not.toBeInTheDocument();
    expect(screen.queryByTestId("campaigns-stat-completion")).not.toBeInTheDocument();
  });

  it("opens a fresh Pathfinder session when the create campaign button is clicked", async () => {
    mocks.activeEpics = [createEpic({ id: "active-1", status: "active", progress_percentage: 40 })];
    mocks.campaignDraft = {
      updatedAt: "2026-05-01T12:01:00.000Z",
      goalInput: "Old campaign draft",
    };

    render(<Campaigns />);

    const initialPathfinderMountId = mocks.lastPathfinderMountId;

    fireEvent.click(screen.getByTestId("campaigns-create-button"));

    await waitFor(() => {
      expect(mocks.lastPathfinderProps?.open).toBe(true);
    });

    expect(mocks.clearCreationPopupMarker).toHaveBeenCalledWith("user-1", "campaign");
    expect(mocks.clearCampaignBuilderDraftSnapshot).toHaveBeenCalledWith("user-1");
    expect(mocks.lastPathfinderProps?.resumeDraft).toBeNull();
    expect(mocks.lastPathfinderProps?.resumeDraftKey).toBeNull();
    expect(mocks.lastPathfinderMountId).not.toBe(initialPathfinderMountId);
  });

  it("reopens Pathfinder with a stored campaign draft for the campaigns tab", async () => {
    mocks.creationMarker = {
      surface: "campaign",
      route: "/campaigns",
      selectedDate: null,
      updatedAt: "2026-05-01T12:00:00.000Z",
    };
    mocks.campaignDraft = {
      updatedAt: "2026-05-01T12:01:00.000Z",
      goalInput: "Recovered campaign",
    };

    render(<Campaigns />);

    await waitFor(() => {
      expect(mocks.lastPathfinderProps?.open).toBe(true);
    });
    expect(mocks.lastPathfinderProps?.resumeDraft).toBe(mocks.campaignDraft);
    expect(mocks.lastPathfinderProps?.resumeDraftKey).toBe("resume-2026-05-01T12:00:00.000Z");
  });
});
