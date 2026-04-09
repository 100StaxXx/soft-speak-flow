import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseNaturalLanguage } from "./useNaturalLanguageParser";

describe("parseNaturalLanguage duration parsing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-09T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses voice-style duration phrasing that uses last/take verbs", () => {
    const parsed = parseNaturalLanguage("Roadmap review it's gonna last 60 minutes tomorrow");

    expect(parsed).toEqual(expect.objectContaining({
      text: "Roadmap review",
      estimatedDuration: 60,
      scheduledDate: "2026-04-10",
    }));
  });

  it("keeps compound hour and minute durations intact", () => {
    const parsed = parseNaturalLanguage("Roadmap review for 1 hour and 30 minutes");

    expect(parsed).toEqual(expect.objectContaining({
      text: "Roadmap review",
      estimatedDuration: 90,
    }));
  });

  it("understands article and word-based hour durations", () => {
    const parsed = parseNaturalLanguage("Roadmap review should last an hour");

    expect(parsed).toEqual(expect.objectContaining({
      text: "Roadmap review",
      estimatedDuration: 60,
    }));
  });
});
