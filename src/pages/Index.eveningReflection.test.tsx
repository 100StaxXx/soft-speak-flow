import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mentorQuery: {
    data: {
      mentorName: "The Sage",
      mentorImage: "/mentor.png",
      todaysQuote: { text: "Stay steady.", author: "The Sage" },
    },
    isLoading: false,
    isError: false,
  },
  eveningReflection: {
    shouldShowBanner: true,
    isDrawerOpen: false,
    setIsDrawerOpen: vi.fn(),
    isLoading: false,
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: mocks.mentorQuery.data,
    isLoading: mocks.mentorQuery.isLoading,
    isError: mocks.mentorQuery.isError,
  }),
  useQueryClient: () => ({
    refetchQueries: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: { onboarding_completed: true, timezone: "UTC" },
    loading: false,
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: null,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useMentorLayoutMode", () => ({
  useMentorLayoutMode: () => "mobile",
}));

vi.mock("@/hooks/useEveningReflection", () => ({
  useEveningReflection: () => mocks.eveningReflection,
}));

vi.mock("@/contexts/MentorConnectionContext", () => ({
  useMentorConnection: () => ({
    mentorId: "mentor-1",
    status: "ready",
    refreshConnection: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ isTransitioning: false }),
}));

vi.mock("@/contexts/MainTabVisibilityContext", () => ({
  useMainTabVisibility: () => ({ isTabActive: true }),
}));

vi.mock("@/hooks/usePostOnboardingMentorGuidance", () => ({
  usePostOnboardingMentorGuidance: () => ({
    isActive: false,
    currentStep: null,
  }),
}));

vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/CompanionErrorBoundary", () => ({
  CompanionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/parallax-card", () => ({
  ParallaxCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/CinematicPageBackground", () => ({
  CinematicPageBackground: () => null,
}));

vi.mock("@/components/skeletons", () => ({
  IndexPageSkeleton: () => <div>Loading...</div>,
}));

vi.mock("@/components/MorningCheckIn", () => ({
  MorningCheckIn: () => null,
}));

vi.mock("@/components/MorningBriefing", () => ({
  MorningBriefing: () => null,
}));

vi.mock("@/components/EveningReflectionBanner", () => ({
  EveningReflectionBanner: ({
    shouldShowBanner,
    isDrawerOpen,
  }: {
    shouldShowBanner: boolean;
    isDrawerOpen: boolean;
  }) => (
    <div
      data-testid="evening-reflection-banner"
      data-should-show={String(shouldShowBanner)}
      data-is-open={String(isDrawerOpen)}
    />
  ),
}));

vi.mock("@/components/WeeklyRecapCard", () => ({
  WeeklyRecapCard: () => null,
}));

vi.mock("@/components/DailyCoachPanel", () => ({
  DailyCoachPanel: () => null,
}));

vi.mock("@/components/TodaysPepTalk", () => ({
  TodaysPepTalk: () => null,
}));

vi.mock("@/components/MentorQuickChat", () => ({
  MentorQuickChat: () => null,
}));

import Index from "./Index";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderIndex(initialEntry = "/mentor?open=evening-reflection") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Index enableOnboardingGuard={false} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("Index evening reflection deep links", () => {
  beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    mocks.eveningReflection = {
      shouldShowBanner: true,
      isDrawerOpen: false,
      setIsDrawerOpen: vi.fn(),
      isLoading: false,
    };
  });

  it("opens the current evening reflection drawer when the mentor route requests it", async () => {
    renderIndex();

    await waitFor(() => {
      expect(mocks.eveningReflection.setIsDrawerOpen).toHaveBeenCalledWith(true);
      expect(screen.getByTestId("location")).toHaveTextContent("/mentor");
    });

    expect(screen.getByTestId("location")).not.toHaveTextContent("?open=evening-reflection");
  });

  it("clears the request without opening when the banner would not be shown", async () => {
    mocks.eveningReflection = {
      shouldShowBanner: false,
      isDrawerOpen: false,
      setIsDrawerOpen: vi.fn(),
      isLoading: false,
    };

    renderIndex();

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/mentor");
    });

    expect(screen.getByTestId("location")).not.toHaveTextContent("?open=evening-reflection");
    expect(mocks.eveningReflection.setIsDrawerOpen).not.toHaveBeenCalled();
  });
});
