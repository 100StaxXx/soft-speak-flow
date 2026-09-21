import { describe, expect, it } from "vitest";

import {
  applyDailyAdventureChoice,
  createEmptyDailyAdventure,
  getDailyAdventureStorageKey,
  selectDailyAdventureDecision,
} from "@/lib/dailyAdventure";

describe("daily adventure", () => {
  const dateKey = "2026-08-10";
  const now = new Date("2026-08-10T08:00:00.000Z");

  it("offers three deterministic paths and turns the choice into a real formation category", () => {
    const state = createEmptyDailyAdventure("user-1", dateKey, now);
    const first = selectDailyAdventureDecision({ state, companionId: "lamb-1", hour: 8 });
    const repeated = selectDailyAdventureDecision({ state, companionId: "lamb-1", hour: 8 });

    expect(first.kind).toBe("path");
    expect(first.options).toHaveLength(3);
    expect(repeated.options.map((option) => option.id)).toEqual(first.options.map((option) => option.id));
    expect(first.options.every((option) => Boolean(option.category && option.pathTitle))).toBe(true);

    const chosen = applyDailyAdventureChoice({
      state,
      decision: first,
      option: first.options[0],
      companionName: "Selah",
      now,
    });
    expect(chosen.path).toMatchObject({
      id: first.options[0].id,
      category: first.options[0].category,
      companionName: "Selah",
    });
    expect(chosen.storyBeats).toHaveLength(1);
  });

  it("moves from the morning path to a midday decision and an evening close", () => {
    const empty = createEmptyDailyAdventure("user-1", dateKey, now);
    const pathDecision = selectDailyAdventureDecision({ state: empty, companionId: "dove-1", hour: 8 });
    const withPath = applyDailyAdventureChoice({
      state: empty,
      decision: pathDecision,
      option: pathDecision.options[0],
      companionName: "Shiloh",
      now,
    });

    expect(selectDailyAdventureDecision({ state: withPath, companionId: "dove-1", hour: 9 }).kind).toBe("bridge");
    expect(selectDailyAdventureDecision({ state: withPath, companionId: "dove-1", hour: 13 }).kind).toBe("midday");
    expect(selectDailyAdventureDecision({ state: withPath, companionId: "dove-1", hour: 19 }).kind).toBe("evening");
  });

  it("stores Graceward adventure state without calendar or agenda concepts", () => {
    const key = getDailyAdventureStorageKey("user-1", dateKey);
    expect(key).toBe("graceward:daily-adventure:v1:user-1:2026-08-10");
    expect(key).not.toMatch(/calendar|agenda|cosmiq/i);
  });
});
