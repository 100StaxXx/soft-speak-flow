import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  status: "authenticated" as "loading" | "recovering" | "authenticated" | "unauthenticated",
  profile: {
    id: "user-1",
    onboarding_completed: false,
    onboarding_data: {},
    faction: null,
  } as Record<string, unknown> | null,
  loading: false,
  companion: null as Record<string, unknown> | null,
  companionLoading: false,
  navigate: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user, status: mocks.status }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ profile: mocks.profile, loading: mocks.loading }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({ companion: mocks.companion, isLoading: mocks.companionLoading }),
}));

vi.mock("@/components/PageLoader", () => ({
  PageLoader: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock("@/components/onboarding/StoryOnboarding", () => ({
  GracewardOnboarding: ({ mode }: { mode: "standard" | "creation" | "migration" }) => (
    <div data-testid="story-onboarding">Story onboarding: {mode}</div>
  ),
}));

import Onboarding from "./Onboarding";

const renderOnboarding = (entry = "/onboarding") => render(
  <MemoryRouter initialEntries={[entry]}>
    <Onboarding />
  </MemoryRouter>,
);

describe("Graceward onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: "user-1" };
    mocks.status = "authenticated";
    mocks.profile = {
      id: "user-1",
      onboarding_completed: false,
      onboarding_data: {},
      faction: null,
    };
    mocks.loading = false;
    mocks.companion = null;
    mocks.companionLoading = false;
  });

  it("starts the Graceward onboarding for a new account", () => {
    renderOnboarding();

    expect(screen.getByTestId("story-onboarding")).toHaveTextContent("standard");
  });

  it("opens Graceward companion creation when an established account has no companion", () => {
    mocks.profile = {
      id: "user-1",
      onboarding_completed: true,
      onboarding_data: { product_mode: "graceward" },
      faction: "void",
    };

    renderOnboarding("/onboarding?companion=1");

    expect(screen.getByTestId("story-onboarding")).toHaveTextContent("creation");
  });

  it("redirects signed-out visitors to welcome", async () => {
    mocks.user = null;
    mocks.status = "unauthenticated";
    renderOnboarding();

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/welcome", { replace: true }));
  });
});
