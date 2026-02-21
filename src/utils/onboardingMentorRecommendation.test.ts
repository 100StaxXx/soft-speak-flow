import { describe, expect, it } from "vitest";

import {
  type OnboardingAnswerLike,
  recommendMentorFromAnswers,
} from "@/utils/onboardingMentorRecommendation";

const fixtureMentors = [
  {
    id: "m-atlas",
    slug: "atlas",
    tags: ["discipline", "calm"],
    themes: ["discipline", "clarity"],
    intensity_level: "medium",
    gender_energy: "masculine",
  },
  {
    id: "m-eli",
    slug: "eli",
    tags: ["confidence", "supportive"],
    themes: ["confidence", "momentum"],
    intensity_level: "medium",
    gender_energy: "masculine",
  },
  {
    id: "m-stryker",
    slug: "stryker",
    tags: ["discipline", "momentum"],
    themes: ["performance", "resilience"],
    intensity_level: "high",
    gender_energy: "masculine",
  },
  {
    id: "m-sienna",
    slug: "sienna",
    tags: ["healing", "supportive"],
    themes: ["healing", "calm"],
    intensity_level: "gentle",
    gender_energy: "feminine",
  },
  {
    id: "m-carmen",
    slug: "carmen",
    tags: ["discipline", "confidence"],
    themes: ["discipline", "leadership"],
    intensity_level: "high",
    gender_energy: "feminine",
  },
  {
    id: "m-reign",
    slug: "reign",
    tags: ["momentum", "discipline"],
    themes: ["physique", "business"],
    intensity_level: "high",
    gender_energy: "feminine",
  },
  {
    id: "m-solace",
    slug: "solace",
    tags: ["supportive", "confidence"],
    themes: ["confidence", "self_belief"],
    intensity_level: "medium",
    gender_energy: "feminine",
  },
] as const;

const mentorEnergyOptions = [
  { answer: "Feminine presence", tags: ["feminine_preference"] },
  { answer: "Masculine presence", tags: ["masculine_preference"] },
  { answer: "Either works for me", tags: [] },
];

const focusAreaOptions = [
  { answer: "Clarity & mindset", tags: ["calm", "discipline"] },
  { answer: "Emotions & healing", tags: ["healing", "supportive"] },
  { answer: "Discipline & performance", tags: ["discipline", "momentum"] },
  { answer: "Confidence & self-belief", tags: ["confidence", "supportive"] },
];

const guidanceToneOptions = [
  { answer: "Gentle & compassionate", tags: ["healing", "calm"] },
  { answer: "Encouraging & supportive", tags: ["supportive", "confidence"] },
  { answer: "Calm & grounded", tags: ["calm", "discipline"] },
  { answer: "Direct & demanding", tags: ["discipline", "momentum"] },
];

const progressStyleOptions = [
  { answer: "Clear principles and logic", tags: ["calm", "discipline"] },
  { answer: "Emotional reassurance", tags: ["supportive", "healing"] },
  { answer: "Someone who believes in me", tags: ["confidence", "supportive"] },
  { answer: "Pressure and high standards", tags: ["discipline", "momentum"] },
];

const toQuestionAnswers = (
  mentorEnergy: (typeof mentorEnergyOptions)[number],
  focusArea: (typeof focusAreaOptions)[number],
  guidanceTone: (typeof guidanceToneOptions)[number],
  progressStyle: (typeof progressStyleOptions)[number],
): OnboardingAnswerLike[] => [
  {
    questionId: "mentor_energy",
    answer: mentorEnergy.answer,
    tags: mentorEnergy.tags,
  },
  {
    questionId: "focus_area",
    answer: focusArea.answer,
    tags: focusArea.tags,
  },
  {
    questionId: "guidance_tone",
    answer: guidanceTone.answer,
    tags: guidanceTone.tags,
  },
  {
    questionId: "progress_style",
    answer: progressStyle.answer,
    tags: progressStyle.tags,
  },
];

describe("recommendMentorFromAnswers", () => {
  it("returns a mentor for every questionnaire combination when active mentors exist", () => {
    const combinations: OnboardingAnswerLike[][] = [];

    for (const mentorEnergy of mentorEnergyOptions) {
      for (const focusArea of focusAreaOptions) {
        for (const guidanceTone of guidanceToneOptions) {
          for (const progressStyle of progressStyleOptions) {
            combinations.push(
              toQuestionAnswers(mentorEnergy, focusArea, guidanceTone, progressStyle),
            );
          }
        }
      }
    }

    expect(combinations).toHaveLength(192);

    for (const answers of combinations) {
      const result = recommendMentorFromAnswers([...fixtureMentors], answers);

      expect(result.reason).toBe("ok");
      expect(result.mentor).not.toBeNull();
      expect(
        fixtureMentors.some((mentor) => mentor.id === result.mentor?.id),
      ).toBe(true);
    }
  });

  it("falls back to full mentor pool when strict energy has no matches", () => {
    const feminineOnlyMentors = fixtureMentors.filter(
      (mentor) => mentor.gender_energy === "feminine",
    );
    const answers = toQuestionAnswers(
      { answer: "Masculine presence", tags: ["masculine_preference"] },
      focusAreaOptions[1],
      guidanceToneOptions[0],
      progressStyleOptions[1],
    );

    const result = recommendMentorFromAnswers(feminineOnlyMentors, answers);

    expect(result.reason).toBe("ok");
    expect(result.usedEnergyFallback).toBe(true);
    expect(result.mentor).not.toBeNull();
    expect(feminineOnlyMentors.some((mentor) => mentor.id === result.mentor?.id)).toBe(true);
  });

  it("returns no_active_mentors when mentor list is empty", () => {
    const answers = toQuestionAnswers(
      mentorEnergyOptions[0],
      focusAreaOptions[0],
      guidanceToneOptions[0],
      progressStyleOptions[0],
    );
    const result = recommendMentorFromAnswers([], answers);

    expect(result.reason).toBe("no_active_mentors");
    expect(result.mentor).toBeNull();
    expect(result.mentorScores).toEqual([]);
    expect(result.topScore).toBe(0);
  });
});
