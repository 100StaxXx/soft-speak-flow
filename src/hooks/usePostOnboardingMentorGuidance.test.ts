import { act, renderHook, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createFreshTutorial = () => ({
  version: 2,
  flowVersion: 11,
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
      flowVersion: 11,
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
    awardCustomXP: vi.fn().mockImplementation(async (amount: number) => ({ xpAwarded: amount })),
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
    expect(getMentorInstructionLines("morning_checkin", null, "sage")[0]).toBe(
      "Open today's reflection, then mark your prayer complete.",
    );
    expect(getMentorInstructionLines("hatch_companion", null, "sage")[0]).toBe(
      "Scroll down and tap 'Hatch.'",
    );

    expect(getMentorInstructionLines("morning_checkin", null, "rival")[0]).toBe(
      "Open today's reflection, then mark your prayer complete.",
    );
  });

  it("strict-locks only the direct action targets in the new loop", () => {
    expect(milestoneUsesStrictLock("mentor_intro_hello")).toBe(false);
    expect(milestoneUsesStrictLock("submit_morning_checkin")).toBe(false);
    expect(milestoneUsesStrictLock("tap_hatch_companion")).toBe(false);
    expect(milestoneUsesStrictLock("complete_companion_hatch")).toBe(false);
  });

  it("restores current tutorial work to the active feature route", () => {
    expect(
      shouldRestoreTutorialRoute({
        pathname: "/companion",
        stepRoute: "/mentor",
        tutorialReady: true,
        tutorialComplete: false,
        currentStepId: "morning_checkin",
        evolutionInFlight: false,
      }),
    ).toBe(true);

    expect(
      shouldRestoreTutorialRoute({
        pathname: "/mentor",
        stepRoute: "/mentor",
        tutorialReady: true,
        tutorialComplete: false,
        currentStepId: "morning_checkin",
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
    mocks.state.awardCustomXP.mockImplementation(async (amount: number) => ({ xpAwarded: amount }));
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
      .querySelectorAll('[data-tour="campaign-builder-launcher"], [data-tour="companion-launcher-option-goal"], [data-tour="pathfinder-primary-action"], [data-tour="evolve-companion-button"], [data-tour="morning-prayer-open"], [data-tour="morning-prayer-complete"]')
      .forEach((element) => element.remove());
    document
      .querySelectorAll('[data-planner-tour="companion-quick-actions"]')
      .forEach((element) => element.remove());
  });

  const createWrapper = (path = "/mentor") =>
    ({ children }: { children: ReactNode }) =>
      React.createElement(
        MemoryRouter,
        { initialEntries: [path] },
        React.createElement(PostOnboardingMentorGuidanceProvider, null, children),
      );

  it("starts with mentor intro, then points at today's prayer", async () => {
    const prayerTarget = document.createElement("button");
    prayerTarget.setAttribute("data-tour", "morning-prayer-open");
    document.body.appendChild(prayerTarget);

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isIntroDialogueActive).toBe(true);
      expect(result.current.currentStep).toBe("morning_checkin");
      expect(result.current.dialogueActionLabel).toBe("Start Tutorial");
    });

    await act(async () => {
      result.current.onDialogueAction?.();
    });

    await waitFor(() => {
      expect(result.current.isIntroDialogueActive).toBe(false);
      expect(result.current.currentStep).toBe("morning_checkin");
      expect(result.current.dialogueActionLabel).toBeUndefined();
      expect(result.current.dialogueText).toBe("Open today's reflection.");
      expect(result.current.activeTargetSelector).toBe(
        '[data-tour="morning-prayer-open"]',
      );
    });
  });

  it("moves the prayer spotlight from opening the reflection to completing it", async () => {
    const prayerOpenTarget = document.createElement("button");
    prayerOpenTarget.setAttribute("data-tour", "morning-prayer-open");
    document.body.appendChild(prayerOpenTarget);

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.onDialogueAction?.();
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("morning_checkin");
      expect(result.current.activeTargetSelector).toBe(
        '[data-tour="morning-prayer-open"]',
      );
      expect(result.current.dialogueText).toBe("Open today's reflection.");
    });

    const prayerCompleteTarget = document.createElement("button");
    prayerCompleteTarget.setAttribute("data-tour", "morning-prayer-complete");
    document.body.appendChild(prayerCompleteTarget);

    await waitFor(() => {
      expect(result.current.activeTargetSelector).toBe(
        '[data-tour="morning-prayer-complete"]',
      );
      expect(result.current.dialogueText).toBe("Mark your prayer complete.");
    });
  });

  it("hands the user from prayer to hatch and then the final closeout", async () => {
    const prayerTarget = document.createElement("button");
    prayerTarget.setAttribute("data-tour", "morning-prayer-complete");
    document.body.appendChild(prayerTarget);
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
      expect(result.current.currentStep).toBe("morning_checkin");
      expect(result.current.dialogueText).toBe("Mark your prayer complete.");
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("morning-checkin-completed"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("hatch_companion");
      expect(result.current.stepRoute).toBe("/companion");
      expect(result.current.dialogueText).toBe("Scroll down and tap 'Hatch.'");
      expect(result.current.activeTargetSelectors).toEqual([
        '[data-tour="evolve-companion-button"]',
      ]);
      expect(result.current.activeTargetSelector).toBe(
        '[data-tour="evolve-companion-button"]',
      );
      expect(mocks.state.awardCustomXP).not.toHaveBeenCalledWith(
        10,
        "guided_tutorial_step_complete",
        undefined,
        expect.objectContaining({
          guided_step: "morning_checkin",
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
      expect(result.current.isActive).toBe(true);
      expect(result.current.currentStep).toBe("hatch_companion");
      expect(result.current.dialogueText).toBe("Your Companion is hatching.");
      expect(result.current.dialogueSupportText).toBe(
        "This can take a few minutes. You can come back when the reveal is ready.",
      );
      expect(result.current.dialogueActionLabel).toBe("Dismiss");
    });

    await act(async () => {
      result.current.onDialogueAction?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(false);
      expect(result.current.currentStep).toBeNull();
      expect(result.current.dialogueText).toBe("");
    });

    await act(async () => {
      mocks.state.companionData = { current_stage: 1 };
      mocks.state.companionDataUpdatedAt = 2;
      window.dispatchEvent(new CustomEvent("companion-evolved"));
      rerender();
    });

    await waitFor(() => {
      expect(mocks.state.queryClient.refetchQueries).toHaveBeenCalled();
      expect(result.current.isActive).toBe(true);
      expect(result.current.currentStep).toBe("mentor_closeout");
      expect(result.current.dialogueText).toBe("You're ready.");
      expect(result.current.dialogueSupportText).toBe(
        "Your Companion is awake, your first prayer is complete, and today has somewhere to go.",
      );
      expect(result.current.dialogueActionLabel).toBe("Start my journey");
    });

    expect(
      mocks.state.profileUpdatePayloads.some((payload) => {
        const guidedTutorial = (
          payload.onboarding_data as { guided_tutorial?: { completed?: boolean } } | undefined
        )?.guided_tutorial;
        return guidedTutorial?.completed === true;
      }),
    ).toBe(false);

    await act(async () => {
      result.current.onDialogueAction?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(false);
      expect(result.current.currentStep).toBeNull();
    });
  });

  it("dismisses only the hatch waiting notice, then shows mentor closeout after reveal dismissal", async () => {
    mocks.state.guidedTutorial = {
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
    mocks.state.companionData = { current_stage: 0 };
    mocks.state.companionDataUpdatedAt = 1;

    const { result, rerender } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/companion"),
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
      expect(result.current.currentStep).toBe("hatch_companion");
      expect(result.current.dialogueText).toBe("Your Companion is hatching.");
      expect(result.current.dialogueSupportText).toBe(
        "This can take a few minutes. You can come back when the reveal is ready.",
      );
      expect(result.current.dialogueActionLabel).toBe("Dismiss");
    });

    await act(async () => {
      result.current.onDialogueAction?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(false);
      expect(result.current.currentStep).toBeNull();
      expect(result.current.dialogueText).toBe("");
      expect(
        mocks.state.profileUpdatePayloads.some((payload) => {
          const guidedTutorial = (
            payload.onboarding_data as
              | {
                  guided_tutorial?: {
                    hatchWaitingNoticeDismissedAt?: string;
                    completedSteps?: string[];
                    milestonesCompleted?: string[];
                  };
                }
              | undefined
          )?.guided_tutorial;
          return (
            typeof guidedTutorial?.hatchWaitingNoticeDismissedAt === "string" &&
            !guidedTutorial.completedSteps?.includes("hatch_companion") &&
            !guidedTutorial.milestonesCompleted?.includes("complete_companion_hatch")
          );
        }),
      ).toBe(true);
    });

    await act(async () => {
      mocks.state.companionData = { current_stage: 1 };
      mocks.state.companionDataUpdatedAt = 2;
      rerender();
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBeNull();
      expect(result.current.dialogueText).toBe("");
      expect(result.current.isActive).toBe(false);
    });

    expect(
      mocks.state.profileUpdatePayloads.some((payload) => {
        const guidedTutorial = (
          payload.onboarding_data as { guided_tutorial?: { completedSteps?: string[] } } | undefined
        )?.guided_tutorial;
        return guidedTutorial?.completedSteps?.includes("hatch_companion");
      }),
    ).toBe(false);

    await act(async () => {
      window.dispatchEvent(new CustomEvent("companion-evolved"));
      rerender();
    });

    await waitFor(() => {
      expect(mocks.state.queryClient.refetchQueries).toHaveBeenCalled();
      expect(result.current.isActive).toBe(true);
      expect(result.current.currentStep).toBe("mentor_closeout");
      expect(result.current.dialogueText).toBe("You're ready.");
      expect(result.current.dialogueActionLabel).toBe("Start my journey");
    });

    expect(
      mocks.state.profileUpdatePayloads.some((payload) => {
        const guidedTutorial = (
          payload.onboarding_data as { guided_tutorial?: { completed?: boolean } } | undefined
        )?.guided_tutorial;
        return guidedTutorial?.completed === true;
      }),
    ).toBe(false);

    await act(async () => {
      result.current.onDialogueAction?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(false);
      expect(result.current.currentStep).toBeNull();
    });
  });

  it("hands off to hatch without duplicating first-prayer XP", async () => {
    mocks.state.guidedTutorial = {
      ...createFreshTutorial(),
      milestonesCompleted: [
        "mentor_intro_hello",
        "open_mentor_tab",
      ],
    };
    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("morning_checkin");
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("morning-checkin-completed"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("hatch_companion");
    });
    expect(mocks.state.awardCustomXP).not.toHaveBeenCalledWith(
      10,
      "guided_tutorial_step_complete",
      undefined,
      expect.objectContaining({
        guided_step: "morning_checkin",
        source: "guided_tutorial",
      }),
    );
    expect(mocks.state.queryClient.fetchQuery).toHaveBeenCalled();
    expect(
      mocks.state.profileUpdatePayloads.some((payload) => {
        const guidedTutorial = (
          payload.onboarding_data as { guided_tutorial?: { completedSteps?: string[]; xpAwardedSteps?: string[] } } | undefined
        )?.guided_tutorial;
        return (
          guidedTutorial?.completedSteps?.includes("morning_checkin") &&
          !guidedTutorial?.xpAwardedSteps?.includes("morning_checkin")
        );
      }),
    ).toBe(true);
  });

  it("does not expose a skip action during the in-progress first-value tutorial", async () => {
    mocks.state.guidedTutorial = {
      ...createFreshTutorial(),
      milestonesCompleted: ["mentor_intro_hello"],
    };

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("morning_checkin");
      expect(result.current.secondaryActionLabel).toBeUndefined();
      expect(result.current.onSecondaryAction).toBeUndefined();
    });

    expect(
      mocks.state.profileUpdatePayloads.some((payload) => {
        const guidedTutorial = (
          payload.onboarding_data as { guided_tutorial?: { dismissed?: boolean; completed?: boolean } } | undefined
        )?.guided_tutorial;
        return guidedTutorial?.dismissed === true || guidedTutorial?.completed === true;
      }),
    ).toBe(false);
  });

  it("migrates legacy Plan day progress directly to companion hatch", async () => {
    mocks.state.guidedTutorial = {
      ...createFreshTutorial(),
      flowVersion: 9,
      completedSteps: ["new_goal", "plan_my_day"],
      milestonesCompleted: ["mentor_intro_hello", "start_plan_my_day", "save_plan_day_action"],
    };

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/companion"),
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("hatch_companion");
    });
  });

  it("shows mentor closeout as a guide card and persists completion from its CTA", async () => {
    mocks.state.guidedTutorial = {
      ...createFreshTutorial(),
      completedSteps: ["morning_checkin", "hatch_companion"],
      xpAwardedSteps: [],
      milestonesCompleted: [
        "mentor_intro_hello",
        "open_mentor_tab",
        "submit_morning_checkin",
        "tap_hatch_companion",
      ],
    };
    mocks.state.personality = {
      name: "Sage",
      slug: "sage",
      tone: "warm",
      style: "steady",
      primary_color: "#f59e0b",
    };

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/companion"),
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("mentor_closeout");
      expect(result.current.speakerName).toBe("Sage");
      expect(result.current.dialogueText).toBe("You're ready.");
      expect(result.current.dialogueSupportText).toBe(
        "Your Companion is awake, your first prayer is complete, and today has somewhere to go.",
      );
      expect(result.current.dialogueActionLabel).toBe("Start my journey");
    });

    expect(
      mocks.state.profileUpdatePayloads.some((payload) => {
        const guidedTutorial = (
          payload.onboarding_data as { guided_tutorial?: { completed?: boolean } } | undefined
        )?.guided_tutorial;
        return guidedTutorial?.completed === true;
      }),
    ).toBe(false);

    await act(async () => {
      result.current.onDialogueAction?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        mocks.state.profileUpdatePayloads.some((payload) => {
          const guidedTutorial = (
            payload.onboarding_data as {
              guided_tutorial?: {
                completed?: boolean;
                completedSteps?: string[];
                milestonesCompleted?: string[];
              };
            } | undefined
          )?.guided_tutorial;
          return (
            guidedTutorial?.completed === true &&
            guidedTutorial.completedSteps?.includes("mentor_closeout") &&
            guidedTutorial.milestonesCompleted?.includes("mentor_closeout_message")
          );
        }),
      ).toBe(true);
      expect(result.current.isActive).toBe(false);
      expect(result.current.currentStep).toBeNull();
    });
  });

  it("recovers current-flow bare completion to the final mentor closeout", async () => {
    mocks.state.guidedTutorial = {
      ...createFreshTutorial(),
      completed: true,
      completedAt: "2026-05-01T12:00:00.000Z",
      completedSteps: [],
      xpAwardedSteps: [],
      milestonesCompleted: [],
    };

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/companion"),
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
      expect(result.current.currentStep).toBe("mentor_closeout");
      expect(result.current.dialogueText).toBe("You're ready.");
      expect(result.current.dialogueActionLabel).toBe("Start my journey");
    });

    await waitFor(() => {
      expect(
        mocks.state.profileUpdatePayloads.some((payload) => {
          const guidedTutorial = (
            payload.onboarding_data as {
              guided_tutorial?: {
                completed?: boolean;
                completedAt?: string;
                completedSteps?: string[];
                milestonesCompleted?: string[];
              };
            } | undefined
          )?.guided_tutorial;
          return (
            guidedTutorial?.completed === false &&
            guidedTutorial.completedAt === undefined &&
            guidedTutorial.completedSteps?.includes("morning_checkin") &&
            guidedTutorial.completedSteps?.includes("hatch_companion") &&
            !guidedTutorial.completedSteps?.includes("mentor_closeout") &&
            guidedTutorial.milestonesCompleted?.includes("mentor_intro_hello") &&
            guidedTutorial.milestonesCompleted?.includes("complete_companion_hatch") &&
            !guidedTutorial.milestonesCompleted?.includes("mentor_closeout_message")
          );
        }),
      ).toBe(true);
    });
  });

  it("honors persisted dismissal without forcing the pre-hatch companion display", async () => {
    mocks.state.guidedTutorial = {
      ...createFreshTutorial(),
      completedSteps: ["new_goal"],
      dismissed: true,
      xpAwardedSteps: ["new_goal"],
      milestonesCompleted: [
        "mentor_intro_hello",
        "start_new_goal",
        "complete_pathfinder_campaign",
        "campaign_calendar_handoff",
      ],
    };
    const hatchTarget = document.createElement("button");
    hatchTarget.setAttribute("data-tour", "evolve-companion-button");
    document.body.appendChild(hatchTarget);

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/companion"),
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBeNull();
      expect(result.current.isActive).toBe(false);
      expect(result.current.isPreHatchCompanionStep).toBe(false);
    });
  });

  it("moves old Plan day progress to hatch and tops up old 5 XP campaign users", async () => {
    mocks.state.guidedTutorial = {
      ...createFreshTutorial(),
      flowVersion: 9,
      completedSteps: ["new_goal", "plan_my_day"],
      xpAwardedSteps: ["new_goal"],
      milestonesCompleted: [
        "mentor_intro_hello",
        "start_new_goal",
        "complete_pathfinder_campaign",
        "start_plan_my_day",
        "answer_plan_day_ai",
        "save_plan_day_action",
      ],
    };
    mocks.state.queryClient.fetchQuery.mockResolvedValue({ current_stage: 0, current_xp: 5 });
    const hatchTarget = document.createElement("button");
    hatchTarget.setAttribute("data-tour", "evolve-companion-button");
    document.body.appendChild(hatchTarget);

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/companion"),
    });

    await waitFor(() => {
      expect(result.current.currentStep).toBe("hatch_companion");
    });

    await waitFor(() => {
      expect(mocks.state.awardCustomXP).toHaveBeenCalledWith(
        5,
        "guided_tutorial_hatch_ready_top_up",
        undefined,
        expect.objectContaining({
          guided_step: "hatch_companion",
          source: "guided_tutorial",
        }),
      );
    });

    const latestPayload = mocks.state.profileUpdatePayloads.at(-1) as
      | { onboarding_data?: { guided_tutorial?: { hatchReadyTopUpAmount?: number } } }
      | undefined;
    expect(latestPayload?.onboarding_data?.guided_tutorial?.hatchReadyTopUpAmount).toBe(5);
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
