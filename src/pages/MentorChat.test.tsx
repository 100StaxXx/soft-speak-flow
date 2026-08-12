import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  profile: { id: "user-1" } as Record<string, unknown> | null,
  profileLoading: false,
  profileError: null as unknown,
  refetchProfile: vi.fn().mockResolvedValue(undefined),
  mentorStatus: "recovering" as "ready" | "recovering" | "missing",
  effectiveMentorId: null as string | null,
  refreshConnection: vi.fn().mockResolvedValue(undefined),
  mentorQuery: {
    data: null as Record<string, unknown> | null,
    isLoading: false,
    isFetching: false,
    error: null as unknown,
    refetch: vi.fn().mockResolvedValue(undefined),
  },
  primaryMentorQuery: {
    data: null as Record<string, unknown> | null,
    isLoading: false,
  },
  queryClient: {
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  },
  askMentorAction: vi.fn(),
  askMentorProps: null as Record<string, unknown> | null,
  dailyGuideThread: null as Record<string, unknown> | null,
  previousDailyGuideThread: null as Record<string, unknown> | null,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    if (queryKey[0] === "mentor-primary") {
      return {
        data: mocks.primaryMentorQuery.data,
        isLoading: mocks.primaryMentorQuery.isLoading,
      };
    }

    return {
      data: mocks.mentorQuery.data,
      isLoading: mocks.mentorQuery.isLoading,
      isFetching: mocks.mentorQuery.isFetching,
      error: mocks.mentorQuery.error,
      refetch: mocks.mentorQuery.refetch,
    };
  },
  useQueryClient: () => mocks.queryClient,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: mocks.profile,
    loading: mocks.profileLoading,
    error: mocks.profileError,
    refetch: mocks.refetchProfile,
  }),
}));

vi.mock("@/hooks/useDailyGuideThread", () => ({
  useDailyGuideThread: () => ({
    thread: mocks.dailyGuideThread,
    previousThread: mocks.previousDailyGuideThread,
  }),
}));

vi.mock("@/contexts/MentorConnectionContext", () => ({
  useMentorConnection: () => ({
    mentorId: mocks.effectiveMentorId,
    status: mocks.mentorStatus,
    refreshConnection: mocks.refreshConnection,
  }),
}));

vi.mock("@/hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({
    tap: vi.fn(),
  }),
}));

vi.mock("@/components/MentorSwitcher", () => ({
  MentorSwitcher: () => <div>MentorSwitcher</div>,
}));

vi.mock("@/components/CinematicPageBackground", () => ({
  CinematicPageBackground: () => null,
}));

vi.mock("@/components/MentorAvatar", () => ({
  MentorAvatar: ({ mentorName }: { mentorName: string }) => <div>{mentorName} Avatar</div>,
}));

vi.mock("@/components/AskMentorChat", () => ({
  AskMentorChat: (props: Record<string, unknown>) => {
    mocks.askMentorProps = props;
    return (
      <button onClick={mocks.askMentorAction} type="button">
        AskMentorChat Action
      </button>
    );
  },
}));

vi.mock("@/components/BottomNav", () => ({
  BottomNav: () => null,
}));

vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/PageInfoButton", () => ({
  PageInfoButton: () => null,
}));

vi.mock("@/components/PageInfoModal", () => ({
  PageInfoModal: () => null,
}));

import MentorChat from "./MentorChat";

const renderMentorChat = (state?: Record<string, unknown>) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/mentor-chat", state }]}>
      <MentorChat />
    </MemoryRouter>,
  );

describe("MentorChat mentor connection state", () => {
  beforeEach(() => {
    mocks.user = { id: "user-1" };
    mocks.profile = { id: "user-1" };
    mocks.profileLoading = false;
    mocks.profileError = null;
    mocks.refetchProfile.mockClear();
    mocks.mentorStatus = "recovering";
    mocks.effectiveMentorId = null;
    mocks.refreshConnection.mockClear();
    mocks.mentorQuery = {
      data: null,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    };
    mocks.primaryMentorQuery = {
      data: null,
      isLoading: false,
    };
    mocks.queryClient.invalidateQueries.mockClear();
    mocks.askMentorAction.mockClear();
    mocks.askMentorProps = null;
    mocks.dailyGuideThread = null;
    mocks.previousDailyGuideThread = null;
  });

  it("shows loading UI during mentor recovery instead of no-mentor state", () => {
    mocks.mentorStatus = "recovering";

    renderMentorChat();

    expect(screen.getByText("Loading your Guide...")).toBeInTheDocument();
    expect(screen.queryByText("No guide selected")).not.toBeInTheDocument();
  });

  it("shows no mentor selected only after recovery confirms missing", () => {
    mocks.mentorStatus = "missing";

    renderMentorChat();

    expect(screen.getByText("No guide selected")).toBeInTheDocument();
    expect(screen.queryByText("Loading your Guide...")).not.toBeInTheDocument();
  });

  it("keeps mentor actions clickable when mentor is ready", () => {
    mocks.mentorStatus = "ready";
    mocks.effectiveMentorId = "mentor-1";
    mocks.mentorQuery.data = {
      id: "mentor-1",
      name: "The Sage",
      tone_description: "Steady guidance",
      avatar_url: "https://example.com/avatar.png",
    };

    renderMentorChat();

    fireEvent.click(screen.getByRole("button", { name: "AskMentorChat Action" }));
    expect(mocks.askMentorAction).toHaveBeenCalledTimes(1);
    expect(screen.getByText("MentorSwitcher")).toBeInTheDocument();
  });

  it("shows today's thread and gives its continuity to the Guide chat", () => {
    mocks.mentorStatus = "ready";
    mocks.effectiveMentorId = "mentor-1";
    mocks.mentorQuery.data = {
      id: "mentor-1",
      name: "Grace",
      slug: "grace",
      tone_description: "Gentle guidance",
      avatar_url: "https://example.com/avatar.png",
    };
    mocks.dailyGuideThread = {
      thread_date: "2026-08-10",
      mentor_name: "Grace",
      focus_label: "A gentler pace",
      focus_category: "Rest",
      practice_key: "formation-12",
      practice_completed_at: null,
      evening_reflected_at: null,
    };
    mocks.previousDailyGuideThread = {
      thread_date: "2026-08-09",
      mentor_name: "Grace",
      focus_label: "Connection",
      focus_category: "Relationships",
      practice_key: "formation-08",
      practice_completed_at: "2026-08-09T18:00:00.000Z",
      evening_reflected_at: "2026-08-09T22:00:00.000Z",
    };

    renderMentorChat({ briefingContext: "Today's encouragement was about receiving limits." });

    expect(screen.getByRole("note", { name: "Today’s Guide thread" })).toHaveTextContent("A gentler pace");
    expect(mocks.askMentorProps?.briefingContext).toContain("receiving limits");
    expect(mocks.askMentorProps?.briefingContext).toContain("A gentler pace");
    expect(mocks.askMentorProps?.briefingContext).toContain("do not shame or pressure");
    expect(mocks.askMentorProps?.briefingContext).toContain("Connection");
  });

  it("shows consult mode while keeping the primary guide visible", () => {
    mocks.mentorStatus = "ready";
    mocks.effectiveMentorId = "mentor-1";
    mocks.mentorQuery.data = {
      id: "mentor-2",
      name: "The Princess",
      tone_description: "Gentle guidance",
      avatar_url: "https://example.com/avatar.png",
    };
    mocks.primaryMentorQuery.data = {
      id: "mentor-1",
      name: "The Sage",
    };

    renderMentorChat({ consultMentorId: "mentor-2" });

    expect(screen.getByText("Consult The Princess")).toBeInTheDocument();
    expect(screen.getByText("Primary: The Sage")).toBeInTheDocument();
    expect(screen.getByText("Consulting: The Princess")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Return to The Sage" })).toBeInTheDocument();

    const consultNotice = screen.getByRole("note", { name: "Temporary consult details" });
    expect(consultNotice).toHaveClass("bg-card/[0.94]");
    expect(consultNotice.querySelector("p:last-child")).toHaveClass("leading-6");
  });
});
