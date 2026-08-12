import { describe, expect, it } from "vitest";

import { estimateWordTiming } from "./estimatedWordTiming";

describe("estimateWordTiming", () => {
  it("spreads every script word across the audio duration", () => {
    const transcript = estimateWordTiming("Be still, and receive grace.", 8);

    expect(transcript.map((word) => word.word)).toEqual([
      "Be",
      "still,",
      "and",
      "receive",
      "grace.",
    ]);
    expect(transcript[0].start).toBeGreaterThanOrEqual(0);
    expect(transcript.at(-1)?.end).toBe(8);
    expect(transcript.every((word) => word.end > word.start)).toBe(true);
  });

  it("returns no words without usable audio metadata", () => {
    expect(estimateWordTiming("A daily word", 0)).toEqual([]);
    expect(estimateWordTiming("", 10)).toEqual([]);
  });
});
