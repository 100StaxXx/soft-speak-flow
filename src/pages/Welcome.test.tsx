import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

describe("Welcome", () => {
  beforeEach(() => {
    authState.user = null;
    authState.loading = false;
  });

  it("shows a single sign-in CTA without preview language", () => {
    render(
      <MemoryRouter initialEntries={["/welcome"]}>
        <Welcome />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /explore preview/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/preview/i)).not.toBeInTheDocument();
  });
});
