import type { HTMLAttributes, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constellationTrailProps: [] as Array<Record<string, unknown>>,
  useCompanionMock: vi.fn(),
  useJourneyPathImageMock: vi.fn(),
  useMilestonesMock: vi.fn(),
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

vi.mock("@/hooks/useJourneyPathImage", () => ({
  useJourneyPathImage: (...args: unknown[]) => mocks.useJourneyPathImageMock(...args),
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

describe("JourneyPathDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.constellationTrailProps.length = 0;
    mocks.useJourneyPathImageMock.mockReturnValue({
      pathImageUrl: null,
    });
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
});
