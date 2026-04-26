import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildQuestPrefillFromNaturalLanguage,
  buildVoiceQuestPrefillFromTranscript,
} from "./voiceQuestPrefill";

describe("buildVoiceQuestPrefillFromTranscript", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-09T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("extracts core scheduling, reminder, notes, and source fields from spoken input", () => {
    const prefill = buildVoiceQuestPrefillFromTranscript(
      "Deep work tomorrow at 3pm for 2 hours with a 30 minute reminder notes: bring roadmap",
    );

    expect(prefill).toEqual(expect.objectContaining({
      text: "Deep Work",
      taskDate: "2026-04-10",
      scheduledTime: "15:00",
      estimatedDuration: 120,
      reminderEnabled: true,
      reminderMinutesBefore: 30,
      moreInformation: "bring roadmap",
      creationSource: "voice",
    }));
  });

  it("maps spoken weekday frequency into the quest recurrence fields", () => {
    const prefill = buildVoiceQuestPrefillFromTranscript("Stretch weekdays at 7am");

    expect(prefill).toEqual(expect.objectContaining({
      text: "Stretch",
      scheduledTime: "07:00",
      recurrencePattern: "weekdays",
      recurrenceDays: [0, 1, 2, 3, 4],
      recurrenceCustomPeriod: null,
    }));
  });

  it("derives the monthly recurrence day from the parsed schedule date when needed", () => {
    const prefill = buildVoiceQuestPrefillFromTranscript("Pay rent monthly on April 30 at 8am");

    expect(prefill).toEqual(expect.objectContaining({
      text: "Pay Rent",
      taskDate: "2026-04-30",
      scheduledTime: "08:00",
      recurrencePattern: "monthly",
      recurrenceMonthDays: [30],
    }));
  });

  it("removes bare ordinal date phrasing from the voice title while preserving the scheduled date", () => {
    const prefill = buildVoiceQuestPrefillFromTranscript("Pilates on the 14th");

    expect(prefill).toEqual(expect.objectContaining({
      text: "Pilates",
      taskDate: "2026-04-14",
      creationSource: "voice",
    }));
  });

  it("strips spoken duration phrasing from the quest title while keeping the parsed minutes", () => {
    const prefill = buildVoiceQuestPrefillFromTranscript("Deep work it's gonna last 60 minutes tomorrow");

    expect(prefill).toEqual(expect.objectContaining({
      text: "Deep Work",
      taskDate: "2026-04-10",
      estimatedDuration: 60,
    }));
  });

  it("removes relative scheduling phrases from the title while keeping the parsed date and time", () => {
    const prefill = buildVoiceQuestPrefillFromTranscript("Pilates tomorrow at 8am");

    expect(prefill).toEqual(expect.objectContaining({
      text: "Pilates",
      taskDate: "2026-04-10",
      scheduledTime: "08:00",
      creationSource: "voice",
    }));
  });

  it("can mark typed natural language captures as nlp instead of voice", () => {
    const prefill = buildQuestPrefillFromNaturalLanguage(
      "Pilates tomorrow at 8am",
      "nlp",
    );

    expect(prefill).toEqual(expect.objectContaining({
      text: "Pilates",
      taskDate: "2026-04-10",
      scheduledTime: "08:00",
      creationSource: "nlp",
    }));
  });

  it("removes weekday scheduling phrases from the title while keeping the parsed schedule", () => {
    const prefill = buildVoiceQuestPrefillFromTranscript("Pilates next Tuesday at 8am");

    expect(prefill).toEqual(expect.objectContaining({
      text: "Pilates",
      taskDate: "2026-04-21",
      scheduledTime: "08:00",
      creationSource: "voice",
    }));
  });

  it("prefills relative-time voice scheduling with a clean title", () => {
    const prefill = buildVoiceQuestPrefillFromTranscript("Walk the dog in one hour");

    expect(prefill).toEqual(expect.objectContaining({
      text: "Walk The Dog",
      taskDate: "2026-04-09",
      scheduledTime: "13:00",
      estimatedDuration: null,
      creationSource: "voice",
    }));
  });

  it("formats conversational lunch plans into a clean voice prefill title", () => {
    vi.setSystemTime(new Date("2026-04-19T12:34:00"));

    const prefill = buildVoiceQuestPrefillFromTranscript(
      "I'm going to grab lunch with Zach today at 1",
    );

    expect(prefill).toEqual(expect.objectContaining({
      text: "Grab Lunch With Zach",
      taskDate: "2026-04-19",
      scheduledTime: "13:00",
      creationSource: "voice",
    }));
  });
});
