import { describe, expect, it } from "vitest";

import { getSmartPrompts } from "./AskMentorChat";

describe("getSmartPrompts", () => {
  it.each([
    [
      "Micah",
      "sage",
      [
        "Help me slow down and sort through what's weighing on me",
        "Ask me a reflection question for today",
        "Help me notice one faithful next step",
      ],
    ],
    [
      "Clara",
      "lyra",
      [
        "Help me sort what matters from what is noise",
        "Ask me questions to help me make a wise decision",
        "Help me understand a pattern I keep repeating",
      ],
    ],
    [
      "Lydia",
      "icon",
      [
        "Help me decide whether I need a boundary",
        "Help me say something honest and gracious",
        "Help me make a choice that fits my values",
      ],
    ],
    [
      "Jude",
      "charles",
      [
        "Help me name what I'm avoiding",
        "Give me one small action to take now",
        "Hold me accountable without shaming me",
      ],
    ],
    [
      "Grace",
      "princess",
      [
        "Help me create a gentle rhythm for today",
        "Help me make room for prayer, work, and rest",
        "Help me restart after falling out of a routine",
      ],
    ],
    [
      "Ezra",
      "operator",
      [
        "Help me turn today's responsibilities into a realistic plan",
        "Help me decide what to do first",
        "Help me use my time and energy wisely",
      ],
    ],
    [
      "Caleb",
      "rival",
      [
        "Help me face something I've been avoiding",
        "Challenge me to take one courageous next step",
        "Help me keep going when I want to quit",
      ],
    ],
  ])("uses Graceward prompts written for %s", (_guideName, slug, expectedPrompts) => {
    expect(getSmartPrompts(slug, "", false, false)).toEqual(expectedPrompts);
  });

  it("also resolves a Graceward guide's display name", () => {
    expect(getSmartPrompts("Ezra", "", false, false)).toEqual([
      "Help me turn today's responsibilities into a realistic plan",
      "Help me decide what to do first",
      "Help me use my time and energy wisely",
    ]);
  });

  it("keeps Graceward faith language out of Cosmiq prompts", () => {
    const prompts = getSmartPrompts("princess", "", false, false, "cosmiq");
    expect(prompts).toEqual([
      "Help me create a gentle rhythm for today",
      "Help me make room for focus, care, and rest",
      "Help me restart after falling out of a routine",
    ]);
    expect(prompts.join(" ")).not.toMatch(/\b(?:pray|prayer|faithful|grace)\b/i);
  });
});
