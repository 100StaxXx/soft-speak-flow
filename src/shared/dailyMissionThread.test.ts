import { describe, expect, it } from "vitest";
import { buildDailyMissionRecommendation } from "@/shared/dailyMissionThread";

describe("buildDailyMissionRecommendation", () => {
  it("uses calendar availability and favors an achievable finish", () => {
    const result = buildDailyMissionRecommendation({
      intention: "finish",
      tasks: [
        { id: "large", task_text: "Write the launch plan", estimated_duration: 120, priority: "high" },
        { id: "small", task_text: "Send the final invoice", estimated_duration: 25, difficulty: "easy" },
      ],
      calendarEvents: [
        { scheduledTime: "08:00", estimatedDuration: 300, isAllDay: false },
        { scheduledTime: "13:30", estimatedDuration: 360, isAllDay: false },
      ],
    });

    expect(result.primaryTaskId).toBe("small");
    expect(result.primaryTaskDurationMinutes).toBe(25);
    expect(result.calendarSummary).toContain("30 minutes");
    expect(result.suggestedWindowLabel).toBe("1:00 PM–1:25 PM");
  });

  it("favors campaign work when the user chooses progress", () => {
    const result = buildDailyMissionRecommendation({
      intention: "progress",
      tasks: [
        { id: "errand", task_text: "Buy coffee", estimated_duration: 15, difficulty: "easy" },
        { id: "campaign", task_text: "Draft chapter one", estimated_duration: 60, epic_id: "epic-1" },
      ],
    });

    expect(result.primaryTaskId).toBe("campaign");
    expect(result.companionAck).toContain("Draft chapter one");
  });

  it("keeps recovery deliberately small on an all-day commitment", () => {
    const result = buildDailyMissionRecommendation({
      intention: "recover",
      tasks: [
        { id: "hard", task_text: "Rebuild the website", estimated_duration: 180, difficulty: "hard" },
        { id: "walk", task_text: "Take a short walk", estimated_duration: 15, difficulty: "easy", category: "body" },
      ],
      calendarEvents: [{ scheduledTime: null, estimatedDuration: 1440, isAllDay: true }],
    });

    expect(result.primaryTaskId).toBe("walk");
    expect(result.primaryTaskDurationMinutes).toBe(15);
    expect(result.calendarSummary).toContain("all-day commitment");
  });

  it("does not invent a completed task when no quests exist", () => {
    const result = buildDailyMissionRecommendation({ intention: "progress", tasks: [] });

    expect(result.primaryTaskId).toBeNull();
    expect(result.primaryTaskTitle).toBe("Choose one 15-minute next step");
    expect(result.optionalTaskIds).toEqual([]);
  });

  it("uses the exact scheduled time when the selected quest is already planned", () => {
    const result = buildDailyMissionRecommendation({
      intention: "finish",
      tasks: [{
        id: "scheduled",
        task_text: "Send the brief",
        estimated_duration: 30,
        scheduled_time: "14:15",
      }],
    });

    expect(result.suggestedWindowLabel).toBe("2:15 PM–2:45 PM");
  });

  it("never suggests an open window that has already passed", () => {
    const result = buildDailyMissionRecommendation({
      intention: "recover",
      tasks: [],
      currentTimeMinutes: 16 * 60 + 30,
    });

    expect(result.suggestedWindowLabel).toBe("4:30 PM–4:40 PM");
  });

  it("still offers a real window when the chapter starts after the usual planning day", () => {
    const result = buildDailyMissionRecommendation({
      intention: "progress",
      tasks: [],
      currentTimeMinutes: 22 * 60,
    });

    expect(result.suggestedWindowLabel).toBe("10:00 PM–10:15 PM");
  });
});
