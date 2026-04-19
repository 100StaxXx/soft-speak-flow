import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseNaturalLanguage } from "./naturalLanguageTaskParser";

describe("shared natural-language task parser scheduling coverage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T09:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses simple natural scheduling phrases", () => {
    const parsed = parseNaturalLanguage("gym at 5pm tomorrow");

    expect(parsed).toEqual(expect.objectContaining({
      text: "gym",
      scheduledDate: "2026-04-20",
      scheduledTime: "17:00",
    }));
  });

  it("parses bare 24-hour times", () => {
    const parsed = parseNaturalLanguage("gym 17:00 tomorrow");

    expect(parsed).toEqual(expect.objectContaining({
      text: "gym",
      scheduledDate: "2026-04-20",
      scheduledTime: "17:00",
    }));
  });

  it("parses ISO dates", () => {
    const parsed = parseNaturalLanguage("gym on 2026-04-20 at 17:00");

    expect(parsed).toEqual(expect.objectContaining({
      text: "gym",
      scheduledDate: "2026-04-20",
      scheduledTime: "17:00",
    }));
  });

  it("parses month day year phrases with an explicit year", () => {
    const parsed = parseNaturalLanguage("gym on April 20, 2026");

    expect(parsed).toEqual(expect.objectContaining({
      text: "gym",
      scheduledDate: "2026-04-20",
    }));
  });

  it("distinguishes this monday from next monday", () => {
    const thisMonday = parseNaturalLanguage("gym this monday");
    const nextMonday = parseNaturalLanguage("gym next monday");

    expect(thisMonday).toEqual(expect.objectContaining({
      text: "gym",
      scheduledDate: "2026-04-20",
    }));
    expect(nextMonday).toEqual(expect.objectContaining({
      text: "gym",
      scheduledDate: "2026-04-27",
    }));
  });

  it("parses reminder phrasing without losing the quest title", () => {
    const parsed = parseNaturalLanguage("remind me 30 minutes before workout");

    expect(parsed).toEqual(expect.objectContaining({
      text: "workout",
      reminderEnabled: true,
      reminderMinutesBefore: 30,
    }));
  });

  it("strips first-person lead-ins while preserving lunch in scheduled quest titles", () => {
    const parsed = parseNaturalLanguage("I'm going to grab lunch with Zach today at 1");

    expect(parsed).toEqual(expect.objectContaining({
      text: "grab lunch with Zach",
      scheduledDate: "2026-04-19",
      scheduledTime: "13:00",
    }));
  });

  it("keeps lunch in the visible title when lunch implies noon", () => {
    const parsed = parseNaturalLanguage("grab lunch with Zach");

    expect(parsed).toEqual(expect.objectContaining({
      text: "grab lunch with Zach",
      scheduledTime: "12:00",
    }));
  });

  it("keeps lunch in the title while explicit times win over implied noon", () => {
    const parsed = parseNaturalLanguage("lunch with Zach at 1");

    expect(parsed).toEqual(expect.objectContaining({
      text: "lunch with Zach",
      scheduledTime: "13:00",
    }));
  });
});
