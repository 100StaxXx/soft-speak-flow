import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prefetchQuery: vi.fn().mockResolvedValue(undefined),
  fetchDailyTasks: vi.fn().mockResolvedValue([]),
  enableTabTransitions: true,
  loggerEnd: vi.fn(),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({
      prefetchQuery: mocks.prefetchQuery,
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
  default: () => <div data-testid="mentor-page">Mentor</div>,
}));

vi.mock("@/pages/Inbox", () => ({
  default: () => <div data-testid="inbox-page">Inbox</div>,
}));

vi.mock("@/pages/Journeys", () => ({
  default: () => <div data-testid="journeys-page">Journeys</div>,
}));

vi.mock("@/pages/Companion", () => ({
  default: () => <div data-testid="companion-page">Companion</div>,
}));

import { MainTabsKeepAlive } from "./MainTabsKeepAlive";

describe("MainTabsKeepAlive", () => {
  beforeEach(() => {
    mocks.prefetchQuery.mockClear();
    mocks.fetchDailyTasks.mockClear();
    mocks.enableTabTransitions = true;
    mocks.loggerEnd.mockClear();

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
  });

  it("restores saved scroll position when returning to a tab", () => {
    const scrollToSpy = vi.spyOn(window, "scrollTo");
    const { rerender } = render(<MainTabsKeepAlive activePath="/mentor" transitionPreset="none" />);

    (window as Window & { scrollY: number }).scrollY = 140;
    rerender(<MainTabsKeepAlive activePath="/inbox" transitionPreset="none" />);

    (window as Window & { scrollY: number }).scrollY = 320;
    rerender(<MainTabsKeepAlive activePath="/mentor" transitionPreset="none" />);

    const lastCallArg = scrollToSpy.mock.calls.at(-1)?.[0] as ScrollToOptions | undefined;
    expect(lastCallArg).toMatchObject({ top: 140, left: 0, behavior: "auto" });
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
});
