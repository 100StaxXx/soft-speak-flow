import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MentorSwitcher } from "./MentorSwitcher";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  profile: {
    timezone: "America/Los_Angeles",
    onboarding_data: { storyTone: "bold" },
  } as Record<string, unknown> | null,
  mentorId: "sage",
  pendingMood: "overthinking" as string | null,
  mentors: [
    {
      id: "atlas",
      name: "Atlas",
      slug: "atlas",
      avatar_url: null,
      primary_color: "#1f2937",
      short_title: "Legacy Guide",
      tone_description: "Legacy tone",
      tags: ["legacy"],
      themes: ["legacy"],
      style_description: null,
      target_user: "Legacy users",
      intensity_level: "medium",
    },
    {
      id: "sage",
      name: "The Sage",
      slug: "sage",
      avatar_url: null,
      primary_color: "#0f172a",
      short_title: "Quiet Clarity",
      tone_description: "Calm and wise",
      tags: ["discipline"],
      themes: ["calm"],
      style_description: null,
      target_user: "Overwhelmed thinkers seeking calm clarity",
      intensity_level: "high",
    },
    {
      id: "princess",
      name: "The Princess",
      slug: "princess",
      avatar_url: null,
      primary_color: "#be185d",
      short_title: "Soft Discipline",
      tone_description: "Gentle and supportive",
      tags: ["healing"],
      themes: ["self_worth"],
      style_description: null,
      target_user: "Users building routines through gentle structure",
      intensity_level: "gentle",
    },
    {
      id: "icon",
      name: "The Icon",
      slug: "icon",
      avatar_url: null,
      primary_color: "#9333ea",
      short_title: "Standards First",
      tone_description: "Confident and composed",
      tags: ["confidence"],
      themes: ["confidence"],
      style_description: null,
      target_user: "Identity-led users refining standards and boundaries",
      intensity_level: "high",
    },
    {
      id: "stryker",
      name: "Stryker",
      slug: "stryker",
      avatar_url: null,
      primary_color: "#334155",
      short_title: "Legacy Guide",
      tone_description: "Legacy tone",
      tags: ["legacy"],
      themes: ["legacy"],
      style_description: null,
      target_user: "Legacy users",
      intensity_level: "high",
    },
  ],
  todayCheckIn: null as Record<string, unknown> | null,
  latestCheckIn: { mood: "content" } as Record<string, unknown> | null,
  queryClient: {
    refetchQueries: vi.fn().mockResolvedValue(undefined),
  },
  toast: vi.fn(),
  applyMentorChange: vi.fn().mockResolvedValue(undefined),
  navigate: vi.fn(),
  location: { pathname: "/mentor", state: null as Record<string, unknown> | null },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const key = queryKey[0];
    if (key === "mentors") {
      return { data: mocks.mentors, isLoading: false };
    }
    if (key === "morning-check-in") {
      return { data: mocks.todayCheckIn, isLoading: false };
    }
    if (key === "morning-check-in-latest") {
      return { data: mocks.latestCheckIn, isLoading: false };
    }
    return { data: null, isLoading: false };
  },
  useQueryClient: () => mocks.queryClient,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ profile: mocks.profile }),
}));

vi.mock("@/contexts/MentorConnectionContext", () => ({
  useMentorConnection: () => ({ mentorId: mocks.mentorId }),
}));

vi.mock("@/hooks/usePendingMentorMood", () => ({
  usePendingMentorMood: () => mocks.pendingMood,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/pages/profileMentorChange", () => ({
  applyMentorChange: mocks.applyMentorChange,
}));

vi.mock("@/components/MentorAvatar", () => ({
  MentorAvatar: ({ mentorName }: { mentorName: string }) => <div>{mentorName} Avatar</div>,
}));

vi.mock("react-router-dom", () => ({
  useLocation: () => mocks.location,
  useNavigate: () => mocks.navigate,
}));

describe("MentorSwitcher", () => {
  beforeEach(() => {
    mocks.user = { id: "user-1" };
    mocks.profile = {
      timezone: "America/Los_Angeles",
      onboarding_data: { storyTone: "bold" },
    };
    mocks.mentorId = "sage";
    mocks.pendingMood = "overthinking";
    mocks.todayCheckIn = null;
    mocks.latestCheckIn = { mood: "content" };
    mocks.queryClient.refetchQueries.mockClear();
    mocks.toast.mockClear();
    mocks.applyMentorChange.mockClear();
    mocks.navigate.mockClear();
    mocks.location = { pathname: "/mentor", state: null };
  });

  it("shows mood-based recommendations using the pending check-in mood first", async () => {
    render(<MentorSwitcher />);

    fireEvent.click(screen.getByTestId("mentor-switcher-trigger"));

    expect(await screen.findByTestId("mentor-switcher-dialog")).toBeInTheDocument();
    expect(screen.getByText("Mood signal: Overthinking")).toBeInTheDocument();
    expect(screen.getByText(/Best for overthinking/)).toBeInTheDocument();
    expect(screen.getAllByText("The Princess").length).toBeGreaterThan(0);
    expect(screen.getAllByText("The Sage").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Quiet Clarity").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Calm and wise").length).toBeGreaterThan(0);
    expect(screen.queryByText("Atlas")).not.toBeInTheDocument();
    expect(screen.queryByText("Stryker")).not.toBeInTheDocument();
  });

  it("supports a controlled triggerless dialog", () => {
    const onOpenChange = vi.fn();

    render(<MentorSwitcher variant="none" open onOpenChange={onOpenChange} />);

    expect(screen.queryByTestId("mentor-switcher-trigger")).not.toBeInTheDocument();
    expect(screen.getByTestId("mentor-switcher-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens a scoped consult without changing the primary guide", async () => {
    render(<MentorSwitcher variant="button" />);

    fireEvent.click(screen.getByTestId("mentor-switcher-trigger"));

    const princessCard = screen.getAllByText("The Princess").find((element) =>
      element.closest(".rounded-2xl"),
    )?.closest(".rounded-2xl");

    expect(princessCard).toBeTruthy();
    fireEvent.click(within(princessCard as HTMLElement).getByRole("button", { name: "Consult" }));

    expect(mocks.applyMentorChange).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/mentor-chat",
      expect.objectContaining({
        replace: false,
        state: expect.objectContaining({
          consultMentorId: "princess",
          consultSource: "/mentor",
        }),
      }),
    );
  });

  it("promotes a consulted guide to primary without passing navigation arguments", async () => {
    render(<MentorSwitcher variant="button" />);

    fireEvent.click(screen.getByTestId("mentor-switcher-trigger"));

    const iconCard = screen.getAllByText("The Icon").find((element) =>
      element.closest(".rounded-2xl"),
    )?.closest(".rounded-2xl");

    expect(iconCard).toBeTruthy();
    fireEvent.click(within(iconCard as HTMLElement).getByRole("button", { name: "Make primary" }));

    await waitFor(() =>
      expect(mocks.applyMentorChange).toHaveBeenCalledWith(
        expect.objectContaining({
          mentorId: "icon",
          userId: "user-1",
          timezone: "America/Los_Angeles",
        }),
      ),
    );

    expect(mocks.applyMentorChange.mock.calls[0][0]).not.toHaveProperty("navigate");
    expect(mocks.applyMentorChange.mock.calls[0][0]).not.toHaveProperty("destinationPath");
    expect(mocks.queryClient.refetchQueries).toHaveBeenCalledWith({ queryKey: ["mentor-page-data"] });
    expect(mocks.queryClient.refetchQueries).toHaveBeenCalledWith({ queryKey: ["morning-check-in"] });
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Primary guide updated",
      }),
    );
  });
});
