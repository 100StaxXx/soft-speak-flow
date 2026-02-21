import { act, renderHook, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createGuidedTutorial = () => ({
  version: 2,
  eligible: true,
  completed: false,
  completedSteps: ["create_quest", "meet_companion"] as const,
  xpAwardedSteps: [] as string[],
  milestonesCompleted: ["open_mentor_tab"] as const,
});

const mocks = vi.hoisted(() => ({
  state: {
    user: { id: "user-1" } as { id: string } | null,
    profileLoading: false,
    guidedTutorial: {
      version: 2,
      eligible: true,
      completed: false,
      completedSteps: ["create_quest", "meet_companion"],
      xpAwardedSteps: [] as string[],
      milestonesCompleted: ["open_mentor_tab"],
    } as Record<string, unknown>,
    profileUpdatePayloads: [] as Array<Record<string, unknown>>,
    queryClient: {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
      getQueryData: vi.fn().mockReturnValue(null),
    },
    awardCustomXP: vi.fn().mockResolvedValue(undefined),
    personality: null as
      | {
          name: string;
          slug: string;
          tone: string;
          style: string;
          avatar_url?: string;
          primary_color: string;
        }
      | null,
  },
}));

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => mocks.state.queryClient,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.state.user,
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    loading: mocks.state.profileLoading,
    profile: {
      onboarding_data: {
        walkthrough_completed: true,
        guided_tutorial: mocks.state.guidedTutorial,
      },
    },
  }),
}));

vi.mock("@/hooks/useXPRewards", () => ({
  useXPRewards: () => ({
    awardCustomXP: mocks.state.awardCustomXP,
  }),
}));

vi.mock("@/hooks/useMentorPersonality", () => ({
  useMentorPersonality: () => mocks.state.personality,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn((payload: Record<string, unknown>) => ({
        eq: vi.fn(async () => {
          mocks.state.profileUpdatePayloads.push(payload);
          return { error: null };
        }),
      })),
    })),
  },
}));

import {
  CREATE_QUEST_SUBSTEP_ORDER,
  PostOnboardingMentorGuidanceProvider,
  getMentorInstructionLines,
  milestoneUsesStrictLock,
  safeCompletedSteps,
  sanitizeCreateQuestProgress,
  shouldRestoreTutorialRoute,
  usePostOnboardingMentorGuidance,
} from "./usePostOnboardingMentorGuidance";

describe("safeCompletedSteps", () => {
  it("returns only valid guided step ids", () => {
    const result = safeCompletedSteps([
      "create_quest",
      "invalid-step",
      "morning_checkin",
      "evolve_companion",
      42,
      null,
    ]);

    expect(result).toEqual(["create_quest", "morning_checkin", "evolve_companion"]);
  });

  it("returns an empty array for malformed values", () => {
    expect(safeCompletedSteps(undefined)).toEqual([]);
    expect(safeCompletedSteps("create_quest")).toEqual([]);
    expect(safeCompletedSteps({ completedSteps: ["create_quest"] })).toEqual([]);
    expect(safeCompletedSteps(null)).toEqual([]);
  });
});

describe("create quest substep order", () => {
  it("defines deterministic substeps in strict order", () => {
    expect(CREATE_QUEST_SUBSTEP_ORDER).toEqual([
      "open_add_quest",
      "enter_title",
      "select_time",
      "submit_create_quest",
    ]);
  });
});

describe("sanitizeCreateQuestProgress", () => {
  it("drops invalid and legacy substep ids and defaults current to first incomplete", () => {
    const result = sanitizeCreateQuestProgress({
      current: "stay_on_quests",
      completed: ["stay_on_quests", "invalid", "open_add_quest", "quests_campaigns_intro"],
    });

    expect(result).toEqual({
      current: "enter_title",
      completed: ["open_add_quest"],
      startedAt: undefined,
      completedAt: undefined,
    });
  });
});

describe("getMentorInstructionLines", () => {
  it("returns mentor-led instructions for each step", () => {
    expect(getMentorInstructionLines("quests_campaigns_intro", null)[0]).toContain(
      "tasks can be done now or saved for later"
    );
    expect(getMentorInstructionLines("create_quest", "open_add_quest")[0]).toContain(
      "Tap the + in the bottom right"
    );
    expect(getMentorInstructionLines("create_quest", "enter_title")[0]).toContain(
      "Type your quest title"
    );
    expect(getMentorInstructionLines("morning_checkin", null)[0]).toContain("Head to Mentor");
    expect(getMentorInstructionLines("evolve_companion", null)[0]).toContain("Tap Evolve");
    expect(getMentorInstructionLines("post_evolution_companion_intro", null)[0]).toContain("track growth");
    expect(getMentorInstructionLines("mentor_closeout", null)[0]).toContain("tutorial is complete");
  });
});

describe("milestoneUsesStrictLock", () => {
  it("does not strict-lock submit morning check-in", () => {
    expect(milestoneUsesStrictLock("submit_morning_checkin")).toBe(false);
  });

  it("does not strict-lock quests explainer", () => {
    expect(milestoneUsesStrictLock("quests_campaigns_intro")).toBe(false);
  });

  it("does not strict-lock post-evolution companion explainer", () => {
    expect(milestoneUsesStrictLock("post_evolution_companion_intro")).toBe(false);
  });

  it("keeps strict lock enabled for actionable tutorial targets", () => {
    expect(milestoneUsesStrictLock("open_add_quest")).toBe(true);
  });
});

describe("shouldRestoreTutorialRoute", () => {
  it("returns true when current path is a main tab and differs from the active step route", () => {
    expect(
      shouldRestoreTutorialRoute({
        pathname: "/journeys",
        stepRoute: "/mentor",
        tutorialReady: true,
        tutorialComplete: false,
        currentStepId: "morning_checkin",
        evolutionInFlight: false,
      })
    ).toBe(true);
  });

  it("returns true for root path mismatch", () => {
    expect(
      shouldRestoreTutorialRoute({
        pathname: "/",
        stepRoute: "/companion",
        tutorialReady: true,
        tutorialComplete: false,
        currentStepId: "evolve_companion",
        evolutionInFlight: false,
      })
    ).toBe(true);
  });

  it("returns false when already on the correct step route", () => {
    expect(
      shouldRestoreTutorialRoute({
        pathname: "/mentor",
        stepRoute: "/mentor",
        tutorialReady: true,
        tutorialComplete: false,
        currentStepId: "morning_checkin",
        evolutionInFlight: false,
      })
    ).toBe(false);
  });

  it("returns false for non-main-tab routes", () => {
    expect(
      shouldRestoreTutorialRoute({
        pathname: "/profile",
        stepRoute: "/mentor",
        tutorialReady: true,
        tutorialComplete: false,
        currentStepId: "morning_checkin",
        evolutionInFlight: false,
      })
    ).toBe(false);
  });

  it("returns false when tutorial is not ready or already complete", () => {
    expect(
      shouldRestoreTutorialRoute({
        pathname: "/journeys",
        stepRoute: "/mentor",
        tutorialReady: false,
        tutorialComplete: false,
        currentStepId: "morning_checkin",
        evolutionInFlight: false,
      })
    ).toBe(false);

    expect(
      shouldRestoreTutorialRoute({
        pathname: "/journeys",
        stepRoute: "/mentor",
        tutorialReady: true,
        tutorialComplete: true,
        currentStepId: "morning_checkin",
        evolutionInFlight: false,
      })
    ).toBe(false);
  });

  it("does not restore route during in-flight evolution step", () => {
    expect(
      shouldRestoreTutorialRoute({
        pathname: "/journeys",
        stepRoute: "/companion",
        tutorialReady: true,
        tutorialComplete: false,
        currentStepId: "evolve_companion",
        evolutionInFlight: true,
      })
    ).toBe(false);
  });

  it("restores route for evolve step once evolution is no longer in-flight", () => {
    expect(
      shouldRestoreTutorialRoute({
        pathname: "/journeys",
        stepRoute: "/companion",
        tutorialReady: true,
        tutorialComplete: false,
        currentStepId: "evolve_companion",
        evolutionInFlight: false,
      })
    ).toBe(true);
  });
});

describe("guided tutorial intro dialogue sequence", () => {
  beforeEach(() => {
    mocks.state.user = { id: "user-1" };
    mocks.state.profileLoading = false;
    mocks.state.guidedTutorial = createGuidedTutorial();
    mocks.state.profileUpdatePayloads = [];
    mocks.state.queryClient.invalidateQueries.mockClear();
    mocks.state.awardCustomXP.mockClear();
    mocks.state.personality = null;
    globalThis.localStorage?.removeItem?.("guided_tutorial_progress_user-1");
  });

  const createWrapper = (path = "/journeys") =>
    ({ children }: { children: ReactNode }) =>
      React.createElement(
        MemoryRouter,
        { initialEntries: [path] },
        React.createElement(PostOnboardingMentorGuidanceProvider, null, children)
      );

  it("shows one intro dialogue milestone before resuming normal tutorial", async () => {
    mocks.state.guidedTutorial = {
      version: 2,
      eligible: true,
      completed: false,
      completedSteps: [],
      xpAwardedSteps: [],
      milestonesCompleted: [],
    };

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/mentor"),
    });

    await waitFor(() => {
      expect(result.current.isIntroDialogueActive).toBe(true);
      expect(result.current.dialogueActionLabel).toBe("Start Tutorial");
      expect(result.current.activeTargetSelectors).toEqual([]);
      expect(result.current.isStrictLockActive).toBe(false);
    });

    await act(async () => {
      result.current.onDialogueAction?.();
    });

    await waitFor(() => {
      expect(result.current.isIntroDialogueActive).toBe(false);
      expect(result.current.isActive).toBe(true);
      expect(result.current.currentStep).toBe("quests_campaigns_intro");
      expect(result.current.dialogueActionLabel).toBe("Continue");
      expect(result.current.onDialogueAction).toBeDefined();
    });
  });

  it("enables temporary hiding only during in-flight evolution milestone", async () => {
    mocks.state.guidedTutorial = {
      version: 2,
      eligible: true,
      completed: false,
      completedSteps: ["create_quest", "meet_companion", "morning_checkin"],
      xpAwardedSteps: [],
      milestonesCompleted: ["mentor_intro_hello"],
    };

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/companion"),
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("evolve_companion");
      expect(result.current.canTemporarilyHide).toBe(false);
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("evolution-loading-start"));
    });

    await waitFor(() => {
      expect(result.current.canTemporarilyHide).toBe(true);
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("companion-evolved"));
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("post_evolution_companion_intro");
      expect(result.current.canTemporarilyHide).toBe(false);
    });
  });

  it("uses atlas voice for the intro hello", async () => {
    mocks.state.personality = {
      name: "Atlas",
      slug: "atlas",
      tone: "Direct",
      style: "",
      primary_color: "#f59e0b",
    };

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/mentor"),
    });

    await waitFor(() => {
      expect(result.current.dialogueText).toContain("deliberate step");
    });
  });

  it("uses sienna voice for the intro hello", async () => {
    mocks.state.personality = {
      name: "Sienna",
      slug: "sienna",
      tone: "Supportive",
      style: "",
      primary_color: "#f59e0b",
    };

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/mentor"),
    });

    await waitFor(() => {
      expect(result.current.dialogueText).toContain("gentle and steady");
    });
  });

  it.each([
    { name: "Atlas", slug: "atlas", tone: "Wise", questsSnippet: "choose what matters now" },
    { name: "Eli", slug: "eli", tone: "Supportive", questsSnippet: "We can do a task now" },
    { name: "Sienna", slug: "sienna", tone: "Empathetic", questsSnippet: "set a gentle to-do for later" },
    { name: "Stryker", slug: "stryker", tone: "Direct", questsSnippet: "Execute a task now" },
    { name: "Carmen", slug: "carmen", tone: "Direct", questsSnippet: "Handle priority tasks now" },
    { name: "Reign", slug: "reign", tone: "Tough", questsSnippet: "Hit a task now" },
    { name: "Solace", slug: "solace", tone: "Supportive", questsSnippet: "take care of something now" },
  ])(
    "uses mentor-specific quests intro voice for $slug and includes now/later + long-term goals",
    async ({ name, slug, tone, questsSnippet }) => {
      mocks.state.personality = {
        name,
        slug,
        tone,
        style: "",
        primary_color: "#f59e0b",
      };
      mocks.state.guidedTutorial = {
        version: 2,
        eligible: true,
        completed: false,
        completedSteps: [],
        xpAwardedSteps: [],
        milestonesCompleted: ["mentor_intro_hello"],
      };
      globalThis.localStorage?.removeItem?.("guided_tutorial_progress_user-1");

      const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
        wrapper: createWrapper("/journeys"),
      });

      await waitFor(() => {
        expect(result.current.currentStep).toBe("quests_campaigns_intro");
        expect(result.current.dialogueText).toContain(questsSnippet);
        expect(result.current.dialogueText.toLowerCase()).toContain("now");
        expect(result.current.dialogueText.toLowerCase()).toContain("later");
        expect(result.current.dialogueSupportText?.toLowerCase()).toContain("campaign");
        expect(result.current.dialogueSupportText?.toLowerCase()).toContain("long-term");
      });
    }
  );

  it("uses different mentor-specific copy for intro and quests milestones across slugs", async () => {
    globalThis.localStorage?.removeItem?.("guided_tutorial_progress_user-1");

    mocks.state.personality = {
      name: "Atlas",
      slug: "atlas",
      tone: "Wise",
      style: "",
      primary_color: "#f59e0b",
    };
    mocks.state.guidedTutorial = {
      version: 2,
      eligible: true,
      completed: false,
      completedSteps: [],
      xpAwardedSteps: [],
      milestonesCompleted: [],
    };

    const { result: atlasIntroResult, unmount: unmountAtlasIntro } = renderHook(
      () => usePostOnboardingMentorGuidance(),
      { wrapper: createWrapper("/mentor") }
    );

    let atlasIntroText = "";
    await waitFor(() => {
      atlasIntroText = atlasIntroResult.current.dialogueText;
      expect(atlasIntroText).toContain("deliberate step");
    });
    unmountAtlasIntro();

    globalThis.localStorage?.removeItem?.("guided_tutorial_progress_user-1");
    mocks.state.personality = {
      name: "Stryker",
      slug: "stryker",
      tone: "Direct",
      style: "",
      primary_color: "#f59e0b",
    };
    mocks.state.guidedTutorial = {
      version: 2,
      eligible: true,
      completed: false,
      completedSteps: [],
      xpAwardedSteps: [],
      milestonesCompleted: [],
    };

    const { result: strykerIntroResult, unmount: unmountStrykerIntro } = renderHook(
      () => usePostOnboardingMentorGuidance(),
      { wrapper: createWrapper("/mentor") }
    );

    let strykerIntroText = "";
    await waitFor(() => {
      strykerIntroText = strykerIntroResult.current.dialogueText;
      expect(strykerIntroText).toContain("execute this fast and clean");
    });
    unmountStrykerIntro();

    expect(atlasIntroText).not.toEqual(strykerIntroText);

    globalThis.localStorage?.removeItem?.("guided_tutorial_progress_user-1");
    mocks.state.personality = {
      name: "Atlas",
      slug: "atlas",
      tone: "Wise",
      style: "",
      primary_color: "#f59e0b",
    };
    mocks.state.guidedTutorial = {
      version: 2,
      eligible: true,
      completed: false,
      completedSteps: [],
      xpAwardedSteps: [],
      milestonesCompleted: ["mentor_intro_hello"],
    };

    const { result: atlasQuestsResult, unmount: unmountAtlasQuests } = renderHook(
      () => usePostOnboardingMentorGuidance(),
      { wrapper: createWrapper("/journeys") }
    );

    let atlasQuestsText = "";
    await waitFor(() => {
      atlasQuestsText = atlasQuestsResult.current.dialogueText;
      expect(atlasQuestsText).toContain("choose what matters now");
    });
    unmountAtlasQuests();

    globalThis.localStorage?.removeItem?.("guided_tutorial_progress_user-1");
    mocks.state.personality = {
      name: "Stryker",
      slug: "stryker",
      tone: "Direct",
      style: "",
      primary_color: "#f59e0b",
    };
    mocks.state.guidedTutorial = {
      version: 2,
      eligible: true,
      completed: false,
      completedSteps: [],
      xpAwardedSteps: [],
      milestonesCompleted: ["mentor_intro_hello"],
    };

    const { result: strykerQuestsResult } = renderHook(
      () => usePostOnboardingMentorGuidance(),
      { wrapper: createWrapper("/journeys") }
    );

    let strykerQuestsText = "";
    await waitFor(() => {
      strykerQuestsText = strykerQuestsResult.current.dialogueText;
      expect(strykerQuestsText).toContain("Execute a task now");
    });

    expect(atlasQuestsText).not.toEqual(strykerQuestsText);
  });

  it("falls back to neutral greeting for unknown mentor slug", async () => {
    mocks.state.personality = {
      name: "Nova",
      slug: "unknown-mentor",
      tone: "",
      style: "",
      primary_color: "#f59e0b",
    };

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/mentor"),
    });

    await waitFor(() => {
      expect(result.current.dialogueText).toContain("I'm Nova");
    });
  });

  it("migrates legacy meet_companion progress without blocking", async () => {
    mocks.state.guidedTutorial = {
      version: 2,
      eligible: true,
      completed: false,
      completedSteps: ["create_quest", "meet_companion"],
      xpAwardedSteps: [],
      milestonesCompleted: ["open_mentor_tab"],
    };

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/journeys"),
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("morning_checkin");
      expect(result.current.stepRoute).toBe("/mentor");
    });
  });

  it("marks quests intro complete when legacy create quest substeps already exist", async () => {
    mocks.state.guidedTutorial = {
      version: 2,
      eligible: true,
      completed: false,
      completedSteps: [],
      xpAwardedSteps: [],
      milestonesCompleted: ["enter_title"],
      substeps: {
        create_quest: {
          current: "submit_create_quest",
          completed: ["open_add_quest", "enter_title"],
        },
      },
    };

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/journeys"),
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("create_quest");
      expect(result.current.currentSubstep).toBe("select_time");
    });
  });

  it("keeps completed old tutorial completed after migration", async () => {
    mocks.state.guidedTutorial = {
      version: 2,
      eligible: true,
      completed: true,
      completedSteps: ["create_quest", "meet_companion", "morning_checkin", "evolve_companion", "mentor_closeout"],
      xpAwardedSteps: ["create_quest", "morning_checkin"],
      milestonesCompleted: ["mentor_closeout_message"],
    };

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/companion"),
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(false);
      expect(result.current.currentStep).toBe(null);
      expect(result.current.dialogueText).toBe("");
    });
  });
});
