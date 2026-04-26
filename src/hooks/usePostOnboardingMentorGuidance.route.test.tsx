import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PostOnboardingMentorGuidanceProvider,
  usePostOnboardingMentorGuidance,
} from "./usePostOnboardingMentorGuidance";

const createFreshTutorial = () => ({
  version: 2,
  flowVersion: 7,
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
    "answer_plan_day_ai",
    "save_plan_day_action",
    "open_new_goal_from_fab",
    "complete_campaign_creation",
  ],
});

const mocks = vi.hoisted(() => ({
  guidedTutorial: {
    version: 2,
    flowVersion: 7,
    eligible: true,
    dismissed: false,
    completed: false,
    completedSteps: [],
    xpAwardedSteps: [],
    milestonesCompleted: [],
  } as Record<string, unknown>,
}));

const createRect = ({
  top = 80,
  left = 24,
  width = 180,
  height = 48,
}: {
  top?: number;
  left?: number;
  width?: number;
  height?: number;
} = {}) =>
  ({
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

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
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
      const element = this as HTMLElement;
      return element.matches("[data-tour], [data-planner-tour]")
        ? createRect()
        : createRect({ width: 0, height: 0 });
    });
    document
      .querySelectorAll('[data-tour="companion-launcher-option-plan-day"], [data-tour="companion-plan-day-follow-up-option"], [data-tour="companion-plan-day-suggestion-save"], [data-tour="companion-plan-day-pending-confirm"], [data-tour="companion-plan-day-pending-confirm-all"], [data-tour="companion-launcher-option-goal"], [data-tour="pathfinder-campaign-builder"]')
      .forEach((element) => element.remove());
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("targets Plan My Day, opens New goal, waits for campaign creation, and reaches the final closeout", async () => {
    mocks.guidedTutorial = createPlanStepTutorial();
    const planTarget = document.createElement("button");
    planTarget.setAttribute("data-tour", "companion-launcher-option-plan-day");
    document.body.appendChild(planTarget);
    const answerTarget = document.createElement("button");
    answerTarget.setAttribute("data-tour", "companion-plan-day-follow-up-option");
    document.body.appendChild(answerTarget);
    const saveTarget = document.createElement("button");
    saveTarget.setAttribute("data-tour", "companion-plan-day-suggestion-save");
    document.body.appendChild(saveTarget);
    const goalTarget = document.createElement("button");
    goalTarget.setAttribute("data-tour", "companion-launcher-option-goal");
    document.body.appendChild(goalTarget);
    const pathfinderTarget = document.createElement("div");
    pathfinderTarget.setAttribute("data-tour", "pathfinder-campaign-builder");
    document.body.appendChild(pathfinderTarget);

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
      expect(screen.getByTestId("step")).toHaveTextContent("plan_my_day");
      expect(screen.getByTestId("path")).toHaveTextContent("/journeys");
      expect(screen.getByTestId("target")).toHaveTextContent(
        '[data-tour="companion-plan-day-follow-up-option"]',
      );
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("companion-plan-my-day-ai-answered"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("step")).toHaveTextContent("plan_my_day");
      expect(screen.getByTestId("path")).toHaveTextContent("/journeys");
      expect(screen.getByTestId("target")).toHaveTextContent(
        '[data-tour="companion-plan-day-suggestion-save"]',
      );
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("companion-plan-my-day-action-saved"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("step")).toHaveTextContent(
        "create_campaign",
      );
      expect(screen.getByTestId("path")).toHaveTextContent("/journeys");
      expect(screen.getByTestId("target")).toHaveTextContent(
        '[data-tour="companion-launcher-option-goal"]',
      );
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("companion-new-goal-started"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("step")).toHaveTextContent(
        "create_campaign",
      );
      expect(screen.getByTestId("path")).toHaveTextContent("/journeys");
      expect(screen.getByTestId("target")).toHaveTextContent(
        '[data-tour="pathfinder-campaign-builder"]',
      );
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("campaign-created"));
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
