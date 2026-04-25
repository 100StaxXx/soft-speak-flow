import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PostOnboardingMentorGuidanceProvider,
  usePostOnboardingMentorGuidance,
} from "./usePostOnboardingMentorGuidance";

const createFreshTutorial = () => ({
  version: 2,
  flowVersion: 5,
  eligible: true,
  dismissed: false,
  completed: false,
  completedSteps: [] as string[],
  xpAwardedSteps: [] as string[],
  milestonesCompleted: [] as string[],
});

const createPlanStepTutorial = () => ({
  ...createFreshTutorial(),
  completedSteps: ["meet_companion"],
  milestonesCompleted: ["mentor_intro_hello", "meet_companion_intro"],
});

const createCloseoutTutorial = () => ({
  ...createFreshTutorial(),
  completedSteps: ["meet_companion", "plan_my_day", "create_campaign"],
  xpAwardedSteps: ["plan_my_day"],
  milestonesCompleted: [
    "mentor_intro_hello",
    "meet_companion_intro",
    "start_plan_my_day",
    "open_campaign_builder",
  ],
});

const mocks = vi.hoisted(() => ({
  guidedTutorial: {
    version: 2,
    flowVersion: 5,
    eligible: true,
    dismissed: false,
    completed: false,
    completedSteps: [],
    xpAwardedSteps: [],
    milestonesCompleted: [],
  } as Record<string, unknown>,
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
  const {
    isIntroDialogueActive,
    dialogueActionLabel,
    onDialogueAction,
    currentStep,
    secondaryActionLabel,
    onSecondaryAction,
    activeTargetSelector,
  } = usePostOnboardingMentorGuidance();

  return (
    <div>
      <div data-testid="path">{location.pathname}</div>
      <div data-testid="step">{currentStep ?? ""}</div>
      <div data-testid="intro-active">{String(isIntroDialogueActive)}</div>
      <div data-testid="intro-action">{dialogueActionLabel || ""}</div>
      <div data-testid="secondary-action">{secondaryActionLabel || ""}</div>
      <div data-testid="target">{activeTargetSelector || ""}</div>
      <button type="button" onClick={() => onDialogueAction?.()}>
        intro-action
      </button>
      <button type="button" onClick={() => onSecondaryAction?.()}>
        secondary
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
    mocks.guidedTutorial = createFreshTutorial();
    globalThis.localStorage?.removeItem?.("guided_tutorial_progress_user-1");
    document
      .querySelectorAll('[data-tour="companion-launcher-option-plan-day"], [data-tour="campaign-builder-launcher"]')
      .forEach((element) => element.remove());
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
      </QueryClientProvider>,
    );
  };

  it("restores a fresh tutorial to the companion route", async () => {
    renderWithProviders("/journeys");

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/companion");
      expect(screen.getByTestId("step")).toHaveTextContent("meet_companion");
      expect(screen.getByTestId("intro-action")).toHaveTextContent(
        "Start Tutorial",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "back" }));

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/companion");
    });
  });

  it("advances from intro to Plan My Day on the companion route", async () => {
    const target = document.createElement("button");
    target.setAttribute("data-tour", "companion-launcher-option-plan-day");
    document.body.appendChild(target);

    renderWithProviders("/companion");

    await waitFor(() => {
      expect(screen.getByTestId("intro-action")).toHaveTextContent(
        "Start Tutorial",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "intro-action" }));

    await waitFor(() => {
      expect(screen.getByTestId("step")).toHaveTextContent("meet_companion");
      expect(screen.getByTestId("intro-action")).toHaveTextContent("Continue");
    });

    fireEvent.click(screen.getByRole("button", { name: "intro-action" }));

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/journeys");
      expect(screen.getByTestId("step")).toHaveTextContent("plan_my_day");
      expect(screen.getByTestId("intro-action")).toHaveTextContent("");
      expect(screen.getByTestId("secondary-action")).toHaveTextContent(
        "Skip tutorial",
      );
    });
  });

  it("targets Plan My Day, opens campaign builder, and reaches the final closeout", async () => {
    mocks.guidedTutorial = createPlanStepTutorial();
    const planTarget = document.createElement("button");
    planTarget.setAttribute("data-tour", "companion-launcher-option-plan-day");
    document.body.appendChild(planTarget);
    const campaignTarget = document.createElement("button");
    campaignTarget.setAttribute("data-tour", "campaign-builder-launcher");
    document.body.appendChild(campaignTarget);

    renderWithProviders("/companion");

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/journeys");
      expect(screen.getByTestId("step")).toHaveTextContent("plan_my_day");
      expect(screen.getByTestId("target")).toHaveTextContent(
        '[data-tour="companion-launcher-option-plan-day"]',
      );
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("companion-plan-my-day-started"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("step")).toHaveTextContent(
        "create_campaign",
      );
      expect(screen.getByTestId("path")).toHaveTextContent("/campaigns");
      expect(screen.getByTestId("target")).toHaveTextContent(
        '[data-tour="campaign-builder-launcher"]',
      );
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("campaign-builder-opened"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("step")).toHaveTextContent(
        "first_plan_closeout",
      );
      expect(screen.getByTestId("intro-action")).toHaveTextContent("Finish");
    });
  });

  it("stops restoring tutorial routes after the tutorial is skipped", async () => {
    mocks.guidedTutorial = {
      ...createFreshTutorial(),
      milestonesCompleted: ["mentor_intro_hello"],
    };
    renderWithProviders("/journeys");

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/companion");
      expect(screen.getByTestId("secondary-action")).toHaveTextContent(
        "Skip tutorial",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "secondary" }));

    await waitFor(() => {
      expect(screen.getByTestId("step")).toHaveTextContent("");
      expect(screen.getByTestId("secondary-action")).toHaveTextContent("");
    });

    fireEvent.click(screen.getByRole("button", { name: "go-journeys" }));

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/journeys");
    });
  });

  it("completes the tutorial from the final closeout action", async () => {
    mocks.guidedTutorial = createCloseoutTutorial();
    renderWithProviders("/companion");

    await waitFor(() => {
      expect(screen.getByTestId("step")).toHaveTextContent(
        "first_plan_closeout",
      );
      expect(screen.getByTestId("intro-action")).toHaveTextContent("Finish");
      expect(screen.getByTestId("secondary-action")).toHaveTextContent(
        "Complete tutorial",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "intro-action" }));

    await waitFor(() => {
      expect(screen.getByTestId("step")).toHaveTextContent("");
      expect(screen.getByTestId("secondary-action")).toHaveTextContent("");
    });
  });
});
