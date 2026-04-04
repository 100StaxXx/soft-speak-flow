import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CALCULATING_STAGE_DURATION_MS,
  QUESTIONNAIRE_PIPELINE_TIMEOUT_MS,
  StoryOnboarding,
} from "./StoryOnboarding";

const QUESTIONNAIRE_ANSWERS = [
  {
    questionId: "mentor_energy",
    optionId: "either_works",
    answer: "Either works for me",
    tags: [],
  },
  {
    questionId: "focus_area",
    optionId: "clarity_mindset",
    answer: "Clarity & mindset",
    tags: ["calm"],
  },
  {
    questionId: "guidance_tone",
    optionId: "encouraging_supportive",
    answer: "Encouraging & supportive",
    tags: ["supportive"],
  },
  {
    questionId: "progress_style",
    optionId: "principles_logic",
    answer: "Clear principles and logic",
    tags: ["discipline"],
  },
];

const ACTIVE_MENTOR = {
  id: "mentor-1",
  name: "Atlas",
  description: "Disciplined guide",
  tone_description: "Direct and clear",
  avatar_url: "",
  tags: ["discipline"],
  mentor_type: "coach",
  target_user_type: "builders",
  slug: "atlas",
  short_title: "The Strategist",
  primary_color: "#7B68EE",
  target_user: "focused achievers",
  themes: ["clarity"],
  intensity_level: "high",
  gender_energy: "masculine",
};

const mocks = vi.hoisted(() => ({
  mentorsEq: vi.fn(),
  profilesUpdateEq: vi.fn(),
  profilesMaybeSingle: vi.fn(),
  questionnaireUpsert: vi.fn(),
  createCompanionMutateAsync: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  loggerInfo: vi.fn(),
}));

const storageMocks = vi.hoisted(() => {
  const store = new Map<string, string>();

  return {
    safeLocalStorage: {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
        return true;
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key);
        return true;
      }),
      clear: vi.fn(() => {
        store.clear();
        return true;
      }),
    },
    reset: () => {
      store.clear();
    },
  };
});

vi.mock("framer-motion", async () => {
  const React = await import("react");

  const motion = new Proxy(
    {},
    {
      get: (_target, key) => {
        const tag = typeof key === "string" ? key : "div";
        return ({ children, ...props }: any) => React.createElement(tag, props, children);
      },
    },
  );

  return {
    motion,
    AnimatePresence: ({ children }: { children: unknown }) => <>{children}</>,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    createCompanion: {
      mutateAsync: mocks.createCompanionMutateAsync,
    },
  }),
}));

vi.mock("@/utils/mentorExplanation", () => ({
  generateMentorExplanation: () => ({
    title: "Your Guide is: Atlas",
    subtitle: "The Strategist",
    paragraph: "A fit for focused builders.",
    bullets: ["Clear guidance"],
  }),
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    scope: () => ({
      error: mocks.loggerError,
      warn: mocks.loggerWarn,
      info: mocks.loggerInfo,
    }),
    warn: mocks.loggerWarn,
    info: mocks.loggerInfo,
    error: mocks.loggerError,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "mentors") {
        return {
          select: () => ({
            eq: mocks.mentorsEq,
          }),
        };
      }

      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: mocks.profilesMaybeSingle,
            }),
          }),
          update: () => ({
            eq: mocks.profilesUpdateEq,
          }),
        };
      }

      if (table === "questionnaire_responses") {
        return {
          upsert: mocks.questionnaireUpsert,
        };
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          }),
        }),
        update: () => ({
          eq: vi.fn(async () => ({ error: null })),
        }),
        upsert: vi.fn(async () => ({ error: null })),
        insert: vi.fn(async () => ({ error: null })),
      };
    },
  },
}));

vi.mock("@/utils/storage", () => ({
  safeLocalStorage: storageMocks.safeLocalStorage,
}));

vi.mock("@/components/StarfieldBackground", () => ({
  StarfieldBackground: () => <div data-testid="starfield-bg" />,
}));

vi.mock("./OnboardingCosmicBackdrop", () => ({
  OnboardingCosmicBackdrop: () => <div data-testid="cosmic-bg" />,
}));

vi.mock("./StoryPrologue", () => ({
  StoryPrologue: ({ onComplete }: { onComplete: (name: string) => void }) => (
    <button type="button" onClick={() => onComplete("Nova")}>
      prologue-next
    </button>
  ),
}));

vi.mock("./DestinyReveal", () => ({
  DestinyReveal: ({ onComplete }: { onComplete: () => void }) => (
    <button type="button" onClick={onComplete}>
      destiny-next
    </button>
  ),
}));

vi.mock("./FactionSelector", () => ({
  FactionSelector: ({ onComplete }: { onComplete: (faction: "starfall") => void }) => (
    <button type="button" onClick={() => onComplete("starfall")}>
      faction-next
    </button>
  ),
}));

vi.mock("./StoryQuestionnaire", () => ({
  StoryQuestionnaire: ({
    onComplete,
    isSubmitting,
  }: {
    onComplete: (answers: typeof QUESTIONNAIRE_ANSWERS) => void;
    isSubmitting?: boolean;
  }) => (
    <div>
      <div data-testid="questionnaire-stage">{isSubmitting ? "submitting" : "idle"}</div>
      <button type="button" onClick={() => onComplete(QUESTIONNAIRE_ANSWERS)} disabled={isSubmitting}>
        questionnaire-submit
      </button>
    </div>
  ),
}));

vi.mock("./MentorCalculating", () => ({
  MentorCalculating: () => <div data-testid="calculating-stage">Calculating</div>,
}));

vi.mock("@/components/MentorResult", () => ({
  MentorResult: ({ onConfirm, onSeeAll }: { onConfirm: () => void; onSeeAll: () => void }) => (
    <div data-testid="mentor-result-stage">
      <button type="button" onClick={onConfirm}>
        mentor-confirm
      </button>
      <button type="button" onClick={onSeeAll}>
        mentor-see-all
      </button>
    </div>
  ),
}));

vi.mock("@/components/MentorGrid", () => ({
  MentorGrid: () => <div data-testid="mentor-grid-stage">Mentor Grid</div>,
}));

vi.mock("./OnboardingStoryToneSelection", () => ({
  OnboardingStoryToneSelection: ({
    initialTone,
    initialPresetId,
    onComplete,
    onBack,
  }: {
    initialTone: string;
    initialPresetId?: string | null;
    onComplete: (selection: { storyTone: string; presetId: string }) => void;
    onBack?: () => void;
  }) => (
    <div data-testid="story-tone-stage">
      <div data-testid="story-tone-initial">{initialTone}</div>
      <div data-testid="story-tone-initial-preset">{initialPresetId ?? ""}</div>
      {onBack ? (
        <button type="button" onClick={onBack}>
          story-tone-back
        </button>
      ) : null}
      <button type="button" onClick={() => onComplete({ storyTone: "dark_intense", presetId: "dragon" })}>
        story-tone-next
      </button>
    </div>
  ),
}));

vi.mock("./EggSelectionPrelude", () => ({
  EggSelectionPrelude: ({
    storyTone,
    speciesName,
    onComplete,
    onBack,
  }: {
    storyTone: string;
    speciesName: string;
    onComplete: () => void;
    onBack?: () => void;
  }) => (
    <div data-testid="egg-prelude-stage">
      <div data-testid="egg-prelude-tone">{storyTone}</div>
      <div data-testid="egg-prelude-species">{speciesName}</div>
      {onBack ? (
        <button type="button" onClick={onBack}>
          egg-prelude-back
        </button>
      ) : null}
      <button type="button" onClick={onComplete}>
        egg-prelude-next
      </button>
    </div>
  ),
}));

vi.mock("./OnboardingEggSelection", () => ({
  OnboardingEggSelection: ({
    onComplete,
    storyTone,
    presetId,
    spiritAnimal,
  }: {
    onComplete: (payload: {
      presetId: string;
      favoriteColor: string;
      spiritAnimal: string;
      coreElement: string;
      storyTone: string;
    }) => void;
    storyTone: string;
    presetId: string;
    spiritAnimal: string;
  }) => (
    <div data-testid="companion-stage">
      <div data-testid="egg-stage-tone">{storyTone}</div>
      <div data-testid="egg-stage-preset">{presetId}</div>
      <div data-testid="egg-stage-species">{spiritAnimal}</div>
      <button
        type="button"
        onClick={() =>
          onComplete({
            presetId,
            favoriteColor: "#60A5FA",
            spiritAnimal,
            coreElement: "ice",
            storyTone,
          })
        }
      >
        complete-companion
      </button>
    </div>
  ),
}));

vi.mock("@/components/CompanionPersonalization", () => ({
  CompanionPersonalization: () => <div data-testid="companion-stage">Companion</div>,
}));

vi.mock("./JourneyBegins", () => ({
  JourneyBegins: ({
    userName,
    companionAnimal,
    onComplete,
  }: {
    userName: string;
    companionAnimal: string;
    onComplete: () => void;
  }) => (
    <div data-testid="journey-begins-stage">
      <div data-testid="journey-begins-summary">{`${userName}:${companionAnimal}`}</div>
      Journey Begins
      <button type="button" onClick={onComplete}>
        finish-journey
      </button>
    </div>
  ),
}));

const renderOnboarding = (
  props: Partial<Parameters<typeof StoryOnboarding>[0]> = {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <StoryOnboarding {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const advanceToQuestionnaire = async () => {
  fireEvent.click(screen.getByRole("button", { name: "prologue-next" }));
  fireEvent.click(await screen.findByRole("button", { name: "destiny-next" }));
  fireEvent.click(await screen.findByRole("button", { name: "faction-next" }));
  await screen.findByRole("button", { name: "questionnaire-submit" });
};

const advanceFromMentorToEggSelection = async () => {
  fireEvent.click(screen.getByRole("button", { name: "mentor-confirm" }));
  fireEvent.click(await screen.findByRole("button", { name: "story-tone-next" }));
  fireEvent.click(await screen.findByRole("button", { name: "egg-prelude-next" }));
  await screen.findByRole("button", { name: "complete-companion" });
};

describe("StoryOnboarding questionnaire submission flow", () => {
  beforeEach(() => {
    mocks.mentorsEq.mockReset();
    mocks.profilesMaybeSingle.mockReset();
    mocks.profilesUpdateEq.mockReset();
    mocks.questionnaireUpsert.mockReset();
    mocks.createCompanionMutateAsync.mockReset();
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.loggerError.mockReset();
    mocks.loggerWarn.mockReset();
    mocks.loggerInfo.mockReset();

    mocks.profilesMaybeSingle.mockResolvedValue({ data: { onboarding_data: {} }, error: null });
    mocks.profilesUpdateEq.mockResolvedValue({ error: null });
    mocks.mentorsEq.mockResolvedValue({ data: [ACTIVE_MENTOR], error: null });
    mocks.questionnaireUpsert.mockResolvedValue({ error: null });
    mocks.createCompanionMutateAsync.mockResolvedValue({ id: "companion-1" });
    storageMocks.reset();
  });

  it("moves to calculating immediately, then returns to questionnaire on timeout failure", async () => {
    mocks.mentorsEq.mockImplementation(() => new Promise(() => {
      // Keep pending to trigger timeout fallback.
    }));

    renderOnboarding();
    await advanceToQuestionnaire();

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "questionnaire-submit" }));

      expect(screen.getByTestId("calculating-stage")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(QUESTIONNAIRE_PIPELINE_TIMEOUT_MS);
        await Promise.resolve();
      });

      expect(screen.getByRole("button", { name: "questionnaire-submit" })).toBeInTheDocument();
      expect(mocks.toastError).toHaveBeenCalledWith(
        "We hit a temporary snag matching your guide. Please try again.",
        expect.objectContaining({ duration: expect.any(Number) }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("still reveals mentor after 2000ms when questionnaire persistence fails", async () => {
    mocks.questionnaireUpsert.mockResolvedValue({
      error: { message: "write failed" },
    });

    renderOnboarding();
    await advanceToQuestionnaire();

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "questionnaire-submit" }));
      expect(screen.getByTestId("calculating-stage")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(CALCULATING_STAGE_DURATION_MS - 1);
      });
      expect(screen.queryByTestId("mentor-result-stage")).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
        await Promise.resolve();
      });

      expect(screen.getByTestId("mentor-result-stage")).toBeInTheDocument();

      expect(mocks.questionnaireUpsert).toHaveBeenCalledTimes(4);
      expect(mocks.toastError).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses the onboarding egg chamber and submits the selected element payload unchanged", async () => {
    renderOnboarding();
    await advanceToQuestionnaire();

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "questionnaire-submit" }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(CALCULATING_STAGE_DURATION_MS);
        await Promise.resolve();
      });

      vi.useRealTimers();

      await advanceFromMentorToEggSelection();
      fireEvent.click(screen.getByRole("button", { name: "complete-companion" }));

      await screen.findByTestId("journey-begins-stage");

      expect(mocks.createCompanionMutateAsync).toHaveBeenCalledWith({
        presetId: "dragon",
        favoriteColor: "#60A5FA",
        spiritAnimal: "Dragon",
        coreElement: "ice",
        storyTone: "dark_intense",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("seeds first-run guided tutorial progress when journey begins is completed", async () => {
    renderOnboarding();
    await advanceToQuestionnaire();

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "questionnaire-submit" }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(CALCULATING_STAGE_DURATION_MS);
        await Promise.resolve();
      });

      vi.useRealTimers();

      await advanceFromMentorToEggSelection();
      fireEvent.click(screen.getByRole("button", { name: "complete-companion" }));

      await screen.findByTestId("journey-begins-stage");
      expect(
        storageMocks.safeLocalStorage.getItem("guided_tutorial_progress_user-1"),
      ).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "finish-journey" }));

      let rawProgress: string | null = null;
      await waitFor(() => {
        rawProgress = storageMocks.safeLocalStorage.getItem(
          "guided_tutorial_progress_user-1",
        );
        expect(rawProgress).toBeTruthy();
      });
      expect(rawProgress).toBeTruthy();

      const guidedTutorial = JSON.parse(rawProgress ?? "{}");
      expect(guidedTutorial).toMatchObject({
        version: 2,
        flowVersion: 3,
        eligible: true,
        completed: false,
        dismissed: false,
        completedSteps: [],
        xpAwardedSteps: [],
        milestonesCompleted: [],
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("passes through story tone via story-tone page and egg prelude before companion creation", async () => {
    renderOnboarding();
    await advanceToQuestionnaire();

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "questionnaire-submit" }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(CALCULATING_STAGE_DURATION_MS);
        await Promise.resolve();
      });

      vi.useRealTimers();

      fireEvent.click(screen.getByRole("button", { name: "mentor-confirm" }));
      expect(await screen.findByTestId("story-tone-stage")).toBeInTheDocument();
      expect(screen.getByTestId("story-tone-initial")).toHaveTextContent("epic_adventure");
      expect(screen.getByTestId("story-tone-initial-preset")).toHaveTextContent("");

      fireEvent.click(screen.getByRole("button", { name: "story-tone-next" }));
      expect(await screen.findByTestId("egg-prelude-stage")).toBeInTheDocument();
      expect(screen.getByTestId("egg-prelude-tone")).toHaveTextContent("dark_intense");
      expect(screen.getByTestId("egg-prelude-species")).toHaveTextContent("Dragon");

      fireEvent.click(screen.getByRole("button", { name: "egg-prelude-next" }));
      expect(await screen.findByTestId("companion-stage")).toBeInTheDocument();
      expect(screen.getByTestId("egg-stage-tone")).toHaveTextContent("dark_intense");
      expect(screen.getByTestId("egg-stage-preset")).toHaveTextContent("dragon");
      expect(screen.getByTestId("egg-stage-species")).toHaveTextContent("Dragon");

      fireEvent.click(screen.getByRole("button", { name: "complete-companion" }));
      await screen.findByTestId("journey-begins-stage");

      expect(mocks.createCompanionMutateAsync).toHaveBeenCalledWith({
        presetId: "dragon",
        favoriteColor: "#60A5FA",
        spiritAnimal: "Dragon",
        coreElement: "ice",
        storyTone: "dark_intense",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves the chosen tone and species when returning from the egg prelude", async () => {
    renderOnboarding();
    await advanceToQuestionnaire();

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "questionnaire-submit" }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(CALCULATING_STAGE_DURATION_MS);
        await Promise.resolve();
      });

      vi.useRealTimers();

      fireEvent.click(screen.getByRole("button", { name: "mentor-confirm" }));
      fireEvent.click(await screen.findByRole("button", { name: "story-tone-next" }));

      expect(screen.getByTestId("egg-prelude-tone")).toHaveTextContent("dark_intense");
      expect(screen.getByTestId("egg-prelude-species")).toHaveTextContent("Dragon");

      fireEvent.click(screen.getByRole("button", { name: "egg-prelude-back" }));

      expect(await screen.findByTestId("story-tone-stage")).toBeInTheDocument();
      expect(screen.getByTestId("story-tone-initial")).toHaveTextContent("dark_intense");
      expect(screen.getByTestId("story-tone-initial-preset")).toHaveTextContent("dragon");

      fireEvent.click(screen.getByRole("button", { name: "story-tone-next" }));

      expect(await screen.findByTestId("egg-prelude-stage")).toBeInTheDocument();
      expect(screen.getByTestId("egg-prelude-tone")).toHaveTextContent("dark_intense");
      expect(screen.getByTestId("egg-prelude-species")).toHaveTextContent("Dragon");
    } finally {
      vi.useRealTimers();
    }
  });

  it("signals the final cinematic lifecycle around the journey-begins stage", async () => {
    const onJourneyCinematicStart = vi.fn();
    const onJourneyCinematicComplete = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StoryOnboarding
            onJourneyCinematicStart={onJourneyCinematicStart}
            onJourneyCinematicComplete={onJourneyCinematicComplete}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await advanceToQuestionnaire();

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "questionnaire-submit" }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(CALCULATING_STAGE_DURATION_MS);
        await Promise.resolve();
      });

      vi.useRealTimers();

      await advanceFromMentorToEggSelection();
      fireEvent.click(screen.getByRole("button", { name: "complete-companion" }));

      await screen.findByTestId("journey-begins-stage");
      await waitFor(() => {
        expect(onJourneyCinematicStart).toHaveBeenCalledTimes(1);
      });

      fireEvent.click(screen.getByRole("button", { name: "finish-journey" }));
      await waitFor(() => {
        expect(onJourneyCinematicComplete).toHaveBeenCalledTimes(1);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("surfaces the create-step failure toast when companion creation fails", async () => {
    mocks.createCompanionMutateAsync.mockRejectedValueOnce(
      new Error("Companion setup is still syncing. Please try again in a moment."),
    );

    renderOnboarding();
    await advanceToQuestionnaire();

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "questionnaire-submit" }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(CALCULATING_STAGE_DURATION_MS);
        await Promise.resolve();
      });

      vi.useRealTimers();

      await advanceFromMentorToEggSelection();
      fireEvent.click(screen.getByRole("button", { name: "complete-companion" }));

      await waitFor(() => {
        expect(mocks.toastError).toHaveBeenCalledWith(
          "Companion setup is still syncing. Please try again in a moment.",
          expect.objectContaining({ duration: expect.any(Number) }),
        );
      });
      expect(screen.queryByTestId("journey-begins-stage")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a finalization-specific toast when companion creation succeeds but onboarding completion fails", async () => {
    mocks.profilesUpdateEq.mockReset();
    mocks.profilesUpdateEq
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "finalization failed" } });

    renderOnboarding();
    await advanceToQuestionnaire();

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "questionnaire-submit" }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(CALCULATING_STAGE_DURATION_MS);
        await Promise.resolve();
      });

      vi.useRealTimers();

      await advanceFromMentorToEggSelection();
      fireEvent.click(screen.getByRole("button", { name: "complete-companion" }));
      await screen.findByTestId("journey-begins-stage");
      fireEvent.click(screen.getByRole("button", { name: "finish-journey" }));

      await waitFor(() => {
        expect(mocks.toastError).toHaveBeenCalledWith(
          "Your egg was created, but we couldn't finish setup. Please try again.",
          expect.objectContaining({ duration: expect.any(Number) }),
        );
      });
      expect(screen.getByTestId("journey-begins-stage")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("resumes journey-begins recovery and backfills tutorial progress on completion", async () => {
    mocks.profilesMaybeSingle.mockResolvedValue({
      data: {
        onboarding_data: {
          story_tone: "dark_intense",
        },
      },
      error: null,
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StoryOnboarding
            resumeState={{
              stage: "journey-begins",
              userName: "Nova",
              companionLabel: "Ice Egg",
            }}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("journey-begins-stage")).toBeInTheDocument();
    });
    expect(screen.getByTestId("journey-begins-summary")).toHaveTextContent("Nova:Ice Egg");
    expect(mocks.createCompanionMutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "finish-journey" }));

    let rawProgress: string | null = null;
    await waitFor(() => {
      rawProgress = storageMocks.safeLocalStorage.getItem(
        "guided_tutorial_progress_user-1",
      );
      expect(rawProgress).toBeTruthy();
    });
    expect(rawProgress).toBeTruthy();
    expect(mocks.profilesUpdateEq).toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Welcome to Cosmiq! Your journey begins.",
      expect.objectContaining({ duration: expect.any(Number) }),
    );
  });

  it("starts reset mode at the story-tone stage", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StoryOnboarding mode="reset" />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("story-tone-stage")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "prologue-next" })).not.toBeInTheDocument();
  });
});
