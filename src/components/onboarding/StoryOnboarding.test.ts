import { describe, expect, it, vi } from "vitest";
import {
  CALCULATING_STAGE_DURATION_MS,
  deriveOnboardingMentorCandidates,
  mapGuidanceToneToIntensity,
  QUESTIONNAIRE_PIPELINE_TIMEOUT_MS,
  resolveQuestionnaireCompletionStage,
  resolveOnboardingBackdropStage,
  runWithTimeout,
  scheduleMentorRevealTransition,
} from "./StoryOnboarding";

describe("mapGuidanceToneToIntensity", () => {
  it("maps plain-text guidance tones to the expected intensity", () => {
    expect(mapGuidanceToneToIntensity("Direct and challenging")).toBe("high");
    expect(mapGuidanceToneToIntensity("Calm and reflective")).toBe("gentle");
    expect(mapGuidanceToneToIntensity("Warm and encouraging")).toBe("gentle");
    expect(mapGuidanceToneToIntensity("Composed and polished")).toBe("medium");
  });

  it("supports legacy emoji-prefixed variants and falls back safely", () => {
    expect(mapGuidanceToneToIntensity("⚔️ Direct & demanding")).toBe("high");
    expect(mapGuidanceToneToIntensity("🌙 Calm and reflective")).toBe("gentle");
    expect(mapGuidanceToneToIntensity("🌷 Warm and encouraging")).toBe("gentle");
    expect(mapGuidanceToneToIntensity("🪞 Composed, polished, and standards-first")).toBe("medium");
    expect(mapGuidanceToneToIntensity("something unexpected")).toBe("medium");
  });
});

describe("deriveOnboardingMentorCandidates", () => {
  const mentors = [
    { id: "m1", slug: "sage", gender_energy: "masculine", tags: ["discipline"] },
    { id: "m2", slug: "charles", gender_energy: "masculine", tags: ["accountability"] },
    { id: "m3", slug: "princess", gender_energy: "feminine", tags: ["supportive"] },
    { id: "m4", slug: "icon", gender_energy: "feminine", tags: ["confidence"] },
    { id: "m5", slug: "operator", gender_energy: "masculine", tags: ["execution"] },
    { id: "m6", slug: "rival", gender_energy: "masculine", tags: ["momentum"] },
    { id: "m7", slug: "lyra", gender_energy: "feminine", tags: ["clarity"] },
  ];

  it("keeps only masculine mentors for masculine presence", () => {
    const result = deriveOnboardingMentorCandidates(mentors, [
      { questionId: "mentor_energy", optionId: "masculine_presence", tags: ["masculine_preference"] },
    ]);

    expect(result.energyPreference).toBe("masculine");
    expect(result.mentorsForSelection.map((mentor) => mentor.id)).toEqual(["m1", "m2", "m5", "m6"]);
  });

  it("keeps only feminine mentors for feminine presence", () => {
    const result = deriveOnboardingMentorCandidates(mentors, [
      { questionId: "mentor_energy", optionId: "feminine_presence", tags: ["feminine_preference"] },
    ]);

    expect(result.energyPreference).toBe("feminine");
    expect(result.mentorsForSelection.map((mentor) => mentor.id)).toEqual(["m1", "m2", "m3", "m4", "m7"]);
  });

  it("keeps only neutral mentors for neutral presence", () => {
    const result = deriveOnboardingMentorCandidates(mentors, [
      { questionId: "mentor_energy", optionId: "neutral_presence", tags: ["neutral_preference"] },
    ]);

    expect(result.energyPreference).toBe("neutral");
    expect(result.mentorsForSelection.map((mentor) => mentor.id)).toEqual(["m1", "m2"]);
  });

  it("keeps all mentors when no preference is selected", () => {
    const result = deriveOnboardingMentorCandidates(mentors, [
      { questionId: "mentor_energy", optionId: "either_works", tags: [] },
    ]);

    expect(result.energyPreference).toBe("no_preference");
    expect(result.mentorsForSelection.map((mentor) => mentor.id)).toEqual(["m1", "m2", "m3", "m4", "m5", "m6", "m7"]);
  });

  it("returns no mentors when a strict preference has no matches", () => {
    const feminineOnlyMentors = [
      { id: "f1", slug: "princess", gender_energy: "feminine", tags: ["supportive"] },
      { id: "f2", slug: "icon", gender_energy: "feminine", tags: ["confidence"] },
    ];
    const result = deriveOnboardingMentorCandidates(feminineOnlyMentors, [
      { questionId: "mentor_energy", optionId: "neutral_presence", tags: ["neutral_preference"] },
    ]);

    expect(result.energyPreference).toBe("neutral");
    expect(result.mentorsForSelection).toEqual([]);
  });
});

describe("resolveOnboardingBackdropStage", () => {
  it("covers all cinematic onboarding stages", () => {
    expect(resolveOnboardingBackdropStage("prologue")).toBe("prologue");
    expect(resolveOnboardingBackdropStage("destiny")).toBe("destiny");
    expect(resolveOnboardingBackdropStage("questionnaire")).toBe("questionnaire");
    expect(resolveOnboardingBackdropStage("calculating")).toBe("calculating");
    expect(resolveOnboardingBackdropStage("story-tone")).toBe("questionnaire");
    expect(resolveOnboardingBackdropStage("egg-prelude")).toBe("journey-begins");
    expect(resolveOnboardingBackdropStage("journey-begins")).toBe("journey-begins");
  });

  it("skips non-cinematic stages", () => {
    expect(resolveOnboardingBackdropStage("faction")).toBeNull();
    expect(resolveOnboardingBackdropStage("mentor-result")).toBeNull();
    expect(resolveOnboardingBackdropStage("mentor-grid")).toBeNull();
    expect(resolveOnboardingBackdropStage("companion")).toBeNull();
  });
});

describe("questionnaire completion stage", () => {
  it("routes to calculating before mentor reveal", () => {
    expect(resolveQuestionnaireCompletionStage()).toBe("calculating");
    expect(resolveQuestionnaireCompletionStage()).not.toBe("mentor-result");
  });
});

describe("mentor reveal transition timer", () => {
  it("advances to mentor reveal after exactly 2000ms", () => {
    vi.useFakeTimers();
    let didTransition = false;

    scheduleMentorRevealTransition(() => {
      didTransition = true;
    });

    expect(CALCULATING_STAGE_DURATION_MS).toBe(2000);
    expect(didTransition).toBe(false);

    vi.advanceTimersByTime(1999);
    expect(didTransition).toBe(false);

    vi.advanceTimersByTime(1);
    expect(didTransition).toBe(true);

    vi.useRealTimers();
  });
});

describe("questionnaire pipeline timeout helper", () => {
  it("uses an explicit bounded timeout for mentor matching", () => {
    expect(QUESTIONNAIRE_PIPELINE_TIMEOUT_MS).toBe(8000);
  });

  it("rejects when operation exceeds timeout", async () => {
    vi.useFakeTimers();

    const pending = new Promise<never>(() => {
      // Intentionally unresolved.
    });

    const timedOperation = runWithTimeout(pending, 25, "mentor_pipeline_timeout");
    vi.advanceTimersByTime(25);

    await expect(timedOperation).rejects.toThrow("mentor_pipeline_timeout");
    vi.useRealTimers();
  });
});
