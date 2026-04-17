import type { HTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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

vi.mock("@/components/JourneyCard", () => ({
  JourneyCard: () => <div data-testid="journey-card" />,
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

describe("Campaigns completion summary", () => {
  beforeEach(() => {
    mocks.activeEpics = [];
    mocks.completedEpics = [];
  });

  it("reflects the active campaign progress when completed campaigns also exist", () => {
    mocks.activeEpics = [createEpic({ id: "active-1", status: "active", progress_percentage: 40 })];
    mocks.completedEpics = [
      createEpic({ id: "completed-1", status: "completed", progress_percentage: 100 }),
      createEpic({ id: "completed-2", status: "completed", progress_percentage: 100 }),
    ];

    render(<Campaigns />);

    expect(screen.getByTestId("campaigns-stat-completion")).toHaveTextContent("40%");
  });

  it("averages the progress across active campaigns", () => {
    mocks.activeEpics = [
      createEpic({ id: "active-1", status: "active", progress_percentage: 10 }),
      createEpic({ id: "active-2", status: "active", progress_percentage: 90 }),
    ];

    render(<Campaigns />);

    expect(screen.getByTestId("campaigns-stat-completion")).toHaveTextContent("50%");
  });

  it("shows 0 percent when there are no active campaigns", () => {
    mocks.completedEpics = [createEpic({ id: "completed-1", status: "completed", progress_percentage: 100 })];

    render(<Campaigns />);

    expect(screen.getByTestId("campaigns-stat-completion")).toHaveTextContent("0%");
  });

  it("treats missing active progress as zero", () => {
    mocks.activeEpics = [createEpic({ id: "active-1", status: "active", progress_percentage: null })];

    render(<Campaigns />);

    expect(screen.getByTestId("campaigns-stat-completion")).toHaveTextContent("0%");
  });
});
