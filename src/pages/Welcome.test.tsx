import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  loading: false,
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authState }));
vi.mock("@/utils/authRedirect", () => ({ getAuthRedirectPath: vi.fn() }));

import Welcome from "./Welcome";

describe("Graceward welcome", () => {
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

  it("introduces Graceward's daily faith experience with clear account actions", () => {
    render(
      <MemoryRouter initialEntries={["/welcome"]}>
        <Welcome />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Graceward", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/a christian daily companion/i)).toBeInTheDocument();
    expect(screen.getByText(/faithful action for the day you actually have/i)).toBeInTheDocument();
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /receive the day/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /without pretending to speak for god/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /begin|start a daily rhythm/i })[0]).toHaveAttribute("href", "/auth?mode=signup");
    expect(screen.getAllByRole("link", { name: /sign in/i })[0]).toHaveAttribute("href", "/auth");
    expect(screen.queryByText(/faction|destiny|quest-based/i)).not.toBeInTheDocument();
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
