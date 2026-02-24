import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  loading: false,
  status: "unauthenticated" as "loading" | "recovering" | "authenticated" | "unauthenticated",
}));

const accessState = vi.hoisted(() => ({
  hasAccess: true,
  gateReason: "none" as "none" | "pre_trial_signup" | "trial_expired",
  loading: false,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

vi.mock("@/hooks/useAccessStatus", () => ({
  useAccessStatus: () => accessState,
}));

vi.mock("@/components/TrialExpiredPaywall", () => ({
  TrialExpiredPaywall: ({ variant }: { variant?: "pre_trial_signup" | "trial_expired" }) => (
    <div>{`Paywall:${variant ?? "pre_trial_signup"}`}</div>
  ),
}));

import { ProtectedRoute } from "./ProtectedRoute";

const renderProtectedRoute = () =>
  render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <div>Protected Content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/welcome" element={<div>Welcome Page</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("ProtectedRoute", () => {
  beforeEach(() => {
    authState.user = null;
    authState.loading = false;
    authState.status = "unauthenticated";
    accessState.hasAccess = true;
    accessState.gateReason = "none";
    accessState.loading = false;
  });

  it("does not redirect while auth is recovering", () => {
    authState.status = "recovering";
    authState.loading = true;
    authState.user = { id: "user-1" };

    renderProtectedRoute();

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Welcome Page")).not.toBeInTheDocument();
  });

  it("redirects to welcome when unauthenticated", async () => {
    authState.status = "unauthenticated";
    authState.loading = false;
    authState.user = null;

    renderProtectedRoute();

    await waitFor(() => {
      expect(screen.getByText("Welcome Page")).toBeInTheDocument();
    });
  });

  it("renders protected content for authenticated users", () => {
    authState.status = "authenticated";
    authState.loading = false;
    authState.user = { id: "user-2" };

    renderProtectedRoute();

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("renders pre-trial paywall variant when access requires trial signup", () => {
    authState.status = "authenticated";
    authState.loading = false;
    authState.user = { id: "user-3" };
    accessState.hasAccess = false;
    accessState.gateReason = "pre_trial_signup";

    renderProtectedRoute();

    expect(screen.getByText("Paywall:pre_trial_signup")).toBeInTheDocument();
  });

  it("renders trial-expired paywall variant when trial is expired", () => {
    authState.status = "authenticated";
    authState.loading = false;
    authState.user = { id: "user-4" };
    accessState.hasAccess = false;
    accessState.gateReason = "trial_expired";

    renderProtectedRoute();

    expect(screen.getByText("Paywall:trial_expired")).toBeInTheDocument();
  });
});
