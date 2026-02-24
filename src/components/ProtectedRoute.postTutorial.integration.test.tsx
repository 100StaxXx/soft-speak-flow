import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  loading: false,
  status: "authenticated" as "loading" | "recovering" | "authenticated" | "unauthenticated",
}));

const profileState = vi.hoisted(() => ({
  profile: {
    created_at: "2026-02-01T00:00:00.000Z",
    trial_started_at: null,
    trial_ends_at: null,
    onboarding_data: {
      guided_tutorial: { completed: false },
    },
  } as {
    created_at: string;
    trial_started_at: string | null;
    trial_ends_at: string | null;
    onboarding_data: Record<string, unknown>;
  },
  loading: false,
}));

const subscriptionState = vi.hoisted(() => ({
  isActive: false,
  isLoading: false,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => profileState,
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => subscriptionState,
}));

vi.mock("@/components/TrialExpiredPaywall", () => ({
  TrialExpiredPaywall: ({ variant }: { variant?: "pre_trial_signup" | "trial_expired" }) => (
    <div>{`Paywall:${variant ?? "pre_trial_signup"}`}</div>
  ),
}));

import { ProtectedRoute } from "./ProtectedRoute";

const renderRoute = () =>
  render(
    <MemoryRouter initialEntries={["/companion"]}>
      <Routes>
        <Route
          path="/companion"
          element={
            <ProtectedRoute>
              <div>Tutorial Complete Screen</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );

describe("ProtectedRoute post-tutorial gating", () => {
  beforeEach(() => {
    authState.user = { id: "user-1" };
    authState.loading = false;
    authState.status = "authenticated";

    subscriptionState.isActive = false;
    subscriptionState.isLoading = false;

    profileState.loading = false;
    profileState.profile = {
      created_at: "2026-02-01T00:00:00.000Z",
      trial_started_at: null,
      trial_ends_at: null,
      onboarding_data: {
        guided_tutorial: { completed: false },
      },
    };
  });

  it("shows pre-trial gate right after tutorial completion state is persisted", async () => {
    const { rerender } = renderRoute();

    expect(screen.getByText("Tutorial Complete Screen")).toBeInTheDocument();
    expect(screen.queryByText("Paywall:pre_trial_signup")).not.toBeInTheDocument();

    profileState.profile = {
      ...profileState.profile,
      onboarding_data: {
        guided_tutorial: { completed: true },
      },
    };

    rerender(
      <MemoryRouter initialEntries={["/companion"]}>
        <Routes>
          <Route
            path="/companion"
            element={
              <ProtectedRoute>
                <div>Tutorial Complete Screen</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Paywall:pre_trial_signup")).toBeInTheDocument();
    });
    expect(screen.queryByText("Tutorial Complete Screen")).not.toBeInTheDocument();
  });

  it("still renders trial-expired gate when tutorial is not complete and trial is expired", () => {
    profileState.profile = {
      ...profileState.profile,
      trial_started_at: "2026-01-01T00:00:00.000Z",
      trial_ends_at: "2026-01-08T00:00:00.000Z",
      onboarding_data: {
        guided_tutorial: { completed: false },
      },
    };

    renderRoute();

    expect(screen.getByText("Paywall:trial_expired")).toBeInTheDocument();
  });
});
