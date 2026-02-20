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
  completedSteps: ["create_quest", "meet_companion", "morning_checkin"] as const,
  xpAwardedSteps: [] as string[],
  milestonesCompleted: ["mentor_intro_hello"] as const,
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
  const { isIntroDialogueActive, dialogueActionLabel, onDialogueAction, currentStep } =
    usePostOnboardingMentorGuidance();

  return (
    <div>
      <div data-testid="path">{location.pathname}</div>
      <div data-testid="step">{currentStep ?? ""}</div>
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
    vi.restoreAllMocks();
    window.matchMedia = originalMatchMedia;
    document
      .querySelectorAll('[data-tour="evolve-companion-button"]')
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
      expect(screen.getByTestId("step")).toHaveTextContent("morning_checkin");
    });
  });

  it("routes from morning check-in to companion evolve, then shows post-evolution companion explainer", async () => {
    renderWithProviders("/mentor");

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/mentor");
      expect(screen.getByTestId("intro-action")).toHaveTextContent("Start Tutorial");
    });

    fireEvent.click(screen.getByRole("button", { name: "intro-action" }));

    await act(async () => {
      window.dispatchEvent(new CustomEvent("morning-checkin-completed"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/companion");
      expect(screen.getByTestId("step")).toHaveTextContent("evolve_companion");
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("evolution-loading-start"));
      window.dispatchEvent(new CustomEvent("companion-evolved"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/companion");
      expect(screen.getByTestId("step")).toHaveTextContent("post_evolution_companion_intro");
      expect(screen.getByTestId("intro-action")).toHaveTextContent("Continue");
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
});
