import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  loading: false,
  status: "unauthenticated" as "loading" | "recovering" | "authenticated" | "unauthenticated",
  recoveryIssue: null as "secure_storage" | "connection" | null,
}));

const recovery = vi.hoisted(() => ({ restart: vi.fn() }));
vi.mock("@/utils/authRecovery", () => ({ restartAuthRecovery: recovery.restart }));

const accessState = vi.hoisted(() => ({
  hasAccess: true,
  gateReason: "none" as "none" | "pre_trial_signup" | "trial_expired",
  loading: false,
  error: false,
  retry: vi.fn(),
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
    recovery.restart.mockClear();
    authState.user = null;
    authState.loading = false;
    authState.status = "unauthenticated";
    authState.recoveryIssue = null;
    accessState.hasAccess = true;
    accessState.gateReason = "none";
    accessState.loading = false;
    accessState.error = false;
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

  it("shows a retry screen rather than a paywall when the initial access check fails", () => {
    authState.user = { id: "user-1" };
    authState.status = "authenticated";
    accessState.hasAccess = false;
    accessState.error = true;
    renderProtectedRoute();
    expect(screen.getByText("We couldn’t check your access")).toBeInTheDocument();
    expect(screen.queryByText(/Paywall:/)).not.toBeInTheDocument();
  });

  it("does not interrupt an already verified user on a failed background check", () => {
    authState.user = { id: "user-1" };
    authState.status = "authenticated";
    const view = renderProtectedRoute();
    accessState.hasAccess = false;
    accessState.error = true;
    view.rerender(ProtectedRouteTree());
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
    expect(screen.queryByText(/Paywall:/)).not.toBeInTheDocument();
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

  it("offers recovery without logging out when auth takes too long", async () => {
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

      expect(screen.getByRole("button", { name: "Retry sign-in check" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Retry sign-in check" }));
      expect(recovery.restart).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Welcome Page")).not.toBeInTheDocument();
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    } finally {
      warnSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("lets a slow saved-session renewal finish without a premature failure screen", async () => {
    vi.useFakeTimers();
    try {
      authState.status = "loading";
      authState.loading = true;
      const view = renderProtectedRoute();
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
      expect(screen.queryByRole("button", { name: "Retry sign-in check" })).not.toBeInTheDocument();
      authState.user = { id: "restored-user" };
      authState.loading = false;
      authState.status = "authenticated";
      view.rerender(ProtectedRouteTree());
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
      expect(screen.queryByText("Welcome Page")).not.toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });

  it("distinguishes secure storage failure from a connection problem", async () => {
    vi.useFakeTimers();
    try {
      authState.status = "recovering";
      authState.loading = true;
      authState.recoveryIssue = "secure_storage";
      renderProtectedRoute();
      await act(async () => { await vi.advanceTimersByTimeAsync(PROTECTED_ROUTE_AUTH_STALL_MS); });
      expect(screen.getByText("Your saved sign-in couldn’t be opened")).toBeInTheDocument();
      expect(screen.queryByText(/Check your connection/)).not.toBeInTheDocument();
      expect(screen.queryByText("Welcome Page")).not.toBeInTheDocument();
    } finally { vi.useRealTimers(); }
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
