import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PostOnboardingMentorGuidanceProvider,
  usePostOnboardingMentorGuidance,
} from "./usePostOnboardingMentorGuidance";
import { CAMPAIGN_CREATED_ANIMATION_COMPLETE_EVENT } from "@/utils/tutorialEvents";

const createFreshTutorial = () => ({
  version: 2,
  flowVersion: 10,
  eligible: true,
  dismissed: false,
  completed: false,
  completedSteps: [] as string[],
  xpAwardedSteps: [] as string[],
  milestonesCompleted: [] as string[],
});

const createLegacyPlanStepTutorial = () => ({
  ...createFreshTutorial(),
  flowVersion: 9,
  completedSteps: ["new_goal"],
  xpAwardedSteps: ["new_goal"],
  milestonesCompleted: ["mentor_intro_hello", "start_new_goal", "complete_pathfinder_campaign"],
});

const createCompletedTutorial = () => ({
  ...createFreshTutorial(),
  completed: true,
  completedSteps: ["new_goal", "hatch_companion", "mentor_closeout"],
  xpAwardedSteps: ["new_goal"],
  milestonesCompleted: [
    "mentor_intro_hello",
    "start_new_goal",
    "complete_pathfinder_campaign",
    "campaign_calendar_handoff",
    "tap_hatch_companion",
    "complete_companion_hatch",
    "mentor_closeout_message",
  ],
});

const mocks = vi.hoisted(() => ({
  guidedTutorial: {
    version: 2,
    flowVersion: 9,
    eligible: true,
    dismissed: false,
    completed: false,
    completedSteps: [],
    xpAwardedSteps: [],
    milestonesCompleted: [],
  } as Record<string, unknown>,
  fetchCompanion: vi.fn().mockResolvedValue({ current_stage: 0 }),
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
    awardCustomXP: vi.fn().mockResolvedValue({ xpAwarded: 5 }),
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  fetchCompanion: mocks.fetchCompanion,
  getCompanionQueryKey: (userId: string | undefined) => ["companion", userId] as const,
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
    isActive,
    isIntroDialogueActive,
    dialogueActionLabel,
    onDialogueAction,
    currentStep,
    secondaryActionLabel,
    onSecondaryAction,
    activeTargetSelector,
    dialogueText,
  } = usePostOnboardingMentorGuidance();

  return (
    <div>
      <div data-testid="path">{location.pathname}</div>
      <div data-testid="active">{String(isActive)}</div>
      <div data-testid="step">{currentStep ?? ""}</div>
      <div data-testid="intro-active">{String(isIntroDialogueActive)}</div>
      <div data-testid="dialogue">{dialogueText}</div>
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
      <button type="button" onClick={() => navigate("/campaigns")}>
        go-campaigns
      </button>
    </div>
  );
};

describe("guided tutorial route restoration", () => {
  beforeEach(() => {
    mocks.guidedTutorial = createFreshTutorial();
    mocks.fetchCompanion.mockResolvedValue({ current_stage: 0 });
    globalThis.localStorage?.removeItem?.("guided_tutorial_progress_user-1");
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
      const element = this as HTMLElement;
      return element.matches("[data-tour], [data-planner-tour]")
        ? createRect()
        : createRect({ width: 0, height: 0 });
    });
    document
      .querySelectorAll('[data-tour="campaign-builder-launcher"], [data-tour="companion-launcher-option-plan-day"], [data-tour="companion-plan-day-follow-up-option"], [data-tour="companion-plan-day-suggestion-save"], [data-tour="companion-plan-day-pending-confirm"], [data-tour="companion-plan-day-pending-confirm-all"], [data-tour="companion-launcher-option-goal"], [data-tour="pathfinder-primary-action"], [data-tour="evolve-companion-button"], [data-tour="pathfinder-campaign-builder"]')
      .forEach((element) => element.remove());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderWithProviders = (initialPath = "/campaigns") => {
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

  it("restores a fresh tutorial to the campaigns route", async () => {
    renderWithProviders("/companion");

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/campaigns");
      expect(screen.getByTestId("step")).toHaveTextContent("new_goal");
      expect(screen.getByTestId("intro-action")).toHaveTextContent(
        "Start Tutorial",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "back" }));

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/campaigns");
    });
  });

  it("steps aside in Pathfinder, waits for the animation, then routes from ritual handoff to companion hatch", async () => {
    const campaignTarget = document.createElement("button");
    campaignTarget.setAttribute("data-tour", "campaign-builder-launcher");
    document.body.appendChild(campaignTarget);
    const hatchTarget = document.createElement("button");
    hatchTarget.setAttribute("data-tour", "evolve-companion-button");
    document.body.appendChild(hatchTarget);

    renderWithProviders("/campaigns");

    await waitFor(() => {
      expect(screen.getByTestId("intro-action")).toHaveTextContent(
        "Start Tutorial",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "intro-action" }));

    await waitFor(() => {
      expect(screen.getByTestId("step")).toHaveTextContent("new_goal");
      expect(screen.getByTestId("intro-action")).toHaveTextContent("");
      expect(screen.getByTestId("target")).toHaveTextContent(
        '[data-tour="campaign-builder-launcher"]',
      );
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("campaign-builder-opened"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("active")).toHaveTextContent("false");
      expect(screen.getByTestId("step")).toHaveTextContent("");
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("pathfinder-campaign-created"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/campaigns");
      expect(screen.getByTestId("active")).toHaveTextContent("false");
      expect(screen.getByTestId("step")).toHaveTextContent("");
      expect(screen.getByTestId("dialogue")).toHaveTextContent("");
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent(CAMPAIGN_CREATED_ANIMATION_COMPLETE_EVENT));
    });

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/campaigns");
      expect(screen.getByTestId("step")).toHaveTextContent("new_goal");
      expect(screen.getByTestId("dialogue")).toHaveTextContent(
        "Your rituals are on the calendar now.",
      );
      expect(screen.getByTestId("intro-action")).toHaveTextContent("Meet companion");
      expect(screen.getByTestId("secondary-action")).toHaveTextContent("");
    });

    fireEvent.click(screen.getByRole("button", { name: "intro-action" }));

    await waitFor(() => {
      expect(screen.getByTestId("step")).toHaveTextContent(
        "hatch_companion",
      );
      expect(screen.getByTestId("path")).toHaveTextContent("/companion");
      expect(screen.getByTestId("target")).toHaveTextContent("");
    });
  });

  it("waits on the journeys page until the campaign animation completes before restoring campaigns", async () => {
    const campaignTarget = document.createElement("button");
    campaignTarget.setAttribute("data-tour", "campaign-builder-launcher");
    document.body.appendChild(campaignTarget);

    renderWithProviders("/campaigns");

    await waitFor(() => {
      expect(screen.getByTestId("intro-action")).toHaveTextContent(
        "Start Tutorial",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "intro-action" }));

    await act(async () => {
      window.dispatchEvent(new CustomEvent("campaign-builder-opened"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("active")).toHaveTextContent("false");
      expect(screen.getByTestId("step")).toHaveTextContent("");
    });

    fireEvent.click(screen.getByRole("button", { name: "go-journeys" }));

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/journeys");
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("pathfinder-campaign-created"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/journeys");
      expect(screen.getByTestId("active")).toHaveTextContent("false");
      expect(screen.getByTestId("step")).toHaveTextContent("");
      expect(screen.getByTestId("dialogue")).toHaveTextContent("");
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent(CAMPAIGN_CREATED_ANIMATION_COMPLETE_EVENT));
    });

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/campaigns");
      expect(screen.getByTestId("step")).toHaveTextContent("new_goal");
      expect(screen.getByTestId("dialogue")).toHaveTextContent(
        "Your rituals are on the calendar now.",
      );
      expect(screen.getByTestId("intro-action")).toHaveTextContent("Meet companion");
    });
  });

  it("moves legacy Plan My Day users directly to companion hatch", async () => {
    mocks.guidedTutorial = createLegacyPlanStepTutorial();
    const hatchTarget = document.createElement("button");
    hatchTarget.setAttribute("data-tour", "evolve-companion-button");
    document.body.appendChild(hatchTarget);

    renderWithProviders("/campaigns");

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/companion");
      expect(screen.getByTestId("step")).toHaveTextContent("hatch_companion");
      expect(screen.getByTestId("target")).toHaveTextContent("");
    });
  });

  it("shows the hatch waiting notice on Companion without restoring routes while hatch is pending", async () => {
    mocks.guidedTutorial = {
      ...createFreshTutorial(),
      completedSteps: ["new_goal"],
      xpAwardedSteps: ["new_goal"],
      milestonesCompleted: [
        "mentor_intro_hello",
        "start_new_goal",
        "complete_pathfinder_campaign",
        "campaign_calendar_handoff",
        "tap_hatch_companion",
      ],
      evolutionInFlight: true,
      evolutionStartedAt: "2026-05-01T12:00:00.000Z",
    };

    renderWithProviders("/companion");

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/companion");
      expect(screen.getByTestId("active")).toHaveTextContent("true");
      expect(screen.getByTestId("step")).toHaveTextContent("hatch_companion");
      expect(screen.getByTestId("dialogue")).toHaveTextContent("Your Companion is hatching.");
      expect(screen.getByTestId("intro-action")).toHaveTextContent("Dismiss");
    });

    fireEvent.click(screen.getByRole("button", { name: "go-journeys" }));

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/journeys");
      expect(screen.getByTestId("active")).toHaveTextContent("false");
      expect(screen.getByTestId("step")).toHaveTextContent("");
      expect(screen.getByTestId("dialogue")).toHaveTextContent("");
    });
  });

  it("stops restoring tutorial routes after the tutorial was previously dismissed", async () => {
    mocks.guidedTutorial = {
      ...createFreshTutorial(),
      dismissed: true,
      milestonesCompleted: ["mentor_intro_hello"],
    };
    renderWithProviders("/journeys");

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/journeys");
      expect(screen.getByTestId("step")).toHaveTextContent("");
      expect(screen.getByTestId("secondary-action")).toHaveTextContent("");
    });

    fireEvent.click(screen.getByRole("button", { name: "go-campaigns" }));

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/campaigns");
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent(CAMPAIGN_CREATED_ANIMATION_COMPLETE_EVENT));
    });

    fireEvent.click(screen.getByRole("button", { name: "go-journeys" }));

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/journeys");
      expect(screen.getByTestId("step")).toHaveTextContent("");
    });
  });

  it("does not restore routes after the tutorial is already complete", async () => {
    mocks.guidedTutorial = createCompletedTutorial();
    renderWithProviders("/companion");

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/companion");
      expect(screen.getByTestId("step")).toHaveTextContent("");
      expect(screen.getByTestId("secondary-action")).toHaveTextContent("");
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent(CAMPAIGN_CREATED_ANIMATION_COMPLETE_EVENT));
    });

    fireEvent.click(screen.getByRole("button", { name: "go-journeys" }));

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/journeys");
      expect(screen.getByTestId("step")).toHaveTextContent("");
    });
  });
});
