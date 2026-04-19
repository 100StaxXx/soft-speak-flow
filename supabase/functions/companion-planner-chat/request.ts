import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import type { ClassificationHint } from "./planner.ts";

const PlannerClassificationTimelineSchema = z.object({
  statedDays: z.number(),
  typicalDays: z.number(),
  feasibility: z.enum(["realistic", "aggressive", "very_aggressive"]),
  adjustmentFactors: z.array(z.string()),
}).nullable().optional();

const PlannerClassificationHintSchema = z.object({
  type: z.enum(["quest", "epic", "habit", "brain-dump"]),
  confidence: z.number(),
  reasoning: z.string(),
  suggestedDeadline: z.string().optional(),
  suggestedDuration: z.number().optional(),
  timelineAnalysis: PlannerClassificationTimelineSchema,
}).nullable().optional();

export const PlannerRequestSchema = z.object({
  message: z.string().min(1).max(4000).trim(),
  currentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horizon: z.enum(["day", "week", "month"]),
  tonePack: z.enum(["soft", "playful", "witty_sassy"]),
  sessionState: z.object({
    draft: z.record(z.unknown()),
    openQuestionIds: z.array(z.string()),
    preferredTimeOfDay: z.string().nullable().optional(),
    preferredTimeReason: z.string().nullable().optional(),
    reminderPreference: z.string().nullable().optional(),
    lastClassification: z.enum(["quest", "epic", "habit", "brain-dump"]).nullable().optional(),
  }),
  parsedInput: z.object({
    text: z.string(),
    scheduledTime: z.string().nullable(),
    scheduledDate: z.string().nullable(),
    estimatedDuration: z.number().nullable(),
    recurrencePattern: z.string().nullable(),
    recurrenceDays: z.array(z.number()),
    recurrenceMonthDays: z.array(z.number()),
    recurrenceCustomPeriod: z.enum(["week", "month"]).nullable(),
    recurrenceEndDate: z.string().nullable(),
    notes: z.string().nullable(),
    category: z.string().nullable(),
    newTitle: z.string().nullable(),
  }).optional(),
  classificationHint: PlannerClassificationHintSchema,
  plannerContext: z.object({
    tasks: z.array(z.object({
      id: z.string(),
      title: z.string(),
      taskDate: z.string().nullable(),
      scheduledTime: z.string().nullable(),
      estimatedDuration: z.number().nullable(),
      recurrencePattern: z.string().nullable(),
      recurrenceEndDate: z.string().nullable().optional(),
      completed: z.boolean().nullable().optional(),
      priority: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
      epicId: z.string().nullable().optional(),
      epicTitle: z.string().nullable().optional(),
    })),
    inboxTasks: z.array(z.object({
      id: z.string(),
      title: z.string(),
      taskDate: z.string().nullable(),
      scheduledTime: z.string().nullable(),
      estimatedDuration: z.number().nullable(),
      recurrencePattern: z.string().nullable(),
      recurrenceEndDate: z.string().nullable().optional(),
      completed: z.boolean().nullable().optional(),
      priority: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
      epicId: z.string().nullable().optional(),
      epicTitle: z.string().nullable().optional(),
    })),
    activeEpics: z.array(z.object({
      id: z.string(),
      title: z.string(),
      endDate: z.string().nullable(),
    })),
    rituals: z.array(z.object({
      id: z.string(),
      epicId: z.string(),
      epicTitle: z.string(),
      title: z.string(),
      frequency: z.string().nullable(),
      preferredTime: z.string().nullable(),
    })),
    calendarEvents: z.array(z.object({
      id: z.string(),
      title: z.string(),
      start: z.string(),
      end: z.string(),
      isAllDay: z.boolean(),
      provider: z.string(),
      readOnly: z.boolean(),
    })),
    scheduleInsights: z.object({
      horizon: z.enum(["day", "week", "month"]),
      selectedDate: z.string(),
      dayLoads: z.array(z.object({
        date: z.string(),
        totalMinutes: z.number(),
        taskCount: z.number(),
        status: z.enum(["open", "balanced", "busy", "overloaded"]),
      })),
      overloadedDates: z.array(z.string()),
      emptyDates: z.array(z.string()),
      conflicts: z.array(z.object({
        date: z.string(),
        taskAId: z.string(),
        taskATitle: z.string(),
        taskBId: z.string(),
        taskBTitle: z.string(),
        overlapMinutes: z.number(),
      })),
      suggestedSlots: z.array(z.object({
        date: z.string(),
        time: z.string(),
        endTime: z.string(),
        score: z.number(),
        reason: z.string(),
      })),
      moveSuggestions: z.array(z.object({
        fromDate: z.string(),
        toDate: z.string(),
        taskId: z.string().nullable().optional(),
        taskTitle: z.string().nullable().optional(),
        suggestedTime: z.string().nullable().optional(),
        reason: z.string(),
      })),
      summary: z.string(),
    }).optional(),
    plannerMemory: z.object({
      tonePack: z.enum(["soft", "playful", "witty_sassy"]).optional(),
      preferredTimeOfDay: z.string().nullable().optional(),
      preferredTimeReason: z.string().nullable().optional(),
      reminderMinutesBefore: z.number().nullable().optional(),
      wakeTime: z.string().nullable().optional(),
      windDownTime: z.string().nullable().optional(),
      peakProductivityTimes: z.array(z.string()).optional(),
      preferredWindows: z.array(z.object({
        timeOfDay: z.string(),
        time: z.string().nullable().optional(),
        reason: z.string().nullable().optional(),
        sourceCount: z.number().optional(),
      })).optional(),
      cadencePatterns: z.record(z.number()).optional(),
      lastConfirmedAt: z.string().nullable().optional(),
    }).optional(),
    aiSignals: z.object({
      preferredDifficulty: z.string().optional(),
      preferredHabitFrequency: z.string().optional(),
      preferredEpicDuration: z.number().optional(),
      commonContexts: z.array(z.string()).optional(),
      suggestedWorkload: z.enum(["light", "normal", "heavy"]).optional(),
    }).optional(),
  }),
});

type PlannerRequestClassificationHint = z.infer<typeof PlannerRequestSchema>["classificationHint"];

export const normalizePlannerClassificationHint = (
  classificationHint: PlannerRequestClassificationHint | ClassificationHint | null | undefined,
): ClassificationHint | null => {
  if (!classificationHint) return null;

  const normalized: ClassificationHint = {
    type: classificationHint.type,
    confidence: classificationHint.confidence,
    reasoning: classificationHint.reasoning,
  };

  if (typeof classificationHint.suggestedDeadline === "string") {
    normalized.suggestedDeadline = classificationHint.suggestedDeadline;
  }

  if (typeof classificationHint.suggestedDuration === "number") {
    normalized.suggestedDuration = classificationHint.suggestedDuration;
  }

  if (classificationHint.timelineAnalysis) {
    normalized.timelineAnalysis = classificationHint.timelineAnalysis;
  }

  return normalized;
};
