import { describe, expect, it } from "vitest";

import {
  ACTIVE_ONBOARDING_MENTOR_SLUGS,
  ENERGY_OPTION_IDS,
  FOCUS_OPTION_IDS,
  ONBOARDING_MENTOR_ASSIGNMENTS,
  PROGRESS_OPTION_IDS,
  SAME_ENERGY_FALLBACKS,
  TONE_OPTION_IDS,
  buildOnboardingAssignmentKey,
  resolveAssignedMentorFromActiveMentors,
  resolvePreassignedMentorSlug,
} from "@/config/onboardingMentorAssignments";

const feminineSlugs = new Set(["sienna", "carmen", "reign", "solace"]);
const masculineSlugs = new Set(["atlas", "eli", "stryker"]);
const validSlugs = new Set(ACTIVE_ONBOARDING_MENTOR_SLUGS);

const makeAnswers = (
  energyOptionId: string,
  focusOptionId = "clarity_mindset",
  toneOptionId = "gentle_compassionate",
  progressOptionId = "principles_logic",
) => [
  { questionId: "mentor_energy", optionId: energyOptionId },
  { questionId: "focus_area", optionId: focusOptionId },
  { questionId: "guidance_tone", optionId: toneOptionId },
  { questionId: "progress_style", optionId: progressOptionId },
];

describe("ONBOARDING_MENTOR_ASSIGNMENTS", () => {
  it("contains exactly 192 preassigned combinations", () => {
    expect(Object.keys(ONBOARDING_MENTOR_ASSIGNMENTS)).toHaveLength(192);
  });

  it("contains valid tuple keys with known option IDs", () => {
    for (const key of Object.keys(ONBOARDING_MENTOR_ASSIGNMENTS)) {
      const parts = key.split("|");
      expect(parts).toHaveLength(4);
      expect(ENERGY_OPTION_IDS).toContain(parts[0] as (typeof ENERGY_OPTION_IDS)[number]);
      expect(FOCUS_OPTION_IDS).toContain(parts[1] as (typeof FOCUS_OPTION_IDS)[number]);
      expect(TONE_OPTION_IDS).toContain(parts[2] as (typeof TONE_OPTION_IDS)[number]);
      expect(PROGRESS_OPTION_IDS).toContain(parts[3] as (typeof PROGRESS_OPTION_IDS)[number]);
    }
  });

  it("maps every key to a known active onboarding mentor slug", () => {
    for (const slug of Object.values(ONBOARDING_MENTOR_ASSIGNMENTS)) {
      expect(validSlugs.has(slug)).toBe(true);
    }
  });

  it("hard-locks feminine and masculine branches by Q1", () => {
    for (const [key, slug] of Object.entries(ONBOARDING_MENTOR_ASSIGNMENTS)) {
      if (key.startsWith("feminine_presence|")) {
        expect(feminineSlugs.has(slug)).toBe(true);
      }
      if (key.startsWith("masculine_presence|")) {
        expect(masculineSlugs.has(slug)).toBe(true);
      }
    }
  });
});

describe("resolvePreassignedMentorSlug", () => {
  it("resolves a direct preassigned slug for a complete answer tuple", () => {
    const slug = resolvePreassignedMentorSlug(
      makeAnswers("feminine_presence", "clarity_mindset", "gentle_compassionate", "principles_logic"),
    );
    expect(slug).toBe("sienna");
  });

  it("returns null when option IDs are incomplete", () => {
    const slug = resolvePreassignedMentorSlug([
      { questionId: "mentor_energy", optionId: "feminine_presence" },
      { questionId: "focus_area", optionId: "clarity_mindset" },
    ]);
    expect(slug).toBeNull();
  });
});

describe("resolveAssignedMentorFromActiveMentors", () => {
  const activeMentors = ACTIVE_ONBOARDING_MENTOR_SLUGS.map((slug) => ({
    id: `id-${slug}`,
    slug,
    name: slug,
  }));

  it("returns the assigned mentor directly when available", () => {
    const answers = makeAnswers(
      "masculine_presence",
      "discipline_performance",
      "direct_demanding",
      "pressure_standards",
    );
    const result = resolveAssignedMentorFromActiveMentors(answers, activeMentors);

    expect(result.mentor?.slug).toBe("stryker");
    expect(result.usedFallback).toBe(false);
    expect(result.requestedSlug).toBe("stryker");
    expect(result.resolvedSlug).toBe("stryker");
  });

  it("falls back within same feminine branch when assigned slug is inactive", () => {
    const answers = makeAnswers(
      "feminine_presence",
      "clarity_mindset",
      "gentle_compassionate",
      "principles_logic",
    );
    const withoutSienna = activeMentors.filter((mentor) => mentor.slug !== "sienna");
    const result = resolveAssignedMentorFromActiveMentors(answers, withoutSienna);

    expect(result.requestedSlug).toBe("sienna");
    expect(result.usedFallback).toBe(true);
    expect(result.mentor?.slug).toBe(SAME_ENERGY_FALLBACKS.feminine_presence[1]);
    expect(feminineSlugs.has(result.mentor?.slug ?? "")).toBe(true);
  });

  it("falls back within same masculine branch without crossing energy", () => {
    const answers = makeAnswers(
      "masculine_presence",
      "confidence_self_belief",
      "encouraging_supportive",
      "belief_support",
    );
    const onlyFeminine = activeMentors.filter((mentor) => feminineSlugs.has(mentor.slug));
    const result = resolveAssignedMentorFromActiveMentors(answers, onlyFeminine);

    expect(result.requestedSlug).not.toBeNull();
    expect(result.mentor).toBeNull();
    expect(result.resolvedSlug).toBeNull();
    expect(result.usedFallback).toBe(true);
  });

  it("uses mixed fallback order for either branch", () => {
    const answers = makeAnswers("either_works", "emotions_healing", "gentle_compassionate", "belief_support");
    const onlyReign = activeMentors.filter((mentor) => mentor.slug === "reign");
    const result = resolveAssignedMentorFromActiveMentors(answers, onlyReign);

    expect(result.usedFallback).toBe(true);
    expect(result.mentor?.slug).toBe("reign");
    expect(result.resolvedSlug).toBe("reign");
  });
});

describe("buildOnboardingAssignmentKey", () => {
  it("builds a stable tuple key from option IDs", () => {
    const key = buildOnboardingAssignmentKey(
      makeAnswers("either_works", "emotions_healing", "encouraging_supportive", "belief_support"),
    );

    expect(key).toBe("either_works|emotions_healing|encouraging_supportive|belief_support");
  });
});
