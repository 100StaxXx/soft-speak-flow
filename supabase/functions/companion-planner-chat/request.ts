import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import type { ClassificationHint } from "./planner.ts";
import { normalizePlannerDurationBucket } from "../_shared/plannerDurationBuckets.ts";

const PLANNER_INTENT_TYPES = ["quest", "epic", "habit", "brain-dump"] as const;
const PLANNER_STARTER_INTENTS = [
  "general",
  "plan_day",
  "plan_week",
  "advance_campaign_start",
  "right_now_start",
  "make_room",
  "what_matters",
  "relationship_touch",
  "adjust_today",
  "low_energy_adjust",
  "briefing_followup",
  "goal_breakdown",
  "free_talk_start",
  "upcoming_start",
  "quest_capture",
  "goal_breakdown_start",
] as const;
const PLANNER_TONE_PACKS = ["soft", "playful", "witty_sassy"] as const;
const WORKLOAD_TOLERANCE_VALUES = ["light", "normal", "heavy"] as const;
const ONBOARDING_SCHEDULE_ARCHETYPE_VALUES = [
  "nine_to_five",
  "business_owner",
  "after_work_builder",
  "student",
  "variable_schedule",
  "flexible_transition",
] as const;
const LEGACY_INTENT_TYPE_ALIASES = [
  "brain_dump",
  "brain dump",
  "braindump",
] as const;

export type PlannerRequestNormalizationReason =
  | "legacy_intent_alias"
  | "legacy_tone_pack_alias"
  | "legacy_workload_alias"
  | "stripped_thread_history"
  | "null_to_absent";

export interface PlannerRequestNormalizationEvent {
  path: string;
  originalValue: unknown;
  normalizedValue: unknown;
  reason: PlannerRequestNormalizationReason;
}

const normalizeIntentType = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();
  if (
    LEGACY_INTENT_TYPE_ALIASES.includes(
      normalized as typeof LEGACY_INTENT_TYPE_ALIASES[number],
    )
  ) {
    return "brain-dump";
  }
  return trimmed;
};

const normalizeStarterIntent = (value: unknown) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === "thread_history") {
    return undefined;
  }
  return normalized;
};

const normalizeOptionalStarterIntent = (value: unknown) => {
  if (value === null) return undefined;
  return normalizeStarterIntent(value);
};

const normalizeNullableStarterIntent = (value: unknown) => {
  if (value === null) return null;
  return normalizeStarterIntent(value);
};

const normalizeTonePack = (value: unknown) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase().replace(/[-\s]+/g, "_");
  return normalized;
};

const normalizeWorkloadTolerance = (value: unknown) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === "low") return "light";
  if (normalized === "medium") return "normal";
  if (normalized === "high") return "heavy";
  return normalized;
};

const PlannerIntentTypeSchema = z.preprocess(
  normalizeIntentType,
  z.enum(PLANNER_INTENT_TYPES),
);

const PlannerStarterIntentSchema = z.enum(PLANNER_STARTER_INTENTS);
const PlannerOptionalStarterIntentSchema = z.preprocess(
  normalizeOptionalStarterIntent,
  PlannerStarterIntentSchema.optional(),
);
const PlannerNullableStarterIntentSchema = z.preprocess(
  normalizeNullableStarterIntent,
  PlannerStarterIntentSchema.optional().nullable(),
);

const PlannerTonePackSchema = z.preprocess(
  normalizeTonePack,
  z.enum(PLANNER_TONE_PACKS),
);

const WorkloadToleranceSchema = z.preprocess(
  normalizeWorkloadTolerance,
  z.enum(WORKLOAD_TOLERANCE_VALUES),
);
const ScheduleArchetypeSchema = z.enum(ONBOARDING_SCHEDULE_ARCHETYPE_VALUES);

const PlannerClassificationTimelineSchema = z.object({
  statedDays: z.number(),
  typicalDays: z.number(),
  feasibility: z.enum(["realistic", "aggressive", "very_aggressive"]),
  adjustmentFactors: z.array(z.string()),
}).nullable().optional();

const PlannerClassificationHintSchema = z.object({
  type: PlannerIntentTypeSchema,
  confidence: z.number(),
  reasoning: z.string(),
  suggestedDeadline: z.string().optional(),
  suggestedDuration: z.number().optional(),
  suggestedActivityDurationMinutes: z.preprocess(
    (value) =>
      typeof value === "number"
        ? normalizePlannerDurationBucket(value) ?? undefined
        : value,
    z.number().optional(),
  ),
  timelineAnalysis: PlannerClassificationTimelineSchema,
}).nullable().optional();

const CompanionStatAttributeSchema = z.enum([
  "vitality",
  "wisdom",
  "discipline",
  "resolve",
  "creativity",
  "alignment",
]);

const CompanionStatNeedSchema = z.object({
  level: z.enum(["low", "medium", "high"]),
  reasons: z.array(z.string()),
});

export const PlannerRequestSchema = z.object({
  message: z.string().min(1).max(4000).trim(),
  currentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currentDateTime: z.string().min(1).max(64),
  timezone: z.string().min(1).max(100).optional(),
  horizon: z.enum(["day", "week", "month"]),
  tonePack: PlannerTonePackSchema,
  conversationHistory: z.array(z.object({
    role: z.enum(["assistant", "user"]),
    content: z.string().min(1).max(4000),
  })).max(24).default([]),
  sessionState: z.object({
    draft: z.record(z.unknown()),
    openQuestionIds: z.array(z.string()),
    preferredTimeOfDay: z.string().nullable().optional(),
    preferredTimeReason: z.string().nullable().optional(),
    reminderPreference: z.string().nullable().optional(),
    pendingStarterIntent: PlannerNullableStarterIntentSchema,
    lastClassification: PlannerIntentTypeSchema.nullable().optional(),
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
      category: z.string().nullable().optional(),
      scheduledTime: z.string().nullable(),
      estimatedDuration: z.number().nullable(),
      actualDurationMinutes: z.number().nullable().optional(),
      actualTimeSpent: z.number().nullable().optional(),
      notes: z.string().nullable().optional(),
      subtaskTitles: z.array(z.string()).optional(),
      difficulty: z.string().nullable().optional(),
      flexibility: z.enum(["fixed", "preferred", "flexible"]).nullable().optional(),
      energyType: z.enum(["deep", "admin", "physical", "errand", "social", "creative", "recovery"]).nullable().optional(),
      mustCalendarBlock: z.boolean().nullable().optional(),
      deadlineAt: z.string().nullable().optional(),
      recurrencePattern: z.string().nullable(),
      recurrenceEndDate: z.string().nullable().optional(),
      completed: z.boolean().nullable().optional(),
      completedAt: z.string().nullable().optional(),
      priority: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
      habitSourceId: z.string().nullable().optional(),
      epicId: z.string().nullable().optional(),
      epicTitle: z.string().nullable().optional(),
      contactId: z.string().nullable().optional(),
    })),
    inboxTasks: z.array(z.object({
      id: z.string(),
      title: z.string(),
      taskDate: z.string().nullable(),
      category: z.string().nullable().optional(),
      scheduledTime: z.string().nullable(),
      estimatedDuration: z.number().nullable(),
      actualDurationMinutes: z.number().nullable().optional(),
      actualTimeSpent: z.number().nullable().optional(),
      notes: z.string().nullable().optional(),
      subtaskTitles: z.array(z.string()).optional(),
      difficulty: z.string().nullable().optional(),
      flexibility: z.enum(["fixed", "preferred", "flexible"]).nullable().optional(),
      energyType: z.enum(["deep", "admin", "physical", "errand", "social", "creative", "recovery"]).nullable().optional(),
      mustCalendarBlock: z.boolean().nullable().optional(),
      deadlineAt: z.string().nullable().optional(),
      recurrencePattern: z.string().nullable(),
      recurrenceEndDate: z.string().nullable().optional(),
      completed: z.boolean().nullable().optional(),
      completedAt: z.string().nullable().optional(),
      priority: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
      habitSourceId: z.string().nullable().optional(),
      epicId: z.string().nullable().optional(),
      epicTitle: z.string().nullable().optional(),
      contactId: z.string().nullable().optional(),
    })),
    recentCompletedTasks: z.array(z.object({
      id: z.string(),
      title: z.string(),
      taskDate: z.string().nullable(),
      category: z.string().nullable().optional(),
      scheduledTime: z.string().nullable(),
      estimatedDuration: z.number().nullable(),
      actualDurationMinutes: z.number().nullable().optional(),
      actualTimeSpent: z.number().nullable().optional(),
      notes: z.string().nullable().optional(),
      subtaskTitles: z.array(z.string()).optional(),
      difficulty: z.string().nullable().optional(),
      flexibility: z.enum(["fixed", "preferred", "flexible"]).nullable().optional(),
      energyType: z.enum(["deep", "admin", "physical", "errand", "social", "creative", "recovery"]).nullable().optional(),
      mustCalendarBlock: z.boolean().nullable().optional(),
      deadlineAt: z.string().nullable().optional(),
      recurrencePattern: z.string().nullable(),
      recurrenceEndDate: z.string().nullable().optional(),
      completed: z.boolean().nullable().optional(),
      completedAt: z.string().nullable().optional(),
      priority: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
      habitSourceId: z.string().nullable().optional(),
      epicId: z.string().nullable().optional(),
      epicTitle: z.string().nullable().optional(),
      contactId: z.string().nullable().optional(),
    })).optional(),
    activeEpics: z.array(z.object({
      id: z.string(),
      title: z.string(),
      endDate: z.string().nullable(),
      progressPercentage: z.number().nullable().optional(),
      daysRemaining: z.number().nullable().optional(),
      habitCount: z.number().nullable().optional(),
    })),
    rituals: z.array(z.object({
      id: z.string(),
      epicId: z.string(),
      epicTitle: z.string(),
      title: z.string(),
      frequency: z.string().nullable(),
      preferredTime: z.string().nullable(),
      estimatedMinutes: z.number().nullable().optional(),
      actualDurationMinutes: z.number().nullable().optional(),
      currentStreak: z.number().nullable().optional(),
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
    contactsNeedingAttention: z.array(z.object({
      id: z.string(),
      name: z.string(),
      avatarUrl: z.string().nullable().optional(),
      daysSinceContact: z.number(),
      hasOverdueReminder: z.boolean(),
      reminderReason: z.string().nullable().optional(),
    })).optional(),
    reflectionSignals: z.array(z.object({
      date: z.string(),
      source: z.enum(["check_in", "reflection"]),
      mood: z.string(),
      energy: z.enum(["low", "medium", "high"]).nullable().optional(),
      wins: z.string().nullable().optional(),
      tomorrowAdjustment: z.string().nullable().optional(),
    })).optional(),
    careSignals: z.object({
      overallCare: z.number(),
      hasDormancyWarning: z.boolean(),
      dialogueTone: z.enum([
        "joyful",
        "content",
        "neutral",
        "reserved",
        "quiet",
        "silent",
      ]),
      inactiveDays: z.number(),
      daysUntilDormancy: z.number().nullable(),
    }).nullable().optional(),
    briefingContext: z.object({
      content: z.string(),
      actionPrompt: z.string().nullable().optional(),
      focus: z.string().nullable().optional(),
      inferredGoals: z.array(z.string()).optional(),
      dataSnapshot: z.record(z.unknown()).nullable().optional(),
    }).nullable().optional(),
    starterIntent: PlannerOptionalStarterIntentSchema,
    priorityScores: z.array(z.object({
      id: z.string(),
      kind: z.enum(["task", "ritual", "epic", "contact", "recovery"]),
      title: z.string(),
      score: z.number(),
      reasons: z.array(z.string()),
      taskId: z.string().nullable().optional(),
      epicId: z.string().nullable().optional(),
      ritualId: z.string().nullable().optional(),
      contactId: z.string().nullable().optional(),
      targetDate: z.string().nullable().optional(),
      suggestedTime: z.string().nullable().optional(),
    })).optional(),
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
      summary: z.string().optional(),
    }).optional(),
    plannerMemory: z.object({
      tonePack: PlannerTonePackSchema.optional(),
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
      workloadTolerance: WorkloadToleranceSchema.nullable().optional(),
      contactCadencePatterns: z.record(z.number()).optional(),
      lastConfirmedAt: z.string().nullable().optional(),
      scheduleArchetype: ScheduleArchetypeSchema.nullable().optional(),
      scheduleArchetypeLabel: z.string().nullable().optional(),
      scheduleArchetypePlanningHint: z.string().nullable().optional(),
    }).optional(),
    statInterpretation: z.object({
      statProfile: z.object({
        scores: z.object({
          vitality: z.number(),
          wisdom: z.number(),
          discipline: z.number(),
          resolve: z.number(),
          creativity: z.number(),
          alignment: z.number(),
        }),
        dominantStat: CompanionStatAttributeSchema,
        secondaryStat: CompanionStatAttributeSchema,
      }),
      statNeeds: z.object({
        vitality: CompanionStatNeedSchema,
        wisdom: CompanionStatNeedSchema,
        discipline: CompanionStatNeedSchema,
        resolve: CompanionStatNeedSchema,
        creativity: CompanionStatNeedSchema,
        alignment: CompanionStatNeedSchema,
      }),
      momentumState: z.enum([
        "locked_in",
        "coasting",
        "slipping",
        "rebuilding",
      ]),
      recentMissInterpretation: z.enum([
        "overload",
        "low_energy",
        "avoidance",
        "interruption",
        "normal_variance",
      ]),
      narrativeBrief: z.string(),
      dailyNarrative: z.string(),
      weeklyNarrative: z.string().optional(),
      identityBootstrap: z.string().optional(),
    }).optional(),
    aiSignals: z.object({
      preferredDifficulty: z.string().optional(),
      preferredHabitFrequency: z.string().optional(),
      preferredEpicDuration: z.number().optional(),
      commonContexts: z.array(z.string()).optional(),
      suggestedWorkload: WorkloadToleranceSchema.optional(),
    }).optional(),
  }),
});

type PlannerRequestClassificationHint = z.infer<
  typeof PlannerRequestSchema
>["classificationHint"];
type ParsedPlannerRequest = z.infer<typeof PlannerRequestSchema>;

const getValueAtPath = (source: unknown, path: string): unknown => {
  if (!source || typeof source !== "object") return undefined;

  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, source);
};

const getTonePackNormalizationReason = (
  originalValue: unknown,
  normalizedValue: unknown,
): PlannerRequestNormalizationReason | null => {
  if (
    typeof originalValue !== "string" || typeof normalizedValue !== "string"
  ) {
    return null;
  }

  const trimmed = originalValue.trim();
  return trimmed !== normalizedValue &&
      trimmed.toLowerCase().replace(/[-\s]+/g, "_") === normalizedValue
    ? "legacy_tone_pack_alias"
    : null;
};

const getIntentTypeNormalizationReason = (
  originalValue: unknown,
  normalizedValue: unknown,
): PlannerRequestNormalizationReason | null => {
  if (
    typeof originalValue !== "string" || typeof normalizedValue !== "string"
  ) {
    return null;
  }

  return LEGACY_INTENT_TYPE_ALIASES.includes(
      originalValue.trim()
        .toLowerCase() as typeof LEGACY_INTENT_TYPE_ALIASES[number],
    ) && normalizedValue === "brain-dump"
    ? "legacy_intent_alias"
    : null;
};

const getStarterIntentNormalizationReason = (
  originalValue: unknown,
  normalizedValue: unknown,
): PlannerRequestNormalizationReason | null => {
  if (originalValue === null && normalizedValue === undefined) {
    return "null_to_absent";
  }

  if (
    typeof originalValue === "string" &&
    originalValue.trim().toLowerCase() === "thread_history" &&
    normalizedValue === undefined
  ) {
    return "stripped_thread_history";
  }

  return null;
};

const getWorkloadNormalizationReason = (
  originalValue: unknown,
  normalizedValue: unknown,
): PlannerRequestNormalizationReason | null => {
  if (
    typeof originalValue !== "string" || typeof normalizedValue !== "string"
  ) {
    return null;
  }

  const normalizedOriginal = originalValue.trim().toLowerCase();
  return normalizedOriginal !== normalizedValue &&
      (normalizedOriginal === "low" ||
        normalizedOriginal === "medium" ||
        normalizedOriginal === "high")
    ? "legacy_workload_alias"
    : null;
};

const PLANNER_REQUEST_NORMALIZATION_RULES: Array<{
  path: string;
  getReason: (
    originalValue: unknown,
    normalizedValue: unknown,
  ) => PlannerRequestNormalizationReason | null;
}> = [
  { path: "tonePack", getReason: getTonePackNormalizationReason },
  {
    path: "classificationHint.type",
    getReason: getIntentTypeNormalizationReason,
  },
  {
    path: "sessionState.pendingStarterIntent",
    getReason: getStarterIntentNormalizationReason,
  },
  {
    path: "sessionState.lastClassification",
    getReason: getIntentTypeNormalizationReason,
  },
  {
    path: "plannerContext.starterIntent",
    getReason: getStarterIntentNormalizationReason,
  },
  {
    path: "plannerContext.plannerMemory.tonePack",
    getReason: getTonePackNormalizationReason,
  },
  {
    path: "plannerContext.plannerMemory.workloadTolerance",
    getReason: getWorkloadNormalizationReason,
  },
  {
    path: "plannerContext.aiSignals.suggestedWorkload",
    getReason: getWorkloadNormalizationReason,
  },
];

export const collectPlannerRequestNormalizationEvents = (
  rawRequest: unknown,
  parsedRequest: ParsedPlannerRequest,
): PlannerRequestNormalizationEvent[] =>
  PLANNER_REQUEST_NORMALIZATION_RULES.flatMap(({ path, getReason }) => {
    const originalValue = getValueAtPath(rawRequest, path);
    const normalizedValue = getValueAtPath(parsedRequest, path);
    const reason = getReason(originalValue, normalizedValue);

    return reason
      ? [{
        path,
        originalValue,
        normalizedValue,
        reason,
      }]
      : [];
  });

export const normalizePlannerClassificationHint = (
  classificationHint:
    | PlannerRequestClassificationHint
    | ClassificationHint
    | null
    | undefined,
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

  const normalizedActivityDuration = normalizePlannerDurationBucket(
    classificationHint.suggestedActivityDurationMinutes ??
      (classificationHint.type === "epic"
        ? undefined
        : classificationHint.suggestedDuration),
  );
  if (normalizedActivityDuration !== null) {
    normalized.suggestedActivityDurationMinutes = normalizedActivityDuration;
  }

  if (classificationHint.timelineAnalysis) {
    normalized.timelineAnalysis = classificationHint.timelineAnalysis;
  }

  return normalized;
};
