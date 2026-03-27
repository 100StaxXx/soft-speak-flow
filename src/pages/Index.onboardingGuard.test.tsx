import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  user: { id: "user-1" } as { id: string } | null,
  profile: {
    onboarding_completed: null,
    selected_mentor_id: "mentor-legacy",
    onboarding_data: {},
  } as Record<string, unknown> | null,
  profileLoading: false,
  companion: null,
  companionLoading: false,
  effectiveMentorId: "mentor-legacy" as string | null,
  mentorStatus: "ready" as "ready" | "recovering" | "missing",
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
  refreshConnection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

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
  useMentorLayoutMode: () => "mobile",
}));

vi.mock("@/contexts/MentorConnectionContext", () => ({
  useMentorConnection: () => ({
    mentorId: mocks.effectiveMentorId,
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
  MorningCheckIn: () => null,
}));

vi.mock("@/components/MorningBriefing", () => ({
  MorningBriefing: () => null,
}));

vi.mock("@/components/EveningReflectionBanner", () => ({
  EveningReflectionBanner: () => null,
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

const renderIndex = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Index enableOnboardingGuard />
    </MemoryRouter>,
  );

describe("Index onboarding guard", () => {
  beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    mocks.navigate.mockClear();
    mocks.user = { id: "user-1" };
    mocks.profile = {
      onboarding_completed: null,
      selected_mentor_id: "mentor-legacy",
      onboarding_data: {},
    };
    mocks.profileLoading = false;
    mocks.companion = null;
    mocks.companionLoading = false;
    mocks.effectiveMentorId = "mentor-legacy";
    mocks.mentorStatus = "ready";
    mocks.mentorQuery = {
      data: null,
      isLoading: false,
      isError: false,
    };
  });

  it("does not send legacy returning users back through onboarding", () => {
    renderIndex();

    expect(mocks.navigate).not.toHaveBeenCalledWith("/onboarding");
  });

  it("still sends explicitly incomplete users to onboarding", () => {
    mocks.profile = {
      onboarding_completed: false,
      selected_mentor_id: "mentor-legacy",
      onboarding_data: {},
    };

    renderIndex();

    expect(mocks.navigate).toHaveBeenCalledWith("/onboarding");
  });
});
