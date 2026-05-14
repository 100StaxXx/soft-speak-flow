import type { HTMLAttributes, ReactNode } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  campaignCardMock: vi.fn((_props: unknown) => <div data-testid="campaign-card" />),
  renameEpicMock: vi.fn(),
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

vi.mock("@/hooks/useJourneysCompanionVisual", () => ({
  useJourneysCompanionVisual: () => ({
    favoriteColor: "#f5b942",
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useEpics", () => ({
  useEpics: () => ({
    activeEpics: [
      {
        id: "active-1",
        title: "Active Campaign",
        user_id: "user-1",
        description: null,
        status: "active",
        progress_percentage: 10,
        target_days: 14,
        start_date: "2026-04-01",
        end_date: null,
        xp_reward: 140,
        epic_habits: [],
      },
    ],
    completedEpics: [
      {
        id: "complete-1",
        title: "Completed Campaign",
        user_id: "user-1",
        description: null,
        status: "completed",
        progress_percentage: 100,
        target_days: 14,
        start_date: "2026-03-01",
        end_date: "2026-03-14",
        xp_reward: 140,
        epic_habits: [],
      },
    ],
    isLoading: false,
    createEpic: vi.fn(),
    isCreating: false,
    renameEpic: mocks.renameEpicMock,
    updateEpicStatus: vi.fn(),
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
