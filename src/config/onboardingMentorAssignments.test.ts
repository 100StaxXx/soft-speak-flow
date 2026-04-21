import { describe, expect, it } from "vitest";

import {
  ACTIVE_ONBOARDING_MENTOR_SLUGS,
  CLARITY_LENS_OPTION_IDS,
  ENERGY_OPTION_IDS,
  FOCUS_OPTION_IDS,
  PRESSURE_STYLE_OPTION_IDS,
  PROGRESS_OPTION_IDS,
  SAME_ENERGY_FALLBACKS,
  TONE_OPTION_IDS,
  resolveAssignedMentorFromActiveMentors,
  resolveOnboardingClarifierQuestionId,
  resolvePreassignedMentorSlug,
} from "@/config/onboardingMentorAssignments";

const feminineSlugs = new Set(["lyra", "icon", "princess", "sage", "charles"]);
const masculineSlugs = new Set(["operator", "rival", "sage", "charles"]);
const neutralSlugs = new Set(["sage", "charles"]);

const makeAnswers = (
  energyOptionId: string,
  focusOptionId = "clarity_signal",
  toneOptionId = "calm_reflective",
  progressOptionId = "perspective_next_step",
  clarifier:
    | { questionId: "clarity_lens"; optionId: (typeof CLARITY_LENS_OPTION_IDS)[number] }
    | { questionId: "pressure_style"; optionId: (typeof PRESSURE_STYLE_OPTION_IDS)[number] }
    | null = null,
) => {
  const answers = [
    { questionId: "mentor_energy", optionId: energyOptionId },
    { questionId: "focus_area", optionId: focusOptionId },
    { questionId: "guidance_tone", optionId: toneOptionId },
    { questionId: "progress_style", optionId: progressOptionId },
  ];

  if (clarifier) {
    answers.push(clarifier);
  }

  return answers;
};

describe("resolveOnboardingClarifierQuestionId", () => {
  it("asks for clarity_lens when Lyra and Icon are still tied after the base answers", () => {
    const clarifier = resolveOnboardingClarifierQuestionId(
      makeAnswers(
        "either_works",
        "clarity_signal",
        "composed_polished",
        "identity_alignment",
      ),
    );

    expect(clarifier).toBe("clarity_lens");
  });

  it("asks for pressure_style when the direct branch is tied after the base answers", () => {
    const clarifier = resolveOnboardingClarifierQuestionId(
      makeAnswers(
        "either_works",
        "execution_pressure",
        "direct_challenging",
        "hard_accountability",
      ),
    );

    expect(clarifier).toBe("pressure_style");
  });

  it("skips the clarifier when the base answers already point clearly to one mentor", () => {
    const clarifier = resolveOnboardingClarifierQuestionId(
      makeAnswers(
        "feminine_presence",
        "gentle_routines",
        "warm_encouraging",
        "gentle_accountability",
      ),
    );

    expect(clarifier).toBeNull();
  });
});

describe("resolvePreassignedMentorSlug", () => {
  it("returns null when the base answers are incomplete", () => {
    const slug = resolvePreassignedMentorSlug([
      { questionId: "mentor_energy", optionId: "feminine_presence" },
      { questionId: "focus_area", optionId: "clarity_signal" },
    ]);

    expect(slug).toBeNull();
  });

  it("resolves Lyra directly for a clear signal-first profile", () => {
    const slug = resolvePreassignedMentorSlug(
      makeAnswers(
        "feminine_presence",
        "clarity_signal",
        "composed_polished",
        "perspective_next_step",
      ),
    );

    expect(slug).toBe("lyra");
  });

  it("uses clarity_lens to split ambiguous clarity profiles", () => {
    const baseAnswers = makeAnswers(
      "either_works",
      "clarity_signal",
      "composed_polished",
      "identity_alignment",
    );

    expect(resolvePreassignedMentorSlug([
      ...baseAnswers,
      { questionId: "clarity_lens", optionId: "calm_perspective" },
    ])).toBe("sage");
    expect(resolvePreassignedMentorSlug([
      ...baseAnswers,
      { questionId: "clarity_lens", optionId: "pattern_strategy" },
    ])).toBe("lyra");
    expect(resolvePreassignedMentorSlug([
      ...baseAnswers,
      { questionId: "clarity_lens", optionId: "standards_self_command" },
    ])).toBe("icon");
  });

  it("uses pressure_style to split ambiguous direct profiles", () => {
    const baseAnswers = makeAnswers(
      "either_works",
      "execution_pressure",
      "direct_challenging",
      "hard_accountability",
    );

    expect(resolvePreassignedMentorSlug([
      ...baseAnswers,
      { questionId: "pressure_style", optionId: "systems_precision" },
    ])).toBe("operator");
    expect(resolvePreassignedMentorSlug([
      ...baseAnswers,
      { questionId: "pressure_style", optionId: "prove_it_pressure" },
    ])).toBe("rival");
    expect(resolvePreassignedMentorSlug([
      ...baseAnswers,
      { questionId: "pressure_style", optionId: "sarcastic_callout" },
    ])).toBe("charles");
  });
});

describe("weighted onboarding coverage", () => {
  it("can reach every active mentor through at least one valid answer path", () => {
    const winners = new Set<string>();
    const clarifierAnswers = [
      null,
      ...CLARITY_LENS_OPTION_IDS.map((optionId) => ({ questionId: "clarity_lens" as const, optionId })),
      ...PRESSURE_STYLE_OPTION_IDS.map((optionId) => ({ questionId: "pressure_style" as const, optionId })),
    ];

    for (const energyOptionId of ENERGY_OPTION_IDS) {
      for (const focusOptionId of FOCUS_OPTION_IDS) {
        for (const toneOptionId of TONE_OPTION_IDS) {
          for (const progressOptionId of PROGRESS_OPTION_IDS) {
            for (const clarifier of clarifierAnswers) {
              const winner = resolvePreassignedMentorSlug(
                makeAnswers(energyOptionId, focusOptionId, toneOptionId, progressOptionId, clarifier),
              );
              if (winner) {
                winners.add(winner);
              }
            }
          }
        }
      }
    }

    expect(winners).toEqual(new Set(ACTIVE_ONBOARDING_MENTOR_SLUGS));
  });

  it("keeps each energy branch inside its allowed mentor pool", () => {
    const clarifierAnswers = [
      null,
      ...CLARITY_LENS_OPTION_IDS.map((optionId) => ({ questionId: "clarity_lens" as const, optionId })),
      ...PRESSURE_STYLE_OPTION_IDS.map((optionId) => ({ questionId: "pressure_style" as const, optionId })),
    ];

    for (const energyOptionId of ENERGY_OPTION_IDS) {
      for (const focusOptionId of FOCUS_OPTION_IDS) {
        for (const toneOptionId of TONE_OPTION_IDS) {
          for (const progressOptionId of PROGRESS_OPTION_IDS) {
            for (const clarifier of clarifierAnswers) {
              const winner = resolvePreassignedMentorSlug(
                makeAnswers(energyOptionId, focusOptionId, toneOptionId, progressOptionId, clarifier),
              );

              if (!winner) continue;

              if (energyOptionId === "feminine_presence") {
                expect(feminineSlugs.has(winner)).toBe(true);
              }
              if (energyOptionId === "masculine_presence") {
                expect(masculineSlugs.has(winner)).toBe(true);
              }
              if (energyOptionId === "neutral_presence") {
                expect(neutralSlugs.has(winner)).toBe(true);
              }
            }
          }
        }
      }
    }
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
      "feminine_presence",
      "clarity_signal",
      "composed_polished",
      "perspective_next_step",
    );
    const result = resolveAssignedMentorFromActiveMentors(answers, activeMentors);

    expect(result.mentor?.slug).toBe("lyra");
    expect(result.usedFallback).toBe(false);
    expect(result.requestedSlug).toBe("lyra");
    expect(result.resolvedSlug).toBe("lyra");
  });

  it("falls back within the feminine branch when the assigned slug is inactive", () => {
    const answers = makeAnswers(
      "feminine_presence",
      "clarity_signal",
      "composed_polished",
      "perspective_next_step",
    );
    const withoutLyra = activeMentors.filter((mentor) => mentor.slug !== "lyra");
    const result = resolveAssignedMentorFromActiveMentors(answers, withoutLyra);

    expect(result.requestedSlug).toBe("lyra");
    expect(result.usedFallback).toBe(true);
    expect(result.mentor?.slug).toBe(SAME_ENERGY_FALLBACKS.feminine_presence[1]);
  });

  it("falls back within the masculine branch and can use neutral guides", () => {
    const answers = makeAnswers(
      "masculine_presence",
      "execution_pressure",
      "direct_challenging",
      "hard_accountability",
      { questionId: "pressure_style", optionId: "systems_precision" },
    );
    const onlyNeutral = activeMentors.filter((mentor) => neutralSlugs.has(mentor.slug));
    const result = resolveAssignedMentorFromActiveMentors(answers, onlyNeutral);

    expect(result.requestedSlug).toBe("operator");
    expect(result.mentor?.slug).toBe("sage");
    expect(result.resolvedSlug).toBe("sage");
    expect(result.usedFallback).toBe(true);
  });
});
