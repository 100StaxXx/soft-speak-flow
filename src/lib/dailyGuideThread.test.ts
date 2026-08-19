import { describe, expect, it } from "vitest";

import {
  buildDailyGuideContinuityContext,
  getDailyGuideQuestion,
} from "./dailyGuideThread";

describe("daily Guide thread", () => {
  it("turns wellbeing encouragement into a concrete care question", () => {
    const question = getDailyGuideQuestion("wellbeing");

    expect(question.prompt).toBe("What kind of care would serve you today?");
    expect(question.options.map((option) => option.category)).toEqual([
      "Body",
      "Body",
      "Soul",
    ]);
  });

  it("uses a stable direction question for uncategorized encouragement", () => {
    expect(getDailyGuideQuestion(null)).toEqual(getDailyGuideQuestion("focus"));
  });

  it("gives the Guide current and previous continuity without applying pressure", () => {
    const context = buildDailyGuideContinuityContext({
      current: {
        threadDate: "2026-08-10",
        focusLabel: "A gentler pace",
        focusCategory: "Rest",
        practiceKey: "formation-12",
        practiceCompletedAt: null,
        eveningReflectedAt: null,
      },
      previous: {
        threadDate: "2026-08-09",
        focusLabel: "Connection",
        focusCategory: "Relationships",
        practiceKey: "formation-08",
        practiceCompletedAt: "2026-08-09T18:00:00.000Z",
        eveningReflectedAt: "2026-08-09T22:00:00.000Z",
      },
    });

    expect(context).toContain("A gentler pace");
    expect(context).toContain("do not shame or pressure");
    expect(context).toContain("completed the connected Faithful Step");
    expect(context).toContain("completed the evening reflection");
  });
});
