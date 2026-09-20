import { describe, it, expect } from "vitest";
import { nextAgendaGreeting, pendingActionToQuestDraft } from "./agendaCompanionChat";
import type { PendingActionView } from "@/types/companionAgent";

describe("Agenda companion drafts", () => {
  it("preserves the agent's scheduling details in the quest editor contract", () => {
    const action: PendingActionView = { id: "draft-1", status: "pending", intent: "schedule_task", actionType: "task_create", summary: "Take a walk",
      confirmationMessage: null, affectedEntities: null, expiresAt: "2026-09-23T00:00:00Z", createdAt: "2026-09-20T00:00:00Z",
      normalizedPayload: { title: "Trail walk", task_date: "2026-09-22", scheduled_time: "15:30", estimated_duration: 45,
        difficulty: "easy", category: "body", notes: "Bring water", reminder_enabled: true, reminder_minutes_before: 10,
        subtasks: ["Pack water", { title: "Choose a route" }] } };
    expect(pendingActionToQuestDraft(action)?.payload).toMatchObject({ taskText: "Trail walk", taskDate: "2026-09-22",
      scheduledTime: "15:30", estimatedDuration: 45, category: "body", notes: "Bring water",
      reminderEnabled: true, reminderMinutesBefore: 10, subtasks: ["Pack water", "Choose a route"] });
    expect(pendingActionToQuestDraft({ ...action, actionType: "task_update" })).toBeNull();
    expect(pendingActionToQuestDraft({ ...action, status: "executed" })).toBeNull();
  });
  it("varies successive openings and keeps overnight greetings gentle", () => {
    const day = new Date(2026, 8, 20, 12);
    expect(nextAgendaGreeting(day)).not.toBe(nextAgendaGreeting(day));
    expect(nextAgendaGreeting(new Date(2026, 8, 20, 23))).toContain("gentle tonight");
  });
});
