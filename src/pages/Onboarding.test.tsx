import { render, screen, waitFor } from "@testing-library/react";
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
    status: "authenticated" as "loading" | "recovering" | "authenticated" | "unauthenticated",
    user: { id: "user-1" } as { id: string } | null,
    profile: {
      onboarding_completed: false,
      selected_mentor_id: "mentor-1",
      onboarding_data: {},
    } as Record<string, unknown> | null,
    profileLoading: false,
    companion: null as { id: string } | null,
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

vi.mock("@/components/onboarding", () => ({
  StoryOnboarding: () => <div>StoryOnboarding</div>,
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
    mocks.companion = { id: "companion-1" };

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
});
