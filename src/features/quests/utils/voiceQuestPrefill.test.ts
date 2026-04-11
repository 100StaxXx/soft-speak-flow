import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildVoiceQuestPrefillFromTranscript } from "./voiceQuestPrefill";

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
      text: "Deep work",
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
      text: "Pay rent",
      taskDate: "2026-04-30",
      scheduledTime: "08:00",
      recurrencePattern: "monthly",
      recurrenceMonthDays: [30],
    }));
  });

  it("strips spoken duration phrasing from the quest title while keeping the parsed minutes", () => {
    const prefill = buildVoiceQuestPrefillFromTranscript("Deep work it's gonna last 60 minutes tomorrow");

    expect(prefill).toEqual(expect.objectContaining({
      text: "Deep work",
      taskDate: "2026-04-10",
      estimatedDuration: 60,
    }));
  });

  it("prefills relative-time voice scheduling with a clean title", () => {
    const prefill = buildVoiceQuestPrefillFromTranscript("Walk the dog in one hour");

    expect(prefill).toEqual(expect.objectContaining({
      text: "Walk the dog",
      taskDate: "2026-04-09",
      scheduledTime: "13:00",
      estimatedDuration: null,
      creationSource: "voice",
    }));
  });
});
