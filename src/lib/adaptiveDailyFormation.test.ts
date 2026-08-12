import { describe, expect, it } from "vitest";

import { DAILY_FORMATION_PRACTICES } from "@/data/dailyFormationPractices";
import { selectAdaptiveDailyFormation, type FormationAssignmentHistory } from "./adaptiveDailyFormation";

const historyFor = (practiceIds: string[]): FormationAssignmentHistory[] => practiceIds.map((practiceKey, index) => {
  const practice = DAILY_FORMATION_PRACTICES.find((candidate) => candidate.id === practiceKey)!;
  return {
    practiceKey,
    practiceDate: `2026-08-${String(7 - index).padStart(2, "0")}`,
    category: practice.category,
    completedAt: "2026-08-07T18:00:00.000Z",
  };
});

describe("selectAdaptiveDailyFormation", () => {
  it("is deterministic for a user and local date", () => {
    const input = { dateKey: "2026-08-08", userId: "user-1" };
    expect(selectAdaptiveDailyFormation(input)).toEqual(selectAdaptiveDailyFormation(input));
  });

  it("does not repeat any of the last ten practices when fresh choices remain", () => {
    const recentIds = DAILY_FORMATION_PRACTICES.slice(0, 10).map((practice) => practice.id);
    const result = selectAdaptiveDailyFormation({
      dateKey: "2026-08-08",
      userId: "user-1",
      history: historyFor(recentIds),
    });
    expect(recentIds).not.toContain(result.practice.id);
  });

  it("fills a missing formation mode across the recent weekly rhythm", () => {
    const result = selectAdaptiveDailyFormation({
      dateKey: "2026-08-08",
      userId: "user-1",
      history: historyFor([
        "formation-01", // Inward
        "formation-02", // Reflective
        "formation-03", // Bodily
        "formation-04", // Relational
      ]),
    });

    expect(result.practice.mode).toBe("Outward");
  });

  it("responds to a relationship-focused reflection", () => {
    const result = selectAdaptiveDailyFormation({
      dateKey: "2026-08-08",
      userId: "user-1",
      reflections: [{ mood: "okay", additionalReflection: "I feel lonely after conflict with my family." }],
    });
    expect(result.practice.category).toBe("Soul");
    expect(result.reason).toContain("reflection");
  });

  it("chooses a manageable practice after an overwhelming day", () => {
    const result = selectAdaptiveDailyFormation({
      dateKey: "2026-08-08",
      userId: "user-1",
      reflections: [{ mood: "rough", tomorrowAdjustment: "I was overwhelmed and exhausted." }],
    });
    expect(result.practice.minutes).toBeLessThanOrEqual(5);
    expect(result.reason).toContain("manageable");
  });

  it("uses learned completion categories as a positive signal", () => {
    const result = selectAdaptiveDailyFormation({
      dateKey: "2026-08-08",
      userId: "user-1",
      learning: { successfulPatterns: { formation_categories: { Body: 20 } } },
    });
    expect(result.practice.category).toBe("Body");
  });

  it("aligns the Faithful Step with the focus chosen in the Guide reflection", () => {
    const result = selectAdaptiveDailyFormation({
      dateKey: "2026-08-08",
      userId: "user-1",
      focusCategory: "Body",
    });

    expect(result.practice.category).toBe("Body");
    expect(result.reason).toBe("Connected to the focus you chose with your Guide");
  });

  it("selects a distinct practice with the correct focus for every daily pillar", () => {
    const selections = (["Mind", "Body", "Soul"] as const).map((focusCategory) =>
      selectAdaptiveDailyFormation({
        dateKey: "2026-08-11",
        userId: "user-1",
        focusCategory,
      }).practice);

    expect(new Set(selections.map(({ id }) => id)).size).toBe(3);
    expect(selections.map(({ category }) => category)).toEqual(["Mind", "Body", "Soul"]);
    expect(selections[0].focus).toBe("knowledge");
    expect(["exercise", "nutrition"]).toContain(selections[1].focus);
    expect(["scripture", "faith"]).toContain(selections[2].focus);
  });
});
