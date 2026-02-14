import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  prefetchQuery: vi.fn().mockResolvedValue(undefined),
  hapticsLight: vi.fn(),
  inboxCount: 0,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    prefetchQuery: mocks.prefetchQuery,
  }),
  useQuery: () => ({
    data: null,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: null,
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: null,
    progressToNext: 0,
  }),
}));

vi.mock("@/hooks/useInboxTasks", () => ({
  useInboxCount: () => ({
    inboxCount: mocks.inboxCount,
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
    mocks.prefetchQuery.mockClear();
    mocks.hapticsLight.mockClear();
    mocks.inboxCount = 0;
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

    fireEvent.click(screen.getByText("Inbox"));

    await waitFor(() => {
      expect(screen.getByTestId("pathname")).toHaveTextContent("/inbox");
    });
    expect(mocks.hapticsLight).toHaveBeenCalledTimes(1);
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("keeps inbox badge accurate while viewing a different tab", () => {
    mocks.inboxCount = 5;

    renderBottomNav("/mentor");

    expect(screen.getByTestId("pathname")).toHaveTextContent("/mentor");
    expect(screen.getByText("5")).toBeInTheDocument();
  });
});
