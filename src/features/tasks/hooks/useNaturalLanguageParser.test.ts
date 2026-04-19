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

  it("treats in one hour as a relative scheduled time instead of a duration", () => {
    const parsed = parseNaturalLanguage("Walk the dog in one hour");

    expect(parsed).toEqual(expect.objectContaining({
      text: "Walk the dog",
      scheduledDate: "2026-04-09",
      scheduledTime: "13:00",
      estimatedDuration: null,
    }));
  });

  it("supports minute-based relative scheduling phrases", () => {
    const parsed = parseNaturalLanguage("Walk the dog in 15 minutes");

    expect(parsed).toEqual(expect.objectContaining({
      text: "Walk the dog",
      scheduledDate: "2026-04-09",
      scheduledTime: "12:15",
      estimatedDuration: null,
    }));
  });

  it("supports half-hour relative scheduling phrases", () => {
    const parsed = parseNaturalLanguage("Walk the dog in half an hour");

    expect(parsed).toEqual(expect.objectContaining({
      text: "Walk the dog",
      scheduledDate: "2026-04-09",
      scheduledTime: "12:30",
      estimatedDuration: null,
    }));
  });

  it("parses relative scheduling and duration together when both are present", () => {
    const parsed = parseNaturalLanguage("Call mom in 2 hours for 1 hour");

    expect(parsed).toEqual(expect.objectContaining({
      text: "Call mom",
      scheduledDate: "2026-04-09",
      scheduledTime: "14:00",
      estimatedDuration: 60,
    }));
  });

  it("rolls the date over when a relative time crosses midnight", () => {
    vi.setSystemTime(new Date("2026-04-09T23:45:00"));

    const parsed = parseNaturalLanguage("Walk the dog in 30 minutes");

    expect(parsed).toEqual(expect.objectContaining({
      text: "Walk the dog",
      scheduledDate: "2026-04-10",
      scheduledTime: "00:15",
      estimatedDuration: null,
    }));
  });

  it("keeps explicit absolute times ahead of relative time phrases", () => {
    const parsed = parseNaturalLanguage("Walk the dog at 5pm in one hour");

    expect(parsed).toEqual(expect.objectContaining({
      text: "Walk the dog",
      scheduledTime: "17:00",
      estimatedDuration: null,
    }));
  });
});

describe("parseNaturalLanguage title preservation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T09:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("extracts the quest title from add-to-schedule phrasing without losing workout", () => {
    const parsed = parseNaturalLanguage("Add workout to today's schedule for 3pm");

    expect(parsed).toEqual(expect.objectContaining({
      text: "workout",
      category: "body",
      scheduledDate: "2026-04-19",
      scheduledTime: "15:00",
    }));
  });

  it("keeps workout as the visible title for direct scheduling phrases", () => {
    const parsed = parseNaturalLanguage("workout at 3pm today");

    expect(parsed).toEqual(expect.objectContaining({
      text: "workout",
      category: "body",
      scheduledDate: "2026-04-19",
      scheduledTime: "15:00",
    }));
  });

  it("keeps exercise as the visible title while still inferring body category", () => {
    const parsed = parseNaturalLanguage("exercise tomorrow");

    expect(parsed).toEqual(expect.objectContaining({
      text: "exercise",
      category: "body",
      scheduledDate: "2026-04-20",
    }));
  });

  it("preserves the entered body title words instead of stripping them as category metadata", () => {
    const parsed = parseNaturalLanguage("body workout at 3pm");

    expect(parsed).toEqual(expect.objectContaining({
      text: "body workout",
      category: "body",
      scheduledTime: "15:00",
    }));
  });
});
