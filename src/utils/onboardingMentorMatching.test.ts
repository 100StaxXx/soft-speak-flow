import { describe, expect, it } from "vitest";
import {
  filterMentorsByEnergyPreference,
  getDesiredIntensityFromGuidanceTone,
  getEnergyPreferenceFromAnswers,
  resolveMentorEnergy,
} from "./onboardingMentorMatching";

describe("getEnergyPreferenceFromAnswers", () => {
  it("returns masculine when mentor_energy answer selects masculine_presence", () => {
    expect(
      getEnergyPreferenceFromAnswers([
        { questionId: "mentor_energy", optionId: "masculine_presence", tags: ["masculine_preference"] },
      ]),
    ).toBe("masculine");
  });

  it("returns feminine when mentor_energy answer selects feminine_presence", () => {
    expect(
      getEnergyPreferenceFromAnswers([
        { questionId: "mentor_energy", optionId: "feminine_presence", tags: ["feminine_preference"] },
      ]),
    ).toBe("feminine");
  });

  it("returns neutral when mentor_energy selects neutral_presence", () => {
    expect(
      getEnergyPreferenceFromAnswers([{ questionId: "mentor_energy", optionId: "neutral_presence", tags: ["neutral_preference"] }]),
    ).toBe("neutral");
  });

  it("returns no_preference when mentor_energy selects either_works", () => {
    expect(
      getEnergyPreferenceFromAnswers([{ questionId: "mentor_energy", optionId: "either_works", tags: [] }]),
    ).toBe("no_preference");
  });
});

describe("resolveMentorEnergy", () => {
  it("prefers explicit gender_energy over tags and slug fallback", () => {
    expect(
      resolveMentorEnergy({
        gender_energy: "female",
        tags: ["masculine"],
        slug: "sage",
      }),
    ).toBe("feminine");
  });

  it("uses tags when gender_energy is missing", () => {
    expect(resolveMentorEnergy({ tags: ["Masculine"] })).toBe("masculine");
  });

  it("uses slug fallback when no explicit energy metadata exists", () => {
    expect(resolveMentorEnergy({ slug: "lyra" })).toBe("feminine");
    expect(resolveMentorEnergy({ slug: "princess" })).toBe("feminine");
    expect(resolveMentorEnergy({ slug: "operator" })).toBe("masculine");
  });

  it("returns unknown when no energy metadata exists", () => {
    expect(resolveMentorEnergy({ slug: "unknown-slug", tags: [] })).toBe("unknown");
  });
});

describe("filterMentorsByEnergyPreference", () => {
  const mentors = [
    { id: "m1", slug: "sage", gender_energy: "masculine" },
    { id: "m2", slug: "charles", gender_energy: "masculine" },
    { id: "m3", slug: "operator", gender_energy: "masculine" },
    { id: "m4", slug: "rival", gender_energy: "masculine" },
    { id: "m5", slug: "princess", gender_energy: "feminine" },
    { id: "m6", slug: "icon", gender_energy: "feminine" },
    { id: "m7", slug: "lyra", gender_energy: "feminine" },
  ];

  it("keeps operator, rival, sage, and charles in the masculine onboarding pool", () => {
    const result = filterMentorsByEnergyPreference(mentors, "masculine");
    expect(result.candidates.map((mentor) => mentor.id)).toEqual(["m1", "m2", "m3", "m4"]);
  });

  it("keeps Lyra, Icon, Princess, Sage, and Charles in the feminine onboarding pool", () => {
    const result = filterMentorsByEnergyPreference(mentors, "feminine");
    expect(result.candidates.map((mentor) => mentor.id)).toEqual(["m1", "m2", "m5", "m6", "m7"]);
  });

  it("keeps only sage and charles in the neutral onboarding pool", () => {
    const result = filterMentorsByEnergyPreference(mentors, "neutral");
    expect(result.candidates.map((mentor) => mentor.id)).toEqual(["m1", "m2"]);
  });

  it("does not filter mentors when no preference is selected", () => {
    const result = filterMentorsByEnergyPreference(mentors, "no_preference");
    expect(result.candidates.map((mentor) => mentor.id)).toEqual(["m1", "m2", "m3", "m4", "m5", "m6", "m7"]);
  });

  it("returns no candidates when preferred energy has no matches", () => {
    const feminineOnlyMentors = [
      { id: "f1", slug: "princess", gender_energy: "feminine" },
      { id: "f2", slug: "icon", gender_energy: "feminine" },
    ];
    const result = filterMentorsByEnergyPreference(feminineOnlyMentors, "neutral");

    expect(result.candidates).toEqual([]);
  });

  it("filters using slug inference when gender_energy is missing", () => {
    const inferredMentors = [
      { id: "s0", slug: "lyra", tags: [] as string[] },
      { id: "s1", slug: "operator", tags: [] as string[] },
      { id: "s2", slug: "sage", tags: [] as string[] },
      { id: "s3", slug: "princess", tags: [] as string[] },
    ];

    const masculineResult = filterMentorsByEnergyPreference(inferredMentors, "masculine");
    const feminineResult = filterMentorsByEnergyPreference(inferredMentors, "feminine");
    const neutralResult = filterMentorsByEnergyPreference(inferredMentors, "neutral");

    expect(masculineResult.candidates.map((mentor) => mentor.id)).toEqual(["s1", "s2"]);
    expect(feminineResult.candidates.map((mentor) => mentor.id)).toEqual(["s0", "s2", "s3"]);
    expect(neutralResult.candidates.map((mentor) => mentor.id)).toEqual(["s2"]);
  });
});

describe("getDesiredIntensityFromGuidanceTone", () => {
  it("maps current guidance tone options to expected intensity buckets", () => {
    expect(getDesiredIntensityFromGuidanceTone("Direct and challenging")).toBe("high");
    expect(getDesiredIntensityFromGuidanceTone("Calm and reflective")).toBe("gentle");
    expect(getDesiredIntensityFromGuidanceTone("Composed and polished")).toBe("medium");
    expect(getDesiredIntensityFromGuidanceTone("Warm and encouraging")).toBe("gentle");
    expect(getDesiredIntensityFromGuidanceTone("Aggressive and challenging")).toBe("high");
    expect(getDesiredIntensityFromGuidanceTone("Sharp and sarcastic")).toBe("medium");
  });

  it("defaults to medium for unknown values", () => {
    expect(getDesiredIntensityFromGuidanceTone("Something else")).toBe("medium");
    expect(getDesiredIntensityFromGuidanceTone(undefined)).toBe("medium");
  });
});
