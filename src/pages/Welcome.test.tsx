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
  StaticBackgroundImage: ({ background }: { background: { src: string } }) => (
    <img alt="" src={background.src} />
  ),
}));

import Welcome from "./Welcome";

describe("Welcome", () => {
  beforeEach(() => {
    authState.user = null;
    authState.loading = false;
    vi.stubGlobal(
      "IntersectionObserver",
      class IntersectionObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  it("renders an informational landing page with auth CTAs", () => {
    render(
      <MemoryRouter initialEntries={["/welcome"]}>
        <Welcome />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /^cosmiq quest$/i })).toBeInTheDocument();
    expect(screen.getByText(/start your quest/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /one place for quests, guidance, and momentum/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /the story is the system/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /register/i })).toHaveAttribute("href", "/auth?mode=signup");
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/auth");
    expect(screen.queryByRole("link", { name: /^cosmiq$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/mythic habit quests/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /email address/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /request access/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /more signal\. fewer screens\. a clearer day/i })).not.toBeInTheDocument();
    expect(screen.queryByAltText(/companion artwork/i)).not.toBeInTheDocument();
  });

  it("keeps legal links available", () => {
    render(
      <MemoryRouter initialEntries={["/welcome"]}>
        <Welcome />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /^terms$/i })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: /^privacy$/i })).toHaveAttribute("href", "/privacy");
  });
});
