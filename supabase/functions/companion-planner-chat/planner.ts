export type PlannerHorizon = "day" | "week" | "month";
export type PlannerTonePack = "soft" | "playful" | "witty_sassy";
export type PlannerProposalKind =
  | "create_quest"
  | "update_quest"
  | "create_campaign"
  | "update_campaign"
  | "create_ritual"
  | "update_ritual"
  | "suggest_reminder";
export type IntentType = "quest" | "epic" | "habit" | "brain-dump";

export interface PlannerQuestion {
  id: string;
  prompt: string;
  reason?: string | null;
  required: boolean;
  field:
    | "time_of_day"
    | "time_reason"
    | "cadence"
    | "end_date"
    | "campaign_link"
    | "duration"
    | "details";
  options?: string[];
}

export interface PlannerProposal {
  id: string;
  kind: PlannerProposalKind;
  title: string;
  summary: string;
  reasoning?: string | null;
  payload: Record<string, unknown>;
  status: "pending" | "confirmed" | "rejected";
  readyToConfirm: boolean;
  missingFields?: string[];
}

export interface PlannerDraftState {
  title?: string | null;
  taskId?: string | null;
  ritualId?: string | null;
  epicId?: string | null;
  epicTitle?: string | null;
  draftKind?: PlannerProposalKind | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  timeOfDay?: string | null;
  timeReason?: string | null;
  cadence?: string | null;
  endDate?: string | null;
  durationMinutes?: number | null;
  reminderMinutesBefore?: number | null;
}

export interface PlannerSessionState {
  draft: PlannerDraftState;
  openQuestionIds: string[];
  preferredTimeOfDay?: string | null;
  preferredTimeReason?: string | null;
  reminderPreference?: string | null;
  lastClassification?: IntentType | null;
}

export interface PlannerContextTask {
  id: string;
  title: string;
  taskDate: string | null;
  scheduledTime: string | null;
  estimatedDuration: number | null;
  recurrencePattern: string | null;
  recurrenceEndDate?: string | null;
  completed?: boolean | null;
  priority?: string | null;
  source?: string | null;
  epicId?: string | null;
  epicTitle?: string | null;
}

export interface PlannerContextEpic {
  id: string;
  title: string;
  endDate: string | null;
}

export interface PlannerContextRitual {
  id: string;
  epicId: string;
  epicTitle: string;
  title: string;
  frequency: string | null;
  preferredTime: string | null;
}

export interface PlannerScheduleConflict {
  date: string;
  taskAId: string;
  taskATitle: string;
  taskBId: string;
  taskBTitle: string;
  overlapMinutes: number;
}

export interface PlannerOpenSlot {
  date: string;
  time: string;
  endTime: string;
  score: number;
  reason: string;
}

export interface PlannerDayLoad {
  date: string;
  totalMinutes: number;
  taskCount: number;
  status: "open" | "balanced" | "busy" | "overloaded";
}

export interface PlannerMoveSuggestion {
  fromDate: string;
  toDate: string;
  taskId?: string | null;
  taskTitle?: string | null;
  suggestedTime?: string | null;
  reason: string;
}

export interface PlannerScheduleInsights {
  horizon: PlannerHorizon;
  selectedDate: string;
  dayLoads: PlannerDayLoad[];
  overloadedDates: string[];
  emptyDates: string[];
  conflicts: PlannerScheduleConflict[];
  suggestedSlots: PlannerOpenSlot[];
  moveSuggestions: PlannerMoveSuggestion[];
  summary: string;
}

export interface PlannerMemoryProfile {
  tonePack?: PlannerTonePack;
  preferredTimeOfDay?: string | null;
  preferredTimeReason?: string | null;
  reminderMinutesBefore?: number | null;
  wakeTime?: string | null;
  windDownTime?: string | null;
  peakProductivityTimes?: string[];
  preferredWindows?: Array<{
    timeOfDay: string;
    time?: string | null;
    reason?: string | null;
    sourceCount?: number;
  }>;
  cadencePatterns?: Record<string, number>;
  lastConfirmedAt?: string | null;
}

export interface ClassificationHint {
  type: IntentType;
  confidence: number;
  reasoning: string;
  suggestedDeadline?: string;
  suggestedDuration?: number;
  timelineAnalysis?: {
    statedDays: number;
    typicalDays: number;
    feasibility: "realistic" | "aggressive" | "very_aggressive";
    adjustmentFactors: string[];
  };
}

export interface ParsedInputHint {
  text: string;
  scheduledTime: string | null;
  scheduledDate: string | null;
  estimatedDuration: number | null;
  recurrencePattern: string | null;
  recurrenceDays: number[];
  recurrenceMonthDays: number[];
  recurrenceCustomPeriod: "week" | "month" | null;
  recurrenceEndDate: string | null;
  notes: string | null;
  category: string | null;
  newTitle: string | null;
}

export interface PlannerBuildInput {
  message: string;
  horizon: PlannerHorizon;
  tonePack: PlannerTonePack;
  sessionState: PlannerSessionState;
  parsedInput?: ParsedInputHint | null;
  classificationHint?: ClassificationHint | null;
  plannerContext: {
    tasks: PlannerContextTask[];
    inboxTasks: PlannerContextTask[];
    activeEpics: PlannerContextEpic[];
    rituals: PlannerContextRitual[];
    scheduleInsights?: PlannerScheduleInsights;
    plannerMemory?: PlannerMemoryProfile;
    aiSignals?: {
      preferredDifficulty?: string;
      preferredHabitFrequency?: string;
      preferredEpicDuration?: number;
      commonContexts?: string[];
      suggestedWorkload?: "light" | "normal" | "heavy";
    };
  };
  currentDate: string;
}

export interface PlannerBuildResult {
  reply: string;
  followUpQuestions: PlannerQuestion[];
  proposals: PlannerProposal[];
  suggestedReminders: PlannerProposal[];
  memoryUpdates: {
    preferredTimeOfDay?: string | null;
    preferredTimeReason?: string | null;
    reminderPreference?: string | null;
  };
  sessionState: PlannerSessionState;
}

type MatchedEntities = {
  task: PlannerContextTask | null;
  ritual: PlannerContextRitual | null;
  epic: PlannerContextEpic | null;
};

type ResolvedCadence = {
  label: string | null;
  recurrencePattern: string | null;
  recurrenceDays: number[] | null;
  recurrenceMonthDays: number[] | null;
  recurrenceCustomPeriod: "week" | "month" | null;
  habitFrequency: string | null;
  habitCustomDays: number[] | null;
  habitCustomMonthDays: number[] | null;
};

const DAY_KEYWORDS = [
  ["monday", 0],
  ["tuesday", 1],
  ["wednesday", 2],
  ["thursday", 3],
  ["friday", 4],
  ["saturday", 5],
  ["sunday", 6],
] as const;

const normalizeText = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const createId = () => crypto.randomUUID();

const isRepeatedIntent = (message: string, parsedInput?: ParsedInputHint | null): boolean => {
  if (parsedInput?.recurrencePattern) return true;

  return /\b(daily|weekly|monthly|every day|every morning|every evening|every week|every month|every weekday|weekdays|repeat|recurring|each day|each week)\b/i.test(message);
};

const isEditIntent = (message: string): boolean =>
  /\b(move|reschedule|shift|change|adjust|update|edit|rename|make it|instead|push|pull|switch)\b/i.test(message);

const isReminderIntent = (message: string): boolean =>
  /\b(remind|reminder|alert|ping me|nudge me)\b/i.test(message);

const isLikelyAnswerOnly = (message: string, sessionState: PlannerSessionState): boolean => {
  if (!sessionState.draft.title || sessionState.openQuestionIds.length === 0) return false;

  return (
    message.length <= 160
    && !/\b(add|create|make|plan|move|rename|reschedule|change|update|need to|want to|set up)\b/i.test(message)
  );
};

const extractTimeOfDay = (message: string, parsedInput?: ParsedInputHint | null): string | null => {
  if (parsedInput?.scheduledTime) {
    const hour = Number.parseInt(parsedInput.scheduledTime.split(":")[0] ?? "", 10);
    if (Number.isNaN(hour)) return null;
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    if (hour < 21) return "evening";
    return "night";
  }

  if (/\bmorning(s)?\b/i.test(message)) return "morning";
  if (/\bafternoon(s)?\b/i.test(message)) return "afternoon";
  if (/\bevening(s)?\b/i.test(message)) return "evening";
  if (/\bnight(s)?\b/i.test(message)) return "night";
  return null;
};

const extractTimeReason = (message: string, sessionState: PlannerSessionState): string | null => {
  const becauseMatch = message.match(/\b(?:because|since)\s+(.+)/i);
  if (becauseMatch?.[1]) return becauseMatch[1].trim();

  const worksMatch = message.match(/\b(.+?)\s+(?:works best|fits best|helps me|keeps me|feels best)\b/i);
  if (worksMatch?.[1]) return worksMatch[1].trim();

  if (sessionState.openQuestionIds.includes("time_reason") && message.trim().length > 18) {
    return message.trim();
  }

  return null;
};

const extractReminderMinutes = (message: string): number | null => {
  const explicit = message.match(/\b(\d{1,3})\s*(?:minutes?|mins?)\s*(?:before|ahead|early)\b/i);
  if (explicit?.[1]) return Number.parseInt(explicit[1], 10);

  if (/\b15\s*(?:min|minute)/i.test(message)) return 15;
  if (/\b30\s*(?:min|minute)/i.test(message)) return 30;
  if (/\bone hour before\b/i.test(message)) return 60;

  return null;
};

const inferReminderMinutes = (
  kind: PlannerProposalKind,
  scheduledTime: string | null | undefined,
  explicitReminderMinutes: number | null,
): number | null => {
  if (explicitReminderMinutes !== null) return explicitReminderMinutes;
  if (!scheduledTime) return null;

  if (kind === "create_campaign" || kind === "create_ritual" || kind === "update_ritual") {
    return 10;
  }

  return 15;
};

const timeOfDayToClock = (timeOfDay: string | null | undefined): string | null => {
  switch (timeOfDay) {
    case "morning":
      return "09:00";
    case "afternoon":
      return "14:00";
    case "evening":
      return "18:00";
    case "night":
      return "20:00";
    default:
      return null;
  }
};

const preferredTime = (draft: PlannerDraftState): string | null =>
  draft.scheduledTime ?? timeOfDayToClock(draft.timeOfDay);

const findMatchedEntities = (
  message: string,
  context: PlannerBuildInput["plannerContext"],
): MatchedEntities => {
  const haystack = normalizeText(message);
  const tasks = [...context.tasks, ...context.inboxTasks];

  const matchedTask = tasks.find((task) => {
    const taskTitle = normalizeText(task.title);
    return taskTitle.length > 2 && haystack.includes(taskTitle);
  }) ?? null;

  const matchedRitual = context.rituals.find((ritual) => {
    const ritualTitle = normalizeText(ritual.title);
    return ritualTitle.length > 2 && haystack.includes(ritualTitle);
  }) ?? null;

  const matchedEpic = context.activeEpics.find((epic) => {
    const epicTitle = normalizeText(epic.title);
    return epicTitle.length > 2 && haystack.includes(epicTitle);
  }) ?? null;

  return {
    task: matchedTask,
    ritual: matchedRitual,
    epic: matchedEpic ?? (
      matchedRitual
        ? context.activeEpics.find((epic) => epic.id === matchedRitual.epicId) ?? null
        : null
    ),
  };
};

const parseRenameTitle = (message: string): string | null => {
  const renameMatch = message.match(/\b(?:rename|change(?: the name of)?)\b.+?\bto\b\s+[""]?(.+?)[""]?$/i);
  if (renameMatch?.[1]) return renameMatch[1].trim();
  return null;
};

const resolveCadence = (message: string, parsedInput?: ParsedInputHint | null): ResolvedCadence => {
  const pattern = parsedInput?.recurrencePattern ?? null;
  const recurrenceDays = parsedInput?.recurrenceDays?.length ? [...parsedInput.recurrenceDays] : null;
  const recurrenceMonthDays = parsedInput?.recurrenceMonthDays?.length ? [...parsedInput.recurrenceMonthDays] : null;
  const recurrenceCustomPeriod = parsedInput?.recurrenceCustomPeriod ?? null;

  if (pattern === "daily") {
    return {
      label: "daily",
      recurrencePattern: "daily",
      recurrenceDays: null,
      recurrenceMonthDays: null,
      recurrenceCustomPeriod: null,
      habitFrequency: "daily",
      habitCustomDays: null,
      habitCustomMonthDays: null,
    };
  }

  if (pattern === "weekdays") {
    return {
      label: "weekdays",
      recurrencePattern: "weekdays",
      recurrenceDays: [0, 1, 2, 3, 4],
      recurrenceMonthDays: null,
      recurrenceCustomPeriod: null,
      habitFrequency: "5x_week",
      habitCustomDays: [0, 1, 2, 3, 4],
      habitCustomMonthDays: null,
    };
  }

  if (pattern === "weekly" || pattern === "biweekly" || pattern === "custom") {
    return {
      label: pattern,
      recurrencePattern: pattern,
      recurrenceDays,
      recurrenceMonthDays,
      recurrenceCustomPeriod,
      habitFrequency: pattern === "biweekly" ? "custom" : (pattern ?? "custom"),
      habitCustomDays: recurrenceDays,
      habitCustomMonthDays: recurrenceMonthDays,
    };
  }

  if (pattern === "monthly") {
    return {
      label: "monthly",
      recurrencePattern: "monthly",
      recurrenceDays: null,
      recurrenceMonthDays: recurrenceMonthDays ?? [1],
      recurrenceCustomPeriod: "month",
      habitFrequency: "monthly",
      habitCustomDays: null,
      habitCustomMonthDays: recurrenceMonthDays ?? [1],
    };
  }

  if (/\bweekdays?\b/i.test(message)) {
    return {
      label: "weekdays",
      recurrencePattern: "weekdays",
      recurrenceDays: [0, 1, 2, 3, 4],
      recurrenceMonthDays: null,
      recurrenceCustomPeriod: null,
      habitFrequency: "5x_week",
      habitCustomDays: [0, 1, 2, 3, 4],
      habitCustomMonthDays: null,
    };
  }

  const dayMatches = DAY_KEYWORDS.filter(([word]) => new RegExp(`\\b${word}\\b`, "i").test(message)).map(([, day]) => day);
  if (dayMatches.length > 0) {
    return {
      label: "weekly",
      recurrencePattern: "weekly",
      recurrenceDays: dayMatches,
      recurrenceMonthDays: null,
      recurrenceCustomPeriod: null,
      habitFrequency: "weekly",
      habitCustomDays: dayMatches,
      habitCustomMonthDays: null,
    };
  }

  if (/\b(daily|every day)\b/i.test(message)) {
    return {
      label: "daily",
      recurrencePattern: "daily",
      recurrenceDays: null,
      recurrenceMonthDays: null,
      recurrenceCustomPeriod: null,
      habitFrequency: "daily",
      habitCustomDays: null,
      habitCustomMonthDays: null,
    };
  }

  if (/\b(weekly|every week)\b/i.test(message)) {
    return {
      label: "weekly",
      recurrencePattern: "weekly",
      recurrenceDays: null,
      recurrenceMonthDays: null,
      recurrenceCustomPeriod: null,
      habitFrequency: "weekly",
      habitCustomDays: null,
      habitCustomMonthDays: null,
    };
  }

  if (/\b(monthly|every month)\b/i.test(message)) {
    return {
      label: "monthly",
      recurrencePattern: "monthly",
      recurrenceDays: null,
      recurrenceMonthDays: [1],
      recurrenceCustomPeriod: "month",
      habitFrequency: "monthly",
      habitCustomDays: null,
      habitCustomMonthDays: [1],
    };
  }

  return {
    label: null,
    recurrencePattern: null,
    recurrenceDays: null,
    recurrenceMonthDays: null,
    recurrenceCustomPeriod: null,
    habitFrequency: null,
    habitCustomDays: null,
    habitCustomMonthDays: null,
  };
};

const mergeDraft = (
  input: PlannerBuildInput,
  matched: MatchedEntities,
): PlannerDraftState => {
  const carryForward = isLikelyAnswerOnly(input.message, input.sessionState);
  const base = carryForward ? { ...input.sessionState.draft } : {};
  const parsed = input.parsedInput;
  const plannerMemory = input.plannerContext.plannerMemory;

  const timeOfDay = extractTimeOfDay(input.message, parsed)
    ?? base.timeOfDay
    ?? input.sessionState.preferredTimeOfDay
    ?? plannerMemory?.preferredTimeOfDay
    ?? null;
  const timeReason = extractTimeReason(input.message, input.sessionState)
    ?? base.timeReason
    ?? input.sessionState.preferredTimeReason
    ?? plannerMemory?.preferredTimeReason
    ?? null;
  const cadence = resolveCadence(input.message, parsed).label ?? base.cadence ?? null;

  const parsedTitle = parsed?.text?.trim() || null;
  const renameTitle = parsed?.newTitle?.trim() || parseRenameTitle(input.message) || null;

  const draftTitle = matched.task?.title
    ?? matched.ritual?.title
    ?? base.title
    ?? (carryForward ? base.title ?? null : parsedTitle);

  return {
    ...base,
    title: renameTitle ? matched.epic?.title ?? matched.task?.title ?? matched.ritual?.title ?? draftTitle : draftTitle,
    taskId: matched.task?.id ?? base.taskId ?? null,
    ritualId: matched.ritual?.id ?? base.ritualId ?? null,
    epicId: matched.epic?.id ?? matched.ritual?.epicId ?? base.epicId ?? null,
    epicTitle: matched.epic?.title ?? matched.ritual?.epicTitle ?? base.epicTitle ?? null,
    scheduledDate: parsed?.scheduledDate ?? base.scheduledDate ?? input.currentDate,
    scheduledTime: parsed?.scheduledTime ?? base.scheduledTime ?? null,
    timeOfDay,
    timeReason,
    cadence,
    endDate: parsed?.recurrenceEndDate ?? input.classificationHint?.suggestedDeadline ?? base.endDate ?? null,
    durationMinutes: parsed?.estimatedDuration ?? input.classificationHint?.suggestedDuration ?? base.durationMinutes ?? null,
    reminderMinutesBefore: extractReminderMinutes(input.message)
      ?? base.reminderMinutesBefore
      ?? plannerMemory?.reminderMinutesBefore
      ?? null,
  };
};

const resolveKind = (
  input: PlannerBuildInput,
  draft: PlannerDraftState,
  matched: MatchedEntities,
  repeated: boolean,
): PlannerProposalKind => {
  const editIntent = isEditIntent(input.message);
  const renameTitle = input.parsedInput?.newTitle ?? parseRenameTitle(input.message);

  if (matched.ritual && editIntent) return "update_ritual";
  if (matched.task && editIntent) return "update_quest";
  if (matched.epic && renameTitle) return "update_campaign";

  if (matched.epic && repeated) return "create_ritual";
  if (matched.ritual && repeated) return "update_ritual";

  if (input.classificationHint?.type === "epic") return "create_campaign";
  if (input.classificationHint?.type === "habit" && draft.epicId) return "create_ritual";
  if (input.classificationHint?.type === "habit") return "create_quest";

  if (repeated && draft.epicId) return "create_ritual";
  return "create_quest";
};

const defaultQuestDate = (input: PlannerBuildInput, draft: PlannerDraftState): string | null => {
  if (draft.scheduledDate) return draft.scheduledDate;
  if (input.horizon === "day") return input.currentDate;
  return input.currentDate;
};

const missingFieldsForKind = (
  kind: PlannerProposalKind,
  draft: PlannerDraftState,
  cadence: ResolvedCadence,
): string[] => {
  const missing = new Set<string>();
  const effectiveTime = preferredTime(draft);

  if (kind !== "update_campaign") {
    if (!effectiveTime) missing.add("time of day");
    if (!draft.timeReason) missing.add("why that time works");
  }

  if ((kind === "create_quest" || kind === "update_quest") && (draft.draftKind === "create_quest" || draft.draftKind === "update_quest")) {
    if (draft.cadence && !cadence.recurrencePattern) missing.add("repeat cadence");
  }

  if ((kind === "create_quest" || kind === "update_quest") && draft.cadence && !draft.endDate) {
    missing.add("end date");
  }

  if (kind === "create_campaign") {
    if (!draft.endDate && !draft.durationMinutes) {
      missing.add("target timeline");
    }
  }

  if (kind === "create_ritual" && !draft.epicId) {
    missing.add("campaign link");
  }

  return [...missing];
};

const question = (input: Omit<PlannerQuestion, "id"> & { id?: string }): PlannerQuestion => ({
  id: input.id ?? input.field,
  prompt: input.prompt,
  reason: input.reason ?? null,
  required: input.required,
  field: input.field,
  options: input.options,
});

const formatSlotLabel = (slot: PlannerOpenSlot, selectedDate: string): string =>
  slot.date === selectedDate
    ? slot.time
    : `${slot.date} ${slot.time}`;

const buildTimeQuestion = (input: PlannerBuildInput): PlannerQuestion => {
  const insights = input.plannerContext.scheduleInsights;
  const plannerMemory = input.plannerContext.plannerMemory;
  const suggestedSlots = insights?.suggestedSlots?.slice(0, 3) ?? [];
  const slotOptions = suggestedSlots.map((slot) => formatSlotLabel(slot, insights?.selectedDate ?? input.currentDate));
  const preferredTimeOfDay = plannerMemory?.preferredTimeOfDay ?? input.sessionState.preferredTimeOfDay ?? null;
  const preferredReason = plannerMemory?.preferredTimeReason ?? input.sessionState.preferredTimeReason ?? null;

  if (suggestedSlots.length > 0) {
    const slotText = slotOptions.join(", ");
    if (preferredTimeOfDay) {
      return question({
        field: "time_of_day",
        prompt: `I found a few open windows: ${slotText}. You usually lean ${preferredTimeOfDay}. Which one fits this best?`,
        reason: preferredReason
          ? `You've said ${preferredTimeOfDay} works because ${preferredReason}. I can reuse that rhythm if it still fits.`
          : "I want to place this in a real opening instead of guessing.",
        required: true,
        options: slotOptions,
      });
    }

    return question({
      field: "time_of_day",
      prompt: `I found a few open windows: ${slotText}. Which one feels right for this?`,
      reason: suggestedSlots[0]?.reason ?? "I want to place this in a real opening instead of guessing.",
      required: true,
      options: slotOptions,
    });
  }

  if (preferredTimeOfDay) {
    return question({
      field: "time_of_day",
      prompt: `You usually prefer ${preferredTimeOfDay} for this kind of work. Want me to place it there again, or shift it?`,
      reason: preferredReason
        ? `You've told me ${preferredTimeOfDay} works because ${preferredReason}.`
        : "I'll use that pattern unless this one needs a different rhythm.",
      required: true,
      options: ["Morning", "Afternoon", "Evening", "Night"],
    });
  }

  return question({
    field: "time_of_day",
    prompt: "What time of day should this live in your schedule?",
    reason: "I want to place it where you're actually likely to follow through.",
    required: true,
    options: ["Morning", "Afternoon", "Evening", "Night"],
  });
};

const buildBalanceQuestion = (input: PlannerBuildInput): PlannerQuestion | null => {
  const suggestion = input.plannerContext.scheduleInsights?.moveSuggestions?.[0];
  if (!suggestion) return null;

  return question({
    id: "details",
    field: "details",
    prompt: suggestion.suggestedTime
      ? `${suggestion.fromDate} looks crowded. Want me to aim "${suggestion.taskTitle ?? "this"}" for ${suggestion.toDate} at ${suggestion.suggestedTime} instead?`
      : `${suggestion.fromDate} looks crowded. Want me to aim "${suggestion.taskTitle ?? "this"}" for ${suggestion.toDate} instead?`,
    reason: suggestion.reason,
    required: false,
    options: [
      suggestion.suggestedTime ? `${suggestion.toDate} ${suggestion.suggestedTime}` : suggestion.toDate,
      "Keep the original day",
    ],
  });
};

const buildFollowUpQuestions = (
  input: PlannerBuildInput,
  kind: PlannerProposalKind,
  draft: PlannerDraftState,
  cadence: ResolvedCadence,
): PlannerQuestion[] => {
  const questions: PlannerQuestion[] = [];
  const effectiveTime = preferredTime(draft);
  const explicitTimeOfDay = extractTimeOfDay(input.message, input.parsedInput);
  const explicitTimeReason = extractTimeReason(input.message, input.sessionState);
  const carryForwardAnswer = isLikelyAnswerOnly(input.message, input.sessionState);
  const shouldConfirmLearnedTime = !carryForwardAnswer && !input.parsedInput?.scheduledTime && !explicitTimeOfDay;
  const shouldConfirmLearnedReason = !carryForwardAnswer && !explicitTimeReason;

  if (kind !== "update_campaign" && (!effectiveTime || shouldConfirmLearnedTime)) {
    questions.push(buildTimeQuestion(input));
  }

  if (kind !== "update_campaign" && (!draft.timeReason || shouldConfirmLearnedReason)) {
    questions.push(question({
      field: "time_reason",
      prompt: input.plannerContext.plannerMemory?.preferredTimeReason
        ? `Why does this timing work today? I know you've previously said ${input.plannerContext.plannerMemory.preferredTimeReason}.`
        : "Why does that time work for you?",
      reason: "I'll reuse your reasoning when I suggest future timing and reminders.",
      required: true,
    }));
  }

  if ((kind === "create_quest" || kind === "update_quest" || kind === "create_ritual" || kind === "update_ritual") && isRepeatedIntent(input.message, input.parsedInput)) {
    if (!cadence.label) {
      questions.push(question({
        field: "cadence",
        prompt: "How often should this repeat?",
        reason: "I need the cadence before I can set up the repeat cleanly.",
        required: true,
        options: ["Daily", "Weekdays", "Weekly", "Monthly"],
      }));
    }

    if ((kind === "create_quest" || kind === "update_quest") && !draft.endDate) {
      questions.push(question({
        field: "end_date",
        prompt: "When should this repetition stop?",
        reason: "That helps me choose a recurring quest instead of an open-ended loop.",
        required: true,
      }));
    }
  }

  if ((kind === "create_quest" || kind === "create_ritual") && input.plannerContext.activeEpics.length > 0 && !draft.epicId && isRepeatedIntent(input.message, input.parsedInput)) {
    questions.push(question({
      field: "campaign_link",
      prompt: "Should this support one of your campaigns, or stay standalone?",
      reason: "If it feeds a bigger goal, I can turn it into a campaign ritual instead.",
      required: false,
      options: [...input.plannerContext.activeEpics.map((epic) => epic.title), "Keep it standalone"],
    }));
  }

  if (kind === "create_campaign" && !draft.endDate) {
    questions.push(question({
      field: "end_date",
      prompt: "What end date or time horizon should this campaign aim for?",
      reason: "I need a target window before I can shape the campaign cadence.",
      required: true,
    }));
  }

  const balanceQuestion = buildBalanceQuestion(input);
  if (balanceQuestion && !questions.some((candidate) => candidate.id === balanceQuestion.id)) {
    questions.push(balanceQuestion);
  }

  return questions;
};

const stripUndefined = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;

const buildQuestProposal = (
  input: PlannerBuildInput,
  draft: PlannerDraftState,
  cadence: ResolvedCadence,
  kind: "create_quest" | "update_quest",
  matchedTask: PlannerContextTask | null,
): PlannerProposal => {
  const scheduledTime = preferredTime(draft);
  const reminderMinutesBefore = inferReminderMinutes(kind, scheduledTime, draft.reminderMinutesBefore ?? null);
  const title = matchedTask?.title ?? draft.title ?? input.parsedInput?.text ?? input.message.trim();

  if (kind === "update_quest" && matchedTask) {
    const updates = stripUndefined({
      task_text: input.parsedInput?.newTitle ?? parseRenameTitle(input.message) ?? undefined,
      task_date: draft.scheduledDate ?? matchedTask.taskDate ?? undefined,
      scheduled_time: scheduledTime ?? undefined,
      estimated_duration: draft.durationMinutes ?? undefined,
      recurrence_pattern: cadence.recurrencePattern ?? undefined,
      recurrence_days: cadence.recurrenceDays ?? undefined,
      recurrence_month_days: cadence.recurrenceMonthDays ?? undefined,
      recurrence_custom_period: cadence.recurrenceCustomPeriod ?? undefined,
      recurrence_end_date: draft.endDate ?? undefined,
      reminder_enabled: reminderMinutesBefore !== null ? true : undefined,
      reminder_minutes_before: reminderMinutesBefore ?? undefined,
      category: input.parsedInput?.category ?? undefined,
      notes: input.parsedInput?.notes ?? undefined,
    });

    return {
      id: createId(),
      kind,
      title: `Update ${matchedTask.title}`,
      summary: cadence.recurrencePattern
        ? `Update "${matchedTask.title}" as a recurring quest with ${cadence.label ?? "your chosen cadence"}${draft.endDate ? ` until ${draft.endDate}` : ""}.`
        : `Adjust "${matchedTask.title}"${scheduledTime ? ` to ${scheduledTime}` : ""}${draft.scheduledDate ? ` on ${draft.scheduledDate}` : ""}.`,
      reasoning: "This reads like an existing quest adjustment rather than a brand-new structure.",
      payload: {
        taskId: matchedTask.id,
        updates,
      },
      status: "pending",
      readyToConfirm: false,
      missingFields: [],
    };
  }

  return {
    id: createId(),
    kind,
    title: `Create ${title}`,
    summary: cadence.recurrencePattern
      ? `Create a recurring quest for "${title}"${draft.endDate ? ` until ${draft.endDate}` : ""}.`
      : `Create a quest for "${title}"${scheduledTime ? ` at ${scheduledTime}` : ""}.`,
    reasoning: cadence.recurrencePattern
      ? "This is repeated work, so I'm treating it as a recurring quest by default."
      : "This looks like a one-off or short-lived action, so it fits best as a quest.",
    payload: {
      taskText: title,
      difficulty: input.plannerContext.aiSignals?.preferredDifficulty ?? "medium",
      taskDate: defaultQuestDate(input, draft),
      scheduledTime,
      estimatedDuration: draft.durationMinutes ?? 30,
      recurrencePattern: cadence.recurrencePattern,
      recurrenceDays: cadence.recurrenceDays,
      recurrenceMonthDays: cadence.recurrenceMonthDays,
      recurrenceCustomPeriod: cadence.recurrenceCustomPeriod,
      recurrenceEndDate: draft.endDate ?? null,
      reminderEnabled: reminderMinutesBefore !== null,
      reminderMinutesBefore: reminderMinutesBefore ?? 15,
      category: input.parsedInput?.category ?? undefined,
      notes: input.parsedInput?.notes ?? undefined,
      source: "manual",
    },
    status: "pending",
    readyToConfirm: false,
    missingFields: [],
  };
};

const buildCampaignProposal = (
  input: PlannerBuildInput,
  draft: PlannerDraftState,
  cadence: ResolvedCadence,
  kind: "create_campaign" | "update_campaign",
  matchedEpic: PlannerContextEpic | null,
): PlannerProposal => {
  const scheduledTime = preferredTime(draft);
  const reminderMinutesBefore = inferReminderMinutes(kind, scheduledTime, draft.reminderMinutesBefore ?? null);
  const renamedTitle = input.parsedInput?.newTitle ?? parseRenameTitle(input.message);
  const title = draft.title ?? input.parsedInput?.text ?? input.message.trim();
  const targetDays = input.classificationHint?.suggestedDuration
    ?? input.plannerContext.aiSignals?.preferredEpicDuration
    ?? 30;

  if (kind === "update_campaign" && matchedEpic && renamedTitle) {
    return {
      id: createId(),
      kind,
      title: `Rename ${matchedEpic.title}`,
      summary: `Rename "${matchedEpic.title}" to "${renamedTitle}".`,
      reasoning: "I found a live campaign reference and this message reads like a title change.",
      payload: {
        epicId: matchedEpic.id,
        title: renamedTitle,
      },
      status: "pending",
      readyToConfirm: true,
      missingFields: [],
    };
  }

  return {
    id: createId(),
    kind: "create_campaign",
    title: `Create ${title}`,
    summary: `Create a campaign for "${title}" with a starter ritual so it becomes actionable right away.`,
    reasoning: "This feels like a multi-step outcome that belongs in a campaign rather than a single quest.",
    payload: {
      title,
      target_days: targetDays,
      habits: [
        {
          title: `Work on ${title}`,
          difficulty: input.plannerContext.aiSignals?.preferredDifficulty ?? "medium",
          frequency: cadence.habitFrequency ?? input.plannerContext.aiSignals?.preferredHabitFrequency ?? "daily",
          custom_days: cadence.habitCustomDays ?? [],
          custom_month_days: cadence.habitCustomMonthDays ?? [],
          preferred_time: scheduledTime,
          estimated_minutes: draft.durationMinutes ?? 45,
          category: input.parsedInput?.category ?? null,
          reminder_enabled: reminderMinutesBefore !== null,
          reminder_minutes_before: reminderMinutesBefore ?? 10,
        },
      ],
    },
    status: "pending",
    readyToConfirm: false,
    missingFields: [],
  };
};

const buildRitualProposal = (
  input: PlannerBuildInput,
  draft: PlannerDraftState,
  cadence: ResolvedCadence,
  kind: "create_ritual" | "update_ritual",
  matchedRitual: PlannerContextRitual | null,
): PlannerProposal => {
  const scheduledTime = preferredTime(draft);
  const reminderMinutesBefore = inferReminderMinutes(kind, scheduledTime, draft.reminderMinutesBefore ?? null);
  const title = matchedRitual?.title ?? draft.title ?? input.parsedInput?.text ?? input.message.trim();
  const epicId = draft.epicId ?? matchedRitual?.epicId ?? null;
  const epicTitle = draft.epicTitle ?? matchedRitual?.epicTitle ?? "your campaign";

  if (kind === "update_ritual" && matchedRitual) {
    return {
      id: createId(),
      kind,
      title: `Update ${matchedRitual.title}`,
      summary: `Update the ritual "${matchedRitual.title}" inside ${matchedRitual.epicTitle}.`,
      reasoning: "You referenced an existing campaign ritual, so I'm keeping the change attached to that campaign.",
      payload: {
        habitId: matchedRitual.id,
        title,
        description: input.parsedInput?.notes ?? null,
        difficulty: input.plannerContext.aiSignals?.preferredDifficulty ?? "medium",
        frequency: cadence.habitFrequency ?? matchedRitual.frequency ?? "daily",
        estimatedMinutes: draft.durationMinutes ?? 30,
        preferredTime: scheduledTime,
        category: input.parsedInput?.category ?? null,
        customDays: cadence.habitCustomDays,
        customMonthDays: cadence.habitCustomMonthDays,
        reminderEnabled: reminderMinutesBefore !== null,
        reminderMinutesBefore: reminderMinutesBefore ?? 10,
      },
      status: "pending",
      readyToConfirm: false,
      missingFields: [],
    };
  }

  return {
    id: createId(),
    kind: "create_ritual",
    title: `Add ${title}`,
    summary: `Add "${title}" as a ritual inside ${epicTitle}.`,
    reasoning: "This repeat work seems tied to a bigger goal, so it belongs as a campaign ritual.",
    payload: {
      epicId,
      title,
      difficulty: input.plannerContext.aiSignals?.preferredDifficulty ?? "medium",
      frequency: cadence.habitFrequency ?? input.plannerContext.aiSignals?.preferredHabitFrequency ?? "daily",
      customDays: cadence.habitCustomDays,
      customMonthDays: cadence.habitCustomMonthDays,
      preferredTime: scheduledTime,
      estimatedMinutes: draft.durationMinutes ?? 30,
      description: input.parsedInput?.notes ?? null,
      category: input.parsedInput?.category ?? null,
      reminderEnabled: reminderMinutesBefore !== null,
      reminderMinutesBefore: reminderMinutesBefore ?? 10,
    },
    status: "pending",
    readyToConfirm: false,
    missingFields: [],
  };
};

const composeReply = (
  input: PlannerBuildInput,
  _tonePack: PlannerTonePack,
  kind: PlannerProposalKind,
  questions: PlannerQuestion[],
  readyToConfirm: boolean,
): string => {
  const baseLabel = ({
    create_quest: "quest",
    update_quest: "quest edit",
    create_campaign: "campaign",
    update_campaign: "campaign edit",
    create_ritual: "campaign ritual",
    update_ritual: "ritual edit",
    suggest_reminder: "reminder tweak",
  })[kind];
  const scheduleSummary = input.plannerContext.scheduleInsights?.summary;
  const preferredTimeOfDay = input.plannerContext.plannerMemory?.preferredTimeOfDay;
  const memoryLead = preferredTimeOfDay
    ? `You usually land work like this in the ${preferredTimeOfDay}. `
    : "";
  const scheduleLead = scheduleSummary ? `${scheduleSummary} ` : "";

  if (readyToConfirm) {
    return `${scheduleLead}Chaos report: this cleanly fits as a ${baseLabel}. Against the odds, you handed me something usable. I have a sharp draft ready for your approval.`;
  }

  return `${scheduleLead}${memoryLead}Hot take: this wants to be a ${baseLabel}, but right now it looks like a hostage note from your executive function. Answer the missing bits and I'll tighten it up.`;
};

const inferClassification = (message: string, repeated: boolean): ClassificationHint => {
  if (/\b(license|exam|launch|build|learn|train for|prepare for|by [a-z]+|\bin \d+ (weeks?|months?)\b)\b/i.test(message)) {
    return {
      type: "epic",
      confidence: 0.7,
      reasoning: "Longer-term goal detected.",
    };
  }

  if (repeated) {
    return {
      type: "habit",
      confidence: 0.72,
      reasoning: "Repeated work detected.",
    };
  }

  return {
    type: "quest",
    confidence: 0.72,
    reasoning: "Single actionable item detected.",
  };
};

export function buildPlannerResponse(input: PlannerBuildInput): PlannerBuildResult {
  const repeated = isRepeatedIntent(input.message, input.parsedInput);
  const classificationHint = input.classificationHint ?? inferClassification(input.message, repeated);
  const matched = findMatchedEntities(input.message, input.plannerContext);
  const draft = mergeDraft({ ...input, classificationHint }, matched);
  const cadence = resolveCadence(input.message, input.parsedInput);

  if (!draft.epicId && draft.epicTitle) {
    const matchingEpic = input.plannerContext.activeEpics.find((epic) => normalizeText(epic.title) === normalizeText(draft.epicTitle));
    if (matchingEpic) {
      draft.epicId = matchingEpic.id;
      draft.epicTitle = matchingEpic.title;
    }
  }

  const kind = resolveKind({ ...input, classificationHint }, draft, matched, repeated);
  draft.draftKind = kind;

  const proposal = kind === "create_campaign" || kind === "update_campaign"
    ? buildCampaignProposal({ ...input, classificationHint }, draft, cadence, kind, matched.epic)
    : kind === "create_ritual" || kind === "update_ritual"
      ? buildRitualProposal({ ...input, classificationHint }, draft, cadence, kind, matched.ritual)
      : buildQuestProposal({ ...input, classificationHint }, draft, cadence, kind as "create_quest" | "update_quest", matched.task);

  const followUpQuestions = buildFollowUpQuestions({ ...input, classificationHint }, kind, draft, cadence);
  const missingFields = missingFieldsForKind(kind, draft, cadence);
  proposal.readyToConfirm = followUpQuestions.length === 0 && missingFields.length === 0;
  proposal.missingFields = missingFields;

  const memoryUpdates = {
    preferredTimeOfDay: draft.timeOfDay
      ?? input.sessionState.preferredTimeOfDay
      ?? input.plannerContext.plannerMemory?.preferredTimeOfDay
      ?? null,
    preferredTimeReason: draft.timeReason
      ?? input.sessionState.preferredTimeReason
      ?? input.plannerContext.plannerMemory?.preferredTimeReason
      ?? null,
    reminderPreference: draft.reminderMinutesBefore !== null
      ? `${draft.reminderMinutesBefore} minutes`
      : input.sessionState.reminderPreference
        ?? (input.plannerContext.plannerMemory?.reminderMinutesBefore
          ? `${input.plannerContext.plannerMemory.reminderMinutesBefore} minutes`
          : null),
  };

  return {
    reply: composeReply(input, input.tonePack, proposal.kind, followUpQuestions, proposal.readyToConfirm),
    followUpQuestions,
    proposals: [proposal],
    suggestedReminders: [],
    memoryUpdates,
    sessionState: {
      ...input.sessionState,
      draft,
      openQuestionIds: followUpQuestions.map((question) => question.id),
      preferredTimeOfDay: memoryUpdates.preferredTimeOfDay,
      preferredTimeReason: memoryUpdates.preferredTimeReason,
      reminderPreference: memoryUpdates.reminderPreference,
      lastClassification: classificationHint.type,
    },
  };
}
