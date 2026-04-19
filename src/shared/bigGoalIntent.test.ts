import { describe, expect, it } from "vitest";

import { parseNaturalLanguage } from "@/features/tasks/hooks/useNaturalLanguageParser";

import {
  looksLikeBigGoal,
  resolveCampaignBuilderInitialGoal,
} from "./bigGoalIntent";

describe("bigGoalIntent", () => {
  it("flags broad long-range goals as builder-worthy", () => {
    const parsed = parseNaturalLanguage("I need help getting my real estate license by August");

    expect(
      looksLikeBigGoal(
        parsed.text || "I need help getting my real estate license by August",
        parsed.estimatedDuration,
        parsed.scheduledDate,
        { now: new Date("2026-04-19T12:00:00.000Z") },
      ),
    ).toBe(true);
  });

  it("does not treat ordinary day-planning prompts as big goals", () => {
    const parsed = parseNaturalLanguage("Help me plan today.");

    expect(
      looksLikeBigGoal(
        parsed.text || "Help me plan today.",
        parsed.estimatedDuration,
        parsed.scheduledDate,
        { now: new Date("2026-04-19T12:00:00.000Z") },
      ),
    ).toBe(false);
  });

  it("drops scaffold-only starter text from the builder prefill", () => {
    const message = "Help me break a big goal into steps.";
    const parsed = parseNaturalLanguage(message);

    expect(resolveCampaignBuilderInitialGoal(message, parsed.text)).toBeNull();
  });

  it("keeps the real goal text when the request includes one", () => {
    const message = "I need help getting my real estate license by August";
    const parsed = parseNaturalLanguage(message);

    expect(resolveCampaignBuilderInitialGoal(message, parsed.text)).toBe(
      "getting my real estate license by August",
    );
  });
});
