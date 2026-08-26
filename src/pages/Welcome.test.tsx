import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  loading: false,
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authState }));
vi.mock("@/utils/authRedirect", () => ({ getAuthRedirectPath: vi.fn() }));

import Welcome, {
  WelcomePresentation,
  getWelcomeProductContent,
} from "./Welcome";

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

    expect(
      screen.getByRole("heading", { name: "Graceward", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/a christian daily companion/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/faithful action for the day you actually have/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /receive the day/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /without pretending to speak for god/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /begin|start a daily rhythm/i })[0],
    ).toHaveAttribute("href", "/auth?mode=signup");
    expect(
      screen.getAllByRole("link", { name: /sign in/i })[0],
    ).toHaveAttribute("href", "/auth");
    expect(
      screen.queryByText(/faction|destiny|quest-based/i),
    ).not.toBeInTheDocument();
  });

  it("keeps legal links available", () => {
    render(
      <MemoryRouter initialEntries={["/welcome"]}>
        <Welcome />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /^terms$/i })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(screen.getByRole("link", { name: /^privacy$/i })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("keeps Cosmiq landing copy free of Graceward faith language", () => {
    const content = getWelcomeProductContent("cosmiq");
    const allCopy = JSON.stringify(content);

    expect(content.eyebrow).toMatch(/living companion/i);
    expect(content.finalCopy).toMatch(/cinematic moments/i);
    expect(allCopy).not.toMatch(/scripture|prayer|church|god/i);
  });

  it("renders Cosmiq with its cinematic visual system instead of Graceward styling", () => {
    const { container } = render(
      <MemoryRouter>
        <WelcomePresentation mode="cosmiq" />
      </MemoryRouter>,
    );

    const shell = container.querySelector('[data-product-mode="cosmiq"]');
    expect(shell).toHaveClass("bg-[#05080d]", "text-white");
    expect(shell).not.toHaveClass("bg-[#f4efe3]", "text-[#203124]");
    expect(
      screen.getByRole("heading", { name: "Cosmiq", level: 1 }),
    ).toBeInTheDocument();
    expect(
      container.querySelector('img[src="/landing-backdrops/quests.jpg"]'),
    ).toBeInTheDocument();
    expect(screen.queryByText("Graceward")).not.toBeInTheDocument();
  });

  it("keeps Graceward on its cream and forest visual system", () => {
    const { container } = render(
      <MemoryRouter>
        <WelcomePresentation mode="christian" />
      </MemoryRouter>,
    );

    const shell = container.querySelector('[data-product-mode="graceward"]');
    expect(shell).toHaveClass("bg-[#f4efe3]", "text-[#203124]");
    expect(shell).not.toHaveClass("bg-[#05080d]", "text-white");
    expect(
      screen.getByRole("heading", { name: "Graceward", level: 1 }),
    ).toBeInTheDocument();
    expect(
      container.querySelector("img[src^='/landing-backdrops/']"),
    ).toBeNull();
  });
});
