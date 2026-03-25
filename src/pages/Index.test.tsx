import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  layoutMode: "mobile" as "mobile" | "desktop",
  mentorStatus: "recovering" as "ready" | "recovering" | "missing",
  effectiveMentorId: null as string | null,
  refreshConnection: vi.fn().mockResolvedValue(undefined),
  user: { id: "user-1" } as { id: string } | null,
  profile: { onboarding_completed: true } as Record<string, unknown> | null,
  profileLoading: false,
  companion: null,
  companionLoading: false,
  mentorQuery: {
    data: null as {
      mentorImage?: string;
      mentorName?: string | null;
      todaysQuote?: { text: string; author?: string };
    } | null,
    isLoading: false,
    isError: false,
  },
  queryClient: {
    refetchQueries: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: mocks.mentorQuery.data,
    isLoading: mocks.mentorQuery.isLoading,
    isError: mocks.mentorQuery.isError,
  }),
  useQueryClient: () => mocks.queryClient,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: mocks.profile,
    loading: mocks.profileLoading,
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: mocks.companion,
    isLoading: mocks.companionLoading,
  }),
}));

vi.mock("@/hooks/useMentorLayoutMode", () => ({
  useMentorLayoutMode: () => mocks.layoutMode,
}));

vi.mock("@/hooks/useMentorConnectionHealth", () => ({
  useMentorConnectionHealth: () => ({
    effectiveMentorId: mocks.effectiveMentorId,
    status: mocks.mentorStatus,
    refreshConnection: mocks.refreshConnection,
  }),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ isTransitioning: false }),
}));

vi.mock("@/contexts/MainTabVisibilityContext", () => ({
  useMainTabVisibility: () => ({ isTabActive: true }),
}));

vi.mock("@/hooks/useFirstTimeModal", () => ({
  useFirstTimeModal: () => ({ showModal: false, dismissModal: vi.fn() }),
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

vi.mock("@/components/StarfieldBackground", () => ({
  StarfieldBackground: () => null,
}));

vi.mock("@/components/skeletons", () => ({
  IndexPageSkeleton: () => <div>Loading...</div>,
}));

vi.mock("@/components/MorningCheckIn", () => ({
  MorningCheckIn: () => <div>MorningCheckIn</div>,
}));

vi.mock("@/components/MorningBriefing", () => ({
  MorningBriefing: () => <div>MorningBriefing</div>,
}));

vi.mock("@/components/EveningReflectionBanner", () => ({
  EveningReflectionBanner: () => <div>EveningReflection</div>,
}));

vi.mock("@/components/WeeklyRecapCard", () => ({
  WeeklyRecapCard: () => <div>WeeklyRecap</div>,
}));

vi.mock("@/components/DailyCoachPanel", () => ({
  DailyCoachPanel: () => <div>DailyCoachPanel</div>,
}));

vi.mock("@/components/TodaysPepTalk", () => ({
  TodaysPepTalk: () => <div>TodaysPepTalk</div>,
}));

vi.mock("@/components/MentorQuickChat", () => ({
  MentorQuickChat: () => <div>MentorQuickChat</div>,
}));

import Index from "./Index";

const renderIndex = () =>
  render(
    <MemoryRouter initialEntries={["/mentor"]}>
      <Index enableOnboardingGuard={false} />
    </MemoryRouter>,
  );

describe("Index mentor connection state", () => {
  beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    mocks.layoutMode = "mobile";
    mocks.refreshConnection.mockClear();
    mocks.queryClient.refetchQueries.mockClear();
    mocks.user = { id: "user-1" };
    mocks.profile = { onboarding_completed: true };
    mocks.profileLoading = false;
    mocks.companion = null;
    mocks.companionLoading = false;
    mocks.mentorQuery = {
      data: null,
      isLoading: false,
      isError: false,
    };
    mocks.effectiveMentorId = null;
    mocks.mentorStatus = "recovering";
  });

  it("does not show mentor connection lost while recovery is in progress", () => {
    mocks.mentorStatus = "recovering";

    renderIndex();

    expect(screen.queryByText("Mentor connection lost")).not.toBeInTheDocument();
  });

  it("keeps the stacked mentor dashboard on mobile", () => {
    mocks.mentorStatus = "ready";
    mocks.effectiveMentorId = "mentor-1";
    mocks.mentorQuery = {
      data: {
        mentorName: "Atlas",
        mentorImage: "/mentor.png",
        todaysQuote: { text: "Stay steady.", author: "Atlas" },
      },
      isLoading: false,
      isError: false,
    };

    renderIndex();

    expect(screen.getByTestId("mentor-mobile-layout")).toBeInTheDocument();
    expect(screen.queryByTestId("mentor-desktop-layout")).not.toBeInTheDocument();
    expect(screen.getByText("MorningCheckIn")).toBeInTheDocument();
    expect(screen.getByText("MentorQuickChat")).toBeInTheDocument();
  });

  it("renders the mentor desktop rail and workspace on desktop", () => {
    mocks.layoutMode = "desktop";
    mocks.mentorStatus = "ready";
    mocks.effectiveMentorId = "mentor-1";
    mocks.mentorQuery = {
      data: {
        mentorName: "Atlas",
        mentorImage: "/mentor.png",
        todaysQuote: { text: "Stay steady.", author: "Atlas" },
      },
      isLoading: false,
      isError: false,
    };

    renderIndex();

    expect(screen.getByTestId("mentor-desktop-rail")).toBeInTheDocument();
    expect(screen.getByTestId("mentor-desktop-workspace")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask Atlas" })).toBeInTheDocument();
  });

  it("shows mentor connection lost only after recovery fails", () => {
    mocks.layoutMode = "desktop";
    mocks.mentorStatus = "missing";

    renderIndex();

    expect(screen.getByText("Mentor connection lost")).toBeInTheDocument();
    expect(screen.getByText("Reconnect Mentor")).toBeInTheDocument();
  });

  it("keeps temporary issue banner behavior unchanged", () => {
    mocks.layoutMode = "desktop";
    mocks.mentorStatus = "ready";
    mocks.effectiveMentorId = "mentor-1";
    mocks.mentorQuery = {
      data: null,
      isLoading: false,
      isError: true,
    };

    renderIndex();

    expect(screen.getByText("Mentor temporarily unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Mentor connection lost")).not.toBeInTheDocument();
  });
});
