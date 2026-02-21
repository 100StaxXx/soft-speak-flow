import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  existingCheckIn: {
    completed_at: "2026-02-21T12:00:00.000Z",
    intention: "Ship the thing",
    mentor_response: "Consistency beats intensity.",
  } as {
    completed_at: string | null;
    intention: string;
    mentor_response: string | null;
  } | null,
  personality: {
    name: "Atlas",
    slug: "atlas",
    primary_color: "#000000",
    avatar_url: "https://cdn.example.com/atlas.png",
  } as {
    name: string;
    slug: string;
    primary_color: string;
    avatar_url?: string;
  } | null,
  loadMentorImage: vi.fn(),
  queryClient: {
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  },
  toast: vi.fn(),
  awardCheckInComplete: vi.fn(),
  checkFirstTimeAchievements: vi.fn().mockResolvedValue(undefined),
  triggerReaction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: mocks.existingCheckIn,
  }),
  useQueryClient: () => mocks.queryClient,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/useMentorPersonality", () => ({
  useMentorPersonality: () => mocks.personality,
}));

vi.mock("@/hooks/useXPRewards", () => ({
  useXPRewards: () => ({
    awardCheckInComplete: mocks.awardCheckInComplete,
    XP_REWARDS: { CHECK_IN: 20 },
  }),
}));

vi.mock("@/hooks/useAchievements", () => ({
  useAchievements: () => ({
    checkFirstTimeAchievements: mocks.checkFirstTimeAchievements,
  }),
}));

vi.mock("@/hooks/useLivingCompanion", () => ({
  useLivingCompanionSafe: () => ({
    triggerReaction: mocks.triggerReaction,
  }),
}));

vi.mock("@/utils/mentorImageLoader", () => ({
  loadMentorImage: mocks.loadMentorImage,
}));

vi.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { MorningCheckIn } from "./MorningCheckIn";

describe("MorningCheckIn completion portrait", () => {
  beforeEach(() => {
    mocks.user = { id: "user-1" };
    mocks.existingCheckIn = {
      completed_at: "2026-02-21T12:00:00.000Z",
      intention: "Ship the thing",
      mentor_response: "Consistency beats intensity.",
    };
    mocks.personality = {
      name: "Atlas",
      slug: "atlas",
      primary_color: "#000000",
      avatar_url: "https://cdn.example.com/atlas.png",
    };
    mocks.loadMentorImage.mockReset();
    mocks.queryClient.invalidateQueries.mockClear();
    mocks.toast.mockClear();
    mocks.awardCheckInComplete.mockClear();
    mocks.checkFirstTimeAchievements.mockClear();
    mocks.triggerReaction.mockClear();
  });

  it("renders portrait tile and quote with direct avatar URL", async () => {
    render(<MorningCheckIn />);

    const portrait = await screen.findByTestId("mentor-portrait-tile");
    expect(portrait).toHaveClass("float-right");
    expect((portrait as HTMLImageElement).src).toContain("https://cdn.example.com/atlas.png");
    expect(screen.getByText(/Consistency beats intensity/i)).toBeInTheDocument();
  });

  it("falls back to loadMentorImage when avatar_url is missing", async () => {
    mocks.personality = {
      name: "Atlas",
      slug: "atlas",
      primary_color: "#000000",
    };
    mocks.loadMentorImage.mockResolvedValueOnce("/assets/atlas-fallback.png");

    render(<MorningCheckIn />);

    await waitFor(() => expect(mocks.loadMentorImage).toHaveBeenCalledWith("atlas"));
    const portrait = await screen.findByTestId("mentor-portrait-tile");
    expect((portrait as HTMLImageElement).src).toContain("/assets/atlas-fallback.png");
  });

  it("keeps mentor copy visible when portrait loading fails", async () => {
    mocks.personality = {
      name: "Atlas",
      slug: "atlas",
      primary_color: "#000000",
    };
    mocks.loadMentorImage.mockRejectedValueOnce(new Error("load failed"));

    render(<MorningCheckIn />);

    await waitFor(() => expect(mocks.loadMentorImage).toHaveBeenCalledWith("atlas"));
    expect(screen.queryByTestId("mentor-portrait-tile")).not.toBeInTheDocument();
    expect(screen.getByText("Atlas")).toBeInTheDocument();
    expect(screen.getByText(/Consistency beats intensity/i)).toBeInTheDocument();
  });

  it("shows pending message in flow-root wrapper while response is preparing", async () => {
    mocks.existingCheckIn = {
      completed_at: "2026-02-21T12:00:00.000Z",
      intention: "Ship the thing",
      mentor_response: null,
    };

    render(<MorningCheckIn />);

    expect(screen.getByText("Preparing your personalized message...")).toBeInTheDocument();
    expect(screen.getByTestId("mentor-response-body")).toHaveClass("flow-root");
    expect(await screen.findByTestId("mentor-portrait-tile")).toHaveClass("float-right");
  });
});
