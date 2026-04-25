import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "@/components/ui/sonner";

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
    storyOnboardingProps: null as Record<string, unknown> | null,
    queryClient: { invalidateQueries: vi.fn(), refetchQueries: vi.fn() },
    signOut: vi.fn(() => Promise.resolve()),
    deleteCurrentAccount: vi.fn(() => Promise.resolve({ warnings: [] })),
    isAccountDeletionAuthError: vi.fn(() => false),
    status: "authenticated" as "loading" | "recovering" | "authenticated" | "unauthenticated",
    user: { id: "user-1" } as { id: string } | null,
    profile: {
      onboarding_completed: false,
      selected_mentor_id: "mentor-1",
      onboarding_data: {},
    } as Record<string, unknown> | null,
    profileLoading: false,
    companion: null as {
      id: string;
      preset_id?: string | null;
      current_stage?: number | null;
      current_image_url?: string | null;
      initial_image_url?: string | null;
      core_element?: string | null;
      spirit_animal?: string | null;
      companion_name?: string | null;
      cached_creature_name?: string | null;
    } | null,
    companionLoading: false,
    profilesUpdateEqMock,
    profilesUpdateMock,
    fromMock,
    loggerError: vi.fn(),
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
    status: mocks.status,
    signOut: mocks.signOut,
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mocks.queryClient,
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

vi.mock("@/services/accountDeletion", () => ({
  deleteCurrentAccount: (options: unknown) => mocks.deleteCurrentAccount(options),
  isAccountDeletionAuthError: (error: unknown) => mocks.isAccountDeletionAuthError(error),
  getAccountDeletionErrorMetadata: (error: unknown) => {
    if (!error || typeof error !== "object") return {};
    const candidate = error as Record<string, unknown>;
    return {
      ...(typeof candidate.code === "string" ? { code: candidate.code } : {}),
      ...(typeof candidate.status === "number" ? { status: candidate.status } : {}),
      ...(typeof candidate.requestId === "string" ? { requestId: candidate.requestId } : {}),
      ...(typeof candidate.stage === "string" ? { stage: candidate.stage } : {}),
    };
  },
  getAccountDeletionFailureMessage: (error: unknown) => {
    const stage =
      error && typeof error === "object" && typeof (error as { stage?: unknown }).stage === "string"
        ? (error as { stage: string }).stage
        : undefined;
    if (stage === "storage_cleanup") {
      return "We couldn't finish deleting your uploaded files, so your account wasn't removed. Please try again.";
    }
    return error instanceof Error ? error.message : "Failed to delete account. Please try again.";
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

vi.mock("@/components/PageLoader", () => ({
  PageLoader: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock("@/components/onboarding", () => ({
  StoryOnboarding: (props: Record<string, unknown>) => {
    mocks.storyOnboardingProps = props;
    return <div>StoryOnboarding</div>;
  },
}));

import Onboarding from "./Onboarding";

const renderOnboarding = () =>
  render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <Onboarding />
    </MemoryRouter>,
  );

describe("Onboarding route guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.status = "authenticated";
    mocks.storyOnboardingProps = null;
    mocks.signOut.mockResolvedValue(undefined);
    mocks.deleteCurrentAccount.mockResolvedValue({ warnings: [] });
    mocks.isAccountDeletionAuthError.mockReturnValue(false);
    mocks.user = { id: "user-1" };
    mocks.profile = {
      onboarding_completed: false,
      selected_mentor_id: "mentor-1",
      onboarding_data: {},
    };
    mocks.profileLoading = false;
    mocks.companion = null;
    mocks.companionLoading = false;
    mocks.loggerError.mockReset();
  });

  it("redirects companion-backed established accounts away from onboarding", async () => {
    mocks.companion = {
      id: "companion-1",
      preset_id: "dragon",
      current_stage: 1,
      current_image_url: "https://example.com/stage-1.png",
      initial_image_url: "https://example.com/egg.png",
    };

    renderOnboarding();

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith("/journeys", { replace: true });
    });
    expect(screen.queryByText("StoryOnboarding")).not.toBeInTheDocument();
    expect(mocks.profilesUpdateMock).toHaveBeenCalledWith({
      onboarding_completed: true,
      onboarding_data: {
        walkthrough_completed: true,
      },
    });
    expect(mocks.profilesUpdateEqMock).toHaveBeenCalledWith("id", "user-1");
  });

  it("still renders onboarding for incomplete accounts without a companion", () => {
    renderOnboarding();

    expect(screen.getByText("StoryOnboarding")).toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("restarts at the opening name screen when saved mid-onboarding progress has no name", () => {
    mocks.profile = {
      onboarding_completed: false,
      selected_mentor_id: "mentor-1",
      onboarding_step: "questionnaire",
      onboarding_data: {
        questionnaireAnswers: [],
      },
    };

    renderOnboarding();

    expect(screen.getByText("StoryOnboarding")).toBeInTheDocument();
    expect(mocks.storyOnboardingProps).toMatchObject({
      resumeState: {
        stage: "prologue",
        userName: "",
      },
    });
  });

  it("shows a recovery action when onboarding gate loading stalls", async () => {
    vi.useFakeTimers();
    mocks.profileLoading = true;

    try {
      renderOnboarding();

      expect(screen.queryByText("We are still loading your setup")).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(12_000);
      });

      expect(screen.getByText("We are still loading your setup")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));

      expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["profile", "user-1"],
      });
      expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["companion", "user-1"],
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps stage 0 egg accounts on onboarding and resumes the final cinematic", () => {
    mocks.profile = {
      onboarding_completed: true,
      selected_mentor_id: "mentor-1",
      onboarding_step: null,
      onboarding_data: {
        userName: "Nova",
      },
    };
    mocks.companion = {
      id: "companion-egg",
      preset_id: null,
      current_stage: 0,
      core_element: "ice",
      spirit_animal: "Egg",
      current_image_url: "https://example.com/ai-egg.png",
      initial_image_url: "https://example.com/ai-egg.png",
      cached_creature_name: null,
    } as {
      id: string;
      preset_id: null;
      current_stage: number;
      core_element: string;
      spirit_animal: string;
      current_image_url: string;
      initial_image_url: string;
      cached_creature_name: string | null;
    };

    renderOnboarding();

    expect(screen.getByText("StoryOnboarding")).toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.storyOnboardingProps).toMatchObject({
      resumeState: {
        stage: "journey-begins",
        userName: "Nova",
        companionLabel: "Ice Egg",
      },
    });
    expect(mocks.profilesUpdateMock).not.toHaveBeenCalled();
  });

  it("ignores cached creature names for preset-backed stage 0 eggs during journey-begins recovery", () => {
    mocks.profile = {
      onboarding_completed: true,
      selected_mentor_id: "mentor-1",
      onboarding_step: null,
      onboarding_data: {
        userName: "Nova",
      },
    };
    mocks.companion = {
      id: "companion-egg",
      preset_id: "dragon",
      current_stage: 0,
      core_element: "fire",
      spirit_animal: "Dragon",
      current_image_url: "https://example.com/preset-egg.png",
      initial_image_url: "https://example.com/preset-egg.png",
      cached_creature_name: "Ignisyl",
    } as {
      id: string;
      preset_id: string;
      current_stage: number;
      core_element: string;
      spirit_animal: string;
      current_image_url: string;
      initial_image_url: string;
      cached_creature_name: string | null;
    };

    renderOnboarding();

    expect(screen.getByText("StoryOnboarding")).toBeInTheDocument();
    expect(mocks.storyOnboardingProps).toMatchObject({
      resumeState: {
        stage: "journey-begins",
        userName: "Nova",
        companionLabel: "Ember Egg",
      },
    });
  });

  it("keeps journey-begins recovery on onboarding without revealing a hatched creature name", () => {
    mocks.profile = {
      onboarding_completed: true,
      selected_mentor_id: "mentor-1",
      onboarding_step: "journey-begins",
      onboarding_data: {
        userName: "Nova",
      },
    };
    mocks.companion = {
      id: "companion-1",
      preset_id: "dragon",
      current_stage: 1,
      core_element: "ice",
      spirit_animal: "Dragon",
      current_image_url: "https://example.com/stage-1.png",
      initial_image_url: "https://example.com/egg.png",
      cached_creature_name: "Frostbite",
    } as {
      id: string;
      preset_id: string;
      current_stage: number;
      core_element: string;
      spirit_animal: string;
      current_image_url: string;
      initial_image_url: string;
      cached_creature_name: string | null;
    };

    renderOnboarding();

    expect(screen.getByText("StoryOnboarding")).toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.storyOnboardingProps).toMatchObject({
      resumeState: {
        stage: "journey-begins",
        userName: "Nova",
        companionLabel: "Dragon",
      },
    });
    expect(mocks.profilesUpdateMock).not.toHaveBeenCalled();
  });

  it("prefers a stored custom companion name during journey-begins recovery", () => {
    mocks.profile = {
      onboarding_completed: true,
      selected_mentor_id: "mentor-1",
      onboarding_step: "journey-begins",
      onboarding_data: {
        userName: "Nova",
      },
    };
    mocks.companion = {
      id: "companion-1",
      preset_id: "dragon",
      current_stage: 0,
      core_element: "ice",
      spirit_animal: "Dragon",
      current_image_url: "https://example.com/preset-egg.png",
      initial_image_url: "https://example.com/preset-egg.png",
      companion_name: "Lyra",
      cached_creature_name: "Frostbite",
    } as {
      id: string;
      preset_id: string;
      current_stage: number;
      core_element: string;
      spirit_animal: string;
      current_image_url: string;
      initial_image_url: string;
      companion_name: string;
      cached_creature_name: string | null;
    };

    renderOnboarding();

    expect(screen.getByText("StoryOnboarding")).toBeInTheDocument();
    expect(mocks.storyOnboardingProps).toMatchObject({
      resumeState: {
        stage: "journey-begins",
        userName: "Nova",
        companionLabel: "Lyra",
      },
    });
  });

  it("starts reset mode when progression reset is required", () => {
    mocks.profile = {
      onboarding_completed: true,
      selected_mentor_id: "mentor-1",
      onboarding_data: {
        walkthrough_completed: true,
        progression_reset_required: true,
      },
    };

    renderOnboarding();

    expect(screen.getByText("StoryOnboarding")).toBeInTheDocument();
    expect(mocks.storyOnboardingProps).toMatchObject({
      mode: "reset",
    });
  });

  it("holds the redirect while the final onboarding cinematic is showing", async () => {
    const view = renderOnboarding();

    const storyOnboardingProps = mocks.storyOnboardingProps as {
      onJourneyCinematicStart?: () => void;
      onJourneyCinematicComplete?: () => void;
    } | null;

    expect(storyOnboardingProps?.onJourneyCinematicStart).toBeTypeOf("function");
    expect(storyOnboardingProps?.onJourneyCinematicComplete).toBeTypeOf("function");

    act(() => {
      storyOnboardingProps?.onJourneyCinematicStart?.();
    });

    mocks.profile = {
      onboarding_completed: true,
      onboarding_step: "complete",
      selected_mentor_id: "mentor-1",
      onboarding_data: {
        walkthrough_completed: true,
      },
    };
    mocks.companion = {
      id: "companion-egg",
      preset_id: null,
      current_stage: 0,
      current_image_url: "https://example.com/ai-egg.png",
      initial_image_url: "https://example.com/ai-egg.png",
    };

    view.rerender(
      <MemoryRouter initialEntries={["/onboarding"]}>
        <Onboarding />
      </MemoryRouter>,
    );

    expect(screen.getByText("StoryOnboarding")).toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();

    act(() => {
      storyOnboardingProps?.onJourneyCinematicComplete?.();
    });

    view.rerender(
      <MemoryRouter initialEntries={["/onboarding"]}>
        <Onboarding />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith("/journeys", { replace: true });
    });
  });

  it("requires explicit confirmation before resetting legacy companion accounts", async () => {
    mocks.companion = { id: "companion-legacy", preset_id: null, current_stage: 2 };

    renderOnboarding();

    expect(screen.getByText("Your old companion setup needs a reset")).toBeInTheDocument();
    expect(mocks.deleteCurrentAccount).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reset my account" }));

    await waitFor(() => {
      expect(mocks.deleteCurrentAccount).toHaveBeenCalledWith({
        queryClient: mocks.queryClient,
        userId: "user-1",
        signOut: mocks.signOut,
      });
    });

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith("/auth", {
        replace: true,
        state: {
          message: "Your previous account was removed so you can restart onboarding with the new companion system.",
        },
      });
    });

    expect(screen.queryByText("StoryOnboarding")).not.toBeInTheDocument();
  });

  it("logs and surfaces a stage-aware failure after confirmed legacy account deletion fails", async () => {
    mocks.companion = { id: "companion-legacy", preset_id: null, current_stage: 2 };
    mocks.deleteCurrentAccount.mockRejectedValueOnce(
      Object.assign(new Error("Account deletion is temporarily unavailable. Please try again later."), {
        code: "ACCOUNT_DELETION_STORAGE_CLEANUP_FAILED",
        status: 500,
        requestId: "req-delete-onboarding-1",
        stage: "storage_cleanup",
      }),
    );

    const toastErrorSpy = vi.spyOn(toast, "error").mockImplementation(() => "");

    renderOnboarding();

    fireEvent.click(screen.getByRole("button", { name: "Reset my account" }));

    await waitFor(() => {
      expect(mocks.loggerError).toHaveBeenCalledWith("[Account Deletion] Legacy onboarding reset failed", {
        surface: "onboarding_legacy_reset",
        userId: "user-1",
        code: "ACCOUNT_DELETION_STORAGE_CLEANUP_FAILED",
        status: 500,
        requestId: "req-delete-onboarding-1",
        stage: "storage_cleanup",
        message: "Account deletion is temporarily unavailable. Please try again later.",
      });
    });
    expect(toastErrorSpy).toHaveBeenCalledWith(
      "We couldn't finish deleting your uploaded files, so your account wasn't removed. Please try again.",
    );
    expect(mocks.navigate).not.toHaveBeenCalledWith("/auth", {
      replace: true,
      state: {
        message: "Your previous account was removed so you can restart onboarding with the new companion system.",
      },
    });

    toastErrorSpy.mockRestore();
  });
});
