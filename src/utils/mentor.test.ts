import { describe, expect, it } from "vitest";
import {
  getOnboardingMentorId,
  getResolvedMentorId,
  isInvalidMentorReferenceError,
  stripOnboardingMentorId,
} from "./mentor";

const VALID_MENTOR_ID = "66d0b7e0-215c-4c6c-b091-33c217de7fbb";

describe("getOnboardingMentorId", () => {
  it("returns trimmed UUID mentor id from onboarding data", () => {
    const profile = {
      onboarding_data: { mentorId: ` ${VALID_MENTOR_ID} ` },
    };

    expect(getOnboardingMentorId(profile)).toBe(VALID_MENTOR_ID);
  });

  it("returns null when onboarding mentor id is missing or invalid", () => {
    expect(getOnboardingMentorId({ onboarding_data: {} })).toBeNull();
    expect(getOnboardingMentorId({ onboarding_data: { mentorId: "not-a-uuid" } })).toBeNull();
    expect(getOnboardingMentorId({ onboarding_data: { mentorId: 42 } })).toBeNull();
    expect(getOnboardingMentorId(null)).toBeNull();
  });
});

describe("getResolvedMentorId", () => {
  it("prefers selected_mentor_id when present", () => {
    expect(
      getResolvedMentorId({
        selected_mentor_id: VALID_MENTOR_ID,
        onboarding_completed: true,
        onboarding_data: { mentorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
      }),
    ).toBe(VALID_MENTOR_ID);
  });

  it("uses onboarding mentor fallback only while onboarding is incomplete", () => {
    expect(
      getResolvedMentorId({
        selected_mentor_id: null,
        onboarding_completed: false,
        onboarding_data: { mentorId: VALID_MENTOR_ID },
      }),
    ).toBe(VALID_MENTOR_ID);

    expect(
      getResolvedMentorId({
        selected_mentor_id: null,
        onboarding_completed: true,
        onboarding_data: { mentorId: VALID_MENTOR_ID },
      }),
    ).toBeNull();
  });
});

describe("stripOnboardingMentorId", () => {
  it("removes mentorId and keeps remaining onboarding fields", () => {
    expect(
      stripOnboardingMentorId({
        mentorId: VALID_MENTOR_ID,
        userName: "Alex",
        walkthrough_completed: true,
      }),
    ).toEqual({
      userName: "Alex",
      walkthrough_completed: true,
    });
  });
});

describe("isInvalidMentorReferenceError", () => {
  it("matches FK errors by postgres code", () => {
    expect(isInvalidMentorReferenceError({ code: "23503" })).toBe(true);
  });

  it("matches FK errors by constraint/message text", () => {
    expect(
      isInvalidMentorReferenceError({
        message: 'update violates foreign key constraint "profiles_selected_mentor_id_fkey"',
      }),
    ).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isInvalidMentorReferenceError({ code: "PGRST116", message: "No rows" })).toBe(false);
    expect(isInvalidMentorReferenceError(null)).toBe(false);
  });
});
