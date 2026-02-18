import { describe, expect, it } from "vitest";
import { deriveOnboardingMentorCandidates, mapGuidanceToneToIntensity } from "./StoryOnboarding";

describe("mapGuidanceToneToIntensity", () => {
  it("maps plain-text guidance tones to the expected intensity", () => {
    expect(mapGuidanceToneToIntensity("Direct & demanding")).toBe("high");
    expect(mapGuidanceToneToIntensity("Gentle & compassionate")).toBe("gentle");
    expect(mapGuidanceToneToIntensity("Calm & grounded")).toBe("gentle");
    expect(mapGuidanceToneToIntensity("Encouraging & supportive")).toBe("medium");
  });

  it("supports legacy emoji-prefixed variants and falls back safely", () => {
    expect(mapGuidanceToneToIntensity("⚔️ Direct & demanding")).toBe("high");
    expect(mapGuidanceToneToIntensity("🌱 Gentle & compassionate")).toBe("gentle");
    expect(mapGuidanceToneToIntensity("🧘 Calm & grounded")).toBe("gentle");
    expect(mapGuidanceToneToIntensity("🤝 Encouraging & supportive")).toBe("medium");
    expect(mapGuidanceToneToIntensity("something unexpected")).toBe("medium");
  });
});

describe("deriveOnboardingMentorCandidates", () => {
  const mentors = [
    { id: "m1", slug: "atlas", gender_energy: "masculine", tags: ["discipline"] },
    { id: "m2", slug: "sienna", gender_energy: "feminine", tags: ["supportive"] },
    { id: "m3", slug: "reign", gender_energy: "feminine", tags: ["momentum"] },
  ];

  it("keeps only masculine mentors for masculine presence", () => {
    const result = deriveOnboardingMentorCandidates(mentors, [
      { questionId: "mentor_energy", tags: ["masculine_preference"] },
    ]);

    expect(result.energyPreference).toBe("masculine");
    expect(result.mentorsForSelection.map((mentor) => mentor.id)).toEqual(["m1"]);
  });

  it("keeps only feminine mentors for feminine presence", () => {
    const result = deriveOnboardingMentorCandidates(mentors, [
      { questionId: "mentor_energy", tags: ["feminine_preference"] },
    ]);

    expect(result.energyPreference).toBe("feminine");
    expect(result.mentorsForSelection.map((mentor) => mentor.id)).toEqual(["m2", "m3"]);
  });

  it("keeps all mentors when no preference is selected", () => {
    const result = deriveOnboardingMentorCandidates(mentors, [
      { questionId: "mentor_energy", tags: [] },
    ]);

    expect(result.energyPreference).toBe("no_preference");
    expect(result.mentorsForSelection.map((mentor) => mentor.id)).toEqual(["m1", "m2", "m3"]);
  });

  it("returns no mentors when a strict preference has no matches", () => {
    const feminineOnlyMentors = [
      { id: "f1", slug: "sienna", gender_energy: "feminine", tags: ["supportive"] },
      { id: "f2", slug: "reign", gender_energy: "feminine", tags: ["momentum"] },
    ];
    const result = deriveOnboardingMentorCandidates(feminineOnlyMentors, [
      { questionId: "mentor_energy", tags: ["masculine_preference"] },
    ]);

    expect(result.energyPreference).toBe("masculine");
    expect(result.mentorsForSelection).toEqual([]);
  });
});
