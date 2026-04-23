import { buildPlannerAISignals } from "@/utils/companionPlannerAiSignals";
import type {
  CompanionPlannerRequest,
  PlannerCareState,
  CompanionPlannerSessionState,
  PlannerStatInterpretation,
} from "@/types/companionPlanner";

type PlannerContext = CompanionPlannerRequest["plannerContext"];
type PlannerConversationHistory = CompanionPlannerRequest["conversationHistory"];
type PlannerSessionState = CompanionPlannerSessionState;
type PlannerParsedInput = NonNullable<CompanionPlannerRequest["parsedInput"]>;

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const asNullableString = (value: unknown): string | null =>
  value === null ? null : asNonEmptyString(value) ?? null;

const asFiniteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const asNullableNumber = (value: unknown): number | null =>
  value === null ? null : asFiniteNumber(value) ?? null;

const asBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const asNullableBoolean = (value: unknown): boolean | null =>
  value === null ? null : asBoolean(value) ?? null;

const asStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const normalized = value
    .map((entry) => asNonEmptyString(entry))
    .filter((entry): entry is string => Boolean(entry));

  return normalized;
};

const asNumberArray = (value: unknown): number[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  return value.filter((entry): entry is number =>
    typeof entry === "number" && Number.isFinite(entry)
  );
};

const asRecordOfNumbers = (
  value: unknown,
): Record<string, number> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value)
    .map(([key, entry]) => [asNonEmptyString(key), asFiniteNumber(entry)] as const)
    .filter((entry): entry is readonly [string, number] =>
      Boolean(entry[0]) && entry[1] !== undefined
    );

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const isPlannerTonePack = (
  value: unknown,
): value is NonNullable<PlannerContext["plannerMemory"]>["tonePack"] =>
  value === "soft" || value === "playful" || value === "witty_sassy";

const isWorkloadTolerance = (
  value: unknown,
): value is NonNullable<PlannerContext["plannerMemory"]>["workloadTolerance"] =>
  value === "light" || value === "normal" || value === "heavy";

const isHorizon = (
  value: unknown,
): value is NonNullable<PlannerContext["scheduleInsights"]>["horizon"] =>
  value === "day" || value === "week" || value === "month";

const isDayLoadStatus = (
  value: unknown,
): value is NonNullable<
  NonNullable<PlannerContext["scheduleInsights"]>["dayLoads"][number]
>["status"] =>
  value === "open" ||
  value === "balanced" ||
  value === "busy" ||
  value === "overloaded";

const isPlannerStarterIntent = (
  value: unknown,
): value is NonNullable<PlannerContext["starterIntent"]> => [
  "general",
  "plan_day",
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
].includes(String(value));

const isPlannerConversationRole = (
  value: unknown,
): value is PlannerConversationHistory[number]["role"] =>
  value === "assistant" || value === "user";

const isPlannerSessionStarterIntent = (
  value: unknown,
): value is NonNullable<PlannerSessionState["pendingStarterIntent"]> =>
  isPlannerStarterIntent(value) || value === "goal_breakdown";

const isClassificationType = (
  value: unknown,
): value is NonNullable<PlannerSessionState["lastClassification"]> =>
  value === "quest" ||
  value === "epic" ||
  value === "habit" ||
  value === "brain-dump" ||
  value === "brain_dump" ||
  value === "brain dump" ||
  value === "braindump";

const isParsedInputCustomPeriod = (
  value: unknown,
): value is NonNullable<PlannerParsedInput["recurrenceCustomPeriod"]> =>
  value === "week" || value === "month";

const isCareTone = (
  value: unknown,
): value is PlannerCareState["dialogueTone"] =>
  value === "joyful" ||
  value === "content" ||
  value === "neutral" ||
  value === "reserved" ||
  value === "quiet" ||
  value === "silent";

const isReflectionSource = (
  value: unknown,
): value is NonNullable<PlannerContext["reflectionSignals"]>[number]["source"] =>
  value === "check_in" || value === "reflection";

const isReflectionEnergy = (
  value: unknown,
): value is NonNullable<
  NonNullable<PlannerContext["reflectionSignals"]>[number]["energy"]
> =>
  value === "low" || value === "medium" || value === "high";

const isPriorityKind = (
  value: unknown,
): value is NonNullable<PlannerContext["priorityScores"]>[number]["kind"] =>
  value === "task" ||
  value === "ritual" ||
  value === "epic" ||
  value === "contact" ||
  value === "recovery";

const isStatAttribute = (
  value: unknown,
): value is keyof PlannerStatInterpretation["statProfile"]["scores"] =>
  value === "vitality" ||
  value === "wisdom" ||
  value === "discipline" ||
  value === "resolve" ||
  value === "creativity" ||
  value === "alignment";

const isNeedLevel = (
  value: unknown,
): value is PlannerStatInterpretation["statNeeds"]["vitality"]["level"] =>
  value === "low" || value === "medium" || value === "high";

const isMomentumState = (
  value: unknown,
): value is PlannerStatInterpretation["momentumState"] =>
  value === "locked_in" ||
  value === "coasting" ||
  value === "slipping" ||
  value === "rebuilding";

const isMissInterpretation = (
  value: unknown,
): value is PlannerStatInterpretation["recentMissInterpretation"] =>
  value === "overload" ||
  value === "low_energy" ||
  value === "avoidance" ||
  value === "interruption" ||
  value === "normal_variance";

const sanitizeTaskLikeEntry = (
  entry: PlannerContext["tasks"][number],
): PlannerContext["tasks"][number] | null => {
  const id = asNonEmptyString(entry.id);
  const title = asNonEmptyString(entry.title);
  if (!id || !title) return null;

  return {
    id,
    title,
    taskDate: asNullableString(entry.taskDate),
    category: asNullableString(entry.category),
    scheduledTime: asNullableString(entry.scheduledTime),
    estimatedDuration: asNullableNumber(entry.estimatedDuration),
    notes: asNullableString(entry.notes),
    subtaskTitles: asStringArray(entry.subtaskTitles),
    difficulty: asNullableString(entry.difficulty),
    recurrencePattern: asNullableString(entry.recurrencePattern),
    recurrenceEndDate: asNullableString(entry.recurrenceEndDate),
    completed: asNullableBoolean(entry.completed),
    priority: asNullableString(entry.priority),
    source: asNullableString(entry.source),
    habitSourceId: asNullableString(entry.habitSourceId),
    epicId: asNullableString(entry.epicId),
    epicTitle: asNullableString(entry.epicTitle),
    contactId: asNullableString(entry.contactId),
  };
};

const sanitizeEpic = (
  entry: PlannerContext["activeEpics"][number],
): PlannerContext["activeEpics"][number] | null => {
  const id = asNonEmptyString(entry.id);
  const title = asNonEmptyString(entry.title);
  if (!id || !title) return null;

  return {
    id,
    title,
    endDate: asNullableString(entry.endDate),
    progressPercentage: asNullableNumber(entry.progressPercentage),
    daysRemaining: asNullableNumber(entry.daysRemaining),
    habitCount: asNullableNumber(entry.habitCount),
  };
};

const sanitizeRitual = (
  entry: PlannerContext["rituals"][number],
): PlannerContext["rituals"][number] | null => {
  const id = asNonEmptyString(entry.id);
  const epicId = asNonEmptyString(entry.epicId);
  const epicTitle = asNonEmptyString(entry.epicTitle);
  const title = asNonEmptyString(entry.title);
  if (!id || !epicId || !epicTitle || !title) return null;

  return {
    id,
    epicId,
    epicTitle,
    title,
    frequency: asNullableString(entry.frequency),
    preferredTime: asNullableString(entry.preferredTime),
    currentStreak: asNullableNumber(entry.currentStreak),
  };
};

const sanitizeCalendarEvent = (
  entry: PlannerContext["calendarEvents"][number],
): PlannerContext["calendarEvents"][number] | null => {
  const id = asNonEmptyString(entry.id);
  const title = asNonEmptyString(entry.title);
  const start = asNonEmptyString(entry.start);
  const end = asNonEmptyString(entry.end);
  const provider = asNonEmptyString(entry.provider);
  const isAllDay = asBoolean(entry.isAllDay);
  const readOnly = asBoolean(entry.readOnly);
  if (!id || !title || !start || !end || !provider) return null;
  if (isAllDay === undefined || readOnly === undefined) return null;

  return {
    id,
    title,
    start,
    end,
    isAllDay,
    provider,
    readOnly,
  };
};

const sanitizeContact = (
  entry: NonNullable<PlannerContext["contactsNeedingAttention"]>[number],
): NonNullable<PlannerContext["contactsNeedingAttention"]>[number] | null => {
  const id = asNonEmptyString(entry.id);
  const name = asNonEmptyString(entry.name);
  const daysSinceContact = asFiniteNumber(entry.daysSinceContact);
  const hasOverdueReminder = asBoolean(entry.hasOverdueReminder);
  if (!id || !name || daysSinceContact === undefined) return null;
  if (hasOverdueReminder === undefined) return null;

  return {
    id,
    name,
    avatarUrl: asNullableString(entry.avatarUrl),
    daysSinceContact,
    hasOverdueReminder,
    reminderReason: asNullableString(entry.reminderReason),
  };
};

const sanitizeReflection = (
  entry: NonNullable<PlannerContext["reflectionSignals"]>[number],
): NonNullable<PlannerContext["reflectionSignals"]>[number] | null => {
  const date = asNonEmptyString(entry.date);
  const mood = asNonEmptyString(entry.mood);
  if (!date || !mood || !isReflectionSource(entry.source)) return null;

  return {
    date,
    source: entry.source,
    mood,
    energy: isReflectionEnergy(entry.energy) ? entry.energy : null,
    wins: asNullableString(entry.wins),
    tomorrowAdjustment: asNullableString(entry.tomorrowAdjustment),
  };
};

const sanitizeCareSignals = (
  entry: PlannerContext["careSignals"],
): PlannerContext["careSignals"] => {
  if (!entry) return undefined;

  const overallCare = asFiniteNumber(entry.overallCare);
  const hasDormancyWarning = asBoolean(entry.hasDormancyWarning);
  const inactiveDays = asFiniteNumber(entry.inactiveDays);
  const daysUntilDormancy = asNullableNumber(entry.daysUntilDormancy);
  if (
    overallCare === undefined ||
    hasDormancyWarning === undefined ||
    inactiveDays === undefined ||
    !isCareTone(entry.dialogueTone)
  ) {
    return undefined;
  }

  return {
    overallCare,
    hasDormancyWarning,
    dialogueTone: entry.dialogueTone,
    inactiveDays,
    daysUntilDormancy,
  };
};

const sanitizeBriefingContext = (
  entry: PlannerContext["briefingContext"],
): PlannerContext["briefingContext"] => {
  if (entry === null) return null;
  if (!entry) return undefined;

  const content = asNonEmptyString(entry.content);
  if (!content) return undefined;

  return {
    content,
    actionPrompt: asNullableString(entry.actionPrompt),
    focus: asNullableString(entry.focus),
    inferredGoals: asStringArray(entry.inferredGoals),
    dataSnapshot:
      entry.dataSnapshot && typeof entry.dataSnapshot === "object"
        ? entry.dataSnapshot
        : entry.dataSnapshot === null
        ? null
        : undefined,
  };
};

const sanitizePriorityScore = (
  entry: NonNullable<PlannerContext["priorityScores"]>[number],
): NonNullable<PlannerContext["priorityScores"]>[number] | null => {
  const id = asNonEmptyString(entry.id);
  const title = asNonEmptyString(entry.title);
  const score = asFiniteNumber(entry.score);
  if (!id || !title || score === undefined || !isPriorityKind(entry.kind)) {
    return null;
  }

  return {
    id,
    kind: entry.kind,
    title,
    score,
    reasons: asStringArray(entry.reasons) ?? [],
    taskId: asNullableString(entry.taskId),
    epicId: asNullableString(entry.epicId),
    ritualId: asNullableString(entry.ritualId),
    contactId: asNullableString(entry.contactId),
    targetDate: asNullableString(entry.targetDate),
    suggestedTime: asNullableString(entry.suggestedTime),
  };
};

const sanitizeScheduleInsights = (
  entry: PlannerContext["scheduleInsights"],
): PlannerContext["scheduleInsights"] => {
  if (!entry) return undefined;
  if (!isHorizon(entry.horizon)) return undefined;

  const selectedDate = asNonEmptyString(entry.selectedDate);
  if (!selectedDate) return undefined;

  const dayLoads = entry.dayLoads
    .map((dayLoad) => {
      const date = asNonEmptyString(dayLoad.date);
      const totalMinutes = asFiniteNumber(dayLoad.totalMinutes);
      const taskCount = asFiniteNumber(dayLoad.taskCount);
      if (
        !date ||
        totalMinutes === undefined ||
        taskCount === undefined ||
        !isDayLoadStatus(dayLoad.status)
      ) {
        return null;
      }

      return {
        date,
        totalMinutes,
        taskCount,
        status: dayLoad.status,
      };
    })
    .filter((dayLoad): dayLoad is NonNullable<
      PlannerContext["scheduleInsights"]
    >["dayLoads"][number] => Boolean(dayLoad));

  return {
    horizon: entry.horizon,
    selectedDate,
    dayLoads,
    overloadedDates: asStringArray(entry.overloadedDates) ?? [],
    emptyDates: asStringArray(entry.emptyDates) ?? [],
    conflicts: entry.conflicts
      .map((conflict) => {
        const date = asNonEmptyString(conflict.date);
        const taskAId = asNonEmptyString(conflict.taskAId);
        const taskATitle = asNonEmptyString(conflict.taskATitle);
        const taskBId = asNonEmptyString(conflict.taskBId);
        const taskBTitle = asNonEmptyString(conflict.taskBTitle);
        const overlapMinutes = asFiniteNumber(conflict.overlapMinutes);
        if (
          !date ||
          !taskAId ||
          !taskATitle ||
          !taskBId ||
          !taskBTitle ||
          overlapMinutes === undefined
        ) {
          return null;
        }

        return {
          date,
          taskAId,
          taskATitle,
          taskBId,
          taskBTitle,
          overlapMinutes,
        };
      })
      .filter((conflict): conflict is NonNullable<
        PlannerContext["scheduleInsights"]
      >["conflicts"][number] => Boolean(conflict)),
    suggestedSlots: entry.suggestedSlots
      .map((slot) => {
        const date = asNonEmptyString(slot.date);
        const time = asNonEmptyString(slot.time);
        const endTime = asNonEmptyString(slot.endTime);
        const score = asFiniteNumber(slot.score);
        const reason = asNonEmptyString(slot.reason);
        if (!date || !time || !endTime || score === undefined || !reason) {
          return null;
        }

        return {
          date,
          time,
          endTime,
          score,
          reason,
        };
      })
      .filter((slot): slot is NonNullable<
        PlannerContext["scheduleInsights"]
      >["suggestedSlots"][number] => Boolean(slot)),
    moveSuggestions: entry.moveSuggestions
      .map((suggestion) => {
        const fromDate = asNonEmptyString(suggestion.fromDate);
        const toDate = asNonEmptyString(suggestion.toDate);
        const reason = asNonEmptyString(suggestion.reason);
        if (!fromDate || !toDate || !reason) return null;

        return {
          fromDate,
          toDate,
          taskId: asNullableString(suggestion.taskId),
          taskTitle: asNullableString(suggestion.taskTitle),
          suggestedTime: asNullableString(suggestion.suggestedTime),
          reason,
        };
      })
      .filter((suggestion): suggestion is NonNullable<
        PlannerContext["scheduleInsights"]
      >["moveSuggestions"][number] => Boolean(suggestion)),
    summary: asNonEmptyString(entry.summary),
  };
};

const sanitizePlannerMemory = (
  entry: PlannerContext["plannerMemory"],
): PlannerContext["plannerMemory"] => {
  if (!entry) return undefined;

  const nextMemory: NonNullable<PlannerContext["plannerMemory"]> = {};

  if (isPlannerTonePack(entry.tonePack)) {
    nextMemory.tonePack = entry.tonePack;
  }

  nextMemory.preferredTimeOfDay = asNullableString(entry.preferredTimeOfDay);
  nextMemory.preferredTimeReason = asNullableString(entry.preferredTimeReason);
  nextMemory.reminderMinutesBefore = asNullableNumber(
    entry.reminderMinutesBefore,
  );
  nextMemory.wakeTime = asNullableString(entry.wakeTime);
  nextMemory.windDownTime = asNullableString(entry.windDownTime);
  nextMemory.peakProductivityTimes =
    asStringArray(entry.peakProductivityTimes) ?? [];
  nextMemory.preferredWindows = (entry.preferredWindows ?? [])
    .map((window) => {
      const timeOfDay = asNonEmptyString(window.timeOfDay);
      if (!timeOfDay) return null;

      return {
        timeOfDay,
        time: asNullableString(window.time),
        reason: asNullableString(window.reason),
        sourceCount: asFiniteNumber(window.sourceCount),
      };
    })
    .filter((window): window is NonNullable<
      NonNullable<PlannerContext["plannerMemory"]>["preferredWindows"]
    >[number] => Boolean(window));

  nextMemory.cadencePatterns = asRecordOfNumbers(entry.cadencePatterns);

  if (isWorkloadTolerance(entry.workloadTolerance)) {
    nextMemory.workloadTolerance = entry.workloadTolerance;
  } else {
    nextMemory.workloadTolerance = null;
  }

  nextMemory.contactCadencePatterns = asRecordOfNumbers(
    entry.contactCadencePatterns,
  );
  nextMemory.lastConfirmedAt = asNullableString(entry.lastConfirmedAt);

  return nextMemory;
};

const sanitizeStatInterpretation = (
  entry: PlannerContext["statInterpretation"],
): PlannerContext["statInterpretation"] => {
  if (!entry) return undefined;

  const scores = entry.statProfile?.scores;
  const scoreRecord = scores && typeof scores === "object"
    ? Object.fromEntries(
      Object.entries(scores)
        .filter(([key, value]) => isStatAttribute(key) && asFiniteNumber(value) !== undefined)
        .map(([key, value]) => [key, asFiniteNumber(value)!]),
    )
    : {};

  if (
    !isStatAttribute(entry.statProfile?.dominantStat) ||
    !isStatAttribute(entry.statProfile?.secondaryStat) ||
    Object.keys(scoreRecord).length !== 6 ||
    !isMomentumState(entry.momentumState) ||
    !isMissInterpretation(entry.recentMissInterpretation)
  ) {
    return undefined;
  }

  const statNeedsEntries = Object.entries(entry.statNeeds ?? {})
    .map(([attribute, need]) => {
      if (!isStatAttribute(attribute) || !need || !isNeedLevel(need.level)) {
        return null;
      }

      return [
        attribute,
        {
          level: need.level,
          reasons: asStringArray(need.reasons) ?? [],
        },
      ] as const;
    })
    .filter((entry): entry is readonly [
      keyof PlannerStatInterpretation["statNeeds"],
      PlannerStatInterpretation["statNeeds"]["vitality"],
    ] => Boolean(entry));

  if (statNeedsEntries.length !== 6) return undefined;

  const narrativeBrief = asNonEmptyString(entry.narrativeBrief);
  const dailyNarrative = asNonEmptyString(entry.dailyNarrative);
  if (!narrativeBrief || !dailyNarrative) return undefined;

  return {
    statProfile: {
      scores: scoreRecord as PlannerStatInterpretation["statProfile"]["scores"],
      dominantStat: entry.statProfile.dominantStat,
      secondaryStat: entry.statProfile.secondaryStat,
    },
    statNeeds: Object.fromEntries(statNeedsEntries) as PlannerStatInterpretation["statNeeds"],
    momentumState: entry.momentumState,
    recentMissInterpretation: entry.recentMissInterpretation,
    narrativeBrief,
    dailyNarrative,
    weeklyNarrative: asNonEmptyString(entry.weeklyNarrative),
    identityBootstrap: asNonEmptyString(entry.identityBootstrap),
  };
};

export const sanitizePlannerConversationHistory = (
  conversationHistory: PlannerConversationHistory,
): PlannerConversationHistory =>
  conversationHistory
    .map((entry) => {
      const content = asNonEmptyString(entry.content);
      if (!content || !isPlannerConversationRole(entry.role)) {
        return null;
      }

      return {
        role: entry.role,
        content: content.slice(0, 4000),
      };
    })
    .filter((entry): entry is PlannerConversationHistory[number] =>
      Boolean(entry)
    )
    .slice(-24);

const sanitizeSessionDraft = (
  draft: PlannerSessionState["draft"],
): PlannerSessionState["draft"] =>
  draft && typeof draft === "object" && !Array.isArray(draft)
    ? draft
    : {};

export const sanitizePlannerSessionState = (
  sessionState: PlannerSessionState,
): PlannerSessionState => {
  const normalizedLastClassification = typeof sessionState.lastClassification ===
        "string"
      ? sessionState.lastClassification.trim().toLowerCase()
      : null;

  return {
    draft: sanitizeSessionDraft(sessionState.draft),
    openQuestionIds: asStringArray(sessionState.openQuestionIds) ?? [],
    preferredTimeOfDay: asNullableString(sessionState.preferredTimeOfDay),
    preferredTimeReason: asNullableString(sessionState.preferredTimeReason),
    reminderPreference: asNullableString(sessionState.reminderPreference),
    pendingStarterIntent: isPlannerSessionStarterIntent(
        sessionState.pendingStarterIntent,
      )
      ? sessionState.pendingStarterIntent
      : sessionState.pendingStarterIntent === null
      ? null
      : undefined,
    lastClassification: isClassificationType(normalizedLastClassification)
      ? normalizedLastClassification === "brain_dump" ||
          normalizedLastClassification === "brain dump" ||
          normalizedLastClassification === "braindump"
        ? "brain-dump"
        : normalizedLastClassification
      : sessionState.lastClassification === null
      ? null
      : undefined,
  };
};

export const sanitizePlannerParsedInput = (
  parsedInput: CompanionPlannerRequest["parsedInput"],
): CompanionPlannerRequest["parsedInput"] => {
  if (!parsedInput) return undefined;

  return {
    text: typeof parsedInput.text === "string" ? parsedInput.text : "",
    scheduledTime: asNullableString(parsedInput.scheduledTime),
    scheduledDate: asNullableString(parsedInput.scheduledDate),
    estimatedDuration: asNullableNumber(parsedInput.estimatedDuration),
    recurrencePattern: asNullableString(parsedInput.recurrencePattern),
    recurrenceDays: asNumberArray(parsedInput.recurrenceDays) ?? [],
    recurrenceMonthDays: asNumberArray(parsedInput.recurrenceMonthDays) ?? [],
    recurrenceCustomPeriod: isParsedInputCustomPeriod(
        parsedInput.recurrenceCustomPeriod,
      )
      ? parsedInput.recurrenceCustomPeriod
      : null,
    recurrenceEndDate: asNullableString(parsedInput.recurrenceEndDate),
    notes: asNullableString(parsedInput.notes),
    category: asNullableString(parsedInput.category),
    newTitle: asNullableString(parsedInput.newTitle),
  };
};

export const sanitizePlannerContext = (
  context: PlannerContext,
): PlannerContext => {
  const starterIntent = isPlannerStarterIntent(context.starterIntent)
    ? context.starterIntent
    : undefined;
  const contactsNeedingAttention = (context.contactsNeedingAttention ?? [])
    .map(sanitizeContact)
    .filter((entry): entry is NonNullable<
      PlannerContext["contactsNeedingAttention"]
    >[number] => Boolean(entry));
  const reflectionSignals = (context.reflectionSignals ?? [])
    .map(sanitizeReflection)
    .filter((entry): entry is NonNullable<
      PlannerContext["reflectionSignals"]
    >[number] => Boolean(entry));
  const priorityScores = (context.priorityScores ?? [])
    .map(sanitizePriorityScore)
    .filter((entry): entry is NonNullable<
      PlannerContext["priorityScores"]
    >[number] => Boolean(entry));

  return {
    tasks: context.tasks
      .map(sanitizeTaskLikeEntry)
      .filter((entry): entry is PlannerContext["tasks"][number] =>
        Boolean(entry)
      ),
    inboxTasks: context.inboxTasks
      .map(sanitizeTaskLikeEntry)
      .filter((entry): entry is PlannerContext["inboxTasks"][number] =>
        Boolean(entry)
      ),
    activeEpics: context.activeEpics
      .map(sanitizeEpic)
      .filter((entry): entry is PlannerContext["activeEpics"][number] =>
        Boolean(entry)
      ),
    rituals: context.rituals
      .map(sanitizeRitual)
      .filter((entry): entry is PlannerContext["rituals"][number] =>
        Boolean(entry)
      ),
    calendarEvents: context.calendarEvents
      .map(sanitizeCalendarEvent)
      .filter((entry): entry is PlannerContext["calendarEvents"][number] =>
        Boolean(entry)
      ),
    contactsNeedingAttention,
    reflectionSignals,
    careSignals: sanitizeCareSignals(context.careSignals),
    briefingContext: sanitizeBriefingContext(context.briefingContext),
    starterIntent,
    priorityScores,
    scheduleInsights: sanitizeScheduleInsights(context.scheduleInsights),
    plannerMemory: sanitizePlannerMemory(context.plannerMemory),
    statInterpretation: sanitizeStatInterpretation(context.statInterpretation),
    aiSignals: buildPlannerAISignals(context.aiSignals),
  };
};

export const summarizePlannerContextForDebug = (context: PlannerContext) => ({
  tasks: context.tasks.length,
  inboxTasks: context.inboxTasks.length,
  activeEpics: context.activeEpics.length,
  rituals: context.rituals.length,
  calendarEvents: context.calendarEvents.length,
  contactsNeedingAttention: context.contactsNeedingAttention?.length ?? 0,
  reflectionSignals: context.reflectionSignals?.length ?? 0,
  priorityScores: context.priorityScores?.length ?? 0,
  hasCareSignals: Boolean(context.careSignals),
  hasBriefingContext: Boolean(context.briefingContext),
  hasScheduleInsights: Boolean(context.scheduleInsights),
  hasPlannerMemory: Boolean(context.plannerMemory),
  hasStatInterpretation: Boolean(context.statInterpretation),
  aiSignals: context.aiSignals,
  starterIntent: context.starterIntent ?? null,
});

export const summarizePlannerSessionStateForDebug = (
  sessionState: PlannerSessionState,
) => ({
  draftKeys: Object.keys(
    sessionState.draft && typeof sessionState.draft === "object" &&
        !Array.isArray(sessionState.draft)
      ? sessionState.draft
      : {},
  ),
  openQuestionIds: sessionState.openQuestionIds,
  preferredTimeOfDayType: sessionState.preferredTimeOfDay === null
    ? "null"
    : typeof sessionState.preferredTimeOfDay,
  preferredTimeReasonType: sessionState.preferredTimeReason === null
    ? "null"
    : typeof sessionState.preferredTimeReason,
  reminderPreferenceType: sessionState.reminderPreference === null
    ? "null"
    : typeof sessionState.reminderPreference,
  pendingStarterIntent: sessionState.pendingStarterIntent ?? null,
  lastClassification: sessionState.lastClassification ?? null,
});

export const summarizePlannerParsedInputForDebug = (
  parsedInput: CompanionPlannerRequest["parsedInput"],
) => parsedInput
  ? {
    textLength: typeof parsedInput.text === "string" ? parsedInput.text.length : null,
    scheduledTime: parsedInput.scheduledTime ?? null,
    scheduledDate: parsedInput.scheduledDate ?? null,
    estimatedDuration: parsedInput.estimatedDuration ?? null,
    recurrencePattern: parsedInput.recurrencePattern ?? null,
    recurrenceDays: Array.isArray(parsedInput.recurrenceDays)
      ? parsedInput.recurrenceDays
      : null,
    recurrenceMonthDays: Array.isArray(parsedInput.recurrenceMonthDays)
      ? parsedInput.recurrenceMonthDays
      : null,
    recurrenceCustomPeriod: parsedInput.recurrenceCustomPeriod ?? null,
    notesType: parsedInput.notes === null ? "null" : typeof parsedInput.notes,
    categoryType: parsedInput.category === null
      ? "null"
      : typeof parsedInput.category,
    newTitleType: parsedInput.newTitle === null
      ? "null"
      : typeof parsedInput.newTitle,
  }
  : null;

export const summarizePlannerRequestForDebug = (
  request: CompanionPlannerRequest,
) => ({
  messageLength: request.message.length,
  horizon: request.horizon,
  currentDate: request.currentDate,
  currentDateTime: request.currentDateTime,
  timezone: request.timezone ?? null,
  tonePack: request.tonePack,
  conversationHistoryCount: request.conversationHistory.length,
  sessionState: summarizePlannerSessionStateForDebug(request.sessionState),
  parsedInput: summarizePlannerParsedInputForDebug(request.parsedInput),
  classificationHint: request.classificationHint
    ? {
      type: request.classificationHint.type,
      confidence: request.classificationHint.confidence,
      hasTimelineAnalysis: Boolean(request.classificationHint.timelineAnalysis),
    }
    : null,
  plannerContext: summarizePlannerContextForDebug(request.plannerContext),
});
