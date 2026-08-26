import { describe, expect, it } from "vitest";

import {
  buildPreviousThreadMemoryComment,
  deriveLivingCompanionDailyState,
  formatLivingCompanionDayKey,
  getLivingCompanionBodyLanguage,
  selectDailyLivingCompanionQuestion,
  selectLivingCompanionTapLine,
} from "@/config/livingCompanion";

describe("living companion copy and state selection", () => {
  it("selects the same daily question for the same companion and local day", () => {
    const context = {
      companionId: "nova",
      bodyLanguage: "calm" as const,
      now: new Date(2026, 7, 9, 13, 30),
    };

    expect(selectDailyLivingCompanionQuestion(context)).toEqual(
      selectDailyLivingCompanionQuestion(context),
    );
    expect(formatLivingCompanionDayKey(context.now)).toBe("2026-08-09");
  });

  it("prioritizes a gentle return after inactivity", () => {
    const question = selectDailyLivingCompanionQuestion({
      companionId: "nova",
      bodyLanguage: "calm",
      inactiveDays: 3,
      nearEvolution: true,
      now: new Date(2026, 7, 9, 9),
    });

    expect(question.id).toBe("return-gently");
    expect(question.prompt).toBe("How would you like to begin again?");
  });

  it("asks about the next season when evolution is close", () => {
    const question = selectDailyLivingCompanionQuestion({
      companionId: "nova",
      bodyLanguage: "happy",
      nearEvolution: true,
      now: new Date(2026, 7, 9, 9),
    });

    expect(question.id).toBe("next-season");
  });

  it("maps questions, dormancy, warnings, and expression mood to body language", () => {
    expect(getLivingCompanionBodyLanguage({ expressionMood: "happy", hasQuestion: true })).toBe("curious");
    expect(getLivingCompanionBodyLanguage({ expressionMood: "excited", isDormant: true })).toBe("sleepy");
    expect(getLivingCompanionBodyLanguage({ expressionMood: "calm", hasDormancyWarning: true })).toBe("concerned");
    expect(getLivingCompanionBodyLanguage({ expressionMood: "happy" })).toBe("happy");
  });

  it("keeps tap responses deterministic while varying them across interactions", () => {
    const first = selectLivingCompanionTapLine({
      bodyLanguage: "calm",
      companionId: "nova",
      interactionCount: 1,
    });
    const repeated = selectLivingCompanionTapLine({
      bodyLanguage: "calm",
      companionId: "nova",
      interactionCount: 1,
    });
    const later = [2, 3, 4].map((interactionCount) => selectLivingCompanionTapLine({
      bodyLanguage: "calm",
      companionId: "nova",
      interactionCount,
    }));

    expect(repeated).toBe(first);
    expect(later.some((line) => line !== first)).toBe(true);
    expect([first, ...later].join(" ").toLowerCase()).not.toMatch(/leave|fading|missed me|come back/);
  });

  it("lets the shared daily thread shape subtle emotional state", () => {
    expect(deriveLivingCompanionDailyState({
      baseBodyLanguage: "calm",
      hour: 13,
      focusAnswered: true,
    })).toEqual({
      bodyLanguage: "curious",
      label: "Holding today’s focus with you",
    });

    expect(deriveLivingCompanionDailyState({
      baseBodyLanguage: "calm",
      hour: 19,
      practiceCompleted: true,
    })).toEqual({
      bodyLanguage: "happy",
      label: "Noticing your faithful step",
    });
  });

  it("recalls a previous focus without turning unfinished work into debt", () => {
    expect(buildPreviousThreadMemoryComment({
      focusLabel: "A gentler pace",
      practiceCompleted: false,
    })).toContain("without becoming a debt");
    expect(buildPreviousThreadMemoryComment({
      focusLabel: "Courage",
      practiceCompleted: true,
    })).toContain("carried it into action");
  });
});
