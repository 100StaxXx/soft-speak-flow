import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prefetchQuery: vi.fn().mockResolvedValue(undefined),
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
  fetchDailyTasks: vi.fn().mockResolvedValue([]),
  enableTabTransitions: true,
  loggerEnd: vi.fn(),
  renderCounts: {
    mentor: 0,
    inbox: 0,
    journeys: 0,
    companion: 0,
  },
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({
      prefetchQuery: mocks.prefetchQuery,
      invalidateQueries: mocks.invalidateQueries,
    }),
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useMotionProfile", () => ({
  useMotionProfile: () => ({
    capabilities: {
      allowParallax: true,
      maxParticles: 40,
      allowBackgroundAnimation: true,
      enableTabTransitions: mocks.enableTabTransitions,
      hapticsMode: "web",
    },
  }),
}));

vi.mock("@/hooks/useTasksQuery", () => ({
  DAILY_TASKS_STALE_TIME: 1,
  DAILY_TASKS_GC_TIME: 1,
  fetchDailyTasks: (...args: unknown[]) => mocks.fetchDailyTasks(...args),
  getDailyTasksQueryKey: (userId: string, date: string) => ["daily-tasks", userId, date],
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    time: () => ({
      end: mocks.loggerEnd,
    }),
  },
}));

vi.mock("@/pages/Mentor", () => ({
  default: () => {
    mocks.renderCounts.mentor += 1;
    return <div data-testid="mentor-page">Mentor</div>;
  },
}));

vi.mock("@/pages/Inbox", () => ({
  default: () => {
    mocks.renderCounts.inbox += 1;
    return <div data-testid="inbox-page">Inbox</div>;
  },
}));

vi.mock("@/pages/Journeys", () => ({
  default: () => {
    mocks.renderCounts.journeys += 1;
    return <div data-testid="journeys-page">Journeys</div>;
  },
}));

vi.mock("@/pages/Companion", () => ({
  default: () => {
    mocks.renderCounts.companion += 1;
    return <div data-testid="companion-page">Companion</div>;
  },
}));

import { MainTabsKeepAlive } from "./MainTabsKeepAlive";

describe("MainTabsKeepAlive", () => {
  beforeEach(() => {
    mocks.prefetchQuery.mockClear();
    mocks.invalidateQueries.mockClear();
    mocks.fetchDailyTasks.mockClear();
    mocks.enableTabTransitions = true;
    mocks.loggerEnd.mockClear();
    mocks.renderCounts.mentor = 0;
    mocks.renderCounts.inbox = 0;
    mocks.renderCounts.journeys = 0;
    mocks.renderCounts.companion = 0;

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      writable: true,
      value: 0,
    });
  });

  it("keeps visited inactive tabs mounted", () => {
    const { container, rerender } = render(
      <MainTabsKeepAlive activePath="/mentor" transitionPreset="none" />,
    );

    expect(container.querySelector("[data-main-tab-path='/mentor']")).toBeInTheDocument();
    expect(container.querySelector("[data-main-tab-path='/inbox']")).not.toBeInTheDocument();

    rerender(<MainTabsKeepAlive activePath="/inbox" transitionPreset="none" />);

    const mentorPanel = container.querySelector("[data-main-tab-path='/mentor']");
    const inboxPanel = container.querySelector("[data-main-tab-path='/inbox']");

    expect(mentorPanel).toBeInTheDocument();
    expect(inboxPanel).toBeInTheDocument();
    expect(mentorPanel).toHaveAttribute("data-main-tab-active", "false");
    expect(inboxPanel).toHaveAttribute("data-main-tab-active", "true");
    expect(mentorPanel).toHaveStyle({ display: "none" });
  });

  it("resets scroll to top on each tab switch", () => {
    const scrollToSpy = vi.spyOn(window, "scrollTo");
    const { rerender } = render(<MainTabsKeepAlive activePath="/mentor" transitionPreset="none" />);

    scrollToSpy.mockClear();
    (window as Window & { scrollY: number }).scrollY = 140;
    rerender(<MainTabsKeepAlive activePath="/inbox" transitionPreset="none" />);

    let lastCallArg = scrollToSpy.mock.calls.at(-1)?.[0] as ScrollToOptions | undefined;
    expect(lastCallArg).toMatchObject({ top: 0, left: 0, behavior: "auto" });

    (window as Window & { scrollY: number }).scrollY = 320;
    rerender(<MainTabsKeepAlive activePath="/mentor" transitionPreset="none" />);

    lastCallArg = scrollToSpy.mock.calls.at(-1)?.[0] as ScrollToOptions | undefined;
    expect(lastCallArg).toMatchObject({ top: 0, left: 0, behavior: "auto" });
  });

  it("uses exiting state only when fade-slide transitions are enabled", async () => {
    const { container, rerender } = render(
      <MainTabsKeepAlive activePath="/mentor" transitionPreset="fade-slide" transitionDurationMs={100} />,
    );

    rerender(<MainTabsKeepAlive activePath="/inbox" transitionPreset="fade-slide" transitionDurationMs={100} />);
    await waitFor(() => {
      expect(container.querySelector("[data-main-tab-path='/mentor']")).toHaveAttribute(
        "data-main-tab-state",
        "exiting",
      );
    });

    await act(async () => {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 140);
      });
    });

    expect(container.querySelector("[data-main-tab-path='/mentor']")).toHaveAttribute(
      "data-main-tab-state",
      "inactive",
    );

    mocks.enableTabTransitions = false;
    rerender(<MainTabsKeepAlive activePath="/journeys" transitionPreset="fade-slide" transitionDurationMs={100} />);
    expect(container.querySelector("[data-main-tab-path='/inbox']")).toHaveAttribute(
      "data-main-tab-state",
      "inactive",
    );
  });

  it("does not rerender untouched inactive scenes during unrelated tab swaps", () => {
    const { rerender } = render(
      <MainTabsKeepAlive activePath="/mentor" transitionPreset="none" />,
    );

    rerender(<MainTabsKeepAlive activePath="/inbox" transitionPreset="none" />);
    const mentorRenderCountAfterFirstSwap = mocks.renderCounts.mentor;

    rerender(<MainTabsKeepAlive activePath="/journeys" transitionPreset="none" />);

    expect(mocks.renderCounts.mentor).toBe(mentorRenderCountAfterFirstSwap);
  });

  it("warm-mounts unvisited tab shells during idle time", () => {
    const idleCallbacks: IdleRequestCallback[] = [];
    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    idleWindow.requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      idleCallbacks.push(callback);
      return idleCallbacks.length;
    });
    idleWindow.cancelIdleCallback = vi.fn();

    const { container } = render(
      <MainTabsKeepAlive activePath="/mentor" transitionPreset="none" />,
    );

    expect(container.querySelector("[data-main-tab-path='/inbox']")).not.toBeInTheDocument();

    act(() => {
      const callback = idleCallbacks.shift();
      callback?.({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
    });

    expect(container.querySelector("[data-main-tab-path='/inbox']")).toBeInTheDocument();
  });

  it("stays stable through rapid tab swaps", () => {
    const { container, rerender } = render(
      <MainTabsKeepAlive activePath="/mentor" transitionPreset="fade-slide" transitionDurationMs={100} />,
    );

    const paths = ["/inbox", "/journeys", "/companion", "/mentor"] as const;
    for (let index = 0; index < 24; index += 1) {
      rerender(
        <MainTabsKeepAlive
          activePath={paths[index % paths.length]}
          transitionPreset="fade-slide"
          transitionDurationMs={100}
        />,
      );
    }

    expect(container.querySelector("[data-main-tab-path='/mentor']")).toBeInTheDocument();
    expect(container.querySelector("[data-main-tab-path='/inbox']")).toBeInTheDocument();
    expect(container.querySelector("[data-main-tab-path='/journeys']")).toBeInTheDocument();
    expect(container.querySelector("[data-main-tab-path='/companion']")).toBeInTheDocument();
  });

  it("throttles per-tab activation refresh during rapid toggles", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-14T00:00:00.000Z"));

    const { rerender } = render(
      <MainTabsKeepAlive activePath="/mentor" transitionPreset="none" />,
    );
    expect(mocks.invalidateQueries).toHaveBeenCalledTimes(1);

    rerender(<MainTabsKeepAlive activePath="/inbox" transitionPreset="none" />);
    expect(mocks.invalidateQueries).toHaveBeenCalledTimes(2);

    rerender(<MainTabsKeepAlive activePath="/mentor" transitionPreset="none" />);
    expect(mocks.invalidateQueries).toHaveBeenCalledTimes(2);

    act(() => {
      vi.advanceTimersByTime(2600);
    });

    rerender(<MainTabsKeepAlive activePath="/companion" transitionPreset="none" />);
    rerender(<MainTabsKeepAlive activePath="/mentor" transitionPreset="none" />);

    expect(mocks.invalidateQueries).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });
});
