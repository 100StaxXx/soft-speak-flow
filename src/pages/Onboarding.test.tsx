import { act, render, screen, waitFor } from "@testing-library/react";
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
    companion: null as { id: string; preset_id?: string | null; current_stage?: number | null } | null,
    companionLoading: false,
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
  });

  it("redirects companion-backed established accounts away from onboarding", async () => {
    mocks.companion = { id: "companion-1", preset_id: "dragon", current_stage: 1 };

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
      cached_creature_name: null,
    } as {
      id: string;
      preset_id: null;
      current_stage: number;
      core_element: string;
      spirit_animal: string;
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
    mocks.companion = { id: "companion-egg", preset_id: null, current_stage: 0 };

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

  it("deletes legacy companion accounts instead of rendering the removed migration flow", async () => {
    mocks.companion = { id: "companion-legacy", preset_id: null, current_stage: 2 };

    renderOnboarding();

    expect(screen.getByText("Resetting your account so you can restart onboarding...")).toBeInTheDocument();

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
});
