import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMorningCheckInDraftStorageKey } from "@/utils/accountLocalState";

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
    name: "The Sage",
    slug: "sage",
    primary_color: "#000000",
    avatar_url: "https://cdn.example.com/sage.png",
  } as {
    name: string;
    slug: string;
    primary_color: string;
    avatar_url?: string;
  } | null,
  loadMentorImage: vi.fn(),
  parseFunctionInvokeError: vi.fn(),
  toUserFacingFunctionError: vi.fn(),
  queryClient: {
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  },
  toast: vi.fn(),
  awardCheckInComplete: vi.fn(),
  checkDailyCompletionAchievement: vi.fn().mockResolvedValue(undefined),
  checkFirstTimeAchievements: vi.fn().mockResolvedValue(undefined),
  triggerReaction: vi.fn().mockResolvedValue(undefined),
  setPendingMentorMood: vi.fn(),
  insertCheckIn: vi.fn(),
  countCheckIns: vi.fn(),
  invokeFunction: vi.fn(),
  storage: new Map<string, string>(),
  safeLocalStorage: {
    getItem: (key: string) => mocks.storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      mocks.storage.set(key, value);
      return true;
    },
    removeItem: (key: string) => {
      mocks.storage.delete(key);
      return true;
    },
    clear: () => {
      mocks.storage.clear();
      return true;
    },
  },
  guidance: {
    isActive: false,
    currentStep: null as string | null,
  },
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

vi.mock("@/utils/storage", () => ({
  safeLocalStorage: mocks.safeLocalStorage,
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
    checkDailyCompletionAchievement: mocks.checkDailyCompletionAchievement,
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

vi.mock("@/utils/mentorMoodSignal", () => ({
  setPendingMentorMood: mocks.setPendingMentorMood,
}));

vi.mock("@/utils/supabaseFunctionErrors", () => ({
  parseFunctionInvokeError: mocks.parseFunctionInvokeError,
  toUserFacingFunctionError: mocks.toUserFacingFunctionError,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "daily_check_ins") {
        const selectChain = {
          eq: vi.fn(() => selectChain),
          maybeSingle: mocks.insertCheckIn,
          then: undefined,
        };
        return {
          select: () => selectChain,
          insert: () => ({
            select: () => ({
              maybeSingle: mocks.insertCheckIn,
            }),
          }),
        };
      }

      return {
        select: () => {
          const selectChain = {
            eq: vi.fn(() => selectChain),
            maybeSingle: mocks.countCheckIns,
          };
          return selectChain;
        },
      };
    },
    functions: {
      invoke: mocks.invokeFunction,
    },
  },
}));

vi.mock("@/hooks/usePostOnboardingMentorGuidance", () => ({
  usePostOnboardingMentorGuidance: () => mocks.guidance,
}));

vi.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { MorningCheckIn } from "./MorningCheckIn";

describe("MorningCheckIn completion portrait", () => {
  beforeEach(() => {
    mocks.user = { id: "user-1" };
    mocks.safeLocalStorage.clear();
    mocks.existingCheckIn = {
      completed_at: "2026-02-21T12:00:00.000Z",
      intention: "Ship the thing",
      mentor_response: "Consistency beats intensity.",
    };
    mocks.personality = {
      name: "The Sage",
      slug: "sage",
      primary_color: "#000000",
      avatar_url: "https://cdn.example.com/sage.png",
    };
    mocks.loadMentorImage.mockReset();
    mocks.parseFunctionInvokeError.mockReset();
    mocks.toUserFacingFunctionError.mockReset();
    mocks.queryClient.invalidateQueries.mockClear();
    mocks.toast.mockClear();
    mocks.awardCheckInComplete.mockClear();
    mocks.checkDailyCompletionAchievement.mockClear();
    mocks.checkFirstTimeAchievements.mockClear();
    mocks.triggerReaction.mockClear();
    mocks.setPendingMentorMood.mockClear();
    mocks.insertCheckIn.mockReset();
    mocks.countCheckIns.mockReset();
    mocks.invokeFunction.mockReset();
    mocks.guidance = {
      isActive: false,
      currentStep: null,
    };
  });

  it("renders portrait tile and quote with direct avatar URL", async () => {
    render(<MorningCheckIn />);

    const portrait = await screen.findByTestId("mentor-portrait-tile");
    expect(screen.getByTestId("morning-checkin-shell").className).toContain("bg-transparent");
    expect(screen.getByTestId("morning-checkin-shell").className).toContain("backdrop-blur-none");
    expect(screen.getByTestId("morning-checkin-shell").className).toContain("shadow-none");
    expect(screen.getByTestId("morning-checkin-shell")).toHaveClass("border-celestial-blue/20");
    expect(screen.getByTestId("mentor-response-panel")).toHaveClass("bg-white/[0.03]");
    expect(screen.getByTestId("mentor-response-panel")).toHaveClass("backdrop-blur-xl");
    expect(portrait).toHaveClass("float-right");
    expect((portrait as HTMLImageElement).src).toContain("https://cdn.example.com/sage.png");
    expect(screen.getByText(/Consistency beats intensity/i)).toBeInTheDocument();
  });

  it("falls back to loadMentorImage when avatar_url is missing", async () => {
    mocks.personality = {
      name: "The Sage",
      slug: "sage",
      primary_color: "#000000",
    };
    mocks.loadMentorImage.mockResolvedValueOnce("/assets/sage-fallback.png");

    render(<MorningCheckIn />);

    await waitFor(() => expect(mocks.loadMentorImage).toHaveBeenCalledWith("sage"));
    const portrait = await screen.findByTestId("mentor-portrait-tile");
    expect((portrait as HTMLImageElement).src).toContain("/assets/sage-fallback.png");
  });

  it("keeps mentor copy visible when portrait loading fails", async () => {
    mocks.personality = {
      name: "The Sage",
      slug: "sage",
      primary_color: "#000000",
    };
    mocks.loadMentorImage.mockRejectedValueOnce(new Error("load failed"));

    render(<MorningCheckIn />);

    await waitFor(() => expect(mocks.loadMentorImage).toHaveBeenCalledWith("sage"));
    expect(screen.queryByTestId("mentor-portrait-tile")).not.toBeInTheDocument();
    expect(screen.getByText("The Sage")).toBeInTheDocument();
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

  it("adds the tutorial highlight treatment to the submit button during Step 3", () => {
    mocks.existingCheckIn = null;
    mocks.guidance = {
      isActive: true,
      currentStep: "morning_checkin",
    };

    render(<MorningCheckIn />);

    expect(screen.getByTestId("morning-checkin-shell").className).toContain("bg-transparent");
    expect(screen.getByTestId("morning-checkin-shell").className).toContain("backdrop-blur-none");
    expect(screen.getByTestId("morning-checkin-shell").className).toContain("shadow-none");
    expect(screen.getByTestId("morning-checkin-header")).not.toHaveClass("bg-gradient-to-r");
    const submitButton = screen.getByRole("button", { name: /check in/i });
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveAttribute("data-tutorial-highlight", "true");
    expect(submitButton.className).toContain("tutorial-checkin-cta");
  });

  it("keeps the default submit button styling outside the tutorial Step 3 state", () => {
    mocks.existingCheckIn = null;
    mocks.guidance = {
      isActive: true,
      currentStep: "create_quest",
    };

    render(<MorningCheckIn />);

    const submitButton = screen.getByRole("button", { name: /check in/i });
    expect(submitButton).not.toHaveAttribute("data-tutorial-highlight");
    expect(submitButton.className).not.toContain("tutorial-checkin-cta");
  });

  it("shows the parsed backend error when the mentor reply request fails", async () => {
    mocks.existingCheckIn = null;
    mocks.insertCheckIn
      .mockResolvedValueOnce({ data: null })
      .mockImplementationOnce(async () => {
        mocks.existingCheckIn = {
          completed_at: "2026-02-21T12:00:00.000Z",
          intention: "Ship the thing",
          mentor_response: null,
        };

        return {
          data: {
            id: "check-in-1",
            user_id: "user-1",
            completed_at: "2026-02-21T12:00:00.000Z",
          },
          error: null,
        };
      });
    mocks.countCheckIns.mockResolvedValue({ count: 2 });
    const invokeError = new Error("Edge Function returned a non-2xx status code");
    mocks.invokeFunction.mockResolvedValue({ error: invokeError });
    mocks.parseFunctionInvokeError.mockResolvedValue({
      category: "rate_limit",
      isOffline: false,
      backendMessage: "Too many AI requests. Please try again later.",
    });
    mocks.toUserFacingFunctionError.mockReturnValue("Too many AI requests. Please try again later.");

    render(<MorningCheckIn />);

    fireEvent.click(screen.getByRole("button", { name: /motivated/i }));
    fireEvent.change(screen.getByPlaceholderText("I will..."), {
      target: { value: "Ship the thing" },
    });
    fireEvent.click(screen.getByRole("button", { name: /check in/i }));

    expect(await screen.findByTestId("mentor-response-status")).toHaveTextContent(
      "Too many AI requests. Please try again later.",
    );
  });

  it("restores an unfinished morning check-in draft after remount", async () => {
    mocks.existingCheckIn = null;

    const { unmount } = render(<MorningCheckIn />);

    fireEvent.click(screen.getByRole("button", { name: /motivated/i }));
    fireEvent.change(screen.getByPlaceholderText("I will..."), {
      target: { value: "Finish the draft" },
    });

    await waitFor(() => {
      expect(mocks.safeLocalStorage.getItem(getMorningCheckInDraftStorageKey("user-1"))).toContain("Finish the draft");
    });

    unmount();

    render(<MorningCheckIn />);

    expect(screen.getByDisplayValue("Finish the draft")).toBeInTheDocument();
  });

  it("clears a stale morning check-in draft from a previous day", async () => {
    mocks.existingCheckIn = null;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString("en-CA");
    mocks.safeLocalStorage.setItem(
      getMorningCheckInDraftStorageKey("user-1"),
      JSON.stringify({
        mood: "motivated",
        intention: "Old plan",
        date: yesterday,
        updatedAt: "2026-04-14T10:00:00.000Z",
      }),
    );

    render(<MorningCheckIn />);

    await waitFor(() => {
      expect(mocks.safeLocalStorage.getItem(getMorningCheckInDraftStorageKey("user-1"))).toBeNull();
    });
    expect(screen.getByPlaceholderText("I will...")).toHaveValue("");
  });

  it("clears the stored morning check-in draft after a successful submission", async () => {
    mocks.existingCheckIn = null;
    mocks.insertCheckIn
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({
        data: {
          id: "check-in-1",
          user_id: "user-1",
          completed_at: "2026-02-21T12:00:00.000Z",
        },
        error: null,
      });
    mocks.countCheckIns.mockResolvedValue({ count: 2 });
    mocks.invokeFunction.mockResolvedValue({ error: null });

    render(<MorningCheckIn />);

    fireEvent.click(screen.getByRole("button", { name: /motivated/i }));
    fireEvent.change(screen.getByPlaceholderText("I will..."), {
      target: { value: "Ship it" },
    });

    await waitFor(() => {
      expect(mocks.safeLocalStorage.getItem(getMorningCheckInDraftStorageKey("user-1"))).toContain("Ship it");
    });

    fireEvent.click(screen.getByRole("button", { name: /check in/i }));

    await waitFor(() => {
      expect(mocks.insertCheckIn).toHaveBeenCalledTimes(2);
    });

    expect(mocks.safeLocalStorage.getItem(getMorningCheckInDraftStorageKey("user-1"))).toBeNull();
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["morning-check-in"],
    });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["journal-entries"],
    });
  });
});
