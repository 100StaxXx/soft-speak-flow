import { describe, expect, it } from "vitest";

import {
  getAchievementTypeVariants,
  hasDynamicAchievementTypeAlias,
  normalizeAchievementType,
} from "@/lib/achievementTypes";

describe("achievementTypes", () => {
  it("normalizes legacy achievement ids to their canonical badge ids", () => {
    expect(normalizeAchievementType("three_day_streak")).toBe("streak_3_day");
    expect(normalizeAchievementType("first_checkin")).toBe("first_check_in");
    expect(normalizeAchievementType("first_mission")).toBe("first_quest");
    expect(normalizeAchievementType("all_tasks_complete")).toBe("perfect_day");
  });

  it("normalizes dynamic story chapter achievement ids", () => {
    expect(normalizeAchievementType("story_chapter_1")).toBe("story_chapter");
    expect(normalizeAchievementType("story_chapter_12")).toBe("story_chapter");
    expect(hasDynamicAchievementTypeAlias("story_chapter_3")).toBe(true);
  });

  it("returns all equivalent static variants for duplicate detection", () => {
    expect(getAchievementTypeVariants("streak_7_day")).toEqual([
      "streak_7_day",
      "week_streak",
    ]);
    expect(getAchievementTypeVariants("week_streak")).toEqual([
      "streak_7_day",
      "week_streak",
    ]);
  });
});
