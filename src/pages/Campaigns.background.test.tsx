import type { HTMLAttributes, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
  CinematicPageBackground: ({ preset }: { preset: string }) => (
    <div data-testid="cinematic-background" data-preset={preset} />
  ),
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

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useEpics", () => ({
  useEpics: () => ({
    activeEpics: [],
    completedEpics: [],
    isLoading: false,
    createEpic: vi.fn(),
    isCreating: false,
    renameEpic: vi.fn(),
    updateEpicStatus: vi.fn(),
  }),
}));

import Campaigns from "./Campaigns";

describe("Campaigns background", () => {
  it("uses the campaigns cinematic wallpaper preset", () => {
    render(<Campaigns />);

    expect(screen.getByTestId("cinematic-background")).toHaveAttribute("data-preset", "campaigns");
    expect(screen.queryByText("Campaign command center")).not.toBeInTheDocument();
    expect(screen.getByTestId("campaigns-empty-state-button")).toHaveClass("bg-celestial-blue/14");
    expect(screen.queryByTestId("campaigns-create-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("campaigns-stat-active")).not.toBeInTheDocument();
    expect(screen.queryByTestId("campaigns-stat-completed")).not.toBeInTheDocument();
    expect(screen.queryByTestId("campaigns-stat-completion")).not.toBeInTheDocument();
    expect(screen.getByTestId("campaigns-empty-state-panel")).toHaveClass("border-celestial-blue/18");
    expect(screen.getByTestId("campaigns-empty-state-panel")).toHaveClass("border-dashed");
    expect(screen.getByTestId("campaigns-empty-state-panel").className).toContain("bg-transparent");
    expect(screen.getByTestId("campaigns-empty-state-panel").className).toContain("backdrop-blur-none");
    expect(screen.getByTestId("campaigns-empty-state-panel").className).toContain("shadow-none");
  });
});
