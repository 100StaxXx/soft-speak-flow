import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CALCULATING_STAGE_DURATION_MS,
  MENTOR_CATALOG_RECOVERY_TIMEOUT_MS,
  QUESTIONNAIRE_PIPELINE_TIMEOUT_MS,
  StoryOnboarding,
} from "./StoryOnboarding";

const QUESTIONNAIRE_ANSWERS = [
  {
    questionId: "visual_persona",
    optionId: "visual_persona_neutral",
    answer: "Prefer not to say",
    tags: ["visual_persona_neutral"],
  },
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
  {
    questionId: "schedule_archetype",
    optionId: "after_work_builder",
    answer: "I'm building something after work",
    tags: ["schedule_after_work_builder"],
  },
];

const ACTIVE_MENTOR = {
  id: "mentor-1",
  name: "The Sage",
  description: "Calm, clarifying guide",
  tone_description: "Calm and clear",
  avatar_url: "",
  tags: ["discipline"],
  mentor_type: "coach",
  target_user_type: "builders",
  slug: "sage",
  short_title: "Quiet Clarity",
  primary_color: "#7B68EE",
  target_user: "focused achievers",
  themes: ["clarity"],
  intensity_level: "medium",
  gender_energy: "masculine",
};

const mocks = vi.hoisted(() => ({
  mentorsEq: vi.fn(),
  profilesUpdateEq: vi.fn(),
  profilesMaybeSingle: vi.fn(),
  questionnaireUpsert: vi.fn(),
  createCompanionMutateAsync: vi.fn(),
  eggStageCompanionName: null as string | null,
  userCompanionMaybeSingle: vi.fn(),
  userCompanionUpdate: vi.fn(),
  userCompanionUpdateEq: vi.fn(),
  companionMemoryMaybeSingle: vi.fn(),
  companionMemoryInsert: vi.fn(),
  prepareCompanionOnboardingJourney: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  loggerInfo: vi.fn(),
  signOut: vi.fn(),
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
    signOut: mocks.signOut,
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
    title: "Your Guide is: The Sage",
    subtitle: "Quiet Clarity",
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
    dismiss: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.prepareCompanionOnboardingJourney,
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

      if (table === "user_companion") {
        const selectChain = {
          eq: vi.fn(),
          order: vi.fn(),
          limit: vi.fn(),
          maybeSingle: mocks.userCompanionMaybeSingle,
        };
        selectChain.eq.mockReturnValue(selectChain);
        selectChain.order.mockReturnValue(selectChain);
        selectChain.limit.mockReturnValue(selectChain);

        return {
          select: () => selectChain,
          update: mocks.userCompanionUpdate,
        };
      }

      if (table === "companion_memories") {
        const selectChain = {
          eq: vi.fn(),
          maybeSingle: mocks.companionMemoryMaybeSingle,
        };
        selectChain.eq.mockReturnValue(selectChain);

        return {
          select: () => selectChain,
          insert: mocks.companionMemoryInsert,
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
    initialAnswers = [],
  }: {
    onComplete: (answers: typeof QUESTIONNAIRE_ANSWERS) => void;
    isSubmitting?: boolean;
    initialAnswers?: typeof QUESTIONNAIRE_ANSWERS;
  }) => (
    <div>
      <div data-testid="questionnaire-stage">{isSubmitting ? "submitting" : "idle"}</div>
      <div data-testid="questionnaire-initial-count">{initialAnswers.length}</div>
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
    onComplete,
    onBack,
  }: {
    initialTone: string;
    onComplete: (selection: { storyTone: string }) => void;
    onBack?: () => void;
  }) => (
    <div data-testid="story-tone-stage">
      <div data-testid="story-tone-initial">{initialTone}</div>
      {onBack ? (
        <button type="button" onClick={onBack}>
          story-tone-back
        </button>
      ) : null}
      <button type="button" onClick={() => onComplete({ storyTone: "dark_intense" })}>
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

vi.mock("@/components/AICompanionCreator", () => ({
  AICompanionCreator: ({
    onComplete,
    storyTone,
    onBack,
  }: {
    onComplete: (payload: {
      favoriteColor: string;
      spiritAnimal: string;
      coreElement: string;
      storyTone: string;
      companionName?: string | null;
    }) => void;
    storyTone: string;
    onBack?: () => void;
  }) => (
    <div data-testid="companion-stage">
      <div data-testid="egg-stage-tone">{storyTone}</div>
      <div data-testid="egg-stage-species">Dragon</div>
      <div data-testid="egg-stage-element">ice</div>
      {onBack ? (
        <button type="button" onClick={onBack}>
          companion-back
        </button>
      ) : null}
      <button
        type="button"
        onClick={() =>
          onComplete({
            favoriteColor: "#60A5FA",
            spiritAnimal: "Dragon",
            coreElement: "ice",
            storyTone,
            companionName: mocks.eggStageCompanionName,
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

vi.mock("@/components/CompanionCreationLoader", () => ({
  CompanionCreationLoader: () => <div data-testid="companion-creation-loader">Loading companion</div>,
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
    mocks.eggStageCompanionName = null;
    mocks.userCompanionMaybeSingle.mockReset();
    mocks.userCompanionUpdate.mockReset();
    mocks.userCompanionUpdateEq.mockReset();
    mocks.companionMemoryMaybeSingle.mockReset();
    mocks.companionMemoryInsert.mockReset();
    mocks.prepareCompanionOnboardingJourney.mockReset();
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.loggerError.mockReset();
    mocks.loggerWarn.mockReset();
    mocks.loggerInfo.mockReset();
    mocks.signOut.mockReset();

    mocks.profilesMaybeSingle.mockResolvedValue({ data: { onboarding_data: {} }, error: null });
    mocks.profilesUpdateEq.mockResolvedValue({ error: null });
    mocks.signOut.mockResolvedValue(undefined);
    mocks.mentorsEq.mockResolvedValue({ data: [ACTIVE_MENTOR], error: null });
    mocks.questionnaireUpsert.mockResolvedValue({ error: null });
    mocks.createCompanionMutateAsync.mockResolvedValue({ id: "companion-1" });
    mocks.userCompanionMaybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.userCompanionUpdate.mockReturnValue({
      eq: mocks.userCompanionUpdateEq,
    });
    mocks.userCompanionUpdateEq.mockResolvedValue({ error: null });
    mocks.companionMemoryMaybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.companionMemoryInsert.mockResolvedValue({ error: null });
    mocks.prepareCompanionOnboardingJourney.mockResolvedValue({ error: null });
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

  it("returns to questionnaire when questionnaire persistence fails", async () => {
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
        await Promise.resolve();
      });

      expect(screen.getByRole("button", { name: "questionnaire-submit" })).toBeInTheDocument();
      expect(mocks.questionnaireUpsert).toHaveBeenCalledTimes(6);
      expect(mocks.toastError).toHaveBeenCalledWith(
        "We hit a temporary snag matching your guide. Please try again.",
        expect.objectContaining({ duration: expect.any(Number) }),
      );
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
        creationMode: "ai",
        favoriteColor: "#60A5FA",
        spiritAnimal: "Dragon",
        coreElement: "ice",
        storyTone: "dark_intense",
        companionName: null,
        deferInitialImageGeneration: true,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("enters journey-begins immediately and shows the companion loader while setup is still pending", async () => {
    mocks.createCompanionMutateAsync.mockImplementation(() => new Promise(() => {
      // Keep pending to verify the journey screen no longer waits on setup.
    }));

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
      await act(async () => {
        await Promise.resolve();
      });
      mocks.profilesUpdateEq.mockClear();

      fireEvent.click(screen.getByRole("button", { name: "finish-journey" }));

      expect(await screen.findByTestId("companion-creation-loader")).toBeInTheDocument();
      expect(mocks.toastError).not.toHaveBeenCalledWith(
        "Your companion is still taking shape. Please try again in a moment.",
        expect.anything(),
      );
      expect(mocks.createCompanionMutateAsync).toHaveBeenCalledTimes(1);
      expect(mocks.profilesUpdateEq).not.toHaveBeenCalled();
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
        flowVersion: 9,
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

      fireEvent.click(screen.getByRole("button", { name: "story-tone-next" }));
      expect(await screen.findByTestId("egg-prelude-stage")).toBeInTheDocument();
      expect(screen.getByTestId("egg-prelude-tone")).toHaveTextContent("dark_intense");
      expect(screen.getByTestId("egg-prelude-species")).toHaveTextContent("companion");

      fireEvent.click(screen.getByRole("button", { name: "egg-prelude-next" }));
      expect(await screen.findByTestId("companion-stage")).toBeInTheDocument();
      expect(screen.getByTestId("egg-stage-tone")).toHaveTextContent("dark_intense");
      expect(screen.getByTestId("egg-stage-species")).toHaveTextContent("Dragon");
      expect(screen.getByTestId("egg-stage-element")).toHaveTextContent("ice");

      fireEvent.click(screen.getByRole("button", { name: "complete-companion" }));
      await screen.findByTestId("journey-begins-stage");

      expect(mocks.createCompanionMutateAsync).toHaveBeenCalledWith({
        creationMode: "ai",
        favoriteColor: "#60A5FA",
        spiritAnimal: "Dragon",
        coreElement: "ice",
        storyTone: "dark_intense",
        companionName: null,
        deferInitialImageGeneration: true,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the egg-era reveal free of cached companion names before hatching", async () => {
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

      expect(screen.getByTestId("journey-begins-summary")).toHaveTextContent("Nova:Ice Egg");
      expect(screen.getByTestId("journey-begins-summary")).not.toHaveTextContent("Ignisyl");
      expect(
        mocks.userCompanionUpdate.mock.calls.every(([payload]) => !("cached_creature_name" in (payload as Record<string, unknown>))),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses a custom companion name immediately during journey-begins and companion creation", async () => {
    mocks.eggStageCompanionName = "Lyra";

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

      expect(screen.getByTestId("journey-begins-summary")).toHaveTextContent("Nova:Lyra");
      expect(mocks.createCompanionMutateAsync).toHaveBeenCalledWith({
        creationMode: "ai",
        favoriteColor: "#60A5FA",
        spiritAnimal: "Dragon",
        coreElement: "ice",
        storyTone: "dark_intense",
        companionName: "Lyra",
        deferInitialImageGeneration: true,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("persists a custom companion name after timeout recovery", async () => {
    mocks.eggStageCompanionName = "Lyra";
    mocks.createCompanionMutateAsync.mockRejectedValueOnce(new Error("GENERATION_TIMEOUT"));
    mocks.userCompanionMaybeSingle.mockResolvedValue({
      data: { id: "companion-recovered", spirit_animal: "Dragon" },
      error: null,
    });

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

      expect(screen.getByTestId("journey-begins-summary")).toHaveTextContent("Nova:Lyra");
      expect(mocks.userCompanionUpdate).toHaveBeenCalledWith({ companion_name: "Lyra" });
      expect(mocks.userCompanionUpdateEq).toHaveBeenCalledWith("id", "companion-recovered");
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

      expect(await screen.findByTestId("egg-prelude-stage")).toBeInTheDocument();
      expect(screen.getByTestId("egg-prelude-tone")).toHaveTextContent("dark_intense");
      expect(screen.getByTestId("egg-prelude-species")).toHaveTextContent("companion");

      fireEvent.click(screen.getByRole("button", { name: "egg-prelude-back" }));

      expect(await screen.findByTestId("story-tone-stage")).toBeInTheDocument();
      expect(screen.getByTestId("story-tone-initial")).toHaveTextContent("dark_intense");

      fireEvent.click(screen.getByRole("button", { name: "story-tone-next" }));

      expect(await screen.findByTestId("egg-prelude-stage")).toBeInTheDocument();
      expect(screen.getByTestId("egg-prelude-tone")).toHaveTextContent("dark_intense");
      expect(screen.getByTestId("egg-prelude-species")).toHaveTextContent("companion");
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
      expect(screen.getByTestId("journey-begins-stage")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries failed companion setup from the journey button using the cached selection", async () => {
    mocks.createCompanionMutateAsync
      .mockRejectedValueOnce(new Error("Companion setup is still syncing. Please try again in a moment."))
      .mockResolvedValueOnce({ id: "companion-1" });

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
      await waitFor(() => {
        expect(mocks.toastError).toHaveBeenCalledWith(
          "Companion setup is still syncing. Please try again in a moment.",
          expect.objectContaining({ duration: expect.any(Number) }),
        );
      });

      mocks.profilesUpdateEq.mockClear();
      fireEvent.click(screen.getByRole("button", { name: "finish-journey" }));

      await waitFor(() => {
        expect(mocks.createCompanionMutateAsync).toHaveBeenCalledTimes(2);
      });
      await waitFor(() => {
        expect(mocks.profilesUpdateEq).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(mocks.toastSuccess).toHaveBeenCalledWith(
          "Welcome to Cosmiq! Your journey begins.",
          expect.objectContaining({ duration: expect.any(Number) }),
        );
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a finalization-specific toast when companion creation succeeds but onboarding completion fails", async () => {
    mocks.prepareCompanionOnboardingJourney.mockResolvedValueOnce({ error: { message: "finalization failed" } });

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

  it("does not render Continue Later during onboarding", async () => {
    const { unmount } = renderOnboarding();

    expect(screen.queryByRole("button", { name: "Continue Later" })).not.toBeInTheDocument();
    unmount();

    renderOnboarding({
      resumeState: {
        stage: "story-tone",
        userName: "Nova",
        onboardingData: {
          story_tone: "dark_intense",
          questionnaireAnswers: QUESTIONNAIRE_ANSWERS,
        },
      },
    });

    await screen.findByTestId("story-tone-stage");
    expect(screen.queryByRole("button", { name: "Continue Later" })).not.toBeInTheDocument();
  });

  it("does not advance from story tone until the next step is persisted", async () => {
    let resolveSave: ((value: { error: null }) => void) | null = null;
    mocks.profilesUpdateEq.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveSave = resolve as (value: { error: null }) => void;
      }),
    );

    renderOnboarding({
      resumeState: {
        stage: "story-tone",
        userName: "Nova",
        onboardingData: {
          story_tone: "epic_adventure",
          questionnaireAnswers: QUESTIONNAIRE_ANSWERS,
        },
      },
    });

    await screen.findByTestId("story-tone-stage");
    fireEvent.click(screen.getByRole("button", { name: "story-tone-next" }));

    await waitFor(() => {
      expect(mocks.profilesUpdateEq).toHaveBeenCalled();
    });
    expect(screen.getByRole("status")).toHaveTextContent("Saving...");
    expect(screen.getByTestId("story-tone-stage")).toBeInTheDocument();
    expect(screen.queryByTestId("egg-prelude-stage")).not.toBeInTheDocument();

    await act(async () => {
      resolveSave?.({ error: null });
      await Promise.resolve();
    });

    expect(await screen.findByTestId("egg-prelude-stage")).toBeInTheDocument();
    expect(screen.queryByText("Saving...")).not.toBeInTheDocument();
  });

  it.each([
    ["story-tone", "story-tone-stage"],
    ["egg-prelude", "egg-prelude-stage"],
    ["companion", "companion-stage"],
    ["mentor-grid", "mentor-grid-stage"],
  ] as const)("resumes the %s onboarding stage", async (stage, testId) => {
    renderOnboarding({
      resumeState: {
        stage,
        userName: "Nova",
        faction: "starfall",
        onboardingData: {
          story_tone: "dark_intense",
          questionnaireAnswers: QUESTIONNAIRE_ANSWERS,
        },
      },
    });

    expect(await screen.findByTestId(testId)).toBeTruthy();
  });

  it("returns to the prologue when a mid-flow resume is missing the saved user name", async () => {
    renderOnboarding({
      resumeState: {
        stage: "questionnaire",
        faction: "starfall",
        onboardingData: {
          questionnaireAnswers: QUESTIONNAIRE_ANSWERS.slice(0, 2),
        },
      },
    });

    await screen.findByRole("button", { name: "prologue-next" });
    expect(screen.queryByTestId("questionnaire-stage")).not.toBeInTheDocument();
  });

  it("resumes questionnaire with saved answers available to the questionnaire", async () => {
    renderOnboarding({
      resumeState: {
        stage: "questionnaire",
        userName: "Nova",
        faction: "starfall",
        onboardingData: {
          questionnaireAnswers: QUESTIONNAIRE_ANSWERS.slice(0, 2),
        },
      },
    });

    expect(await screen.findByTestId("questionnaire-stage")).toBeTruthy();
    expect(screen.getByTestId("questionnaire-initial-count")).toHaveTextContent("2");
  });

  it("resumes mentor result with the saved mentor and explanation", async () => {
    renderOnboarding({
      resumeState: {
        stage: "mentor-result",
        userName: "Nova",
        faction: "starfall",
        onboardingData: {
          mentorId: ACTIVE_MENTOR.id,
          questionnaireAnswers: QUESTIONNAIRE_ANSWERS,
          explanation: {
            title: "Your Guide is: The Sage",
            subtitle: "Quiet Clarity",
            paragraph: "A fit for focused builders.",
            bullets: ["Clear guidance"],
          },
        },
      },
    });

    expect(await screen.findByTestId("mentor-result-stage")).toBeInTheDocument();
  });

  it("falls back to the mentor grid when the saved mentor is no longer active", async () => {
    mocks.mentorsEq.mockResolvedValueOnce({
      data: [{ ...ACTIVE_MENTOR, id: "mentor-2", name: "The Navigator" }],
      error: null,
    });

    renderOnboarding({
      resumeState: {
        stage: "mentor-result",
        userName: "Nova",
        faction: "starfall",
        onboardingData: {
          mentorId: ACTIVE_MENTOR.id,
          questionnaireAnswers: QUESTIONNAIRE_ANSWERS,
          explanation: {
            title: "Your Guide is: The Sage",
            subtitle: "Quiet Clarity",
            paragraph: "A fit for focused builders.",
            bullets: ["Clear guidance"],
          },
        },
      },
    });

    expect(await screen.findByTestId("mentor-grid-stage")).toBeInTheDocument();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "We couldn't reload your saved guide. Please choose one from the guide list.",
      expect.objectContaining({ duration: expect.any(Number) }),
    );
  });

  it("returns to the questionnaire when mentor-result resume cannot reload the guide catalog", async () => {
    mocks.mentorsEq.mockResolvedValueOnce({ data: [], error: null });

    renderOnboarding({
      resumeState: {
        stage: "mentor-result",
        userName: "Nova",
        faction: "starfall",
        onboardingData: {
          mentorId: ACTIVE_MENTOR.id,
          questionnaireAnswers: QUESTIONNAIRE_ANSWERS,
          explanation: {
            title: "Your Guide is: The Sage",
            subtitle: "Quiet Clarity",
            paragraph: "A fit for focused builders.",
            bullets: ["Clear guidance"],
          },
        },
      },
    });

    expect(await screen.findByTestId("questionnaire-stage")).toBeInTheDocument();
    expect(screen.getByTestId("questionnaire-initial-count")).toHaveTextContent(
      String(QUESTIONNAIRE_ANSWERS.length),
    );
    expect(mocks.toastError).toHaveBeenCalledWith(
      "We couldn't reload the guide catalog. Please retry your guide match.",
      expect.objectContaining({ duration: expect.any(Number) }),
    );
  });

  it("offers a retry when mentor-result resume catalog loading stalls", async () => {
    mocks.mentorsEq.mockImplementationOnce(() => new Promise(() => {
      // Keep pending to exercise the restore timeout escape.
    }));

    vi.useFakeTimers();
    try {
      renderOnboarding({
        resumeState: {
          stage: "mentor-result",
          userName: "Nova",
          faction: "starfall",
          onboardingData: {
            mentorId: ACTIVE_MENTOR.id,
            questionnaireAnswers: QUESTIONNAIRE_ANSWERS,
            explanation: {
              title: "Your Guide is: The Sage",
              subtitle: "Quiet Clarity",
              paragraph: "A fit for focused builders.",
              bullets: ["Clear guidance"],
            },
          },
        },
      });

      expect(screen.getByText("Restoring your guide...")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Retry Guide Match" })).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(MENTOR_CATALOG_RECOVERY_TIMEOUT_MS);
      });

      fireEvent.click(screen.getByRole("button", { name: "Retry Guide Match" }));

      expect(screen.getByTestId("questionnaire-stage")).toBeInTheDocument();
      expect(screen.getByTestId("questionnaire-initial-count")).toHaveTextContent(
        String(QUESTIONNAIRE_ANSWERS.length),
      );
    } finally {
      vi.useRealTimers();
    }
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
