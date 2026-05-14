import { describe, expect, it } from "vitest";
import {
  COMPANION_CHAT_OPENING_LINES,
  getRandomCompanionChatOpeningLine,
} from "./companionChatOpeners";

describe("companion chat openers", () => {
  it("contains the companion chat opener bucket", () => {
    expect(COMPANION_CHAT_OPENING_LINES).toHaveLength(73);
    expect(COMPANION_CHAT_OPENING_LINES).toContain("what's gucci fam");
    expect(COMPANION_CHAT_OPENING_LINES).toContain("yo, talk to me");
    expect(COMPANION_CHAT_OPENING_LINES).toContain(
      "what's the overall vibe rn",
    );
    expect(COMPANION_CHAT_OPENING_LINES).toContain("How are you feeling");
  });

  it("selects a stable bucket entry from a random fraction", () => {
    expect(getRandomCompanionChatOpeningLine(() => 0)).toBe(
      COMPANION_CHAT_OPENING_LINES[0],
    );
    expect(getRandomCompanionChatOpeningLine(() => 0.999999999999)).toBe(
      COMPANION_CHAT_OPENING_LINES[COMPANION_CHAT_OPENING_LINES.length - 1],
    );
  });
});
