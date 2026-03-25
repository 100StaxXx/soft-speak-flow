import { describe, expect, it } from "vitest";

import { isReturningProfile } from "./profileOnboarding";

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
        onboarding_data: {},
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
});
