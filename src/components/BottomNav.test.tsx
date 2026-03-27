import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  warmDailyTasksQueryFromRemote: vi.fn().mockResolvedValue([]),
  warmEpicsQueryFromRemote: vi.fn().mockResolvedValue([]),
  hapticsLight: vi.fn(),
  companion: null as { id: string } | null,
  canEvolve: false,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({}),
  useQuery: () => ({
    data: null,
    isLoading: false,
  }),
}));

vi.mock("@/utils/plannerSync", () => ({
  warmDailyTasksQueryFromRemote: (...args: unknown[]) => mocks.warmDailyTasksQueryFromRemote(...args),
  warmEpicsQueryFromRemote: (...args: unknown[]) => mocks.warmEpicsQueryFromRemote(...args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: mocks.companion,
    canEvolve: mocks.canEvolve,
  }),
}));

vi.mock("@/contexts/MentorConnectionContext", () => ({
  useMentorConnection: () => ({
    mentorId: "mentor-1",
  }),
}));

vi.mock("@/hooks/useMotionProfile", () => ({
  useMotionProfile: () => ({
    capabilities: {
      allowParallax: true,
      maxParticles: 40,
      allowBackgroundAnimation: true,
      enableTabTransitions: true,
      hapticsMode: "web",
    },
  }),
}));

vi.mock("@/utils/haptics", () => ({
  haptics: {
    light: (...args: unknown[]) => mocks.hapticsLight(...args),
  },
}));

vi.mock("@/components/MentorAvatar", () => ({
  MentorAvatar: () => <div data-testid="mentor-avatar" />,
}));

vi.mock("@/components/companion/CompanionNavPresence", () => ({
  CompanionNavPresence: () => null,
}));

import { BottomNav } from "./BottomNav";

const PathnameProbe = () => {
  const location = useLocation();
  return <div data-testid="pathname">{location.pathname}</div>;
};

const renderBottomNav = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BottomNav />
      <PathnameProbe />
    </MemoryRouter>,
  );

describe("BottomNav", () => {
  beforeEach(() => {
    mocks.warmDailyTasksQueryFromRemote.mockClear();
    mocks.warmEpicsQueryFromRemote.mockClear();
    mocks.hapticsLight.mockClear();
    mocks.companion = null;
    mocks.canEvolve = false;
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not force scroll reset when re-tapping the active tab", () => {
    const scrollToSpy = vi.spyOn(window, "scrollTo");
    renderBottomNav("/mentor");
    scrollToSpy.mockClear();

    fireEvent.click(screen.getByText("Mentor"));

    expect(mocks.hapticsLight).toHaveBeenCalledTimes(1);
    expect(scrollToSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("pathname")).toHaveTextContent("/mentor");
  });

  it("navigates to another tab without forcing scroll reset", async () => {
    const scrollToSpy = vi.spyOn(window, "scrollTo");
    renderBottomNav("/mentor");
    scrollToSpy.mockClear();

    fireEvent.click(screen.getByText("Campaigns"));

    await waitFor(() => {
      expect(screen.getByTestId("pathname")).toHaveTextContent("/campaigns");
    });
    expect(mocks.hapticsLight).toHaveBeenCalledTimes(1);
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("warms local-first journeys and campaigns caches on tab prefetch interactions", () => {
    renderBottomNav("/mentor");

    fireEvent.pointerDown(screen.getByText("Quests"));
    fireEvent.pointerDown(screen.getByText("Campaigns"));

    expect(mocks.warmDailyTasksQueryFromRemote).toHaveBeenCalledWith(expect.any(Object), "user-1", expect.any(String));
    expect(mocks.warmEpicsQueryFromRemote).toHaveBeenCalledWith(expect.any(Object), "user-1");
  });

  it("renders the reordered main tabs", () => {
    renderBottomNav("/mentor");

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Mentor",
      "Quests",
      "Campaigns",
      "Companion",
    ]);
  });

  it("does not show companion ready badge when companion is not evolvable", () => {
    mocks.companion = { id: "companion-1" };
    mocks.canEvolve = false;

    renderBottomNav("/mentor");

    expect(screen.queryByText("!")).not.toBeInTheDocument();
  });

  it("shows companion ready badge only when evolution is ready", () => {
    mocks.companion = { id: "companion-1" };
    mocks.canEvolve = true;

    renderBottomNav("/mentor");

    expect(screen.getByText("!")).toBeInTheDocument();
  });

  it("sets runtime bottom nav offset token and cleans it up on unmount", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          x: 0,
          y: 0,
          top: 0,
          right: 390,
          bottom: 88,
          left: 0,
          width: 390,
          height: 88,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    const { unmount } = renderBottomNav("/mentor");
    expect(document.documentElement.style.getPropertyValue("--bottom-nav-runtime-offset")).toBe("88px");

    unmount();
    expect(document.documentElement.style.getPropertyValue("--bottom-nav-runtime-offset")).toBe("");
  });
});
