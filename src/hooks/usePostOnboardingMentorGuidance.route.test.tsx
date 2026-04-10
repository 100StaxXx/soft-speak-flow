import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  completedSteps: ["create_quest", "meet_companion", "morning_checkin", "companion_tab_intro"] as const,
  xpAwardedSteps: [] as string[],
  milestonesCompleted: ["mentor_intro_hello", "companion_tab_intro"] as const,
});

const createCloseoutTutorial = () => ({
  version: 2,
  eligible: true,
  completed: false,
  completedSteps: [
    "quests_campaigns_intro",
    "create_quest",
    "morning_checkin",
    "companion_tab_intro",
    "evolve_companion",
    "post_evolution_companion_intro",
  ] as const,
  xpAwardedSteps: ["create_quest", "morning_checkin"] as const,
  milestonesCompleted: ["mentor_intro_hello", "post_evolution_companion_intro"] as const,
});

const mocks = vi.hoisted(() => ({
  guidedTutorial: {
    version: 2,
    eligible: true,
    completed: false,
    completedSteps: ["create_quest", "meet_companion"],
    xpAwardedSteps: [] as string[],
    milestonesCompleted: ["open_mentor_tab"],
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
    resumeActionLabel,
    onResumeAction,
  } = usePostOnboardingMentorGuidance();

  return (
    <div>
      <div data-testid="path">{location.pathname}</div>
      <div data-testid="step">{currentStep ?? ""}</div>
      <div data-testid="intro-active">{String(isIntroDialogueActive)}</div>
      <div data-testid="intro-action">{dialogueActionLabel || ""}</div>
      <div data-testid="secondary-action">{secondaryActionLabel || ""}</div>
      <div data-testid="resume-action">{resumeActionLabel || ""}</div>
      <button type="button" onClick={() => onDialogueAction?.()}>
        intro-action
      </button>
      <button type="button" onClick={() => onSecondaryAction?.()}>
        secondary
      </button>
      <button type="button" onClick={() => onResumeAction?.()}>
        resume
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
  const originalMatchMedia = window.matchMedia;
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;

  const createTargetRect = ({
    top,
    bottom,
    left = 0,
    right = 320,
  }: {
    top: number;
    bottom: number;
    left?: number;
    right?: number;
  }) => ({
    top,
    bottom,
    left,
    right,
    width: right - left,
    height: bottom - top,
    x: left,
    y: top,
    toJSON: () => ({}),
  });

  const mountEvolveTarget = (rect: ReturnType<typeof createTargetRect>) => {
    const target = document.createElement("button");
    target.setAttribute("data-tour", "evolve-companion-button");
    document.body.appendChild(target);
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue(
      rect as unknown as DOMRect
    );
    return target;
  };

  beforeEach(() => {
    mocks.guidedTutorial = createGuidedTutorial();
    globalThis.localStorage?.removeItem?.("guided_tutorial_progress_user-1");
    scrollIntoViewMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: scrollIntoViewMock,
    });
    window.matchMedia = originalMatchMedia;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.matchMedia = originalMatchMedia;
    document
      .querySelectorAll('[data-tour="evolve-companion-button"]')
      .forEach((element) => element.remove());
  });

  const renderWithProviders = (
    initialPath = "/journeys",
    options?: {
      seedCompanion?: {
        id: string;
        current_stage: number;
      } | null;
    },
  ) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    if (options?.seedCompanion) {
      queryClient.setQueryData(["companion", "user-1"], options.seedCompanion);
    }

    return {
      queryClient,
      ...render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[initialPath]}>
            <PostOnboardingMentorGuidanceProvider>
              <Routes>
                <Route path="*" element={<RouteProbe />} />
              </Routes>
            </PostOnboardingMentorGuidanceProvider>
          </MemoryRouter>
        </QueryClientProvider>
      ),
    };
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
      expect(screen.getByTestId("secondary-action")).toHaveTextContent("");
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
      expect(screen.getByTestId("step")).toHaveTextContent("morning_checkin");
    });
  });

  it("routes from morning check-in to companion intro, then evolve, then post-evolution explainer", async () => {
    renderWithProviders("/mentor");

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/mentor");
      expect(screen.getByTestId("intro-action")).toHaveTextContent("Start Tutorial");
    });

    fireEvent.click(screen.getByRole("button", { name: "intro-action" }));

    vi.useFakeTimers();
    try {
      await act(async () => {
        window.dispatchEvent(new CustomEvent("morning-checkin-completed"));
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByTestId("path")).toHaveTextContent("/companion");
      expect(screen.getByTestId("step")).toHaveTextContent("companion_tab_intro");
      expect(screen.getByTestId("intro-action")).toHaveTextContent("");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1300);
      });

      expect(screen.getByTestId("step")).toHaveTextContent("evolve_companion");
    } finally {
      vi.useRealTimers();
    }

    await act(async () => {
      window.dispatchEvent(new CustomEvent("evolution-loading-start"));
      window.dispatchEvent(new CustomEvent("companion-evolved"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/companion");
      expect(screen.getByTestId("step")).toHaveTextContent("post_evolution_companion_intro");
      expect(screen.getByTestId("intro-action")).toHaveTextContent("");
    });
  });

  it("allows leaving during in-flight evolution, then returns to companion after completion", async () => {
    mocks.guidedTutorial = createEvolveStepTutorial();
    renderWithProviders("/companion");

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/companion");
      expect(screen.getByTestId("intro-active")).toHaveTextContent("false");
      expect(screen.getByTestId("step")).toHaveTextContent("evolve_companion");
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

  it("stops restoring tutorial routes after setup is deferred and can resume later", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/mentor");
      expect(screen.getByTestId("step")).toHaveTextContent("morning_checkin");
      expect(screen.getByTestId("intro-action")).toHaveTextContent("Start Tutorial");
    });

    fireEvent.click(screen.getByRole("button", { name: "intro-action" }));

    await waitFor(() => {
      expect(screen.getByTestId("intro-action")).toHaveTextContent("");
      expect(screen.getByTestId("secondary-action")).toHaveTextContent("Continue later");
    });

    fireEvent.click(screen.getByRole("button", { name: "secondary" }));

    await waitFor(() => {
      expect(screen.getByTestId("step")).toHaveTextContent("");
      expect(screen.getByTestId("secondary-action")).toHaveTextContent("");
      expect(screen.getByTestId("resume-action")).toHaveTextContent("Continue setup");
    });

    fireEvent.click(screen.getByRole("button", { name: "go-journeys" }));

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/journeys");
    });

    fireEvent.click(screen.getByRole("button", { name: "resume" }));

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/mentor");
      expect(screen.getByTestId("resume-action")).toHaveTextContent("");
    });
  });

  it("shows a complete tutorial action on the final closeout step", async () => {
    mocks.guidedTutorial = createCloseoutTutorial();
    renderWithProviders("/companion");

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/companion");
      expect(screen.getByTestId("step")).toHaveTextContent("mentor_closeout");
      expect(screen.getByTestId("secondary-action")).toHaveTextContent("Complete tutorial");
    });

    fireEvent.click(screen.getByRole("button", { name: "secondary" }));

    await waitFor(() => {
      expect(screen.getByTestId("step")).toHaveTextContent("");
      expect(screen.getByTestId("secondary-action")).toHaveTextContent("");
    });
  });

  it("auto-scrolls to evolve button on evolve tutorial milestone", async () => {
    mocks.guidedTutorial = createEvolveStepTutorial();
    mountEvolveTarget(createTargetRect({ top: 1200, bottom: 1260 }));
    renderWithProviders("/companion");

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/companion");
      expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    });

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      block: "center",
      inline: "nearest",
      behavior: "smooth",
    });
  });

  it("does not auto-scroll when tutorial is not on evolve milestone", async () => {
    renderWithProviders("/journeys");

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/mentor");
    });

    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it("dedupes evolve auto-scroll while staying in the same milestone entry", async () => {
    mocks.guidedTutorial = createEvolveStepTutorial();
    mountEvolveTarget(createTargetRect({ top: 1200, bottom: 1260 }));
    renderWithProviders("/companion");

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      window.dispatchEvent(new Event("resize"));
      window.dispatchEvent(new Event("orientationchange"));
      window.dispatchEvent(new Event("scroll"));
    });

    await new Promise((resolve) => window.setTimeout(resolve, 300));
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
  });

  it("uses non-animated auto-scroll when reduced motion is enabled", async () => {
    mocks.guidedTutorial = createEvolveStepTutorial();
    mountEvolveTarget(createTargetRect({ top: 1200, bottom: 1260 }));
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    renderWithProviders("/companion");

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    });

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      block: "center",
      inline: "nearest",
      behavior: "auto",
    });
  });

  it("does not skip evolve step from companion cache alone before the hatch starts", async () => {
    mocks.guidedTutorial = createEvolveStepTutorial();
    renderWithProviders("/companion", {
      seedCompanion: {
        id: "companion-1",
        current_stage: 1,
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/companion");
      expect(screen.getByTestId("step")).toHaveTextContent("evolve_companion");
    });
  });

  it("requires an explicit evolution start before the completion event advances the step", async () => {
    mocks.guidedTutorial = createEvolveStepTutorial();
    renderWithProviders("/companion");

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/companion");
      expect(screen.getByTestId("step")).toHaveTextContent("evolve_companion");
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("companion-evolved"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("step")).toHaveTextContent("evolve_companion");
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("evolution-loading-start"));
      window.dispatchEvent(new CustomEvent("companion-evolved"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("step")).toHaveTextContent("post_evolution_companion_intro");
    });
  });

  it("recovers to the post-evolution step when hatch had already started and companion state updates after mount", async () => {
    mocks.guidedTutorial = {
      ...createEvolveStepTutorial(),
      milestonesCompleted: [
        "mentor_intro_hello",
        "companion_tab_intro",
        "tap_evolve_companion",
      ],
      evolutionInFlight: true,
    };

    const { queryClient } = renderWithProviders("/companion");

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/companion");
      expect(screen.getByTestId("step")).toHaveTextContent("evolve_companion");
    });

    await act(async () => {
      queryClient.setQueryData(["companion", "user-1"], {
        id: "companion-1",
        current_stage: 1,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("step")).toHaveTextContent("post_evolution_companion_intro");
    });
  });
});
