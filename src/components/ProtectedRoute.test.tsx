import { act, render, screen, waitFor } from "@testing-library/react";
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

vi.mock("@/components/Paywall", () => ({
  Paywall: ({ variant }: { variant?: "pre_trial_signup" | "trial_expired" }) => (
    <div>{`Paywall:${variant ?? "pre_trial_signup"}`}</div>
  ),
}));

import { ProtectedRoute, PROTECTED_ROUTE_AUTH_STALL_MS } from "./ProtectedRoute";

const ProtectedRouteTree = (props?: Partial<React.ComponentProps<typeof ProtectedRoute>>) => (
  <MemoryRouter initialEntries={["/protected"]}>
    <Routes>
      <Route
        path="/protected"
        element={
          <ProtectedRoute {...props}>
            <div>Protected Content</div>
          </ProtectedRoute>
        }
      />
      <Route path="/welcome" element={<div>Welcome Page</div>} />
    </Routes>
  </MemoryRouter>
);

const renderProtectedRoute = (props?: Partial<React.ComponentProps<typeof ProtectedRoute>>) =>
  render(ProtectedRouteTree(props));

describe("ProtectedRoute", () => {
  beforeEach(() => {
    authState.user = null;
    authState.loading = false;
    authState.status = "unauthenticated";
    accessState.hasAccess = true;
    accessState.gateReason = "none";
    accessState.loading = false;
  });

  it("renders protected content while auth is recovering with a cached user", () => {
    authState.status = "recovering";
    authState.loading = true;
    authState.user = { id: "user-1" };

    renderProtectedRoute();

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    expect(screen.queryByText("Welcome Page")).not.toBeInTheDocument();
  });

  it("does not redirect while auth is recovering without a cached user", () => {
    authState.status = "recovering";
    authState.loading = true;
    authState.user = null;

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

  it("keeps rendered content visible while access refreshes", () => {
    authState.status = "authenticated";
    authState.loading = false;
    authState.user = { id: "user-6" };

    const view = renderProtectedRoute();

    expect(screen.getByText("Protected Content")).toBeInTheDocument();

    accessState.loading = true;
    view.rerender(ProtectedRouteTree());

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("blocks content instead of reusing a previous user's access decision during account switches", () => {
    authState.status = "authenticated";
    authState.loading = false;
    authState.user = { id: "user-a" };

    const view = renderProtectedRoute();

    expect(screen.getByText("Protected Content")).toBeInTheDocument();

    authState.user = { id: "user-b" };
    accessState.loading = true;
    view.rerender(ProtectedRouteTree());

    expect(screen.getByText("Checking access...")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("does not render protected content while the initial access check is still loading", () => {
    authState.status = "authenticated";
    authState.loading = false;
    authState.user = { id: "user-stalled" };
    accessState.hasAccess = true;
    accessState.gateReason = "none";
    accessState.loading = true;

    renderProtectedRoute();

    expect(screen.getByText("Checking access...")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("shows the paywall if the initial access check resolves denied", () => {
    authState.status = "authenticated";
    authState.loading = false;
    authState.user = { id: "user-denied-after-stall" };
    accessState.hasAccess = true;
    accessState.gateReason = "none";
    accessState.loading = true;

    const view = renderProtectedRoute();

    expect(screen.getByText("Checking access...")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();

    accessState.loading = false;
    accessState.hasAccess = false;
    accessState.gateReason = "trial_expired";
    view.rerender(ProtectedRouteTree());

    expect(screen.getByText("Paywall:trial_expired")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("leaves auth loading and redirects to welcome if auth never resolves", async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    authState.status = "loading";
    authState.loading = true;
    authState.user = null;

    try {
      renderProtectedRoute();

      expect(screen.getByText("Loading...")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PROTECTED_ROUTE_AUTH_STALL_MS);
        await Promise.resolve();
      });

      expect(screen.getByText("Welcome Page")).toBeInTheDocument();
    } finally {
      warnSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("keeps the paywall visible while denied access refreshes", () => {
    authState.status = "authenticated";
    authState.loading = false;
    authState.user = { id: "user-7" };
    accessState.hasAccess = false;
    accessState.gateReason = "pre_trial_signup";

    const view = renderProtectedRoute();

    expect(screen.getByText("Paywall:pre_trial_signup")).toBeInTheDocument();

    accessState.loading = true;
    accessState.hasAccess = true;
    view.rerender(ProtectedRouteTree());

    expect(screen.getByText("Paywall:pre_trial_signup")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
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

  it("renders protected content without waiting on subscription checks when access is not required", () => {
    authState.status = "authenticated";
    authState.loading = false;
    authState.user = { id: "user-5" };
    accessState.hasAccess = false;
    accessState.loading = true;

    renderProtectedRoute({ requireAccess: false });

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });
});
