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

Deno.test("accepts quest notes and subtask titles in planner task context", () => {
  const parsed = PlannerRequestSchema.parse({
    ...baseRequest(),
    plannerContext: {
      ...baseRequest().plannerContext,
      tasks: [{
        id: "task-1",
        title: "Workout",
        taskDate: "2026-04-18",
        scheduledTime: "18:00",
        estimatedDuration: 45,
        notes: "Leg day with extra stretching.",
        subtaskTitles: ["Warm up", "Cooldown walk"],
        difficulty: "medium",
        recurrencePattern: null,
      }],
    },
  });

  assertEquals(parsed.plannerContext.tasks[0]?.notes, "Leg day with extra stretching.");
  assertEquals(parsed.plannerContext.tasks[0]?.subtaskTitles, ["Warm up", "Cooldown walk"]);
});

Deno.test("normalizes legacy starter intent and classifier aliases instead of rejecting the request", () => {
  const parsed = PlannerRequestSchema.parse({
    ...baseRequest(),
    sessionState: {
      ...baseRequest().sessionState,
      pendingStarterIntent: "thread_history",
      lastClassification: "brain_dump",
    },
    classificationHint: {
      type: "brain dump",
      confidence: 0.6,
      reasoning: "Legacy alias still coming through",
      timelineAnalysis: null,
    },
    plannerContext: {
      ...baseRequest().plannerContext,
      starterIntent: "thread_history",
    },
  });

  assertEquals(parsed.sessionState.pendingStarterIntent, undefined);
  assertEquals(parsed.sessionState.lastClassification, "brain-dump");
  assertEquals(parsed.classificationHint?.type, "brain-dump");
  assertEquals(parsed.plannerContext.starterIntent, undefined);
});

Deno.test("normalizes legacy workload and tone pack values in planner context", () => {
  const parsed = PlannerRequestSchema.parse({
    ...baseRequest(),
    plannerContext: {
      ...baseRequest().plannerContext,
      plannerMemory: {
        tonePack: "witty-sassy",
        workloadTolerance: "medium",
      },
      aiSignals: {
        suggestedWorkload: "high",
      },
    },
  });

  assertEquals(parsed.plannerContext.plannerMemory?.tonePack, "witty_sassy");
  assertEquals(parsed.plannerContext.plannerMemory?.workloadTolerance, "normal");
  assertEquals(parsed.plannerContext.aiSignals?.suggestedWorkload, "heavy");
});
