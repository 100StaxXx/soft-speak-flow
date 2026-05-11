import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  loading: false,
}));

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

vi.mock("@/utils/authRedirect", () => ({
  getAuthRedirectPath: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
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
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });
    vi.stubGlobal(
      "IntersectionObserver",
      class IntersectionObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  it("renders an informational landing page without auth CTAs", () => {
    render(
      <MemoryRouter initialEntries={["/welcome"]}>
        <Welcome />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /^cosmiq quest$/i })).toBeInTheDocument();
    expect(screen.getByText(/early access/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /one place for quests, guidance, and momentum/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /more signal\. fewer screens\. a clearer day/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /the story is the system/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /email address/i })).toBeInTheDocument();
    expect(screen.queryByAltText(/companion artwork/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create account/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign in/i })).not.toBeInTheDocument();
  });

  it("submits an early access request", async () => {
    render(
      <MemoryRouter initialEntries={["/welcome"]}>
        <Welcome />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: /email address/i }), {
      target: { value: "User@Example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /request access/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("early-access-signup", {
        body: expect.objectContaining({
          email: "user@example.com",
        }),
      });
    });

    expect(await screen.findByText(/you are on the early access list/i)).toBeInTheDocument();
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
