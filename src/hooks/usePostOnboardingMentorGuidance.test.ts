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
      completedSteps: ["create_quest", "meet_companion"] as const,
      xpAwardedSteps: [] as string[],
      milestonesCompleted: ["open_mentor_tab"] as const,
    },
    profileUpdatePayloads: [] as Array<Record<string, unknown>>,
    queryClient: {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
    },
    awardCustomXP: vi.fn().mockResolvedValue(undefined),
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
  useMentorPersonality: () => null,
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
      42,
      null,
    ]);

    expect(result).toEqual(["create_quest", "morning_checkin"]);
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
      "stay_on_quests",
      "open_add_quest",
      "enter_title",
      "select_time",
      "submit_create_quest",
    ]);
  });
});

describe("sanitizeCreateQuestProgress", () => {
  it("drops invalid substep ids and defaults current to first incomplete", () => {
    const result = sanitizeCreateQuestProgress({
      current: "invalid",
      completed: ["stay_on_quests", "invalid", "open_add_quest"],
    });

    expect(result).toEqual({
      current: "enter_title",
      completed: ["stay_on_quests", "open_add_quest"],
      startedAt: undefined,
      completedAt: undefined,
    });
  });
});

describe("getMentorInstructionLines", () => {
  it("returns mentor-led instructions for each step", () => {
    expect(getMentorInstructionLines("create_quest", "open_add_quest")[0]).toContain(
      "Tap the + in the bottom right"
    );
    expect(getMentorInstructionLines("create_quest", "enter_title")[0]).toContain(
      "Type your quest title"
    );
    expect(getMentorInstructionLines("meet_companion", null)[0]).toContain("Open Companion");
    expect(getMentorInstructionLines("morning_checkin", null)[0]).toContain("Head to Mentor");
  });
});

describe("milestoneUsesStrictLock", () => {
  it("does not strict-lock submit morning check-in", () => {
    expect(milestoneUsesStrictLock("submit_morning_checkin")).toBe(false);
  });

  it("does not strict-lock companion progress confirmation", () => {
    expect(milestoneUsesStrictLock("confirm_companion_progress")).toBe(false);
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
      })
    ).toBe(false);

    expect(
      shouldRestoreTutorialRoute({
        pathname: "/journeys",
        stepRoute: "/mentor",
        tutorialReady: true,
        tutorialComplete: true,
      })
    ).toBe(false);
  });
});

describe("guided tutorial intro state", () => {
  beforeEach(() => {
    mocks.state.user = { id: "user-1" };
    mocks.state.profileLoading = false;
    mocks.state.guidedTutorial = createGuidedTutorial();
    mocks.state.profileUpdatePayloads = [];
    mocks.state.queryClient.invalidateQueries.mockClear();
    mocks.state.awardCustomXP.mockClear();
    globalThis.localStorage?.removeItem?.("guided_tutorial_progress_user-1");
  });

  const createWrapper = (path = "/journeys") =>
    ({ children }: { children: ReactNode }) =>
      React.createElement(
        MemoryRouter,
        { initialEntries: [path] },
        React.createElement(PostOnboardingMentorGuidanceProvider, null, children)
      );

  it("keeps tutorial inactive while intro is active", async () => {
    mocks.state.guidedTutorial.introEnabled = true;
    mocks.state.guidedTutorial.introSeen = false;

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isIntroActive).toBe(true);
    });
    expect(result.current.isActive).toBe(false);
  });

  it("completes intro and enables tutorial flow", async () => {
    mocks.state.guidedTutorial.introEnabled = true;
    mocks.state.guidedTutorial.introSeen = false;

    const { result } = renderHook(() => usePostOnboardingMentorGuidance(), {
      wrapper: createWrapper("/mentor"),
    });

    await waitFor(() => {
      expect(result.current.isIntroActive).toBe(true);
      expect(result.current.isActive).toBe(false);
    });

    await act(async () => {
      result.current.completeIntro();
    });

    await waitFor(() => {
      expect(result.current.isIntroActive).toBe(false);
      expect(result.current.isActive).toBe(true);
    });

    expect(
      mocks.state.profileUpdatePayloads.some((payload) =>
        JSON.stringify(payload).includes('"introSeen":true')
      )
    ).toBe(true);
  });
});
