import { describe, expect, it } from "vitest";

import {
  getJourneysCompanionLauncherGreeting,
  getJourneysCompanionLauncherTemplates,
} from "@/shared/journeysCompanionLauncherTemplates";

describe("journeys companion launcher greetings", () => {
  it("keeps the free-talk greeting pool mostly English with only a little multilingual flavor", () => {
    const greetings = new Set<string>();

    for (let index = 0; index < 256; index += 1) {
      greetings.add(
        getJourneysCompanionLauncherGreeting({
          date: new Date(`2026-04-${String((index % 28) + 1).padStart(2, "0")}T12:00:00.000Z`),
          userId: `user-${index}`,
        }),
      );
    }

    expect(greetings.size).toBe(16);

    const greetingList = Array.from(greetings);

    expect(greetingList).toEqual(expect.arrayContaining([
      "What's good, friend?",
      "What's good, buddy?",
      "What's good, guy?",
      "What's good, dude?",
      "What's good, fam?",
      "What's good, pal?",
    ]));

    const multilingualGreetings = greetingList.filter((greeting) =>
      /\b(amigo|mon ami)\b/i.test(greeting),
    );
    const disallowedGreetings = greetingList.filter((greeting) =>
      /\b(compa|hermano)\b/i.test(greeting),
    );

    expect(multilingualGreetings).toEqual(expect.arrayContaining([
      "What's good, amigo?",
      "What's good, mon ami?",
    ]));
    expect(multilingualGreetings).toHaveLength(2);
    expect(greetingList.length - multilingualGreetings.length).toBeGreaterThan(multilingualGreetings.length);
    expect(disallowedGreetings).toHaveLength(0);
  });

  it("uses the selected greeting as the free-talk launcher label and message", () => {
    const templates = getJourneysCompanionLauncherTemplates({
      date: new Date("2026-04-20T12:00:00.000Z"),
      userId: "user-42",
    });

    expect(templates[0]).toMatchObject({
      id: "free-talk",
      target: "conversation",
      starterIntent: "free_talk_start",
    });
    expect(templates[0]?.label).toBe(templates[0]?.message);
  });
});
