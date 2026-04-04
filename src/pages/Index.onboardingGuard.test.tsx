import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const profilesUpdateEqMock = vi.fn(() => Promise.resolve({ error: null }));
  const profilesUpdateMock = vi.fn(() => ({ eq: profilesUpdateEqMock }));
  const fromMock = vi.fn((table: string) => {
    if (table !== "profiles") {
      throw new Error(`Unexpected table: ${table}`);
    }

    return {
      update: profilesUpdateMock,
    };
  });

  return {
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
    profilesUpdateEqMock,
    profilesUpdateMock,
    fromMock,
  };
});

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

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.fromMock,
  },
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
    window.sessionStorage.clear();
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
    mocks.profilesUpdateEqMock.mockClear();
    mocks.profilesUpdateMock.mockClear();
    mocks.fromMock.mockClear();
  });

  it("does not send legacy returning users back through onboarding", () => {
    renderIndex();

    expect(mocks.navigate).not.toHaveBeenCalledWith("/onboarding");
  });

  it("does not send walkthrough-complete users back through onboarding", () => {
    mocks.profile = {
      onboarding_completed: false,
      selected_mentor_id: "mentor-legacy",
      onboarding_data: { walkthrough_completed: true },
    };

    renderIndex();

    expect(mocks.navigate).not.toHaveBeenCalledWith("/onboarding");
  });

  it("does not send companion-backed stale profiles back through onboarding", async () => {
    mocks.profile = {
      onboarding_completed: false,
      selected_mentor_id: "mentor-legacy",
      onboarding_data: {},
    };
    mocks.companion = {
      id: "companion-1",
      preset_id: "dragon",
      current_stage: 1,
    } as { id: string; preset_id: string; current_stage: number };

    renderIndex();

    expect(mocks.navigate).not.toHaveBeenCalledWith("/onboarding");
    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith("/journeys", { replace: true });
    });
  });

  it("sends stage 0 egg accounts without tutorial progress back to onboarding", () => {
    mocks.profile = {
      onboarding_completed: true,
      onboarding_step: null,
      selected_mentor_id: "mentor-legacy",
      onboarding_data: {},
    };
    mocks.companion = {
      id: "companion-egg",
      preset_id: null,
      current_stage: 0,
    } as { id: string; preset_id: null; current_stage: number };

    renderIndex();

    expect(mocks.navigate).toHaveBeenCalledWith("/onboarding");
    expect(mocks.navigate).not.toHaveBeenCalledWith("/journeys", { replace: true });
  });

  it("sends preset-backed stage 0 egg accounts without tutorial progress back to onboarding", () => {
    mocks.profile = {
      onboarding_completed: true,
      onboarding_step: null,
      selected_mentor_id: "mentor-legacy",
      onboarding_data: {},
    };
    mocks.companion = {
      id: "companion-egg",
      preset_id: "dragon",
      current_stage: 0,
    } as { id: string; preset_id: string; current_stage: number };

    renderIndex();

    expect(mocks.navigate).toHaveBeenCalledWith("/onboarding");
    expect(mocks.navigate).not.toHaveBeenCalledWith("/journeys", { replace: true });
  });

  it("keeps completed stage 0 egg accounts on the app shell when onboarding_step is complete", async () => {
    mocks.profile = {
      onboarding_completed: false,
      onboarding_step: "complete",
      selected_mentor_id: "mentor-legacy",
      onboarding_data: {},
    };
    mocks.companion = {
      id: "companion-egg",
      preset_id: null,
      current_stage: 0,
    } as { id: string; preset_id: null; current_stage: number };

    renderIndex();

    expect(mocks.navigate).not.toHaveBeenCalledWith("/onboarding");
    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith("/journeys", { replace: true });
    });
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
