import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prefetchQuery: vi.fn().mockResolvedValue(undefined),
  mountCounts: {
    mentor: 0,
    inbox: 0,
    journeys: 0,
    companion: 0,
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    prefetchQuery: mocks.prefetchQuery,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useTasksQuery", () => ({
  DAILY_TASKS_GC_TIME: 1,
  DAILY_TASKS_STALE_TIME: 1,
  fetchDailyTasks: vi.fn().mockResolvedValue([]),
  getDailyTasksQueryKey: (_userId: string, taskDate: string) => ["daily-tasks", taskDate],
}));

vi.mock("@/pages/Mentor", async () => {
  const React = await import("react");
  const { useMainTabVisibility } = await import("@/contexts/MainTabVisibilityContext");

  return {
    default: () => {
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
    },
  };
});

vi.mock("@/pages/Inbox", async () => {
  const React = await import("react");
  const { useMainTabVisibility } = await import("@/contexts/MainTabVisibilityContext");

  return {
    default: () => {
      const { isTabActive } = useMainTabVisibility();
      React.useEffect(() => {
        mocks.mountCounts.inbox += 1;
      }, []);

      return <div data-testid="inbox-visibility">{isTabActive ? "active" : "inactive"}</div>;
    },
  };
});

vi.mock("@/pages/Journeys", async () => {
  const React = await import("react");
  const { useMainTabVisibility } = await import("@/contexts/MainTabVisibilityContext");

  return {
    default: () => {
      const { isTabActive } = useMainTabVisibility();
      React.useEffect(() => {
        mocks.mountCounts.journeys += 1;
      }, []);

      return <div data-testid="journeys-visibility">{isTabActive ? "active" : "inactive"}</div>;
    },
  };
});

vi.mock("@/pages/Companion", async () => {
  const React = await import("react");
  const { useMainTabVisibility } = await import("@/contexts/MainTabVisibilityContext");

  return {
    default: () => {
      const { isTabActive } = useMainTabVisibility();
      React.useEffect(() => {
        mocks.mountCounts.companion += 1;
      }, []);

      return <div data-testid="companion-visibility">{isTabActive ? "active" : "inactive"}</div>;
    },
  };
});

import { MainTabsKeepAlive } from "@/components/MainTabsKeepAlive";

describe("MainTabsKeepAlive", () => {
  beforeEach(() => {
    mocks.prefetchQuery.mockReset();
    mocks.prefetchQuery.mockResolvedValue(undefined);
    mocks.mountCounts.mentor = 0;
    mocks.mountCounts.inbox = 0;
    mocks.mountCounts.journeys = 0;
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

    rerender(<MainTabsKeepAlive activePath="/inbox" />);

    expect(screen.getByTestId("mentor-visibility")).toHaveTextContent("inactive");
    expect(screen.getByTestId("inbox-visibility")).toHaveTextContent("active");
  });

  it("preserves tab state and avoids remounting visited tabs", () => {
    const { rerender } = render(<MainTabsKeepAlive activePath="/mentor" />);

    fireEvent.click(screen.getByText("Increment mentor"));
    expect(screen.getByTestId("mentor-counter")).toHaveTextContent("1");
    expect(mocks.mountCounts.mentor).toBe(1);

    rerender(<MainTabsKeepAlive activePath="/inbox" />);
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
    rerender(<MainTabsKeepAlive activePath="/inbox" />);
    expect(scrollToSpy).toHaveBeenCalled();

    scrollToSpy.mockClear();
    (window as Window & { scrollY: number }).scrollY = 150;
    rerender(<MainTabsKeepAlive activePath="/mentor" />);

    expect(scrollToSpy).not.toHaveBeenCalled();
  });
});
