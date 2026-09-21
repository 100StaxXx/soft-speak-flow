import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingExperienceGate } from "./OnboardingExperienceGate";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  profile: null as Record<string, unknown> | null,
  profileLoading: false,
  profileError: null as Error | null,
  companion: null as Record<string, unknown> | null,
  companionLoading: false,
  companionError: null as Error | null,
  refetchProfile: vi.fn(),
  refetchCompanion: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
    loading: false,
    status: mocks.user ? "authenticated" : "unauthenticated",
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: mocks.profile,
    loading: mocks.profileLoading,
    error: mocks.profileError,
    refetch: mocks.refetchProfile,
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: mocks.companion,
    isLoading: mocks.companionLoading,
    error: mocks.companionError,
    refetch: mocks.refetchCompanion,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    })),
  },
}));

const renderGate = (initialPath = "/mentor") => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <OnboardingExperienceGate>
          <Routes>
            <Route path="/mentor" element={<div>Graceward Today</div>} />
            <Route path="/onboarding" element={<div>Graceward onboarding</div>} />
          </Routes>
        </OnboardingExperienceGate>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("OnboardingExperienceGate", () => {
  beforeEach(() => {
    mocks.user = { id: "user-1" };
    mocks.profile = {
      id: "user-1",
      selected_mentor_id: null,
      onboarding_completed: false,
      onboarding_step: null,
      onboarding_data: null,
    };
    mocks.profileLoading = false;
    mocks.profileError = null;
    mocks.companion = null;
    mocks.companionLoading = false;
    mocks.companionError = null;
    mocks.refetchProfile.mockReset();
    mocks.refetchCompanion.mockReset();
  });

  it("redirects a newly created account into onboarding", async () => {
    renderGate();

    expect(await screen.findByText("Graceward onboarding")).toBeInTheDocument();
    expect(screen.queryByText("Graceward Today")).not.toBeInTheDocument();
  });

  it("allows an established account into the main experience", () => {
    mocks.profile = {
      ...mocks.profile,
      onboarding_completed: true,
      onboarding_step: "complete",
    };

    renderGate();

    expect(screen.getByText("Graceward Today")).toBeInTheDocument();
  });

  it("does not gate the onboarding route while profile data is loading", () => {
    mocks.profileLoading = true;
    mocks.companionLoading = true;

    renderGate("/onboarding");

    expect(screen.getByText("Graceward onboarding")).toBeInTheDocument();
  });

  it("shows a recoverable state when onboarding data cannot be loaded", async () => {
    mocks.profile = null;
    mocks.profileError = new Error("offline");

    renderGate();

    fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));
    await waitFor(() => {
      expect(mocks.refetchProfile).toHaveBeenCalledOnce();
      expect(mocks.refetchCompanion).toHaveBeenCalledOnce();
    });
  });
});
