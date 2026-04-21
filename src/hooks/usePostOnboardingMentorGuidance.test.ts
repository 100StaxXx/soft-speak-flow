import { act, renderHook, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createGuidedTutorial = () => ({
  version: 2,
  eligible: true,
  completed: false,
  completedSteps: ["create_quest", "meet_companion"] as const,
  xpAwardedSteps: [] as string[],
  milestonesCompleted: ["open_mentor_tab"] as const,
});

const createCloseoutTutorial = () => ({
  version: 2,
  flowVersion: 3,
  eligible: true,
  dismissed: false,
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
    } as Record<string, unknown> | null,
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

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => mocks.state.queryClient,
    useQuery: () => ({
      data: null,
      dataUpdatedAt: 0,
    }),
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

vi.mock("@/utils/storage", () => ({
  safeLocalStorage: storageMocks.safeLocalStorage,
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
      "daily to-do list"
    );
    expect(getMentorInstructionLines("create_quest", "open_add_quest")[0]).toContain(
      "Tap the + in the bottom right"
    );
    expect(getMentorInstructionLines("create_quest", "enter_title")[0]).toContain(
      "Name your quest"
    );
    expect(getMentorInstructionLines("create_quest", "select_time")[0]).toContain("Pick a time");
    expect(getMentorInstructionLines("create_quest", "submit_create_quest")[0]).toContain("Tap Add Quest");
    expect(getMentorInstructionLines("morning_checkin", null)[0]).toContain("Open Guide");
    expect(getMentorInstructionLines("companion_tab_intro", null)[0]).toContain("Companion Tab");
    expect(getMentorInstructionLines("evolve_companion", null)[0]).toContain("Tap Hatch to awaken it");
    expect(getMentorInstructionLines("post_evolution_companion_intro", null)[0]).toContain(
      "first step to greatness"
    );
    expect(getMentorInstructionLines("mentor_closeout", null)[0]).toContain(
      "concludes the tutorial"
    );
  });
});

describe("milestoneUsesStrictLock", () => {
  it("does not strict-lock submit morning check-in", () => {
    expect(milestoneUsesStrictLock("submit_morning_checkin")).toBe(false);
  });

  it("does not strict-lock companion intro", () => {
    expect(milestoneUsesStrictLock("companion_tab_intro")).toBe(false);
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
    storageMocks.reset();
  });

  afterEach(() => {
    document
      .querySelectorAll(
        [
          '[data-tour="add-quest-launcher"]',
          '[data-tour="add-quest-create-button"]',
          '[data-tour="add-quest-time-panel"]',
          '[data-tour="add-quest-time-input"]',
          '[data-tour="add-quest-time-chip"]',
        ].join(", ")
      )
      .forEach((element) => element.remove());
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

  it("prefers outlining the full morning check-in card for the submit milestone", async () => {
    mocks.state.guidedTutorial = {
      version: 2,
      eligible: true,
      completed: false,
      completedSteps: ["create_quest", "meet_companion"],
      xpAwardedSteps: [],
      milestonesCompleted: ["mentor_intro_hello", "open_mentor_tab"],
    };

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/mentor"),
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("morning_checkin");
      expect(result.current.activeTargetSelectors).toEqual([
        '[data-tour="morning-checkin"]',
        '[data-tour="checkin-submit"]',
      ]);
      expect(result.current.isStrictLockActive).toBe(false);
    });
  });

  it("targets both floating and shared add-quest launchers for open_add_quest", async () => {
    mocks.state.guidedTutorial = {
      version: 2,
      eligible: true,
      completed: false,
      completedSteps: ["quests_campaigns_intro"],
      xpAwardedSteps: [],
      milestonesCompleted: ["mentor_intro_hello", "quests_campaigns_intro"],
    };

    const launcher = document.createElement("button");
    launcher.setAttribute("data-tour", "add-quest-launcher");
    document.body.appendChild(launcher);

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/journeys"),
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("create_quest");
      expect(result.current.currentSubstep).toBe("open_add_quest");
      expect(result.current.activeTargetSelectors).toEqual([
        '[data-tour="add-quest-fab"]',
        '[data-tour="add-quest-launcher"]',
      ]);
      expect(result.current.activeTargetSelector).toBe('[data-tour="add-quest-launcher"]');
    });
  });

  it("retargets select_time from the chip to the open time panel", async () => {
    mocks.state.guidedTutorial = {
      version: 2,
      eligible: true,
      completed: false,
      completedSteps: ["quests_campaigns_intro"],
      xpAwardedSteps: [],
      milestonesCompleted: ["mentor_intro_hello", "quests_campaigns_intro"],
      substeps: {
        create_quest: {
          current: "select_time",
          completed: ["open_add_quest", "enter_title"],
        },
      },
    };

    const timeChip = document.createElement("button");
    timeChip.setAttribute("data-tour", "add-quest-time-chip");
    document.body.appendChild(timeChip);

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/journeys"),
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("create_quest");
      expect(result.current.currentSubstep).toBe("select_time");
      expect(result.current.activeTargetSelectors).toEqual([
        '[data-tour="add-quest-time-panel"]',
        '[data-tour="add-quest-time-input"]',
        '[data-tour="add-quest-time-chip"]',
      ]);
      expect(result.current.activeTargetSelector).toBe('[data-tour="add-quest-time-chip"]');
    });

    const timePanel = document.createElement("div");
    timePanel.setAttribute("data-tour", "add-quest-time-panel");
    document.body.appendChild(timePanel);

    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(result.current.activeTargetSelector).toBe('[data-tour="add-quest-time-panel"]');
    });
  });

  it("starts the tutorial from fresh local onboarding progress before the profile refresh catches up", async () => {
    mocks.state.guidedTutorial = null;
    storageMocks.safeLocalStorage.setItem(
      "guided_tutorial_progress_user-1",
      JSON.stringify({
        version: 2,
        flowVersion: 3,
        eligible: true,
        dismissed: false,
        completed: false,
        completedSteps: [],
        xpAwardedSteps: [],
        milestonesCompleted: [],
        lastUpdatedAt: "2026-04-03T00:00:00.000Z",
      }),
    );

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/journeys"),
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
      expect(result.current.isIntroDialogueActive).toBe(true);
      expect(result.current.currentStep).toBe("quests_campaigns_intro");
      expect(result.current.dialogueActionLabel).toBe("Start Tutorial");
    });
  });

  it("completes create_quest from submit_create_quest when a scheduled task-added event arrives", async () => {
    mocks.state.guidedTutorial = {
      version: 2,
      eligible: true,
      completed: false,
      completedSteps: ["quests_campaigns_intro"],
      xpAwardedSteps: [],
      milestonesCompleted: ["mentor_intro_hello", "quests_campaigns_intro"],
      substeps: {
        create_quest: {
          current: "submit_create_quest",
          completed: ["open_add_quest", "enter_title", "select_time"],
        },
      },
    };

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/journeys"),
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("create_quest");
      expect(result.current.currentSubstep).toBe("submit_create_quest");
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("task-added", {
          detail: {
            taskDate: "2026-04-04",
            scheduledTime: "10:30",
          },
        })
      );
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("morning_checkin");
      expect(result.current.currentSubstep).toBeNull();
    });
  });

  it("awards only the hatch-only tutorial XP budget across create quest and morning check-in", async () => {
    mocks.state.awardCustomXP.mockClear();

    mocks.state.guidedTutorial = {
      version: 2,
      eligible: true,
      completed: false,
      completedSteps: ["quests_campaigns_intro"],
      xpAwardedSteps: [],
      milestonesCompleted: ["mentor_intro_hello", "quests_campaigns_intro"],
      substeps: {
        create_quest: {
          current: "submit_create_quest",
          completed: ["open_add_quest", "enter_title", "select_time"],
        },
      },
    };

    const createQuestRender = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/journeys"),
    });

    await waitFor(() => {
      expect(createQuestRender.result.current.currentStep).toBe("create_quest");
      expect(createQuestRender.result.current.currentSubstep).toBe("submit_create_quest");
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("task-added", {
          detail: {
            taskDate: "2026-04-04",
            scheduledTime: "10:30",
          },
        })
      );
    });

    await waitFor(() => {
      expect(mocks.state.awardCustomXP).toHaveBeenCalledWith(
        3,
        "guided_tutorial_step_complete",
        undefined,
        expect.objectContaining({
          guided_step: "create_quest",
          source: "guided_tutorial",
        }),
      );
    });

    createQuestRender.unmount();

    mocks.state.guidedTutorial = {
      version: 2,
      eligible: true,
      completed: false,
      completedSteps: ["quests_campaigns_intro", "create_quest"],
      xpAwardedSteps: ["create_quest"],
      milestonesCompleted: ["mentor_intro_hello"],
    };

    const morningCheckInRender = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/mentor"),
    });

    await waitFor(() => {
      expect(morningCheckInRender.result.current.currentStep).toBe("morning_checkin");
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("morning-checkin-completed"));
    });

    await waitFor(() => {
      expect(mocks.state.awardCustomXP).toHaveBeenNthCalledWith(
        2,
        3,
        "guided_tutorial_step_complete",
        undefined,
        expect.objectContaining({
          guided_step: "morning_checkin",
          source: "guided_tutorial",
        }),
      );
    });

    expect(
      mocks.state.awardCustomXP.mock.calls.map(([xpAmount]) => xpAmount)
    ).toEqual([3, 3]);
  });

  it("falls back to an add-quest launcher when submit_create_quest loses the sheet target, then reselects the create button when it returns", async () => {
    mocks.state.guidedTutorial = {
      version: 2,
      eligible: true,
      completed: false,
      completedSteps: ["quests_campaigns_intro"],
      xpAwardedSteps: [],
      milestonesCompleted: ["mentor_intro_hello", "quests_campaigns_intro"],
      substeps: {
        create_quest: {
          current: "submit_create_quest",
          completed: ["open_add_quest", "enter_title", "select_time"],
        },
      },
    };

    const launcher = document.createElement("button");
    launcher.setAttribute("data-tour", "add-quest-launcher");
    document.body.appendChild(launcher);

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/journeys"),
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("create_quest");
      expect(result.current.currentSubstep).toBe("submit_create_quest");
      expect(result.current.activeTargetSelectors).toEqual([
        '[data-tour="add-quest-create-button"]',
        '[data-tour="add-quest-fab"]',
        '[data-tour="add-quest-launcher"]',
      ]);
      expect(result.current.activeTargetSelector).toBe('[data-tour="add-quest-launcher"]');
    });

    const createButton = document.createElement("button");
    createButton.setAttribute("data-tour", "add-quest-create-button");
    document.body.appendChild(createButton);

    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(result.current.activeTargetSelector).toBe('[data-tour="add-quest-create-button"]');
    });
  });

  it("enables temporary hiding only during in-flight evolution milestone", async () => {
    mocks.state.guidedTutorial = {
      version: 2,
      eligible: true,
      completed: false,
      completedSteps: ["create_quest", "meet_companion", "morning_checkin", "companion_tab_intro"],
      xpAwardedSteps: [],
      milestonesCompleted: ["mentor_intro_hello", "companion_tab_intro"],
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

  it("uses sage voice for the intro hello", async () => {
    mocks.state.personality = {
      name: "The Sage",
      slug: "sage",
      tone: "Wise",
      style: "",
      primary_color: "#f59e0b",
    };

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/mentor"),
    });

    await waitFor(() => {
      expect(result.current.dialogueText).toContain("I'm The Sage");
    });
  });

  it("uses princess voice for the intro hello", async () => {
    mocks.state.personality = {
      name: "The Princess",
      slug: "princess",
      tone: "Supportive",
      style: "",
      primary_color: "#f59e0b",
    };

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/mentor"),
    });

    await waitFor(() => {
      expect(result.current.dialogueText).toContain("I'm The Princess");
    });
  });

  it.each([
    { name: "The Sage", slug: "sage", tone: "Wise" },
    { name: "The Icon", slug: "icon", tone: "Composed" },
    { name: "Charles", slug: "charles", tone: "Direct" },
    { name: "The Princess", slug: "princess", tone: "Empathetic" },
    { name: "The Operator", slug: "operator", tone: "Direct" },
    { name: "The Rival", slug: "rival", tone: "Tough" },
  ])(
    "uses shared quests intro voice for $slug",
    async ({ name, slug, tone }) => {
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
      storageMocks.safeLocalStorage.removeItem("guided_tutorial_progress_user-1");

      const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
        wrapper: createWrapper("/journeys"),
      });

      await waitFor(() => {
        expect(result.current.currentStep).toBe("quests_campaigns_intro");
        expect(result.current.dialogueText).toContain("daily to-do list");
        expect(result.current.dialogueText.toLowerCase()).toContain("schedule");
        expect(result.current.dialogueSupportText?.toLowerCase()).toContain("routines");
      });
    }
  );

  it("uses different mentor-specific intro copy while keeping shared quests copy", async () => {
    storageMocks.safeLocalStorage.removeItem("guided_tutorial_progress_user-1");

    mocks.state.personality = {
      name: "The Sage",
      slug: "sage",
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
      expect(atlasIntroText).toContain("I'm The Sage");
    });
    unmountAtlasIntro();

    storageMocks.safeLocalStorage.removeItem("guided_tutorial_progress_user-1");
    mocks.state.personality = {
      name: "The Operator",
      slug: "operator",
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
      expect(strykerIntroText).toContain("We're building a system");
    });
    unmountStrykerIntro();

    expect(atlasIntroText).not.toEqual(strykerIntroText);

    storageMocks.safeLocalStorage.removeItem("guided_tutorial_progress_user-1");
    mocks.state.personality = {
      name: "The Sage",
      slug: "sage",
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
      expect(atlasQuestsText).toContain("daily to-do list");
    });
    unmountAtlasQuests();

    storageMocks.safeLocalStorage.removeItem("guided_tutorial_progress_user-1");
    mocks.state.personality = {
      name: "The Operator",
      slug: "operator",
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
      expect(strykerQuestsText).toContain("daily to-do list");
    });

    expect(atlasQuestsText).toEqual(strykerQuestsText);
  });

  it("returns no support text for open mentor milestone copy", async () => {
    mocks.state.guidedTutorial = {
      version: 2,
      eligible: true,
      completed: false,
      completedSteps: ["quests_campaigns_intro", "create_quest"],
      xpAwardedSteps: [],
      milestonesCompleted: ["mentor_intro_hello"],
    };

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/profile"),
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("morning_checkin");
      expect(result.current.dialogueText).toBe("Open Guide.");
      expect(result.current.dialogueSupportText).toBeUndefined();
    });
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

  it("dismisses an in-progress tutorial and persists the dismissed state", async () => {
    mocks.state.guidedTutorial = {
      version: 2,
      flowVersion: 3,
      eligible: true,
      dismissed: false,
      completed: false,
      completedSteps: [],
      xpAwardedSteps: [],
      milestonesCompleted: ["mentor_intro_hello"],
    };

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/journeys"),
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
      expect(result.current.currentStep).toBe("quests_campaigns_intro");
      expect(result.current.secondaryActionLabel).toBe("Skip tutorial");
      expect(result.current.onSecondaryAction).toBeDefined();
    });

    await act(async () => {
      result.current.onSecondaryAction?.();
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(false);
      expect(result.current.currentStep).toBe(null);
      expect(result.current.secondaryActionLabel).toBeUndefined();
      expect(result.current.dialogueText).toBe("");
    });

    const latestPayload = mocks.state.profileUpdatePayloads.at(-1) as
      | { onboarding_data?: { guided_tutorial?: { dismissed?: boolean; completed?: boolean } } }
      | undefined;
    expect(latestPayload?.onboarding_data?.guided_tutorial?.dismissed).toBe(true);
    expect(latestPayload?.onboarding_data?.guided_tutorial?.completed).toBe(false);
  });

  it("completes the final closeout step from the secondary action", async () => {
    mocks.state.guidedTutorial = createCloseoutTutorial();

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/companion"),
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
      expect(result.current.currentStep).toBe("mentor_closeout");
      expect(result.current.secondaryActionLabel).toBe("Complete tutorial");
      expect(result.current.onSecondaryAction).toBeDefined();
    });

    await act(async () => {
      result.current.onSecondaryAction?.();
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(false);
      expect(result.current.currentStep).toBe(null);
      expect(result.current.secondaryActionLabel).toBeUndefined();
    });

    const latestPayload = mocks.state.profileUpdatePayloads.at(-1) as
      | {
          onboarding_data?: {
            guided_tutorial?: {
              dismissed?: boolean;
              completed?: boolean;
              completedSteps?: string[];
            };
          };
        }
      | undefined;
    expect(latestPayload?.onboarding_data?.guided_tutorial?.completed).toBe(true);
    expect(latestPayload?.onboarding_data?.guided_tutorial?.completedSteps).toContain(
      "mentor_closeout"
    );
    expect(latestPayload?.onboarding_data?.guided_tutorial?.dismissed).not.toBe(true);
  });

  it("auto-completes the closeout step after the fallback timeout", async () => {
    vi.useFakeTimers();
    try {
      mocks.state.guidedTutorial = createCloseoutTutorial();

      const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
        wrapper: createWrapper("/companion"),
      });

      expect(result.current.currentStep).toBe("mentor_closeout");
      expect(result.current.secondaryActionLabel).toBe("Complete tutorial");

      await act(async () => {
        vi.advanceTimersByTime(2600);
        await Promise.resolve();
      });

      expect(result.current.currentStep).toBe(null);
      expect(result.current.isActive).toBe(false);

      const latestPayload = mocks.state.profileUpdatePayloads.at(-1) as
        | {
            onboarding_data?: {
              guided_tutorial?: {
                completed?: boolean;
                completedSteps?: string[];
              };
            };
          }
        | undefined;
      expect(latestPayload?.onboarding_data?.guided_tutorial?.completed).toBe(true);
      expect(latestPayload?.onboarding_data?.guided_tutorial?.completedSteps).toContain(
        "mentor_closeout"
      );
    } finally {
      vi.useRealTimers();
    }
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
