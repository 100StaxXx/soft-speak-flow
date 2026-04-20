import { describe, expect, it } from "vitest";

import {
  buildCompanionStatInterpretation,
  classifyCompanionMissInterpretation,
  computeRecentExpressionByAttribute,
  getCompanionBehaviorAwardIntent,
} from "./companionStatSignals";

describe("companionStatSignals", () => {
  it("prefers explicit category metadata over looser keyword heuristics", () => {
    expect(getCompanionBehaviorAwardIntent({
      title: "Design homepage concept",
      category: "mind",
    })?.attribute).toBe("wisdom");

    expect(getCompanionBehaviorAwardIntent({
      title: "Design homepage concept",
    })?.attribute).toBe("creativity");
  });

  it("includes echo gains when computing recent expression", () => {
    const expression = computeRecentExpressionByAttribute([
      {
        attribute: "discipline",
        sourceEvent: "habit_complete",
        amountAwarded: 4,
        echoAmount: 1,
        createdAt: "2026-04-19T12:00:00.000Z",
      },
    ], "2026-04-19", 14);

    expect(expression.discipline).toBe(4);
    expect(expression.resolve).toBe(1);
  });

  it("classifies low-energy misses separately from overload", () => {
    const lowEnergyInterpretation = classifyCompanionMissInterpretation({
      currentDate: "2026-04-19",
      recentTasks: [
        {
          id: "task-1",
          title: "Write report",
          taskDate: "2026-04-17",
          completed: false,
        },
        {
          id: "task-2",
          title: "Call doctor",
          taskDate: "2026-04-18",
          completed: false,
        },
      ],
      reflectionSignals: [
        {
          date: "2026-04-18",
          source: "reflection",
          mood: "drained",
          energy: "low",
        },
      ],
      scheduleSummary: null,
    });

    const overloadInterpretation = classifyCompanionMissInterpretation({
      currentDate: "2026-04-19",
      recentTasks: [
        { id: "task-1", title: "One", taskDate: "2026-04-15", completed: false },
        { id: "task-2", title: "Two", taskDate: "2026-04-16", completed: false },
        { id: "task-3", title: "Three", taskDate: "2026-04-17", completed: false },
        { id: "task-4", title: "Four", taskDate: "2026-04-18", completed: false },
      ],
      reflectionSignals: [],
      scheduleSummary: { selectedDateStatus: "overloaded", overloadedDates: ["2026-04-18"] },
    });

    expect(lowEnergyInterpretation).toBe("low_energy");
    expect(overloadInterpretation).toBe("overload");
  });

  it("derives momentum and stat needs without punitive stat drops", () => {
    const interpretation = buildCompanionStatInterpretation({
      currentDate: "2026-04-19",
      scores: {
        vitality: 330,
        wisdom: 520,
        discipline: 610,
        resolve: 420,
        creativity: 380,
        alignment: 390,
      },
      recentEvents: [
        {
          attribute: "discipline",
          sourceEvent: "habit_complete",
          amountAwarded: 4,
          echoAmount: 1,
          createdAt: "2026-04-18T12:00:00.000Z",
        },
        {
          attribute: "discipline",
          sourceEvent: "planned_task_on_time",
          amountAwarded: 3,
          echoAmount: 1,
          createdAt: "2026-04-17T12:00:00.000Z",
        },
      ],
      recentTasks: [
        {
          id: "task-1",
          title: "Deep work block",
          taskDate: "2026-04-18",
          difficulty: "hard",
          completed: true,
          scheduledTime: "09:00",
        },
        {
          id: "task-2",
          title: "Weekly review",
          taskDate: "2026-04-17",
          completed: true,
          scheduledTime: "17:00",
        },
      ],
      reflectionSignals: [],
      scheduleSummary: { selectedDateStatus: "balanced", overloadedDates: [] },
    });

    expect(interpretation.statProfile.dominantStat).toBe("discipline");
    expect(interpretation.momentumState).toBe("coasting");
    expect(interpretation.statNeeds.vitality.level).toBe("high");
    expect(interpretation.statNeeds.vitality.reasons.length).toBeGreaterThan(0);
  });
});
