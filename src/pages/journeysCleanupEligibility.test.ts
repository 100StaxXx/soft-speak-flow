import { describe, expect, it } from "vitest";
import { isOnboardingCleanupEligible } from "@/pages/journeysCleanupEligibility";

describe("isOnboardingCleanupEligible", () => {
  it("returns true when onboarding is completed even without walkthrough flag", () => {
    expect(isOnboardingCleanupEligible(false, true, {})).toBe(true);
  });

  it("returns true when walkthrough is completed even if onboarding_completed is false", () => {
    expect(
      isOnboardingCleanupEligible(false, false, {
        walkthrough_completed: true,
      })
    ).toBe(true);
  });

  it("returns false while profile is loading", () => {
    expect(
      isOnboardingCleanupEligible(true, true, {
        walkthrough_completed: true,
      })
    ).toBe(false);
  });

  it("returns false when neither onboarding nor walkthrough is completed", () => {
    expect(isOnboardingCleanupEligible(false, false, {})).toBe(false);
  });
});
