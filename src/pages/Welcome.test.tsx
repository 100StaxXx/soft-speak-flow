import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  loading: false,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

vi.mock("@/utils/authRedirect", () => ({
  getAuthRedirectPath: vi.fn(),
}));

vi.mock("@/components/PageLoader", () => ({
  PageLoader: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock("@/components/StaticBackgroundImage", () => ({
  StaticBackgroundImage: () => null,
}));

vi.mock("@/assets/backgrounds", () => ({
  welcomeBackground: "",
}));

import Welcome from "./Welcome";

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

describe("Welcome", () => {
  beforeEach(() => {
    authState.user = null;
    authState.loading = false;
  });

  it("shows account CTAs without preview language", () => {
    render(
      <MemoryRouter initialEntries={["/welcome"]}>
        <Welcome />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /^create account$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /explore preview/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/preview/i)).not.toBeInTheDocument();
  });

  it("opens auth in signup mode from the create account CTA", () => {
    render(
      <MemoryRouter initialEntries={["/welcome"]}>
        <Routes>
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/auth" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^create account$/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/auth?mode=signup");
  });
});
