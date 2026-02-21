import {
  HABIT_XP_REWARDS,
  SYSTEM_XP_REWARDS,
  DAILY_XP_CAP,
  POST_CAP_REPEATABLE_MULTIPLIER,
  getEffectiveQuestXP,
  getQuestXPMultiplier,
} from "./xpRewards";

describe("xpRewards rebalance constants", () => {
  it("uses rebalanced habit and bonus values", () => {
    expect(HABIT_XP_REWARDS.EASY).toBe(10);
    expect(HABIT_XP_REWARDS.MEDIUM).toBe(14);
    expect(HABIT_XP_REWARDS.HARD).toBe(20);
    expect(SYSTEM_XP_REWARDS.ALL_HABITS_COMPLETE).toBe(20);
  });

  it("uses updated repeatable cap values", () => {
    expect(DAILY_XP_CAP).toBe(260);
    expect(POST_CAP_REPEATABLE_MULTIPLIER).toBe(0.35);
  });
});

describe("quest position multiplier boundaries", () => {
  it("applies the expected diminishing multiplier by quest position", () => {
    expect(getQuestXPMultiplier(1)).toBe(1.0);
    expect(getQuestXPMultiplier(4)).toBe(1.0);
    expect(getQuestXPMultiplier(5)).toBe(0.75);
    expect(getQuestXPMultiplier(6)).toBe(0.5);
    expect(getQuestXPMultiplier(7)).toBe(0.25);
    expect(getQuestXPMultiplier(8)).toBe(0.25);
    expect(getQuestXPMultiplier(9)).toBe(0.1);
    expect(getQuestXPMultiplier(15)).toBe(0.1);
  });

  it("calculates effective quest XP from difficulty and quest position", () => {
    expect(getEffectiveQuestXP("easy", 1)).toBe(12);
    expect(getEffectiveQuestXP("hard", 5)).toBe(17);
    expect(getEffectiveQuestXP("hard", 8)).toBe(6);
    expect(getEffectiveQuestXP("medium", 10)).toBe(2);
  });
});
