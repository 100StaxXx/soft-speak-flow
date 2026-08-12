import { describe, expect, it } from "vitest";

import { DAILY_FORMATION_PRACTICES, getDailyFormationPractice } from "./dailyFormationPractices";

describe("daily formation practices", () => {
  it("offers a reviewed practice pool across all three daily pillars", () => {
    expect(DAILY_FORMATION_PRACTICES).toHaveLength(90);

    const categoryCounts = Object.fromEntries(
      ["Mind", "Body", "Soul"]
        .map((category) => [
          category,
          DAILY_FORMATION_PRACTICES.filter((practice) => practice.category === category).length,
        ]),
    );
    expect(categoryCounts).toEqual({ Mind: 30, Body: 30, Soul: 30 });
    expect(new Set(DAILY_FORMATION_PRACTICES.map((practice) => practice.category))).toEqual(
      new Set(["Mind", "Body", "Soul"]),
    );
    expect(new Set(DAILY_FORMATION_PRACTICES.map((practice) => practice.mode))).toEqual(
      new Set(["Inward", "Reflective", "Relational", "Outward", "Bodily"]),
    );
  });

  it("keeps every reviewed practice gentle, concise, and equally rewarded", () => {
    const ids = new Set<string>();

    for (const practice of DAILY_FORMATION_PRACTICES) {
      expect(practice.id).toMatch(/^formation-[0-9]{2}$/);
      expect(ids.has(practice.id)).toBe(false);
      ids.add(practice.id);
      expect(practice.title.trim().split(/\s+/).length).toBeGreaterThanOrEqual(2);
      expect(practice.title.trim().split(/\s+/).length).toBeLessThanOrEqual(4);
      expect(practice.action.length).toBeGreaterThan(20);
      expect(practice.action.trim().split(/\s+/).length).toBeLessThanOrEqual(25);
      expect(practice.action.toLowerCase()).not.toContain("tomorrow");
      expect(practice.action.toLowerCase()).not.toMatch(/\b(must|should|streak)\b/);
      expect(practice.benefit.length).toBeGreaterThan(20);
      expect(practice.benefit).toMatch(/^Practices /);
      expect(practice.minutes).toBeGreaterThanOrEqual(2);
      expect(practice.minutes).toBeLessThanOrEqual(15);
      expect(practice.xpReward).toBe(10);
      expect(practice.source).toBe("reviewed");
      expect(practice.scriptureReference).toBeNull();
    }
  });

  it("keeps each pillar inside its intended formation boundary", () => {
    const allowedFocuses = {
      Mind: ["knowledge"],
      Body: ["exercise", "nutrition"],
      Soul: ["scripture", "faith"],
    } as const;

    for (const practice of DAILY_FORMATION_PRACTICES) {
      expect(allowedFocuses[practice.category]).toContain(practice.focus);
    }

    expect(DAILY_FORMATION_PRACTICES.filter(({ category }) => category === "Mind").every(
      ({ focus }) => focus === "knowledge",
    )).toBe(true);
    expect(new Set(DAILY_FORMATION_PRACTICES.filter(({ category }) => category === "Body").map(
      ({ focus }) => focus,
    ))).toEqual(new Set(["exercise", "nutrition"]));
    expect(new Set(DAILY_FORMATION_PRACTICES.filter(({ category }) => category === "Soul").map(
      ({ focus }) => focus,
    ))).toEqual(new Set(["scripture", "faith"]));
  });

  it("stays stable within a local day and advances the next day", () => {
    expect(getDailyFormationPractice(new Date(2026, 7, 8, 0, 5))).toEqual(
      getDailyFormationPractice(new Date(2026, 7, 8, 23, 55)),
    );
    expect(getDailyFormationPractice(new Date(2026, 7, 8))).not.toEqual(
      getDailyFormationPractice(new Date(2026, 7, 9)),
    );
  });
});
