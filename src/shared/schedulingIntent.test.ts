import { describe, expect, it } from "vitest";

import { parseNaturalLanguage } from "./naturalLanguageTaskParser";
import {
  analyzeSchedulingIntent,
  shouldRouteMessageToPlanner,
} from "./schedulingIntent";

const analyze = (message: string) =>
  analyzeSchedulingIntent(message, parseNaturalLanguage(message));

describe("schedulingIntent", () => {
  it("keeps weather questions with date language in chat", () => {
    const analysis = analyze("What's the weather gonna be like this weekend");

    expect(analysis.hasConcreteSchedulingPayload).toBe(true);
    expect(analysis.isExternalInfoQuestion).toBe(true);
    expect(analysis.disposition).toBe("read_only");
    expect(
      shouldRouteMessageToPlanner({ surface: "companion", analysis }),
    ).toBe(false);
    expect(
      shouldRouteMessageToPlanner({ surface: "journeys", analysis }),
    ).toBe(false);
  });

  it("recognizes bare scheduled tasks without routing chatbot turns", () => {
    const analysis = analyze("Call mom this weekend");

    expect(analysis.disposition).toBe("schedule_action");
    expect(analysis.isExternalInfoQuestion).toBe(false);
    expect(
      shouldRouteMessageToPlanner({ surface: "companion", analysis }),
    ).toBe(false);
    expect(
      shouldRouteMessageToPlanner({ surface: "journeys", analysis }),
    ).toBe(true);
  });

  it("routes explicit reminder requests from Companion chat", () => {
    const analysis = analyze("Remind me to check the weather this weekend");

    expect(analysis.disposition).toBe("schedule_action");
    expect(analysis.hasExplicitPlannerAction).toBe(true);
    expect(analysis.isExternalInfoQuestion).toBe(false);
    expect(
      shouldRouteMessageToPlanner({ surface: "companion", analysis }),
    ).toBe(true);
  });
});
