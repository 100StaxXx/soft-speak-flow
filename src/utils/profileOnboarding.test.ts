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
      }),
    ).toMatchObject({
      isEstablished: true,
      needsOnboarding: false,
      reason: "companion_exists",
      shouldSelfHeal: true,
    });
  });

  it("treats stage 0 egg-only companions as established", () => {
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
      }),
    ).toMatchObject({
      isEstablished: true,
      needsOnboarding: false,
      reason: "egg_selected",
      needsCompanionMigration: false,
      shouldSelfHeal: true,
    });
  });

  it("keeps post-stage-0 companions without presets in migration", () => {
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
        { hasCompanion: true, hasPresetCompanion: true },
      ),
    ).toBe(true);
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
});
