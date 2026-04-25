import { describe, expect, it } from "vitest";

import { getSmartPrompts } from "./AskMentorChat";

describe("getSmartPrompts", () => {
  it("uses Lyra-specific signal prompts", () => {
    const prompts = getSmartPrompts("lyra", "Futuristic, poised, and precise", false, false);

    expect(prompts).toContain("Help me find the signal");
    expect(prompts).toContain("Show me the pattern I'm missing");
  });
});
