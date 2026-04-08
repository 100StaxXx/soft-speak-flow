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
    activeEpics: [],
    completedEpics: [],
    isLoading: false,
    createEpic: vi.fn(),
    isCreating: false,
    updateEpicStatus: vi.fn(),
  }),
}));

import Campaigns from "./Campaigns";

describe("Campaigns background", () => {
  it("uses the campaigns cinematic wallpaper preset", () => {
    render(<Campaigns />);

    expect(screen.getByTestId("cinematic-background")).toHaveAttribute("data-preset", "campaigns");
  });
});
