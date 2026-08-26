import { describe, expect, it } from "vitest";
import {
  COMPANION_CHAT_OPENING_LINES,
  getCompanionChatOpeningLines,
  getRandomCompanionChatOpeningLine,
} from "./companionChatOpeners";

describe("companion chat openers", () => {
  it("contains the companion chat opener bucket", () => {
    expect(COMPANION_CHAT_OPENING_LINES).toHaveLength(30);
    expect(COMPANION_CHAT_OPENING_LINES).toContain(
      "I'm here. What's on your heart today?",
    );
    expect(COMPANION_CHAT_OPENING_LINES).toContain(
      "Would it help to reflect, pray, or take one small step?",
    );
    expect(COMPANION_CHAT_OPENING_LINES).toContain(
      "What would a faithful next step look like today?",
    );
    expect(COMPANION_CHAT_OPENING_LINES).toContain(
      "Tell me what today has felt like so far.",
    );
    expect(COMPANION_CHAT_OPENING_LINES.join(" ")).not.toMatch(
      /\b(?:fam|gucci|vibe|poppin|gang)\b/i,
    );
  });

  it("selects a stable bucket entry from a random fraction", () => {
    expect(getRandomCompanionChatOpeningLine(() => 0)).toBe(
      COMPANION_CHAT_OPENING_LINES[0],
    );
    expect(getRandomCompanionChatOpeningLine(() => 0.999999999999)).toBe(
      COMPANION_CHAT_OPENING_LINES[COMPANION_CHAT_OPENING_LINES.length - 1],
    );
  });

  it("keeps Graceward prayer language out of Cosmiq openers", () => {
    const cosmiqLines = getCompanionChatOpeningLines("cosmiq");
    expect(cosmiqLines).toHaveLength(30);
    expect(cosmiqLines.join(" ")).not.toMatch(/\b(?:pray|prayer|faithful|grace)\b/i);
  });
});
