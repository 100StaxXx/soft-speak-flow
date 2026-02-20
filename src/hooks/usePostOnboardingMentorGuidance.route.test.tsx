import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PostOnboardingMentorGuidanceProvider,
  usePostOnboardingMentorGuidance,
} from "./usePostOnboardingMentorGuidance";

const createGuidedTutorial = () => ({
  version: 2,
  eligible: true,
  completed: false,
  completedSteps: ["create_quest", "meet_companion"] as const,
  xpAwardedSteps: [] as string[],
  milestonesCompleted: ["open_mentor_tab"] as const,
});

const mocks = vi.hoisted(() => ({
  guidedTutorial: {
    version: 2,
    eligible: true,
    completed: false,
    completedSteps: ["create_quest", "meet_companion"] as const,
    xpAwardedSteps: [] as string[],
    milestonesCompleted: ["open_mentor_tab"] as const,
  },
  profileUpdatePayloads: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    loading: false,
    profile: {
      onboarding_data: {
        walkthrough_completed: true,
        guided_tutorial: mocks.guidedTutorial,
      },
    },
  }),
}));

vi.mock("@/hooks/useXPRewards", () => ({
  useXPRewards: () => ({
    awardCustomXP: vi.fn(),
  }),
}));

vi.mock("@/hooks/useMentorPersonality", () => ({
  useMentorPersonality: () => null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn((payload: Record<string, unknown>) => ({
        eq: vi.fn(async () => {
          mocks.profileUpdatePayloads.push(payload);
          return { error: null };
        }),
      })),
    })),
  },
}));

const RouteProbe = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isIntroActive, completeIntro } = usePostOnboardingMentorGuidance();

  return (
    <div>
      <div data-testid="path">{location.pathname}</div>
      <div data-testid="intro-active">{String(isIntroActive)}</div>
      <button type="button" onClick={() => completeIntro()}>
        complete-intro
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        back
      </button>
    </div>
  );
};

describe("guided tutorial route restoration", () => {
  beforeEach(() => {
    mocks.guidedTutorial = createGuidedTutorial();
    mocks.profileUpdatePayloads = [];
    globalThis.localStorage?.removeItem?.("guided_tutorial_progress_user-1");
  });

  const renderWithProviders = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <PostOnboardingMentorGuidanceProvider>
            <Routes>
              <Route path="*" element={<RouteProbe />} />
            </Routes>
          </PostOnboardingMentorGuidanceProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("redirects to the active tutorial route using replace semantics", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/mentor");
    });

    fireEvent.click(screen.getByRole("button", { name: "back" }));

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/mentor");
    });
  });

  it("does not restore route while intro is active", async () => {
    mocks.guidedTutorial.introEnabled = true;
    mocks.guidedTutorial.introSeen = false;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId("intro-active")).toHaveTextContent("true");
      expect(screen.getByTestId("path")).toHaveTextContent("/journeys");
    });
  });

  it("restores route after intro is completed", async () => {
    mocks.guidedTutorial.introEnabled = true;
    mocks.guidedTutorial.introSeen = false;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId("intro-active")).toHaveTextContent("true");
      expect(screen.getByTestId("path")).toHaveTextContent("/journeys");
    });

    fireEvent.click(screen.getByRole("button", { name: "complete-intro" }));

    await waitFor(() => {
      expect(screen.getByTestId("intro-active")).toHaveTextContent("false");
      expect(screen.getByTestId("path")).toHaveTextContent("/mentor");
    });

    expect(
      mocks.profileUpdatePayloads.some((payload) =>
        JSON.stringify(payload).includes('"introSeen":true')
      )
    ).toBe(true);
  });
});
