import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MentorSwitcher } from "./MentorSwitcher";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  profile: {
    timezone: "America/Los_Angeles",
    onboarding_data: { storyTone: "bold" },
  } as Record<string, unknown> | null,
  mentorId: "atlas",
  pendingMood: "overthinking" as string | null,
  mentors: [
    {
      id: "atlas",
      name: "Atlas",
      slug: "atlas",
      avatar_url: null,
      primary_color: "#0f172a",
      short_title: "Stoic Builder",
      tone_description: "Direct and calm",
      tags: ["discipline"],
      themes: ["calm"],
      style_description: null,
      target_user: null,
      intensity_level: "high",
    },
    {
      id: "sienna",
      name: "Sienna",
      slug: "sienna",
      avatar_url: null,
      primary_color: "#be185d",
      short_title: "Soft Guide",
      tone_description: "Gentle and supportive",
      tags: ["healing"],
      themes: ["self_worth"],
      style_description: null,
      target_user: null,
      intensity_level: "gentle",
    },
    {
      id: "reign",
      name: "Reign",
      slug: "reign",
      avatar_url: null,
      primary_color: "#9333ea",
      short_title: "Performance Queen",
      tone_description: "High energy and confident",
      tags: ["high_energy"],
      themes: ["confidence"],
      style_description: null,
      target_user: null,
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
    mocks.mentorId = "atlas";
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
    expect(screen.getAllByText("Best for overthinking").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sienna").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Atlas").length).toBeGreaterThan(0);
  });

  it("opens a scoped consult without changing the primary guide", async () => {
    render(<MentorSwitcher variant="button" />);

    fireEvent.click(screen.getByTestId("mentor-switcher-trigger"));

    const siennaCard = screen.getAllByText("Sienna").find((element) =>
      element.closest(".rounded-2xl"),
    )?.closest(".rounded-2xl");

    expect(siennaCard).toBeTruthy();
    fireEvent.click(within(siennaCard as HTMLElement).getByRole("button", { name: "Consult" }));

    expect(mocks.applyMentorChange).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/mentor-chat",
      expect.objectContaining({
        replace: false,
        state: expect.objectContaining({
          consultMentorId: "sienna",
          consultSource: "/mentor",
        }),
      }),
    );
  });

  it("promotes a consulted guide to primary without passing navigation arguments", async () => {
    render(<MentorSwitcher variant="button" />);

    fireEvent.click(screen.getByTestId("mentor-switcher-trigger"));

    const reignCard = screen.getAllByText("Reign").find((element) =>
      element.closest(".rounded-2xl"),
    )?.closest(".rounded-2xl");

    expect(reignCard).toBeTruthy();
    fireEvent.click(within(reignCard as HTMLElement).getByRole("button", { name: "Make primary" }));

    await waitFor(() =>
      expect(mocks.applyMentorChange).toHaveBeenCalledWith(
        expect.objectContaining({
          mentorId: "reign",
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
