import { describe, expect, it } from "vitest";
import { getActiveWordIndex } from "./captionTiming";

describe("getActiveWordIndex", () => {
  it("hands off to the next word at an exact end boundary", () => {
    const transcript = [
      { start: 0, end: 0.5 },
      { start: 0.5, end: 1.0 },
    ];

    expect(getActiveWordIndex(transcript, 0.499)).toBe(0);
    expect(getActiveWordIndex(transcript, 0.5)).toBe(1);
  });

  it("returns -1 during timestamp gaps", () => {
    const transcript = [
      { start: 0, end: 0.4 },
      { start: 0.6, end: 1.0 },
    ];

    expect(getActiveWordIndex(transcript, 0.5)).toBe(-1);
  });

  it("returns -1 before first word and after last word", () => {
    const transcript = [
      { start: 0.2, end: 0.6 },
      { start: 0.7, end: 1.2 },
    ];

    expect(getActiveWordIndex(transcript, 0.1)).toBe(-1);
    expect(getActiveWordIndex(transcript, 1.2)).toBe(-1);
  });

  it("handles large seek jumps forward and backward using stale previous index", () => {
    const transcript = [
      { start: 0, end: 0.5 },
      { start: 0.5, end: 1.0 },
      { start: 1.0, end: 1.5 },
    ];

    expect(getActiveWordIndex(transcript, 1.2, 0)).toBe(2);
    expect(getActiveWordIndex(transcript, 0.2, 2)).toBe(0);
  });
});
