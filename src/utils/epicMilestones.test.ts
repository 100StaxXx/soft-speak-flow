import { describe, it, expect } from "vitest";
import {
  calculateTotalChapters,
  calculateChapterMilestones,
  getCurrentChapter,
  getNextMilestone,
  isChapterReached,
  getChapterProgress,
  shouldTriggerBossBattle,
} from "./epicMilestones";

describe("calculateTotalChapters", () => {
  it("returns base chapters for short epics", () => {
    expect(calculateTotalChapters(14, 3)).toBe(3);
    expect(calculateTotalChapters(29, 5)).toBe(5);
  });

  it("adds bonus chapter for 30+ day epics", () => {
    expect(calculateTotalChapters(30, 3)).toBe(4);
    expect(calculateTotalChapters(60, 5)).toBe(6);
  });
});

describe("calculateChapterMilestones", () => {
  it("distributes milestones evenly", () => {
    expect(calculateChapterMilestones(4)).toEqual([25, 50, 75, 100]);
    expect(calculateChapterMilestones(5)).toEqual([20, 40, 60, 80, 100]);
  });

  it("always ends at 100", () => {
    const result = calculateChapterMilestones(7);
    expect(result[result.length - 1]).toBe(100);
  });
});

describe("getCurrentChapter", () => {
  it("returns 0 for 0% progress", () => {
    expect(getCurrentChapter(0, 4)).toBe(0);
  });

  it("returns correct chapter for mid-progress", () => {
    expect(getCurrentChapter(30, 4)).toBe(1); // Past 25%, working toward 50%
    expect(getCurrentChapter(50, 4)).toBe(2); // At 50%, working toward 75%
  });

  it("returns totalChapters when complete", () => {
    expect(getCurrentChapter(100, 4)).toBe(4);
  });
});

describe("getNextMilestone", () => {
  it("returns first milestone for 0% progress", () => {
    expect(getNextMilestone(0, 4)).toBe(25);
  });

  it("returns null when all milestones reached", () => {
    expect(getNextMilestone(100, 4)).toBeNull();
  });
});

describe("isChapterReached", () => {
  it("returns true when progress meets milestone", () => {
    expect(isChapterReached(1, 25, 4)).toBe(true);
    expect(isChapterReached(2, 50, 4)).toBe(true);
  });

  it("returns false when progress is below milestone", () => {
    expect(isChapterReached(2, 40, 4)).toBe(false);
  });
});

describe("shouldTriggerBossBattle", () => {
  it("triggers at 100% when finale not completed", () => {
    expect(shouldTriggerBossBattle(100, false)).toBe(true);
  });

  it("does not trigger when finale already completed", () => {
    expect(shouldTriggerBossBattle(100, true)).toBe(false);
  });

  it("does not trigger below 100%", () => {
    expect(shouldTriggerBossBattle(99, false)).toBe(false);
  });
});

describe("getChapterProgress", () => {
  it("calculates progress within first chapter", () => {
    const result = getChapterProgress(12, 4); // 12% of 25%
    expect(result.currentChapter).toBe(1);
    expect(result.progressInChapter).toBe(48); // 12/25 = 48%
  });

  it("calculates progress in middle chapters", () => {
    const result = getChapterProgress(37, 4); // Between 25% and 50%
    expect(result.currentChapter).toBe(2);
    expect(result.progressInChapter).toBe(48); // (37-25)/25 = 48%
  });

  it("returns 100% progress for completed chapters", () => {
    const result = getChapterProgress(100, 4);
    expect(result.currentChapter).toBe(4);
    expect(result.progressInChapter).toBe(100);
  });
});
