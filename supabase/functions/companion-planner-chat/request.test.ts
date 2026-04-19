import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizePlannerClassificationHint, PlannerRequestSchema } from "./request.ts";

const baseRequest = () => ({
  message: "What do I have coming up?",
  currentDate: "2026-04-18",
  currentDateTime: "2026-04-18T10:30:00-07:00",
  horizon: "day" as const,
  tonePack: "soft" as const,
  conversationHistory: [],
  sessionState: {
    draft: {},
    openQuestionIds: [],
    preferredTimeOfDay: null,
    preferredTimeReason: null,
    reminderPreference: null,
    lastClassification: null,
  },
  parsedInput: {
    text: "What do I have coming up?",
    scheduledTime: null,
    scheduledDate: null,
    estimatedDuration: null,
    recurrencePattern: null,
    recurrenceDays: [],
    recurrenceMonthDays: [],
    recurrenceCustomPeriod: null,
    recurrenceEndDate: null,
    notes: null,
    category: null,
    newTitle: null,
  },
  classificationHint: {
    type: "quest" as const,
    confidence: 0.9,
    reasoning: "Schedule question",
    timelineAnalysis: null,
  },
  plannerContext: {
    tasks: [],
    inboxTasks: [],
    activeEpics: [],
    rituals: [],
    calendarEvents: [],
  },
});

Deno.test("accepts nullable timelineAnalysis and normalizes it away", () => {
  const parsed = PlannerRequestSchema.parse(baseRequest());
  const normalized = normalizePlannerClassificationHint(parsed.classificationHint);

  assertEquals(normalized, {
    type: "quest",
    confidence: 0.9,
    reasoning: "Schedule question",
  });
});
