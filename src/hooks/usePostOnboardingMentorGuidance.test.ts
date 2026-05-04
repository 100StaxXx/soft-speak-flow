import { act, renderHook, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createFreshTutorial = () => ({
  version: 2,
  flowVersion: 9,
  eligible: true,
  dismissed: false,
  completed: false,
  completedSteps: [] as string[],
  xpAwardedSteps: [] as string[],
  milestonesCompleted: [] as string[],
});

const mocks = vi.hoisted(() => ({
  state: {
    user: { id: "user-1" } as { id: string } | null,
    profileLoading: false,
    guidedTutorial: {
      version: 2,
      flowVersion: 9,
      eligible: true,
      dismissed: false,
      completed: false,
      completedSteps: [],
      xpAwardedSteps: [],
      milestonesCompleted: [],
    } as Record<string, unknown> | null,
    profileUpdatePayloads: [] as Array<Record<string, unknown>>,
    queryClient: {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
      refetchQueries: vi.fn().mockResolvedValue(undefined),
      fetchQuery: vi.fn().mockResolvedValue(null),
      getQueryData: vi.fn().mockReturnValue(null),
    },
    companionData: null as { current_stage: number } | null,
    companionDataUpdatedAt: 0,
    awardCustomXP: vi.fn().mockResolvedValue({ xpAwarded: 5 }),
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

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => mocks.state.queryClient,
    useQuery: () => ({
      data: mocks.state.companionData,
      dataUpdatedAt: mocks.state.companionDataUpdatedAt,
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
  MILESTONES_ALLOWING_TEMPORARY_HIDE,
  MILESTONES_AUTO_HIDDEN,
  PostOnboardingMentorGuidanceProvider,
  getMentorInstructionLines,
  milestoneUsesStrictLock,
  safeCompletedSteps,
  sanitizeCreateQuestProgress,
  shouldRestoreTutorialRoute,
  usePostOnboardingMentorGuidance,
} from "./usePostOnboardingMentorGuidance";

describe("guided tutorial helpers", () => {
  it("keeps current and legacy step ids safe for migration", () => {
    const result = safeCompletedSteps([
      "meet_companion",
      "new_goal",
      "plan_my_day",
      "hatch_companion",
      "first_plan_closeout",
      "create_quest",
      "invalid-step",
      42,
    ]);

    expect(result).toEqual([
      "meet_companion",
      "new_goal",
      "plan_my_day",
      "hatch_companion",
      "first_plan_closeout",
      "create_quest",
    ]);
  });

  it("keeps legacy create-quest substep ordering for old progress migration", () => {
    expect(CREATE_QUEST_SUBSTEP_ORDER).toEqual([
      "open_add_quest",
      "enter_title",
      "select_time",
      "submit_create_quest",
    ]);

    expect(
      sanitizeCreateQuestProgress({
        current: "stay_on_quests",
        completed: [
          "stay_on_quests",
          "invalid",
          "open_add_quest",
          "quests_campaigns_intro",
        ],
      }),
    ).toEqual({
      current: "enter_title",
      completed: ["open_add_quest"],
      startedAt: undefined,
      completedAt: undefined,
    });
  });

  it("returns the per-mentor step text for the active flow", () => {
    expect(getMentorInstructionLines("new_goal", null, "sage")[0]).toBe(
      "Tap 'New goal.'",
    );
    expect(getMentorInstructionLines("plan_my_day", null, "sage")[0]).toBe(
      "Tap 'Plan day.'",
    );
    expect(getMentorInstructionLines("hatch_companion", null, "sage")[0]).toBe(
      "Tap 'Hatch.'",
    );
    expect(getMentorInstructionLines("mentor_closeout", null, "sage")[0]).toBe(
      "Your Companion is here.",
    );
    expect(getMentorInstructionLines("mentor_closeout", null, "rival")[0]).toBe(
      "It hatched.",
    );

    expect(getMentorInstructionLines("new_goal", null, "rival")[0]).toBe(
      "Tap 'New goal.'",
    );

    // Unknown mentor falls back to sage
    expect(getMentorInstructionLines("plan_my_day", null, undefined)[0]).toBe(
      "Tap 'Plan day.'",
    );
  });

  it("strict-locks the actionable Plan day target in the new loop", () => {
    expect(milestoneUsesStrictLock("mentor_intro_hello")).toBe(false);
    expect(milestoneUsesStrictLock("start_new_goal")).toBe(true);
    expect(milestoneUsesStrictLock("complete_pathfinder_campaign")).toBe(true);
    expect(milestoneUsesStrictLock("start_plan_my_day")).toBe(true);
    expect(milestoneUsesStrictLock("answer_plan_day_ai")).toBe(false);
    expect(milestoneUsesStrictLock("save_plan_day_action")).toBe(true);
    expect(milestoneUsesStrictLock("tap_hatch_companion")).toBe(false);
    expect(milestoneUsesStrictLock("complete_companion_hatch")).toBe(false);
  });

  it("allows temporarily hiding the panel on planner milestones that occlude transcript content", () => {
    expect(
      MILESTONES_ALLOWING_TEMPORARY_HIDE.has("complete_companion_evolution"),
    ).toBe(true);
    expect(MILESTONES_ALLOWING_TEMPORARY_HIDE.has("start_new_goal")).toBe(true);
    expect(MILESTONES_ALLOWING_TEMPORARY_HIDE.has("complete_pathfinder_campaign")).toBe(true);
    expect(MILESTONES_ALLOWING_TEMPORARY_HIDE.has("start_plan_my_day")).toBe(true);
    expect(MILESTONES_ALLOWING_TEMPORARY_HIDE.has("answer_plan_day_ai")).toBe(true);
    expect(MILESTONES_ALLOWING_TEMPORARY_HIDE.has("tap_hatch_companion")).toBe(true);
    expect(MILESTONES_ALLOWING_TEMPORARY_HIDE.has("complete_companion_hatch")).toBe(true);
    expect(MILESTONES_ALLOWING_TEMPORARY_HIDE.has("mentor_intro_hello")).toBe(false);
    expect(MILESTONES_ALLOWING_TEMPORARY_HIDE.has("meet_companion_intro")).toBe(false);
  });

  it("auto-hides the card on milestones where the user is in a passive wait", () => {
    // The hatch wait is purely waiting on auto-progression; the card adds noise.
    expect(MILESTONES_AUTO_HIDDEN.has("complete_companion_hatch")).toBe(true);
    // The pre-hatch tap is still actionable, so it must keep showing the card.
    expect(MILESTONES_AUTO_HIDDEN.has("tap_hatch_companion")).toBe(false);
    expect(MILESTONES_AUTO_HIDDEN.has("start_new_goal")).toBe(false);
    expect(MILESTONES_AUTO_HIDDEN.has("mentor_intro_hello")).toBe(false);
  });

  it("restores current tutorial work to the active feature route", () => {
    expect(
      shouldRestoreTutorialRoute({
        pathname: "/companion",
        stepRoute: "/journeys",
        tutorialReady: true,
        tutorialComplete: false,
        currentStepId: "plan_my_day",
        evolutionInFlight: false,
      }),
    ).toBe(true);

    expect(
      shouldRestoreTutorialRoute({
        pathname: "/journeys",
        stepRoute: "/journeys",
        tutorialReady: true,
        tutorialComplete: false,
        currentStepId: "plan_my_day",
        evolutionInFlight: false,
      }),
    ).toBe(false);

    expect(
      shouldRestoreTutorialRoute({
        pathname: "/journeys",
        stepRoute: "/companion",
        tutorialReady: true,
        tutorialComplete: false,
        currentStepId: "hatch_companion",
        evolutionInFlight: true,
      }),
    ).toBe(false);
  });
});

describe("guided tutorial first-value loop", () => {
  beforeEach(() => {
    mocks.state.user = { id: "user-1" };
    mocks.state.profileLoading = false;
    mocks.state.guidedTutorial = createFreshTutorial();
    mocks.state.profileUpdatePayloads = [];
    mocks.state.queryClient.invalidateQueries.mockClear();
    mocks.state.queryClient.invalidateQueries.mockResolvedValue(undefined);
    mocks.state.queryClient.refetchQueries.mockClear();
    mocks.state.queryClient.refetchQueries.mockResolvedValue(undefined);
    mocks.state.queryClient.fetchQuery.mockClear();
    mocks.state.queryClient.fetchQuery.mockResolvedValue(null);
    mocks.state.queryClient.getQueryData.mockReturnValue(null);
    mocks.state.companionData = null;
    mocks.state.companionDataUpdatedAt = 0;
    mocks.state.awardCustomXP.mockClear();
    mocks.state.awardCustomXP.mockResolvedValue({ xpAwarded: 5 });
    mocks.state.personality = null;
    storageMocks.reset();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
      const element = this as HTMLElement;
      return element.matches("[data-tour], [data-planner-tour]")
        ? createRect()
        : createRect({ width: 0, height: 0 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document
      .querySelectorAll('[data-tour="companion-launcher-option-plan-day"], [data-tour="companion-plan-day-follow-up-option"], [data-tour="companion-plan-day-suggestion-save"], [data-tour="companion-plan-day-pending-confirm"], [data-tour="companion-plan-day-pending-confirm-all"]')
      .forEach((element) => element.remove());
    document
      .querySelectorAll('[data-tour="companion-launcher-option-goal"], [data-tour="pathfinder-primary-action"], [data-tour="evolve-companion-button"]')
      .forEach((element) => element.remove());
  });

  const createWrapper = (path = "/journeys") =>
    ({ children }: { children: ReactNode }) =>
      React.createElement(
        MemoryRouter,
        { initialEntries: [path] },
        React.createElement(PostOnboardingMentorGuidanceProvider, null, children),
      );

  it("starts with mentor intro, then points at New goal", async () => {
    const newGoalTarget = document.createElement("button");
    newGoalTarget.setAttribute("data-tour", "companion-launcher-option-goal");
    document.body.appendChild(newGoalTarget);

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isIntroDialogueActive).toBe(true);
      expect(result.current.currentStep).toBe("new_goal");
      expect(result.current.dialogueActionLabel).toBe("Start Tutorial");
    });

    await act(async () => {
      result.current.onDialogueAction?.();
    });

    await waitFor(() => {
      expect(result.current.isIntroDialogueActive).toBe(false);
      expect(result.current.currentStep).toBe("new_goal");
      expect(result.current.dialogueActionLabel).toBeUndefined();
      expect(result.current.dialogueText).toBe("Tap 'New goal.'");
      expect(result.current.activeTargetSelector).toBe(
        '[data-tour="companion-launcher-option-goal"]',
      );
    });
  });

  it("advances from Pathfinder campaign save through Plan day to hatch completion", async () => {
    const newGoalTarget = document.createElement("button");
    newGoalTarget.setAttribute("data-tour", "companion-launcher-option-goal");
    document.body.appendChild(newGoalTarget);
    const pathfinderTarget = document.createElement("button");
    pathfinderTarget.setAttribute("data-tour", "pathfinder-primary-action");
    document.body.appendChild(pathfinderTarget);
    const planTarget = document.createElement("button");
    planTarget.setAttribute("data-tour", "companion-launcher-option-plan-day");
    document.body.appendChild(planTarget);
    const answerTarget = document.createElement("button");
    answerTarget.setAttribute("data-tour", "companion-plan-day-follow-up-option");
    document.body.appendChild(answerTarget);
    const saveTarget = document.createElement("button");
    saveTarget.setAttribute("data-tour", "companion-plan-day-suggestion-save");
    document.body.appendChild(saveTarget);
    const hatchTarget = document.createElement("button");
    hatchTarget.setAttribute("data-tour", "evolve-companion-button");
    document.body.appendChild(hatchTarget);

    const { result, rerender } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.onDialogueAction?.();
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("new_goal");
      expect(result.current.dialogueText).toBe("Tap 'New goal.'");
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("companion-new-goal-started"));
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("new_goal");
      expect(result.current.dialogueText).toBe("Save the campaign.");
      expect(result.current.activeTargetSelector).toBe(
        '[data-tour="pathfinder-primary-action"]',
      );
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("campaign-created"));
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("plan_my_day");
      expect(result.current.activeTargetSelectors).toEqual([
        '[data-tour="companion-launcher-option-plan-day"]',
        '[data-planner-tour="companion-quick-actions"]',
      ]);
      expect(result.current.activeTargetSelector).toBe(
        '[data-tour="companion-launcher-option-plan-day"]',
      );
      expect(mocks.state.awardCustomXP).toHaveBeenCalledWith(
        5,
        "guided_tutorial_step_complete",
        undefined,
        expect.objectContaining({
          guided_step: "new_goal",
          source: "guided_tutorial",
        }),
      );
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("companion-plan-my-day-started"));
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("plan_my_day");
      expect(result.current.dialogueText).toBe("Tell it what you need.");
      expect(result.current.activeTargetSelectors).toEqual([
        '[data-tour="companion-plan-day-follow-up-option"]',
        '[data-tour="companion-plan-day-chat-input"]',
        '[data-tour="companion-plan-day-chat-send"]',
      ]);
      expect(result.current.activeTargetSelector).toBe(
        '[data-tour="companion-plan-day-follow-up-option"]',
      );
      expect(mocks.state.awardCustomXP).not.toHaveBeenCalledWith(
        5,
        "guided_tutorial_step_complete",
        undefined,
        expect.objectContaining({ guided_step: "plan_my_day" }),
      );
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("companion-plan-my-day-ai-answered"));
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("plan_my_day");
      expect(result.current.dialogueText).toBe("Save one quest.");
      expect(result.current.activeTargetSelectors).toEqual([
        '[data-tour="companion-plan-day-pending-confirm"]',
        '[data-tour="companion-plan-day-pending-confirm-all"]',
        '[data-tour="companion-plan-day-suggestion-save"]',
      ]);
      expect(result.current.activeTargetSelector).toBe(
        '[data-tour="companion-plan-day-suggestion-save"]',
      );
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("companion-plan-my-day-action-saved"));
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("hatch_companion");
      expect(result.current.stepRoute).toBe("/companion");
      expect(mocks.state.awardCustomXP).toHaveBeenCalledWith(
        5,
        "guided_tutorial_step_complete",
        undefined,
        expect.objectContaining({
          guided_step: "plan_my_day",
          source: "guided_tutorial",
        }),
      );
      expect(mocks.state.queryClient.fetchQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ["companion", "user-1"],
          queryFn: expect.any(Function),
        }),
      );
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("companion-hatch-started"));
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("hatch_companion");
      expect(result.current.dialogueText).toBe("Let the hatch finish.");
      expect(result.current.shouldAutoHideCard).toBe(true);
    });

    await act(async () => {
      mocks.state.companionData = { current_stage: 1 };
      mocks.state.companionDataUpdatedAt = 2;
      window.dispatchEvent(new CustomEvent("companion-evolved"));
      rerender();
    });

    await waitFor(() => {
      expect(mocks.state.queryClient.refetchQueries).toHaveBeenCalled();
      expect(result.current.currentStep).toBe("mentor_closeout");
      expect(result.current.dialogueText).toBe("Your Companion is here.");
      expect(result.current.dialogueActionLabel).toBe("Finish");
      expect(result.current.isPreHatchCompanionStep).toBe(false);
    });

    await act(async () => {
      result.current.onDialogueAction?.();
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(false);
      expect(result.current.currentStep).toBeNull();
    });
  });

  it("holds on hatch_companion while the visual hatch animation is still playing", async () => {
    // The hatch RPC resolves and refetches companion data with stage=1 long
    // before the ~12s visual animation finishes. The mentor must stay hidden
    // until companion-evolved fires; otherwise the closeout dialogue overlays
    // the HATCHING gradient mid-animation.
    mocks.state.guidedTutorial = {
      ...createFreshTutorial(),
      completedSteps: ["new_goal", "plan_my_day"],
      xpAwardedSteps: ["new_goal", "plan_my_day"],
      milestonesCompleted: [
        "mentor_intro_hello",
        "start_new_goal",
        "complete_pathfinder_campaign",
        "start_plan_my_day",
        "answer_plan_day_ai",
        "save_plan_day_action",
      ],
    };
    const hatchTarget = document.createElement("button");
    hatchTarget.setAttribute("data-tour", "evolve-companion-button");
    document.body.appendChild(hatchTarget);

    const { result, rerender } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/companion"),
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("hatch_companion");
    });

    // User taps Hatch — the visual animation begins, sessionEvolutionInFlight=true.
    await act(async () => {
      window.dispatchEvent(new CustomEvent("companion-hatch-started"));
    });

    await waitFor(() => {
      expect(result.current.dialogueText).toBe("Let the hatch finish.");
      expect(result.current.shouldAutoHideCard).toBe(true);
    });

    // Companion data refetches with stage=1 mid-animation. The step must NOT
    // advance — visualAnimationActive is still true.
    await act(async () => {
      mocks.state.companionData = { current_stage: 1 };
      mocks.state.companionDataUpdatedAt = 2;
      rerender();
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("hatch_companion");
      expect(result.current.shouldAutoHideCard).toBe(true);
    });

    // Visual animation completes — companion-evolved releases the gate.
    await act(async () => {
      window.dispatchEvent(new CustomEvent("companion-evolved"));
      rerender();
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("mentor_closeout");
    });
  });

  it("recovers from a stale persisted evolutionInFlight on cold reopen", async () => {
    // If the user closes the app mid-animation, persistedEvolutionInFlight
    // stays true but no companion-evolved event will fire next session.
    // sessionEvolutionInFlight starts at null, so visualAnimationActive is
    // false and the step is allowed to advance once data confirms the hatch.
    mocks.state.guidedTutorial = {
      ...createFreshTutorial(),
      completedSteps: ["new_goal", "plan_my_day"],
      xpAwardedSteps: ["new_goal", "plan_my_day"],
      milestonesCompleted: [
        "mentor_intro_hello",
        "start_new_goal",
        "complete_pathfinder_campaign",
        "start_plan_my_day",
        "answer_plan_day_ai",
        "save_plan_day_action",
        "tap_hatch_companion",
      ],
      evolutionInFlight: true,
      evolutionStartedAt: "2026-05-04T00:00:00.000Z",
    };
    mocks.state.companionData = { current_stage: 1 };
    mocks.state.companionDataUpdatedAt = 100;
    const hatchTarget = document.createElement("button");
    hatchTarget.setAttribute("data-tour", "evolve-companion-button");
    document.body.appendChild(hatchTarget);

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/companion"),
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("mentor_closeout");
    });
  });

  it("does not complete or route from Plan day until tutorial XP is actually awarded", async () => {
    mocks.state.guidedTutorial = {
      ...createFreshTutorial(),
      completedSteps: ["new_goal"],
      xpAwardedSteps: ["new_goal"],
      milestonesCompleted: [
        "mentor_intro_hello",
        "start_new_goal",
        "complete_pathfinder_campaign",
      ],
    };
    mocks.state.awardCustomXP.mockResolvedValue(undefined);
    const planTarget = document.createElement("button");
    planTarget.setAttribute("data-tour", "companion-launcher-option-plan-day");
    document.body.appendChild(planTarget);
    const saveTarget = document.createElement("button");
    saveTarget.setAttribute("data-tour", "companion-plan-day-suggestion-save");
    document.body.appendChild(saveTarget);

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("plan_my_day");
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("companion-plan-my-day-action-saved"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mocks.state.awardCustomXP).toHaveBeenCalledWith(
        5,
        "guided_tutorial_step_complete",
        undefined,
        expect.objectContaining({
          guided_step: "plan_my_day",
          source: "guided_tutorial",
        }),
      );
    });
    expect(result.current.currentStep).toBe("plan_my_day");
    expect(mocks.state.queryClient.fetchQuery).not.toHaveBeenCalled();
    expect(
      mocks.state.profileUpdatePayloads.some((payload) => {
        const guidedTutorial = (
          payload.onboarding_data as { guided_tutorial?: { completedSteps?: string[]; xpAwardedSteps?: string[] } } | undefined
        )?.guided_tutorial;
        return (
          guidedTutorial?.completedSteps?.includes("plan_my_day") ||
          guidedTutorial?.xpAwardedSteps?.includes("plan_my_day")
        );
      }),
    ).toBe(false);
  });

  it("can skip the in-progress first-value tutorial", async () => {
    mocks.state.guidedTutorial = {
      ...createFreshTutorial(),
      milestonesCompleted: ["mentor_intro_hello"],
    };

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("new_goal");
      expect(result.current.secondaryActionLabel).toBe("Skip tutorial");
    });

    await act(async () => {
      result.current.onSecondaryAction?.();
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBeNull();
      expect(result.current.isActive).toBe(false);
    });

    const latestPayload = mocks.state.profileUpdatePayloads.at(-1) as
      | { onboarding_data?: { guided_tutorial?: { dismissed?: boolean } } }
      | undefined;
    expect(latestPayload?.onboarding_data?.guided_tutorial?.dismissed).toBe(
      true,
    );
  });

  it("stops forcing pre-hatch companion display after skipping on the hatch step", async () => {
    mocks.state.guidedTutorial = {
      ...createFreshTutorial(),
      completedSteps: ["new_goal", "plan_my_day"],
      xpAwardedSteps: ["new_goal", "plan_my_day"],
      milestonesCompleted: [
        "mentor_intro_hello",
        "start_new_goal",
        "complete_pathfinder_campaign",
        "start_plan_my_day",
        "answer_plan_day_ai",
        "save_plan_day_action",
      ],
    };
    const hatchTarget = document.createElement("button");
    hatchTarget.setAttribute("data-tour", "evolve-companion-button");
    document.body.appendChild(hatchTarget);

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/companion"),
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("hatch_companion");
      expect(result.current.isPreHatchCompanionStep).toBe(true);
    });

    await act(async () => {
      result.current.onSecondaryAction?.();
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBeNull();
      expect(result.current.isActive).toBe(false);
      expect(result.current.isPreHatchCompanionStep).toBe(false);
    });
  });

  it("keeps completed old tutorial state completed after migration", async () => {
    mocks.state.guidedTutorial = {
      version: 2,
      eligible: true,
      completed: true,
      completedSteps: ["create_quest", "morning_checkin", "mentor_closeout"],
      xpAwardedSteps: ["create_quest", "morning_checkin"],
      milestonesCompleted: ["mentor_closeout_message"],
    };

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(false);
      expect(result.current.currentStep).toBeNull();
      expect(result.current.dialogueText).toBe("");
    });
  });
});
