import { describe, expect, it } from "vitest";

import { CHRISTIAN_DAILY_CONTENT, getChristianDailyContent } from "./christianDailyContent";

describe("reviewed Christian daily content", () => {
  it("keeps every displayed Scripture excerpt tied to an exact public-domain source", () => {
    expect(CHRISTIAN_DAILY_CONTENT).toHaveLength(7);
    for (const item of CHRISTIAN_DAILY_CONTENT) {
      expect(item.reference).toMatch(/\d/);
      expect(item.text.length).toBeGreaterThan(20);
      expect(item.translation).toBe("WEB");
      expect(item.translationLabel).toContain("World English Bible Classic");
      expect(item.sourceUrl).toMatch(/^https:\/\/ebible\.org\/eng-web\//);
      expect(item.prayer).toMatch(/Amen\.$/);
      expect(item.practice.length).toBeGreaterThan(10);
    }
  });

  it("rotates deterministically by calendar day without daylight-saving drift", () => {
    expect(getChristianDailyContent(new Date(2026, 2, 8, 0, 5))).toEqual(
      getChristianDailyContent(new Date(2026, 2, 8, 23, 55)),
    );
    expect(getChristianDailyContent(new Date(2026, 2, 8))).not.toEqual(
      getChristianDailyContent(new Date(2026, 2, 9)),
    );
  });
});
