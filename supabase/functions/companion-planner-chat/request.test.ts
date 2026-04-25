import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  collectPlannerRequestNormalizationEvents,
  normalizePlannerClassificationHint,
  PlannerRequestSchema,
} from "./request.ts";

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
  const normalized = normalizePlannerClassificationHint(
    parsed.classificationHint,
  );

  assertEquals(normalized, {
    type: "quest",
    confidence: 0.9,
    reasoning: "Schedule question",
  });
});

Deno.test("normalizes non-epic legacy suggestedDuration into bounded activity minutes", () => {
  const normalized = normalizePlannerClassificationHint({
    type: "quest",
    confidence: 0.88,
    reasoning: "Legacy duration estimate",
    suggestedDuration: 52,
  });

  assertEquals(normalized, {
    type: "quest",
    confidence: 0.88,
    reasoning: "Legacy duration estimate",
    suggestedDuration: 52,
    suggestedActivityDurationMinutes: 45,
  });
});

Deno.test("keeps epic suggestedDuration as target days without deriving activity minutes", () => {
  const normalized = normalizePlannerClassificationHint({
    type: "epic",
    confidence: 0.91,
    reasoning: "Long-running goal",
    suggestedDuration: 52,
  });

  assertEquals(normalized, {
    type: "epic",
    confidence: 0.91,
    reasoning: "Long-running goal",
    suggestedDuration: 52,
  });
});

Deno.test("keeps explicit epic activity minutes separate from target days", () => {
  const normalized = normalizePlannerClassificationHint({
    type: "epic",
    confidence: 0.9,
    reasoning: "Long-term goal with a clear work block size",
    suggestedDuration: 75,
    suggestedActivityDurationMinutes: 52,
  });

  assertEquals(normalized, {
    type: "epic",
    confidence: 0.9,
    reasoning: "Long-term goal with a clear work block size",
    suggestedDuration: 75,
    suggestedActivityDurationMinutes: 45,
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
        actualTimeSpent: 52,
        notes: "Leg day with extra stretching.",
        subtaskTitles: ["Warm up", "Cooldown walk"],
        difficulty: "medium",
        recurrencePattern: null,
      }],
    },
  });

  assertEquals(
    parsed.plannerContext.tasks[0]?.notes,
    "Leg day with extra stretching.",
  );
  assertEquals(parsed.plannerContext.tasks[0]?.actualTimeSpent, 52);
  assertEquals(parsed.plannerContext.tasks[0]?.subtaskTitles, [
    "Warm up",
    "Cooldown walk",
  ]);
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

Deno.test("treats explicit null plannerContext starter intent as absent", () => {
  const parsed = PlannerRequestSchema.parse({
    ...baseRequest(),
    plannerContext: {
      ...baseRequest().plannerContext,
      starterIntent: null,
    },
  });

  assertEquals(parsed.plannerContext.starterIntent, undefined);
});

Deno.test("accepts explicit null pending starter intent in session state", () => {
  const parsed = PlannerRequestSchema.parse({
    ...baseRequest(),
    sessionState: {
      ...baseRequest().sessionState,
      pendingStarterIntent: null,
    },
  });

  assertEquals(parsed.sessionState.pendingStarterIntent, null);
});

Deno.test("normalizes legacy top-level tone pack aliases", () => {
  const parsed = PlannerRequestSchema.parse({
    ...baseRequest(),
    tonePack: "witty-sassy",
  });

  assertEquals(parsed.tonePack, "witty_sassy");
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
  assertEquals(
    parsed.plannerContext.plannerMemory?.workloadTolerance,
    "normal",
  );
  assertEquals(parsed.plannerContext.aiSignals?.suggestedWorkload, "heavy");
});

Deno.test("rejects unrelated mixed-case intent types instead of blanket-lowercasing them", () => {
  const parsed = PlannerRequestSchema.safeParse({
    ...baseRequest(),
    classificationHint: {
      ...baseRequest().classificationHint,
      type: "Quest",
    },
  });

  assertEquals(parsed.success, false);
});

Deno.test("rejects conversation history longer than 24 messages", () => {
  const parsed = PlannerRequestSchema.safeParse({
    ...baseRequest(),
    conversationHistory: Array.from({ length: 25 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `Message ${index + 1}`,
    })),
  });

  assertEquals(parsed.success, false);
});

Deno.test("collects normalization events for meaningful legacy coercions", () => {
  const rawRequest = {
    ...baseRequest(),
    tonePack: "witty-sassy",
    sessionState: {
      ...baseRequest().sessionState,
      pendingStarterIntent: "thread_history",
      lastClassification: "brain_dump",
    },
    classificationHint: {
      ...baseRequest().classificationHint,
      type: "brain dump",
    },
    plannerContext: {
      ...baseRequest().plannerContext,
      starterIntent: null,
      plannerMemory: {
        tonePack: "witty-sassy",
        workloadTolerance: "medium",
      },
      aiSignals: {
        suggestedWorkload: "high",
      },
    },
  };
  const parsed = PlannerRequestSchema.parse(rawRequest);

  assertEquals(collectPlannerRequestNormalizationEvents(rawRequest, parsed), [
    {
      path: "tonePack",
      originalValue: "witty-sassy",
      normalizedValue: "witty_sassy",
      reason: "legacy_tone_pack_alias",
    },
    {
      path: "classificationHint.type",
      originalValue: "brain dump",
      normalizedValue: "brain-dump",
      reason: "legacy_intent_alias",
    },
    {
      path: "sessionState.pendingStarterIntent",
      originalValue: "thread_history",
      normalizedValue: undefined,
      reason: "stripped_thread_history",
    },
    {
      path: "sessionState.lastClassification",
      originalValue: "brain_dump",
      normalizedValue: "brain-dump",
      reason: "legacy_intent_alias",
    },
    {
      path: "plannerContext.starterIntent",
      originalValue: null,
      normalizedValue: undefined,
      reason: "null_to_absent",
    },
    {
      path: "plannerContext.plannerMemory.tonePack",
      originalValue: "witty-sassy",
      normalizedValue: "witty_sassy",
      reason: "legacy_tone_pack_alias",
    },
    {
      path: "plannerContext.plannerMemory.workloadTolerance",
      originalValue: "medium",
      normalizedValue: "normal",
      reason: "legacy_workload_alias",
    },
    {
      path: "plannerContext.aiSignals.suggestedWorkload",
      originalValue: "high",
      normalizedValue: "heavy",
      reason: "legacy_workload_alias",
    },
  ]);
});
