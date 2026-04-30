import { describe, expect, it } from "vitest";

import { normalizeJourneySchedule, type JourneySchedule } from "./useJourneySchedule";

const baseSchedule = {
  feasibilityAssessment: {
    daysAvailable: 30,
    typicalDays: 30,
    feasibility: "achievable",
    message: "You can do this.",
  },
  phases: [],
  milestones: [],
  rituals: [],
  weeklyHoursEstimate: 5,
  suggestedChapterCount: 3,
  executionModel: "sequential",
} satisfies JourneySchedule;

describe("normalizeJourneySchedule", () => {
  it("normalizes ritual timing from snake_case responses and falls back when missing", () => {
    const schedule = normalizeJourneySchedule({
      ...baseSchedule,
      rituals: [
        {
          id: "ritual-1",
          title: "Morning review",
          description: "Check the plan.",
          frequency: "daily",
          difficulty: "easy",
          preferred_time: "8:05",
          estimated_minutes: 25,
        },
        {
          id: "ritual-2",
          title: "Deep work",
          description: "Main practice block.",
          frequency: "daily",
          difficulty: "medium",
          preferredTime: "not a time",
          estimatedMinutes: 30.5,
        },
      ],
    } as JourneySchedule);

    expect(schedule.rituals[0]).toEqual(expect.objectContaining({
      preferredTime: "08:05",
      estimatedMinutes: 25,
    }));
    expect(schedule.rituals[1]).toEqual(expect.objectContaining({
      preferredTime: "10:00",
      estimatedMinutes: undefined,
    }));
  });
});
