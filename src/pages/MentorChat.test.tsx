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

vi.mock("@/components/AskMentorChat", () => ({
  AskMentorChat: () => (
    <button onClick={mocks.askMentorAction} type="button">
      AskMentorChat Action
    </button>
  ),
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
  });

  it("shows loading UI during mentor recovery instead of no-mentor state", () => {
    mocks.mentorStatus = "recovering";

    renderMentorChat();

    expect(screen.getByText("Loading your motivator...")).toBeInTheDocument();
    expect(screen.queryByText("No guide selected")).not.toBeInTheDocument();
  });

  it("shows no mentor selected only after recovery confirms missing", () => {
    mocks.mentorStatus = "missing";

    renderMentorChat();

    expect(screen.getByText("No guide selected")).toBeInTheDocument();
    expect(screen.queryByText("Loading your motivator...")).not.toBeInTheDocument();
  });

  it("keeps mentor actions clickable when mentor is ready", () => {
    mocks.mentorStatus = "ready";
    mocks.effectiveMentorId = "mentor-1";
    mocks.mentorQuery.data = {
      id: "mentor-1",
      name: "Atlas",
      tone_description: "Steady guidance",
      avatar_url: "https://example.com/avatar.png",
    };

    renderMentorChat();

    fireEvent.click(screen.getByRole("button", { name: "AskMentorChat Action" }));
    expect(mocks.askMentorAction).toHaveBeenCalledTimes(1);
    expect(screen.getByText("MentorSwitcher")).toBeInTheDocument();
  });

  it("shows consult mode while keeping the primary guide visible", () => {
    mocks.mentorStatus = "ready";
    mocks.effectiveMentorId = "mentor-1";
    mocks.mentorQuery.data = {
      id: "mentor-2",
      name: "Sienna",
      tone_description: "Gentle guidance",
      avatar_url: "https://example.com/avatar.png",
    };
    mocks.primaryMentorQuery.data = {
      id: "mentor-1",
      name: "Atlas",
    };

    renderMentorChat({ consultMentorId: "mentor-2" });

    expect(screen.getByText("Consult Sienna")).toBeInTheDocument();
    expect(screen.getByText("Primary: Atlas")).toBeInTheDocument();
    expect(screen.getByText("Consulting: Sienna")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Return to Atlas" })).toBeInTheDocument();
  });
});
