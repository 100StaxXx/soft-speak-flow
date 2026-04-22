import { describe, expect, it } from "vitest";

import {
  toJournalEntryFromDailyCheckIn,
  toJournalEntryFromEveningReflection,
  toJournalEntryFromReflection,
} from "./journalEntryAdapters";

describe("journal entry adapters", () => {
  it("maps user reflections into canonical journal entries", () => {
    expect(toJournalEntryFromReflection({
      id: "reflection-1",
      user_id: "user-1",
      reflection_date: "2026-04-20",
      mood: "calm",
      note: "Felt centered after the walk.",
      ai_reply: "Keep that rhythm.",
      created_at: "2026-04-20T22:00:00.000Z",
    })).toEqual({
      id: "reflection-1",
      userId: "user-1",
      entryType: "reflection",
      date: "2026-04-20",
      mood: "calm",
      body: "Felt centered after the walk.",
      aiResponse: "Keep that rhythm.",
      wins: null,
      gratitude: null,
      intention: null,
      tomorrowAdjustment: null,
      sourceTable: "user_reflections",
      createdAt: "2026-04-20T22:00:00.000Z",
      checkInType: null,
    });
  });

  it("maps evening reflections and preserves subtype-specific fields", () => {
    expect(toJournalEntryFromEveningReflection({
      id: "evening-1",
      user_id: "user-1",
      reflection_date: "2026-04-20",
      mood: "grateful",
      wins: "Finished the adapter layer.",
      additional_reflection: "The work felt clean.",
      tomorrow_adjustment: "Start tests earlier.",
      gratitude: "Pairing time",
      mentor_response: "Nice landing.",
      created_at: "2026-04-20T23:00:00.000Z",
    })).toMatchObject({
      entryType: "evening_reflection",
      body: "The work felt clean.",
      wins: "Finished the adapter layer.",
      gratitude: "Pairing time",
      tomorrowAdjustment: "Start tests earlier.",
      aiResponse: "Nice landing.",
    });
  });

  it("maps daily check-ins and normalizes mentor response into aiResponse", () => {
    expect(toJournalEntryFromDailyCheckIn({
      id: "check-in-1",
      user_id: "user-1",
      check_in_date: "2026-04-21",
      check_in_type: "morning",
      completed_at: null,
      created_at: "2026-04-21T14:00:00.000Z",
      intention: "Protect focus time",
      mentor_response: "You have a clear north star.",
      mood: "steady",
      reflection: "Need a lighter first hour.",
    })).toMatchObject({
      entryType: "daily_check_in",
      date: "2026-04-21",
      mood: "steady",
      body: "Need a lighter first hour.",
      aiResponse: "You have a clear north star.",
      intention: "Protect focus time",
      checkInType: "morning",
    });
  });
});
