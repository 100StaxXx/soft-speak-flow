import { describe, expect, it } from "vitest";
import {
  getRemainingDailyTaskBadgeCount,
  normalizeRemainingTodayBadgeCount,
  shouldSyncRemainingTodayBadge,
} from "@/hooks/useDailyTaskBadgeSync";

describe("daily task badge sync", () => {
  it("counts incomplete quests and rituals as the badge value", () => {
    expect(getRemainingDailyTaskBadgeCount([
      { completed: false },
      { completed: null },
      { completed: true },
      { completed: false },
    ])).toBe(3);
  });

  it("normalizes the canonical remaining-today count", () => {
    expect(normalizeRemainingTodayBadgeCount(4.9)).toBe(4);
    expect(normalizeRemainingTodayBadgeCount(-2)).toBe(0);
    expect(normalizeRemainingTodayBadgeCount("not-a-count")).toBe(0);
  });

  it("only writes the native badge after a canonical count resolves", () => {
    expect(shouldSyncRemainingTodayBadge({
      enabled: true,
      hasCanonicalCount: true,
      isLoading: false,
    })).toBe(true);

    expect(shouldSyncRemainingTodayBadge({
      enabled: true,
      hasCanonicalCount: false,
      isLoading: false,
    })).toBe(false);
  });
});
