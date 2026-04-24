import { describe, expect, it } from "vitest";

import {
  buildEstablishedProfileSelfHealPatch,
  getOnboardingGateState,
  isReturningProfile,
} from "./profileOnboarding";

describe("getOnboardingGateState", () => {
  it("treats companion-backed stale profiles as established", () => {
    expect(
      getOnboardingGateState({
        profile: {
          onboarding_completed: false,
          selected_mentor_id: "mentor-1",
          onboarding_data: {},
        },
        hasCompanion: true,
        hasPresetCompanion: true,
        companionStage: 1,
        hasCompanionImages: true,
      }),
    ).toMatchObject({
      isEstablished: true,
      needsOnboarding: false,
      reason: "companion_exists",
      shouldSelfHeal: true,
    });
  });

  it("keeps preset-backed stage 0 eggs in onboarding recovery until onboarding is complete", () => {
    expect(
      getOnboardingGateState({
        profile: {
          onboarding_completed: false,
          selected_mentor_id: "mentor-1",
          onboarding_data: {},
        },
        hasCompanion: true,
        hasPresetCompanion: true,
        companionStage: 0,
        hasCompanionImages: true,
      }),
    ).toMatchObject({
      isEstablished: false,
      needsOnboarding: true,
      reason: null,
      resumeStep: "journey-begins",
      needsCompanionMigration: false,
      shouldSelfHeal: false,
    });
  });

  it("treats stage 0 egg-only companions without tutorial progress as pending journey-begins recovery", () => {
    expect(
      getOnboardingGateState({
        profile: {
          onboarding_completed: false,
          selected_mentor_id: "mentor-1",
          onboarding_data: {},
        },
        hasCompanion: true,
        hasPresetCompanion: false,
        companionStage: 0,
        hasCompanionImages: true,
      }),
    ).toMatchObject({
      isEstablished: false,
      needsOnboarding: true,
      reason: null,
      resumeStep: "journey-begins",
      needsCompanionMigration: false,
      shouldSelfHeal: false,
    });
  });

  it("keeps explicit journey-begins recovery active even when the companion has already advanced past stage 0", () => {
    expect(
      getOnboardingGateState({
        profile: {
          onboarding_completed: true,
          onboarding_step: "journey-begins",
          selected_mentor_id: "mentor-1",
          onboarding_data: {},
        },
        hasCompanion: true,
        hasPresetCompanion: true,
        companionStage: 1,
        hasCompanionImages: true,
      }),
    ).toMatchObject({
      isEstablished: false,
      needsOnboarding: true,
      reason: null,
      resumeStep: "journey-begins",
      needsCompanionMigration: false,
      shouldSelfHeal: false,
    });
  });

  it("treats a complete onboarding step as established even with a stage 0 egg", () => {
    expect(
      getOnboardingGateState({
        profile: {
          onboarding_completed: false,
          onboarding_step: "complete",
          selected_mentor_id: "mentor-1",
          onboarding_data: {},
        },
        hasCompanion: true,
        hasPresetCompanion: false,
        companionStage: 0,
        hasCompanionImages: true,
      }),
    ).toMatchObject({
      isEstablished: true,
      needsOnboarding: false,
      reason: "onboarding_step_complete",
      resumeStep: null,
      shouldSelfHeal: true,
    });
  });

  it("treats valid post-stage-0 AI companions as established", () => {
    expect(
      getOnboardingGateState({
        profile: {
          onboarding_completed: false,
          selected_mentor_id: "mentor-1",
          onboarding_data: {},
        },
        hasCompanion: true,
        hasPresetCompanion: false,
        companionStage: 2,
        hasCompanionImages: true,
      }),
    ).toMatchObject({
      isEstablished: true,
      needsOnboarding: false,
      reason: "companion_exists",
      needsCompanionMigration: false,
      shouldSelfHeal: true,
    });
  });

  it("keeps structurally broken post-stage-0 AI companions in migration", () => {
    expect(
      getOnboardingGateState({
        profile: {
          onboarding_completed: false,
          selected_mentor_id: "mentor-1",
          onboarding_data: {},
        },
        hasCompanion: true,
        hasPresetCompanion: false,
        companionStage: 2,
      }),
    ).toMatchObject({
      isEstablished: false,
      needsOnboarding: true,
      reason: null,
      needsCompanionMigration: true,
      shouldSelfHeal: false,
    });
  });

  it("keeps preset-backed post-stage companions established even when image urls are missing", () => {
    expect(
      getOnboardingGateState({
        profile: {
          onboarding_completed: false,
          selected_mentor_id: "mentor-1",
          onboarding_data: {},
        },
        hasCompanion: true,
        hasPresetCompanion: true,
        companionStage: 5,
        hasCompanionImages: false,
      }),
    ).toMatchObject({
      isEstablished: true,
      needsOnboarding: false,
      reason: "companion_exists",
      needsCompanionMigration: false,
      shouldSelfHeal: true,
    });
  });

  it("keeps mentor-only incomplete profiles in onboarding", () => {
    expect(
      getOnboardingGateState({
        profile: {
          onboarding_completed: false,
          selected_mentor_id: "mentor-1",
          onboarding_data: {},
        },
        hasCompanion: false,
      }),
    ).toMatchObject({
      isEstablished: false,
      needsOnboarding: true,
      reason: null,
      shouldSelfHeal: false,
    });
  });

  it("treats legacy mentor-linked accounts as established", () => {
    expect(
      getOnboardingGateState({
        profile: {
          onboarding_completed: null,
          selected_mentor_id: "mentor-legacy",
          onboarding_data: {},
        },
      }),
    ).toMatchObject({
      isEstablished: true,
      needsOnboarding: false,
      reason: "legacy_resolved_mentor",
      shouldSelfHeal: false,
    });
  });

  it("treats walkthrough-complete profiles as established", () => {
    expect(
      getOnboardingGateState({
        profile: {
          onboarding_completed: false,
          selected_mentor_id: null,
          onboarding_data: { walkthrough_completed: true },
        },
      }),
    ).toMatchObject({
      isEstablished: true,
      needsOnboarding: false,
      reason: "walkthrough_completed",
      shouldSelfHeal: false,
    });
  });

  it("forces onboarding when a progression reset is pending", () => {
    expect(
      getOnboardingGateState({
        profile: {
          onboarding_completed: true,
          selected_mentor_id: "mentor-1",
          onboarding_data: { walkthrough_completed: true, progression_reset_required: true },
        },
        hasCompanion: false,
      }),
    ).toMatchObject({
      isEstablished: false,
      needsOnboarding: true,
      needsProgressionReset: true,
      shouldSelfHeal: false,
    });
  });
});

describe("isReturningProfile", () => {
  it("returns true when onboarding is complete", () => {
    expect(
      isReturningProfile({
        onboarding_completed: true,
        selected_mentor_id: null,
        onboarding_data: {},
      }),
    ).toBe(true);
  });

  it("returns true when walkthrough is completed even if onboarding is false", () => {
    expect(
      isReturningProfile({
        onboarding_completed: false,
        selected_mentor_id: null,
        onboarding_data: { walkthrough_completed: true },
      }),
    ).toBe(true);
  });

  it("returns true for legacy accounts with a resolved mentor and null onboarding state", () => {
    expect(
      isReturningProfile({
        onboarding_completed: null,
        selected_mentor_id: "mentor-legacy",
        onboarding_data: {},
      }),
    ).toBe(true);
  });

  it("returns false for explicitly incomplete onboarding", () => {
    expect(
      isReturningProfile({
        onboarding_completed: false,
        selected_mentor_id: "mentor-1",
        onboarding_data: { walkthrough_completed: false },
      }),
    ).toBe(false);
  });

  it("returns false when there is no profile progress to trust", () => {
    expect(
      isReturningProfile({
        onboarding_completed: null,
        selected_mentor_id: null,
        onboarding_data: {},
      }),
    ).toBe(false);
  });

  it("returns false when progression reset is required", () => {
    expect(
      isReturningProfile({
        onboarding_completed: true,
        selected_mentor_id: "mentor-1",
        onboarding_data: { walkthrough_completed: true, progression_reset_required: true },
      }),
    ).toBe(false);
  });

  it("returns true when a stale profile already has a companion", () => {
    expect(
      isReturningProfile(
        {
          onboarding_completed: false,
          selected_mentor_id: "mentor-1",
          onboarding_data: {},
        },
        { hasCompanion: true, hasPresetCompanion: true, companionStage: 1, hasCompanionImages: true },
      ),
    ).toBe(true);
  });

  it("returns false for a stage 0 egg waiting on journey-begins recovery", () => {
    expect(
      isReturningProfile(
        {
          onboarding_completed: true,
          selected_mentor_id: "mentor-1",
          onboarding_data: {},
        },
        { hasCompanion: true, hasPresetCompanion: false, companionStage: 0, hasCompanionImages: true },
      ),
    ).toBe(false);
  });

  it("returns false for a preset companion that is still marked as journey-begins", () => {
    expect(
      isReturningProfile(
        {
          onboarding_completed: true,
          onboarding_step: "journey-begins",
          selected_mentor_id: "mentor-1",
          onboarding_data: {},
        },
        { hasCompanion: true, hasPresetCompanion: true, companionStage: 1, hasCompanionImages: true },
      ),
    ).toBe(false);
  });
});

describe("buildEstablishedProfileSelfHealPatch", () => {
  it("repairs stale companion-backed profiles without dropping onboarding data", () => {
    expect(
      buildEstablishedProfileSelfHealPatch({
        profile: {
          onboarding_completed: false,
          selected_mentor_id: "mentor-1",
          onboarding_data: {
            guided_tutorial: {
              completed: false,
            },
            mentorName: "Atlas",
          },
        },
        hasCompanion: true,
        hasPresetCompanion: true,
        companionStage: 1,
        hasCompanionImages: true,
      }),
    ).toEqual({
      onboarding_completed: true,
      onboarding_data: {
        guided_tutorial: {
          completed: false,
        },
        mentorName: "Atlas",
        walkthrough_completed: true,
      },
    });
  });

  it("does not self-heal profiles waiting for progression reset", () => {
    expect(
      buildEstablishedProfileSelfHealPatch({
        profile: {
          onboarding_completed: true,
          selected_mentor_id: "mentor-1",
          onboarding_data: {
            walkthrough_completed: true,
            progression_reset_required: true,
          },
        },
        hasCompanion: false,
      }),
    ).toBeNull();
  });

  it("does not self-heal stage 0 egg accounts still waiting on journey-begins", () => {
    expect(
      buildEstablishedProfileSelfHealPatch({
        profile: {
          onboarding_completed: true,
          onboarding_data: {},
        },
        hasCompanion: true,
        hasPresetCompanion: false,
        companionStage: 0,
        hasCompanionImages: true,
      }),
    ).toBeNull();
  });

  it("does not self-heal companion-backed accounts that are still on journey-begins", () => {
    expect(
      buildEstablishedProfileSelfHealPatch({
        profile: {
          onboarding_completed: true,
          onboarding_step: "journey-begins",
          onboarding_data: {},
        },
        hasCompanion: true,
        hasPresetCompanion: true,
        companionStage: 1,
        hasCompanionImages: true,
      }),
    ).toBeNull();
  });
});
