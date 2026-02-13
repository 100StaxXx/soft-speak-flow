import { describe, expect, it } from "vitest";
import {
  filterMentorsByEnergyPreference,
  getDesiredIntensityFromGuidanceTone,
  getEnergyPreferenceFromAnswers,
  resolveMentorEnergy,
} from "./onboardingMentorMatching";

describe("getEnergyPreferenceFromAnswers", () => {
  it("returns masculine when mentor_energy answer includes masculine_preference", () => {
    expect(
      getEnergyPreferenceFromAnswers([
        { questionId: "mentor_energy", tags: ["masculine_preference"] },
      ]),
    ).toBe("masculine");
  });

  it("returns feminine when mentor_energy answer includes feminine_preference", () => {
    expect(
      getEnergyPreferenceFromAnswers([
        { questionId: "mentor_energy", tags: ["feminine_preference"] },
      ]),
    ).toBe("feminine");
  });

  it("returns no_preference when mentor_energy has no tags", () => {
    expect(
      getEnergyPreferenceFromAnswers([{ questionId: "mentor_energy", tags: [] }]),
    ).toBe("no_preference");
  });
});

describe("resolveMentorEnergy", () => {
  it("prefers explicit gender_energy over tags and slug fallback", () => {
    expect(
      resolveMentorEnergy({
        gender_energy: "female",
        tags: ["masculine"],
        slug: "atlas",
      }),
    ).toBe("feminine");
  });

  it("uses tags when gender_energy is missing", () => {
    expect(resolveMentorEnergy({ tags: ["Masculine"] })).toBe("masculine");
  });

  it("uses slug fallback when no explicit energy metadata exists", () => {
    expect(resolveMentorEnergy({ slug: "sienna" })).toBe("feminine");
    expect(resolveMentorEnergy({ slug: "stryker" })).toBe("masculine");
  });

  it("returns unknown when no energy metadata exists", () => {
    expect(resolveMentorEnergy({ slug: "unknown-slug", tags: [] })).toBe("unknown");
  });
});

describe("filterMentorsByEnergyPreference", () => {
  const mentors = [
    { id: "m1", slug: "atlas", gender_energy: "masculine" },
    { id: "m2", slug: "sienna", gender_energy: "feminine" },
    { id: "m3", slug: "solace", gender_energy: "feminine" },
  ];

  it("keeps only masculine mentors when masculine is selected", () => {
    const result = filterMentorsByEnergyPreference(mentors, "masculine");
    expect(result.usedFallback).toBe(false);
    expect(result.candidates.map((mentor) => mentor.id)).toEqual(["m1"]);
  });

  it("keeps only feminine mentors when feminine is selected", () => {
    const result = filterMentorsByEnergyPreference(mentors, "feminine");
    expect(result.usedFallback).toBe(false);
    expect(result.candidates.map((mentor) => mentor.id)).toEqual(["m2", "m3"]);
  });

  it("does not filter mentors when no preference is selected", () => {
    const result = filterMentorsByEnergyPreference(mentors, "no_preference");
    expect(result.usedFallback).toBe(false);
    expect(result.candidates.map((mentor) => mentor.id)).toEqual(["m1", "m2", "m3"]);
  });

  it("falls back to all mentors when preferred energy has no matches", () => {
    const feminineOnlyMentors = [
      { id: "f1", slug: "sienna", gender_energy: "feminine" },
      { id: "f2", slug: "solace", gender_energy: "feminine" },
    ];
    const result = filterMentorsByEnergyPreference(feminineOnlyMentors, "masculine");

    expect(result.usedFallback).toBe(true);
    expect(result.candidates.map((mentor) => mentor.id)).toEqual(["f1", "f2"]);
  });
});

describe("getDesiredIntensityFromGuidanceTone", () => {
  it("maps current guidance tone options to expected intensity buckets", () => {
    expect(getDesiredIntensityFromGuidanceTone("Gentle & compassionate")).toBe("gentle");
    expect(getDesiredIntensityFromGuidanceTone("Encouraging & supportive")).toBe("medium");
    expect(getDesiredIntensityFromGuidanceTone("Calm & grounded")).toBe("gentle");
    expect(getDesiredIntensityFromGuidanceTone("Direct & demanding")).toBe("high");
  });

  it("defaults to medium for unknown values", () => {
    expect(getDesiredIntensityFromGuidanceTone("Something else")).toBe("medium");
    expect(getDesiredIntensityFromGuidanceTone(undefined)).toBe("medium");
  });
});
