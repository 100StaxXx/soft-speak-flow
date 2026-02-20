import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const createEvolveStepTutorial = () => ({
  version: 2,
  eligible: true,
  completed: false,
  completedSteps: ["create_quest", "meet_companion", "morning_checkin"] as const,
  xpAwardedSteps: [] as string[],
  milestonesCompleted: ["mentor_intro_hello"] as const,
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
      update: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    })),
  },
}));

const RouteProbe = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isIntroDialogueActive, dialogueActionLabel, onDialogueAction } =
    usePostOnboardingMentorGuidance();

  return (
    <div>
      <div data-testid="path">{location.pathname}</div>
      <div data-testid="intro-active">{String(isIntroDialogueActive)}</div>
      <div data-testid="intro-action">{dialogueActionLabel || ""}</div>
      <button type="button" onClick={() => onDialogueAction?.()}>
        intro-action
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        back
      </button>
      <button type="button" onClick={() => navigate("/journeys")}>
        go-journeys
      </button>
    </div>
  );
};

describe("guided tutorial route restoration", () => {
  beforeEach(() => {
    mocks.guidedTutorial = createGuidedTutorial();
    globalThis.localStorage?.removeItem?.("guided_tutorial_progress_user-1");
  });

  const renderWithProviders = (initialPath = "/journeys") => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
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

  it("keeps route restoration active while intro dialogue is pending", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/mentor");
      expect(screen.getByTestId("intro-active")).toHaveTextContent("true");
      expect(screen.getByTestId("intro-action")).toHaveTextContent("Start Tutorial");
    });
  });

  it("advances intro dialogue on route and then exits intro mode", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId("intro-action")).toHaveTextContent("Start Tutorial");
    });

    fireEvent.click(screen.getByRole("button", { name: "intro-action" }));

    await waitFor(() => {
      expect(screen.getByTestId("intro-active")).toHaveTextContent("false");
      expect(screen.getByTestId("intro-action")).toHaveTextContent("");
      expect(screen.getByTestId("path")).toHaveTextContent("/mentor");
    });
  });

  it("allows leaving during in-flight evolution, then returns to companion after completion", async () => {
    mocks.guidedTutorial = createEvolveStepTutorial();
    renderWithProviders("/companion");

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/companion");
      expect(screen.getByTestId("intro-active")).toHaveTextContent("false");
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("evolution-loading-start"));
    });

    fireEvent.click(screen.getByRole("button", { name: "go-journeys" }));

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/journeys");
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("companion-evolved"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/companion");
    });
  });
});
