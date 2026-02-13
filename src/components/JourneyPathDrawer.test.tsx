import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  trailProps: null as Record<string, unknown> | null,
}));

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useJourneyPathImage", () => ({
  useJourneyPathImage: () => ({
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useMilestones", () => ({
  useMilestones: () => ({
    milestones: [
      {
        id: "m1",
        title: "First step",
        milestone_percent: 20,
        is_postcard_milestone: false,
        completed_at: null,
        description: null,
        phase_name: "Act 1",
        target_date: null,
        chapter_number: 1,
      },
    ],
    totalCount: 1,
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: {
      current_image_url: "https://example.com/companion.png",
      current_mood: "joyful",
    },
  }),
}));

vi.mock("@/components/ConstellationTrail", () => ({
  ConstellationTrail: (props: Record<string, unknown>) => {
    mocks.trailProps = props;
    return <div data-testid="constellation-trail-mock" />;
  },
}));

vi.mock("@/components/JourneyDetailDrawer", () => ({
  JourneyDetailDrawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { JourneyPathDrawer } from "./JourneyPathDrawer";

describe("JourneyPathDrawer", () => {
  it("passes epicId and drawer surface props to ConstellationTrail", () => {
    render(
      <JourneyPathDrawer
        epic={{
          id: "epic-1",
          title: "Hero Path",
          progress_percentage: 45,
          target_days: 30,
          start_date: "2026-01-01",
          end_date: "2026-02-01",
        }}
      >
        <button type="button">Open</button>
      </JourneyPathDrawer>,
    );

    expect(screen.getByTestId("constellation-trail-mock")).toBeInTheDocument();
    expect(mocks.trailProps).toMatchObject({
      epicId: "epic-1",
      surface: "drawer",
      motionPreset: "cinematic",
      performanceMode: "balanced",
    });
  });

  it("does not render a duplicate drawer-level journey image element", () => {
    render(
      <JourneyPathDrawer
        epic={{
          id: "epic-2",
          title: "Mystic Path",
          progress_percentage: 15,
          target_days: 20,
          start_date: "2026-01-01",
          end_date: "2026-01-21",
        }}
      >
        <button type="button">Open</button>
      </JourneyPathDrawer>,
    );

    expect(screen.queryByAltText("Your journey path")).not.toBeInTheDocument();
  });
});
