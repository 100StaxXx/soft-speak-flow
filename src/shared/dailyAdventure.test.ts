import { describe, expect, it } from "vitest";

import {
  addAdventureDecision,
  buildCrossroadsChoices,
  buildMorningAdventureChoices,
  createDailyAdventureState,
  deriveDailyAdventurePhase,
  getCrossroadsTaskUpdate,
  getDailyAdventureStory,
  parseDailyAdventureState,
} from "@/shared/dailyAdventure";

describe("Daily Adventure", () => {
  it("offers exactly three balanced morning routes and varies them by day", () => {
    const firstDay = buildMorningAdventureChoices({ missionDate: "2026-08-10", currentStage: 18 });
    const secondDay = buildMorningAdventureChoices({ missionDate: "2026-08-11", currentStage: 18 });

    expect(firstDay).toHaveLength(3);
    expect(new Set(firstDay.map((choice) => choice.intention))).toEqual(new Set(["finish", "progress", "recover"]));
    expect(new Set(firstDay.map((choice) => choice.key)).size).toBe(3);
    expect(secondDay.map((choice) => choice.key)).not.toEqual(firstDay.map((choice) => choice.key));
  });

  it("persists the route as a parseable versioned story", () => {
    const story = getDailyAdventureStory({
      missionDate: "2026-08-10",
      companionName: "Nova",
      currentStage: 22,
    });
    const choice = buildMorningAdventureChoices({ missionDate: "2026-08-10", currentStage: 22 })[0];
    const opening = createDailyAdventureState({ story, choice, chosenAt: "2026-08-10T08:00:00.000Z" });
    const crossroadsChoice = buildCrossroadsChoices({
      primaryTitle: "Ship the prototype",
      optionalTaskTitles: ["Review the launch notes"],
      hour: 14,
    })[1];
    const branched = addAdventureDecision({
      state: opening,
      phase: "crossroads",
      choice: crossroadsChoice,
      chosenAt: "2026-08-10T14:00:00.000Z",
    });

    expect(parseDailyAdventureState(branched)).toEqual(branched);
    expect(branched.openingScene).toContain("Nova");
    expect(branched.crossroadsChoice?.key).toBe("take-side-route");
  });

  it("moves through crossroads, evening return, completion, and resolution", () => {
    const base = {
      state: null,
      primaryTaskCompleted: false,
      completedTaskCount: 0,
    };
    expect(deriveDailyAdventurePhase({ ...base, status: null, hour: 8 })).toBe("opening");
    expect(deriveDailyAdventurePhase({ ...base, status: "active", hour: 9 })).toBe("underway");
    expect(deriveDailyAdventurePhase({ ...base, status: "active", hour: 14 })).toBe("crossroads");
    expect(deriveDailyAdventurePhase({ ...base, status: "active", hour: 19 })).toBe("evening");
    expect(deriveDailyAdventurePhase({ ...base, status: "active", hour: 11, primaryTaskCompleted: true })).toBe("return");
    expect(deriveDailyAdventurePhase({ ...base, status: "completed", hour: 11 })).toBe("return");
    expect(deriveDailyAdventurePhase({ ...base, status: "reflected", hour: 11 })).toBe("resolved");
  });

  it("turns the side-route choice into a real agenda reroute", () => {
    const update = getCrossroadsTaskUpdate({
      choiceKey: "take-side-route",
      recommendation: {
        primaryTaskId: "task-1",
        primaryTaskTitle: "Write the launch plan",
        primaryTaskDurationMinutes: 60,
        optionalTaskIds: ["task-2"],
        optionalTaskTitles: ["Review the checklist"],
      },
      tasks: [
        { id: "task-1", task_text: "Write the launch plan", estimated_duration: 60 },
        { id: "task-2", task_text: "Review the checklist", estimated_duration: 20 },
      ],
    });

    expect(update).toMatchObject({
      primaryTaskId: "task-2",
      primaryTaskTitle: "Review the checklist",
      primaryTaskDurationMinutes: 20,
      optionalTaskIds: ["task-1"],
    });
  });
});
