import { act, fireEvent, render, screen } from "@testing-library/react";
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
  toastError: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  loggerInfo: vi.fn(),
}));

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
    createCompanion: vi.fn(),
  }),
}));

vi.mock("@/utils/mentorExplanation", () => ({
  generateMentorExplanation: () => ({
    title: "Your Mentor is: Atlas",
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
  MentorResult: () => <div data-testid="mentor-result-stage">Mentor Result</div>,
}));

vi.mock("@/components/MentorGrid", () => ({
  MentorGrid: () => <div data-testid="mentor-grid-stage">Mentor Grid</div>,
}));

vi.mock("@/components/CompanionPersonalization", () => ({
  CompanionPersonalization: () => <div data-testid="companion-stage">Companion</div>,
}));

vi.mock("./JourneyBegins", () => ({
  JourneyBegins: () => <div data-testid="journey-begins-stage">Journey Begins</div>,
}));

const renderOnboarding = () => {
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
        <StoryOnboarding />
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

describe("StoryOnboarding questionnaire submission flow", () => {
  beforeEach(() => {
    mocks.mentorsEq.mockReset();
    mocks.profilesMaybeSingle.mockReset();
    mocks.profilesUpdateEq.mockReset();
    mocks.questionnaireUpsert.mockReset();
    mocks.toastError.mockReset();
    mocks.loggerError.mockReset();
    mocks.loggerWarn.mockReset();
    mocks.loggerInfo.mockReset();

    mocks.profilesMaybeSingle.mockResolvedValue({ data: { onboarding_data: {} }, error: null });
    mocks.profilesUpdateEq.mockResolvedValue({ error: null });
    mocks.mentorsEq.mockResolvedValue({ data: [ACTIVE_MENTOR], error: null });
    mocks.questionnaireUpsert.mockResolvedValue({ error: null });
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
        "We hit a temporary snag matching your mentor. Please try again.",
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
});
