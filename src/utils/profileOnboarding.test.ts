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
      }),
    ).toMatchObject({
      isEstablished: true,
      needsOnboarding: false,
      reason: "companion_exists",
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

  it("returns true when a stale profile already has a companion", () => {
    expect(
      isReturningProfile(
        {
          onboarding_completed: false,
          selected_mentor_id: "mentor-1",
          onboarding_data: {},
        },
        { hasCompanion: true },
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
});
