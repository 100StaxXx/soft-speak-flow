import { describe, expect, it } from "vitest";
import { buildWellbeingVideoPrompt, WELLBEING_CATEGORIES, WELLBEING_OPTIONS, WELLBEING_VIDEO_SECONDS } from "./companionWellbeing";
describe("Wellbeing prompts", () => {
  it("has a distinct action for every form and category", () => {
    const prompts = [1,5,13,21,36,56,81].flatMap((stage) => WELLBEING_CATEGORIES.map((category) => buildWellbeingVideoPrompt(stage, category, "storm")));
    expect(new Set(prompts).size).toBe(21);
    for (const prompt of prompts) {
      expect(prompt).toContain("exact first frame");
      expect(prompt).toContain("no lightning flashes");
      expect(prompt).toContain("No cuts");
      expect(prompt).toContain("current evolution form");
    }
    expect(WELLBEING_VIDEO_SECONDS).toBe(3);
  });
  it("reuses the same form prompt between visual evolution boundaries", () => {
    expect(buildWellbeingVideoPrompt(12, "mind", "ice")).toBe(buildWellbeingVideoPrompt(5, "mind", "ice"));
    expect(() => buildWellbeingVideoPrompt(0, "mind", "ice")).toThrow();
  });
  it("offers secular, optional activities", () => {
    const content = JSON.stringify(WELLBEING_OPTIONS);
    expect(content).not.toMatch(/bible|prayer|scripture|god|worship|church|must|streak/i);
    expect(WELLBEING_OPTIONS.soul.suggestions.map((idea) => idea.title).join(" ")).toMatch(/nature/);
  });
});
