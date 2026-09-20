import { describe, expect, it } from "vitest";
import { buildWellbeingVideoPrompt, WELLBEING_CATEGORIES, WELLBEING_OPTIONS, WELLBEING_VIDEO_SECONDS, IDLE_VIDEO_CATEGORIES, companionVideoSeconds } from "./companionWellbeing";
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
    expect(WELLBEING_VIDEO_SECONDS).toBe(5);
    for (const prompt of prompts) {
      expect(prompt).toContain("exact last frame");
      expect(prompt).toContain("original resting pose");
      expect(prompt).toContain("Exactly 5 seconds");
      expect(prompt).not.toContain("out of frame");
    }
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
  it("provides four distinct four-second idle loops for every visual form", () => {
    expect(IDLE_VIDEO_CATEGORIES).toHaveLength(4);
    const prompts = [1,5,13,21,36,56,81].flatMap((stage) => IDLE_VIDEO_CATEGORIES.map((category) => {
      expect(companionVideoSeconds(category)).toBe(4);
      const prompt = buildWellbeingVideoPrompt(stage, category, "storm");
      expect(prompt).toContain("Exactly 4 seconds");
      expect(prompt).toContain("exact last frame");
      expect(prompt).toContain("original resting pose");
      return prompt;
    }));
    expect(new Set(prompts).size).toBe(28);
  });
});
