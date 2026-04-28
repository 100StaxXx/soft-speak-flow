import { act, renderHook, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  state: {
    user: { id: "user-1" } as { id: string } | null,
    profileLoading: false,
    guidedTutorial: {
      version: 2,
      flowVersion: 7,
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
  MILESTONES_ALLOWING_TEMPORARY_HIDE,
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
      "plan_my_day",
      "create_campaign",
      "first_plan_closeout",
      "create_quest",
      "invalid-step",
      42,
    ]);

    expect(result).toEqual([
      "meet_companion",
      "plan_my_day",
      "create_campaign",
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

  it("describes the new companion plus Plan My Day and campaign tutorial", () => {
    expect(getMentorInstructionLines("meet_companion", null)[0]).toContain(
      "companion is already created",
    );
    expect(getMentorInstructionLines("plan_my_day", null)[0]).toContain(
      "Plan day",
    );
    expect(getMentorInstructionLines("create_campaign", null)[0]).toContain(
      "New goal",
    );
    expect(
      getMentorInstructionLines("first_plan_closeout", null)[0],
    ).toContain("New goal");
  });

  it("strict-locks the actionable Plan day and New goal targets in the new loop", () => {
    expect(milestoneUsesStrictLock("mentor_intro_hello")).toBe(false);
    expect(milestoneUsesStrictLock("meet_companion_intro")).toBe(false);
    expect(milestoneUsesStrictLock("start_plan_my_day")).toBe(true);
    expect(milestoneUsesStrictLock("answer_plan_day_ai")).toBe(false);
    expect(milestoneUsesStrictLock("save_plan_day_action")).toBe(true);
    expect(milestoneUsesStrictLock("open_new_goal_from_fab")).toBe(true);
    expect(milestoneUsesStrictLock("complete_campaign_creation")).toBe(true);
    expect(milestoneUsesStrictLock("first_plan_closeout_message")).toBe(false);
  });

  it("allows temporarily hiding the panel on planner milestones that occlude transcript content", () => {
    expect(
      MILESTONES_ALLOWING_TEMPORARY_HIDE.has("complete_companion_evolution"),
    ).toBe(true);
    expect(MILESTONES_ALLOWING_TEMPORARY_HIDE.has("start_plan_my_day")).toBe(true);
    expect(MILESTONES_ALLOWING_TEMPORARY_HIDE.has("answer_plan_day_ai")).toBe(true);
    expect(MILESTONES_ALLOWING_TEMPORARY_HIDE.has("save_plan_day_action")).toBe(true);
    expect(
      MILESTONES_ALLOWING_TEMPORARY_HIDE.has("first_plan_closeout_message"),
    ).toBe(true);
    expect(MILESTONES_ALLOWING_TEMPORARY_HIDE.has("mentor_intro_hello")).toBe(false);
    expect(MILESTONES_ALLOWING_TEMPORARY_HIDE.has("meet_companion_intro")).toBe(false);
    expect(MILESTONES_ALLOWING_TEMPORARY_HIDE.has("open_new_goal_from_fab")).toBe(false);
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
    mocks.state.queryClient.getQueryData.mockReturnValue(null);
    mocks.state.awardCustomXP.mockClear();
    mocks.state.awardCustomXP.mockResolvedValue(undefined);
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
      .querySelectorAll('[data-tour="companion-launcher-option-plan-day"], [data-tour="companion-plan-day-follow-up-option"], [data-tour="companion-plan-day-suggestion-save"], [data-tour="companion-plan-day-pending-confirm"], [data-tour="companion-plan-day-pending-confirm-all"], [data-tour="companion-launcher-option-goal"], [data-tour="pathfinder-campaign-builder"]')
      .forEach((element) => element.remove());
  });

  const createWrapper = (path = "/companion") =>
    ({ children }: { children: ReactNode }) =>
      React.createElement(
        MemoryRouter,
        { initialEntries: [path] },
        React.createElement(PostOnboardingMentorGuidanceProvider, null, children),
      );

  it("starts with mentor intro, then meets the existing companion", async () => {
    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isIntroDialogueActive).toBe(true);
      expect(result.current.currentStep).toBe("meet_companion");
      expect(result.current.dialogueActionLabel).toBe("Start Tutorial");
    });

    await act(async () => {
      result.current.onDialogueAction?.();
    });

    await waitFor(() => {
      expect(result.current.isIntroDialogueActive).toBe(false);
      expect(result.current.currentStep).toBe("meet_companion");
      expect(result.current.dialogueActionLabel).toBe("Continue");
      expect(result.current.dialogueText).toContain("This is your Companion");
    });
  });

  it("advances from companion intro to Plan day, New goal, campaign creation, and then closeout", async () => {
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

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.onDialogueAction?.();
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("meet_companion");
      expect(result.current.dialogueActionLabel).toBe("Continue");
    });

    await act(async () => {
      result.current.onDialogueAction?.();
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
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("companion-plan-my-day-started"));
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("plan_my_day");
      expect(result.current.dialogueText).toContain("Answer your companion");
      expect(result.current.activeTargetSelectors).toEqual([
        '[data-tour="companion-plan-day-follow-up-option"]',
        '[data-tour="companion-plan-day-chat-input"]',
        '[data-tour="companion-plan-day-chat-send"]',
      ]);
      expect(result.current.activeTargetSelector).toBe(
        '[data-tour="companion-plan-day-follow-up-option"]',
      );
      expect(mocks.state.awardCustomXP).not.toHaveBeenCalled();
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("companion-plan-my-day-ai-answered"));
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("plan_my_day");
      expect(result.current.dialogueText).toContain("Save one suggested quest");
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
      expect(result.current.currentStep).toBe("create_campaign");
      expect(result.current.activeTargetSelectors).toEqual([
        '[data-tour="companion-launcher-option-goal"]',
        '[data-planner-tour="companion-quick-actions"]',
      ]);
      expect(result.current.activeTargetSelector).toBe(
        '[data-tour="companion-launcher-option-goal"]',
      );
      expect(mocks.state.awardCustomXP).toHaveBeenCalledWith(
        3,
        "guided_tutorial_step_complete",
        undefined,
        expect.objectContaining({
          guided_step: "plan_my_day",
          source: "guided_tutorial",
        }),
      );
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("companion-new-goal-started"));
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("create_campaign");
      expect(result.current.activeTargetSelectors).toEqual([
        '[data-tour="pathfinder-campaign-builder"]',
        '[data-tour="companion-launcher-option-goal"]',
        '[data-planner-tour="companion-quick-actions"]',
      ]);
      expect(result.current.activeTargetSelector).toBe(
        '[data-tour="pathfinder-campaign-builder"]',
      );
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("campaign-created"));
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("first_plan_closeout");
      expect(result.current.dialogueActionLabel).toBe("Finish");
    });

    await act(async () => {
      result.current.onDialogueAction?.();
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(false);
      expect(result.current.currentStep).toBeNull();
    });
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
      expect(result.current.currentStep).toBe("meet_companion");
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
