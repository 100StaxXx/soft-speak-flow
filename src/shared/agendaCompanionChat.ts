import type { PendingActionView } from "@/types/companionAgent";
import type { CompanionPlannerProposal } from "@/types/companionPlanner";

const openings = [
  "Hey, you! What shall we make room for today?",
  "There you are. Have something on your mind, or shall we find a next step together?",
  "Ready when you are. Tell me what you’d like to do and we’ll find a place for it.",
  "A little adventure, a little breathing room. What does your day need?",
  "Good to see you. We can sort out a quest, shuffle the day, or just talk.",
  "I’m here. Big idea or tiny next step—where shall we start?",
] as const;
let openingIndex = Math.floor(Math.random() * openings.length);

/** Called on opening, never on each render. No network or generated media needed. */
export function nextAgendaGreeting(date = new Date()) {
  const opening = openings[openingIndex++ % openings.length];
  const hour = date.getHours();
  return hour < 6 || hour >= 21
    ? `${opening} We can keep things gentle tonight.`
    : opening;
}

/** Translate the agent's normalized draft into the existing quest editor contract. */
export function pendingActionToQuestDraft(action: PendingActionView | null): CompanionPlannerProposal | null {
  if (action?.actionType !== "task_create" || action.status !== "pending") return null;
  const p = action.normalizedPayload;
  if (!p || typeof p !== "object" || Array.isArray(p) || typeof p.title !== "string" || !p.title.trim()) return null;
  return {
    id: action.id, kind: "create_quest", title: p.title, summary: action.summary,
    status: "pending", readyToConfirm: true,
    payload: {
      ...p, taskText: p.title, taskDate: p.task_date, scheduledTime: p.scheduled_time,
      draftDestination: p.task_date == null ? "inbox" : "scheduled",
      estimatedDuration: p.estimated_duration ?? p.duration_minutes,
      notes: p.notes ?? p.more_information,
      reminderEnabled: p.reminder_enabled, reminderMinutesBefore: p.reminder_minutes_before,
      recurrencePattern: p.recurrence_pattern, recurrenceDays: p.recurrence_days,
      recurrenceMonthDays: p.recurrence_month_days, recurrenceCustomPeriod: p.recurrence_custom_period,
      subtasks: Array.isArray(p.subtasks) ? p.subtasks.map((item) =>
        typeof item === "string" ? item : item && typeof item === "object" && !Array.isArray(item) ? item.title : null,
      ).filter((item) => typeof item === "string") : [],
    },
  };
}
