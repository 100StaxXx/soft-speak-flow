import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  warmDailyTasksQueryFromRemote: vi.fn().mockResolvedValue([]),
  warmEpicsQueryFromRemote: vi.fn().mockResolvedValue([]),
  mountCounts: {
    mentor: 0,
    journeys: 0,
    campaigns: 0,
    companion: 0,
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({}),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/utils/plannerSync", () => ({
  warmDailyTasksQueryFromRemote: (...args: unknown[]) => mocks.warmDailyTasksQueryFromRemote(...args),
  warmEpicsQueryFromRemote: (...args: unknown[]) => mocks.warmEpicsQueryFromRemote(...args),
}));

vi.mock("@/pages/Mentor", async () => {
  const React = await import("react");
  const { useMainTabVisibility } = await import("@/contexts/MainTabVisibilityContext");
  const MentorPageMock = () => {
    const { isTabActive } = useMainTabVisibility();
    const [counter, setCounter] = React.useState(0);

    React.useEffect(() => {
      mocks.mountCounts.mentor += 1;
    }, []);

    return (
      <div data-testid="mentor-tab">
        <span data-testid="mentor-visibility">{isTabActive ? "active" : "inactive"}</span>
        <span data-testid="mentor-counter">{counter}</span>
        <button onClick={() => setCounter((prev) => prev + 1)}>Increment mentor</button>
      </div>
    );
  };

  return { default: MentorPageMock };
});

vi.mock("@/pages/Campaigns", async () => {
  const React = await import("react");
  const { useMainTabVisibility } = await import("@/contexts/MainTabVisibilityContext");
  const CampaignsPageMock = () => {
    const { isTabActive } = useMainTabVisibility();
    React.useEffect(() => {
      mocks.mountCounts.campaigns += 1;
    }, []);

    return <div data-testid="campaigns-visibility">{isTabActive ? "active" : "inactive"}</div>;
  };

  return { default: CampaignsPageMock };
});

vi.mock("@/pages/Journeys", async () => {
  const React = await import("react");
  const { useMainTabVisibility } = await import("@/contexts/MainTabVisibilityContext");
  const JourneysPageMock = () => {
    const { isTabActive } = useMainTabVisibility();
    React.useEffect(() => {
      mocks.mountCounts.journeys += 1;
    }, []);

    return <div data-testid="journeys-visibility">{isTabActive ? "active" : "inactive"}</div>;
  };

  return { default: JourneysPageMock };
});

vi.mock("@/pages/Companion", async () => {
  const React = await import("react");
  const { useMainTabVisibility } = await import("@/contexts/MainTabVisibilityContext");
  const CompanionPageMock = () => {
    const { isTabActive } = useMainTabVisibility();
    React.useEffect(() => {
      mocks.mountCounts.companion += 1;
    }, []);

    return <div data-testid="companion-visibility">{isTabActive ? "active" : "inactive"}</div>;
  };

  return { default: CompanionPageMock };
});

import { MainTabsKeepAlive } from "@/components/MainTabsKeepAlive";

describe("MainTabsKeepAlive", () => {
  beforeEach(() => {
    mocks.warmDailyTasksQueryFromRemote.mockReset();
    mocks.warmDailyTasksQueryFromRemote.mockResolvedValue([]);
    mocks.warmEpicsQueryFromRemote.mockReset();
    mocks.warmEpicsQueryFromRemote.mockResolvedValue([]);
    mocks.mountCounts.mentor = 0;
    mocks.mountCounts.journeys = 0;
    mocks.mountCounts.campaigns = 0;
    mocks.mountCounts.companion = 0;

    let rafId = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      rafId += 1;
      callback(0);
      return rafId;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("provides active/inactive tab visibility through context", () => {
    const { rerender } = render(<MainTabsKeepAlive activePath="/mentor" />);

    expect(screen.getByTestId("mentor-visibility")).toHaveTextContent("active");

    rerender(<MainTabsKeepAlive activePath="/campaigns" />);

    expect(screen.getByTestId("mentor-visibility")).toHaveTextContent("inactive");
    expect(screen.getByTestId("campaigns-visibility")).toHaveTextContent("active");
  });

  it("prefetches journeys tasks and epics on mount", () => {
    render(<MainTabsKeepAlive activePath="/mentor" />);

    expect(mocks.warmDailyTasksQueryFromRemote).toHaveBeenCalledTimes(1);
    expect(mocks.warmDailyTasksQueryFromRemote).toHaveBeenCalledWith(expect.any(Object), "user-1", expect.any(String));
    expect(mocks.warmEpicsQueryFromRemote).toHaveBeenCalledTimes(1);
    expect(mocks.warmEpicsQueryFromRemote).toHaveBeenCalledWith(expect.any(Object), "user-1");
  });

  it("preserves tab state and avoids remounting visited tabs", () => {
    const { rerender } = render(<MainTabsKeepAlive activePath="/mentor" />);

    fireEvent.click(screen.getByText("Increment mentor"));
    expect(screen.getByTestId("mentor-counter")).toHaveTextContent("1");
    expect(mocks.mountCounts.mentor).toBe(1);

    rerender(<MainTabsKeepAlive activePath="/campaigns" />);
    rerender(<MainTabsKeepAlive activePath="/mentor" />);

    expect(screen.getByTestId("mentor-counter")).toHaveTextContent("1");
    expect(mocks.mountCounts.mentor).toBe(1);
  });

  it("skips no-op scroll restoration when already at target scroll", () => {
    const scrollToSpy = vi.spyOn(window, "scrollTo");
    const { rerender } = render(<MainTabsKeepAlive activePath="/mentor" />);

    // Initial render should not force scroll restoration.
    expect(scrollToSpy).not.toHaveBeenCalled();

    (window as Window & { scrollY: number }).scrollY = 150;
    rerender(<MainTabsKeepAlive activePath="/campaigns" />);
    expect(scrollToSpy).toHaveBeenCalled();

    scrollToSpy.mockClear();
    (window as Window & { scrollY: number }).scrollY = 150;
    rerender(<MainTabsKeepAlive activePath="/mentor" />);

    expect(scrollToSpy).not.toHaveBeenCalled();
  });
});
