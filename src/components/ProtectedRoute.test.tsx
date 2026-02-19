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
  loading: false,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

vi.mock("@/hooks/useAccessStatus", () => ({
  useAccessStatus: () => accessState,
}));

vi.mock("@/components/TrialExpiredPaywall", () => ({
  TrialExpiredPaywall: () => <div>Paywall</div>,
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
});
