import { parseNaturalLanguage } from "../../../src/shared/naturalLanguageTaskParser.ts";
import {
  cleanGeneratedTaskTitle,
  formatGeneratedTaskTitle,
} from "../../../src/shared/taskTitleNormalization.ts";
import { analyzeSchedulingIntent } from "../../../src/shared/schedulingIntent.ts";
import { computePlannerPriorityScores } from "../../../src/shared/companionPlannerPriority.ts";

export type PlannerHorizon = "day" | "week" | "month";
export type PlannerTonePack = "soft" | "playful" | "witty_sassy";
export type PlannerResponseMode =
  | "conversational"
  | "schedule_read"
  | "proposal";
export type PlannerProposalKind =
  | "create_quest"
  | "update_quest"
  | "create_campaign"
  | "update_campaign"
  | "adjust_campaign_plan"
  | "create_ritual"
  | "update_ritual"
  | "suggest_reminder";
export type IntentType = "quest" | "epic" | "habit" | "brain-dump";
export type PlannerStarterIntent =
  | "general"
  | "plan_day"
  | "make_room"
  | "what_matters"
  | "relationship_touch"
  | "adjust_today"
  | "low_energy_adjust"
  | "briefing_followup"
  | "goal_breakdown"
  | "free_talk_start"
  | "upcoming_start"
  | "quest_capture"
  | "goal_breakdown_start";

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
  questNotes?: string | null;
  questSubtasks?: string[];
  questSubtaskPlanMode?: "append" | "replace" | null;
}

export interface PlannerSessionState {
  draft: PlannerDraftState;
  openQuestionIds: string[];
  preferredTimeOfDay?: string | null;
  preferredTimeReason?: string | null;
  reminderPreference?: string | null;
  pendingStarterIntent?: PlannerStarterIntent | null;
  lastClassification?: IntentType | null;
}

export interface PlannerContextTask {
  id: string;
  title: string;
  taskDate: string | null;
  category?: string | null;
  scheduledTime: string | null;
  estimatedDuration: number | null;
  notes?: string | null;
  subtaskTitles?: string[];
  difficulty?: string | null;
  recurrencePattern: string | null;
  recurrenceEndDate?: string | null;
  completed?: boolean | null;
  priority?: string | null;
  source?: string | null;
  habitSourceId?: string | null;
  epicId?: string | null;
  epicTitle?: string | null;
  contactId?: string | null;
}

export interface PlannerContextEpic {
  id: string;
  title: string;
  endDate: string | null;
  progressPercentage?: number | null;
  daysRemaining?: number | null;
  habitCount?: number | null;
}

export interface PlannerContextRitual {
  id: string;
  epicId: string;
  epicTitle: string;
  title: string;
  frequency: string | null;
  preferredTime: string | null;
  currentStreak?: number | null;
}

export interface PlannerContactNeedingAttention {
  id: string;
  name: string;
  avatarUrl?: string | null;
  daysSinceContact: number;
  hasOverdueReminder: boolean;
  reminderReason?: string | null;
}

export interface PlannerReflectionSignal {
  date: string;
  source: "check_in" | "reflection";
  mood: string;
  energy?: "low" | "medium" | "high" | null;
  wins?: string | null;
  tomorrowAdjustment?: string | null;
}

export interface PlannerCareState {
  overallCare: number;
  hasDormancyWarning: boolean;
  dialogueTone: "joyful" | "content" | "neutral" | "reserved" | "quiet" | "silent";
  inactiveDays: number;
  daysUntilDormancy: number | null;
}

export interface PlannerBriefingContext {
  content: string;
  actionPrompt?: string | null;
  focus?: string | null;
  inferredGoals?: string[];
  dataSnapshot?: Record<string, unknown> | null;
}

export interface PlannerPriorityScore {
  id: string;
  kind: "task" | "ritual" | "epic" | "contact" | "recovery";
  title: string;
  score: number;
  reasons: string[];
  taskId?: string | null;
  epicId?: string | null;
  ritualId?: string | null;
  contactId?: string | null;
  targetDate?: string | null;
  suggestedTime?: string | null;
}

export interface PlannerContextCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  isAllDay: boolean;
  provider: string;
  readOnly: boolean;
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
  workloadTolerance?: "light" | "normal" | "heavy" | null;
  contactCadencePatterns?: Record<string, number>;
  lastConfirmedAt?: string | null;
}

export interface PlannerStatInterpretation {
  statProfile: {
    scores: {
      vitality: number;
      wisdom: number;
      discipline: number;
      resolve: number;
      creativity: number;
      alignment: number;
    };
    dominantStat: "vitality" | "wisdom" | "discipline" | "resolve" | "creativity" | "alignment";
    secondaryStat: "vitality" | "wisdom" | "discipline" | "resolve" | "creativity" | "alignment";
  };
  statNeeds: Record<
    "vitality" | "wisdom" | "discipline" | "resolve" | "creativity" | "alignment",
    {
      level: "low" | "medium" | "high";
      reasons: string[];
    }
  >;
  momentumState: "locked_in" | "coasting" | "slipping" | "rebuilding";
  recentMissInterpretation: "overload" | "low_energy" | "avoidance" | "interruption" | "normal_variance";
  narrativeBrief: string;
  dailyNarrative: string;
  weeklyNarrative?: string;
  identityBootstrap?: string;
}

export interface PlannerQuestSubtaskPlan {
  mode: "append" | "replace";
  titles: string[];
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
  conversationHistory: Array<{
    role: "assistant" | "user";
    content: string;
  }>;
  sessionState: PlannerSessionState;
  parsedInput?: ParsedInputHint | null;
  classificationHint?: ClassificationHint | null;
  plannerContext: {
    tasks: PlannerContextTask[];
    inboxTasks: PlannerContextTask[];
    activeEpics: PlannerContextEpic[];
    rituals: PlannerContextRitual[];
    calendarEvents: PlannerContextCalendarEvent[];
    contactsNeedingAttention?: PlannerContactNeedingAttention[];
    reflectionSignals?: PlannerReflectionSignal[];
    careSignals?: PlannerCareState | null;
    briefingContext?: PlannerBriefingContext | null;
    starterIntent?: PlannerStarterIntent;
    priorityScores?: PlannerPriorityScore[];
    scheduleInsights?: PlannerScheduleInsights;
    plannerMemory?: PlannerMemoryProfile;
    statInterpretation?: PlannerStatInterpretation;
    aiSignals?: {
      preferredDifficulty?: string;
      preferredHabitFrequency?: string;
      preferredEpicDuration?: number;
      commonContexts?: string[];
      suggestedWorkload?: "light" | "normal" | "heavy";
    };
  };
  currentDate: string;
  currentDateTime: string;
}

export interface PlannerBuildResult {
  mode: PlannerResponseMode;
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
  tasks: PlannerContextTask[];
  task: PlannerContextTask | null;
  rituals: PlannerContextRitual[];
  ritual: PlannerContextRitual | null;
  epics: PlannerContextEpic[];
  epic: PlannerContextEpic | null;
  calendarEvents: PlannerContextCalendarEvent[];
  calendarEvent: PlannerContextCalendarEvent | null;
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

type TimelineInterval = {
  id: string;
  title: string;
  source: "quest" | "calendar";
  startMinutes: number;
  endMinutes: number;
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
const WEEKDAY_WORD_PATTERN =
  "monday|tuesday|wednesday|thursday|friday|saturday|sunday";
const DAY_REFERENCE_REGEX = new RegExp(
  `\\b(?:today|tomorrow|my day|(?:my\\s+)?(?:this\\s+|next\\s+|upcoming\\s+)?(?:${WEEKDAY_WORD_PATTERN}))\\b`,
  "i",
);

const DEFAULT_TASK_DURATION_MINUTES = 30;
const DEFAULT_WAKE_TIME = "08:00";
const DEFAULT_WIND_DOWN_TIME = "21:00";
const BREAK_BIG_GOAL_STARTER_INTENT = "help me break a big goal into steps";
const MAKE_ROOM_STARTER_INTENT = "help me make room for what matters";
const UPCOMING_STARTER_WINDOW_PROMPT = "What should I review: the rest of today, tomorrow, or both?";
const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "into",
  "from",
  "your",
  "my",
  "this",
  "that",
  "a",
  "an",
]);

const TIMING_ONLY_REPLY_TOKENS = new Set([
  "am",
  "at",
  "afternoon",
  "after",
  "before",
  "both",
  "day",
  "days",
  "evening",
  "friday",
  "later",
  "monday",
  "morning",
  "next",
  "night",
  "rest",
  "saturday",
  "sunday",
  "thursday",
  "today",
  "tomorrow",
  "tonight",
  "tuesday",
  "wednesday",
  "week",
  "weeks",
]);

const TITLE_SCAFFOLD_TOKENS = new Set([
  "add",
  "at",
  "calendar",
  "for",
  "in",
  "into",
  "my",
  "on",
  "onto",
  "put",
  "s",
  "schedule",
  "slot",
  "the",
  "to",
  "today",
  "todays",
  "tomorrow",
  "tomorrows",
]);

const normalizeText = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(
    /\s+/g,
    " ",
  ).trim();

const sanitizeProposalTitle = (
  value: string | null | undefined,
): string | null => {
  const trimmed = cleanGeneratedTaskTitle(value);
  if (!trimmed) return null;

  const normalized = normalizeText(trimmed);
  if (!normalized) return null;

  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length === 0) return null;
  if (tokens.every((token) => TITLE_SCAFFOLD_TOKENS.has(token))) return null;

  return trimmed;
};

const isTimingOnlyReply = (
  message: string,
  parsed?: ParsedInputHint | null,
): boolean => {
  if (
    !parsed?.scheduledTime &&
    !parsed?.scheduledDate &&
    !parsed?.recurrencePattern
  ) {
    return false;
  }

  const normalized = normalizeText(message);
  if (!normalized) return false;
  if (hasPlanningVerb(normalized)) return false;
  if (
    /^(call|write|get|finish|book|send|draft|review|plan|move|practice|prep|clean|organize|outline|work on)\b/i
      .test(normalized)
  ) {
    return false;
  }

  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length === 0) return false;

  return tokens.every((token) =>
    /^\d+$/.test(token) || TIMING_ONLY_REPLY_TOKENS.has(token)
  );
};

const hasExplicitSlotSignal = (message: string): boolean =>
  /\b(at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2}\b|today|tomorrow|day after tomorrow|tonight|this morning|this afternoon|this evening|this weekend|next week|next month|weekdays?|weekends?|every day|every week|every month|monday|tuesday|wednesday|thursday|friday|saturday|sunday|in \d+\s+(?:minutes?|hours?|days?|weeks?|months?)|\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{4})?|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i
    .test(message);

const shouldUseServerSchedulePayload = (
  input: PlannerBuildInput,
  analysis: ReturnType<typeof analyzeSchedulingIntent>,
): boolean => {
  if (analysis.disposition !== "schedule_action") return false;
  if (isReminderIntent(input.message) && !hasExplicitSlotSignal(input.message)) {
    return false;
  }

  return hasExplicitSlotSignal(input.message) || input.parsedInput == null;
};

const normalizeParsedInput = (
  input: PlannerBuildInput,
): ParsedInputHint | null => {
  const serverParsed = parseNaturalLanguage(input.message, {
    referenceDateTime: input.currentDateTime,
  });
  const clientParsed = input.parsedInput ?? null;
  const schedulingIntent = analyzeSchedulingIntent(input.message, serverParsed);
  const useServerSchedulePayload = shouldUseServerSchedulePayload(
    input,
    schedulingIntent,
  );
  const cleanedClientText = cleanGeneratedTaskTitle(clientParsed?.text);
  const cleanedServerText = cleanGeneratedTaskTitle(serverParsed.text);
  const fallbackText = cleanedClientText || cleanedServerText ||
    clientParsed?.text || serverParsed.text;

  const text = sanitizeProposalTitle(cleanedClientText) ??
    sanitizeProposalTitle(cleanedServerText) ??
    fallbackText;

  return {
    text,
    scheduledTime: clientParsed?.scheduledTime ??
      (useServerSchedulePayload ? serverParsed.scheduledTime : null),
    scheduledDate: clientParsed?.scheduledDate ??
      (useServerSchedulePayload ? serverParsed.scheduledDate : null),
    estimatedDuration: clientParsed?.estimatedDuration ??
      serverParsed.estimatedDuration,
    recurrencePattern: clientParsed?.recurrencePattern ??
      serverParsed.recurrencePattern,
    recurrenceDays: clientParsed?.recurrenceDays?.length
      ? [...clientParsed.recurrenceDays]
      : [...serverParsed.recurrenceDays],
    recurrenceMonthDays: clientParsed?.recurrenceMonthDays?.length
      ? [...clientParsed.recurrenceMonthDays]
      : [...serverParsed.recurrenceMonthDays],
    recurrenceCustomPeriod: clientParsed?.recurrenceCustomPeriod ??
      serverParsed.recurrenceCustomPeriod,
    recurrenceEndDate: clientParsed?.recurrenceEndDate ??
      serverParsed.recurrenceEndDate,
    notes: clientParsed?.notes ?? serverParsed.notes,
    category: clientParsed?.category ?? serverParsed.category,
    newTitle: clientParsed?.newTitle ?? serverParsed.newTitle,
  };
};

const parseDateKey = (value: string): Date => new Date(`${value}T00:00:00`);

const formatDateKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatReadableDate = (value: string): string =>
  parseDateKey(value).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

const addDaysToDateKey = (value: string, days: number): string => {
  const next = parseDateKey(value);
  next.setDate(next.getDate() + days);
  return formatDateKey(next);
};

const resolveWeekdayDate = (
  currentDate: string,
  weekday: string,
  qualifier: string | null,
): string | null => {
  const weekdayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const targetWeekday = weekdayMap[weekday];
  if (targetWeekday === undefined) return null;

  const baseDate = parseDateKey(currentDate);
  const currentWeekday = baseDate.getDay();
  let dayDelta = (targetWeekday - currentWeekday + 7) % 7;

  if (qualifier === "this") {
    if (dayDelta === 0) return currentDate;
  } else if (qualifier === "next") {
    dayDelta = dayDelta === 0 ? 7 : dayDelta + 7;
  } else if (dayDelta === 0) {
    dayDelta += 7;
  }

  baseDate.setDate(baseDate.getDate() + dayDelta);
  return formatDateKey(baseDate);
};

const findWeekdayReference = (
  message: string,
): { weekday: string; qualifier: string | null } | null => {
  const match = message.match(
    new RegExp(
      `\\b(?:(this|next|upcoming)\\s+)?(${WEEKDAY_WORD_PATTERN})\\b`,
      "i",
    ),
  );
  if (!match?.[2]) return null;

  return {
    weekday: match[2].toLowerCase(),
    qualifier: match[1]?.toLowerCase() ?? null,
  };
};

const formatScheduleReference = (
  currentDate: string,
  targetDate: string,
  capitalizeRelative = false,
): string => {
  if (targetDate === currentDate) {
    return capitalizeRelative ? "Today" : "today";
  }

  if (targetDate === addDaysToDateKey(currentDate, 1)) {
    return capitalizeRelative ? "Tomorrow" : "tomorrow";
  }

  return formatReadableDate(targetDate);
};

const parseTimeToMinutes = (
  value: string | null | undefined,
): number | null => {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hour = Number.parseInt(match[1] ?? "", 10);
  const minute = Number.parseInt(match[2] ?? "", 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return (hour * 60) + minute;
};

const formatMinutes = (minutes: number): string => {
  const safeMinutes = Math.max(0, Math.min(minutes, (23 * 60) + 59));
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const normalizeClockTime = (value: string): string | null => {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number.parseInt(match[1] ?? "", 10);
  const minute = Number.parseInt(match[2] ?? "", 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const getLocalDateFromDateTime = (value: string): string | null => {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T/);
  return match?.[1] ?? null;
};

const getLocalMinutesFromDateTime = (value: string): number | null => {
  const match = value.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;

  const hour = Number.parseInt(match[1] ?? "", 10);
  const minute = Number.parseInt(match[2] ?? "", 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  return (hour * 60) + minute;
};

const getWakeMinutes = (plannerMemory?: PlannerMemoryProfile | null) =>
  parseTimeToMinutes(plannerMemory?.wakeTime ?? DEFAULT_WAKE_TIME) ?? (8 * 60);

const getWindDownMinutes = (plannerMemory?: PlannerMemoryProfile | null) =>
  parseTimeToMinutes(plannerMemory?.windDownTime ?? DEFAULT_WIND_DOWN_TIME) ??
    (21 * 60);

const getTaskDuration = (task: PlannerContextTask): number =>
  Number.isFinite(task.estimatedDuration) && (task.estimatedDuration ?? 0) > 0
    ? Number(task.estimatedDuration)
    : DEFAULT_TASK_DURATION_MINUTES;

const getMeaningfulTokens = (value: string) =>
  normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

const entityTitleMatches = (haystack: string, title: string): boolean => {
  const normalizedTitle = normalizeText(title);
  if (normalizedTitle.length < 3) return false;
  if (haystack.includes(normalizedTitle)) return true;

  const titleTokens = getMeaningfulTokens(normalizedTitle);
  if (titleTokens.length === 0) return false;

  const matchedTokenCount =
    titleTokens.filter((token) => haystack.includes(token)).length;
  if (titleTokens.length === 1) return matchedTokenCount === 1;
  return matchedTokenCount >= Math.min(2, titleTokens.length);
};

const hasExplicitDateReference = (
  message: string,
  parsedInput?: ParsedInputHint | null,
): boolean =>
  Boolean(parsedInput?.scheduledDate) ||
  /\b(today|tomorrow|day after tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
    .test(message);

const isScheduleQuestion = (message: string): boolean => {
  if (
    /\b(what do i have coming up|what(?:'s| is) coming up|what do i have scheduled|what(?:'s| is) on my calendar|what do i have today|what do i have tomorrow|what(?:'s| is) my schedule|what(?:'s| is) on my plate)\b/i
      .test(message)
  ) {
    return true;
  }

  const hasDayReference = DAY_REFERENCE_REGEX.test(message);
  if (
    hasDayReference &&
    /\b(show me|how does|how(?:'s| is)|what does)\b/i.test(message) &&
    /\b(route|look|looking|schedule)\b/i.test(message)
  ) {
    return true;
  }

  return hasDayReference && isAvailabilityQuestion(message);
};

const isAvailabilityQuestion = (message: string): boolean =>
  /\b(when am i free|am i free|where do i have room|what openings do i have|what time do i have free|what(?:'s| is) open)\b/i
    .test(message);

const isUpcomingDigestQuestion = (message: string): boolean =>
  /\b(what do i have coming up|what(?:'s| is) coming up|what(?:'s| is) on my plate)\b/i
    .test(message);

const isQuestCollectionIntent = (message: string): boolean =>
  /\b(rest|all)\b.+\b(quests|tasks)\b/i.test(message);

const isBreakBigGoalStarterIntent = (message: string): boolean =>
  normalizeText(message) === BREAK_BIG_GOAL_STARTER_INTENT;

const isMakeRoomStarterIntent = (message: string): boolean =>
  normalizeText(message) === MAKE_ROOM_STARTER_INTENT;

const resolveUpcomingStarterFollowUpMessage = (message: string): string => {
  const normalized = normalizeText(message);

  if (
    normalized === "both" ||
    normalized.includes("today and tomorrow") ||
    normalized.includes("rest of today and tomorrow")
  ) {
    return "What do I have coming up for the rest of today and tomorrow?";
  }

  if (normalized.includes("tomorrow")) {
    return "What do I have coming up tomorrow?";
  }

  if (
    normalized.includes("today") ||
    normalized.includes("later today") ||
    normalized.includes("rest of today")
  ) {
    return "What do I have coming up for the rest of today?";
  }

  return message;
};

const inferPlannerStarterIntentFromMessage = (
  message: string,
): PlannerStarterIntent => {
  const normalizedMessage = message.trim().toLowerCase();

  if (/\b(tired|drained|fried|make it light|light day|low energy)\b/.test(normalizedMessage)) {
    return "low_energy_adjust";
  }
  if (/\b(free me up|make room|clear space)\b/.test(normalizedMessage)) {
    return "make_room";
  }
  if (/\b(what matters most|top priority|prioritize|focus on)\b/.test(normalizedMessage)) {
    return "what_matters";
  }
  if (/\b(plan my day|what does today look like|show me today|today look like)\b/.test(normalizedMessage)) {
    return "plan_day";
  }
  if (/\b(relationship touch|who should i (?:text|call|reach out to)|who needs attention|follow up with|reach out to someone)\b/.test(normalizedMessage)) {
    return "relationship_touch";
  }
  if (/\b(adjust today|rework today|reschedule today|move today around)\b/.test(normalizedMessage)) {
    return "adjust_today";
  }
  if (/\b(break this goal down|break a big goal|turn this into steps)\b/.test(normalizedMessage)) {
    return "goal_breakdown";
  }

  return "general";
};

const getResolvedStarterIntent = (input: PlannerBuildInput): PlannerStarterIntent =>
  input.plannerContext.starterIntent ??
  inferPlannerStarterIntentFromMessage(input.message);

const getResolvedPriorityScores = (
  input: PlannerBuildInput,
): PlannerPriorityScore[] =>
  input.plannerContext.priorityScores?.length
    ? input.plannerContext.priorityScores
    : computePlannerPriorityScores({
      currentDate: input.currentDate,
      tasks: input.plannerContext.tasks,
      inboxTasks: input.plannerContext.inboxTasks,
      activeEpics: input.plannerContext.activeEpics,
      rituals: input.plannerContext.rituals,
      calendarEvents: input.plannerContext.calendarEvents,
      contactsNeedingAttention: input.plannerContext.contactsNeedingAttention,
      reflectionSignals: input.plannerContext.reflectionSignals,
      careSignals: input.plannerContext.careSignals ?? undefined,
      briefingContext: input.plannerContext.briefingContext ?? undefined,
      starterIntent: getResolvedStarterIntent(input),
      scheduleInsights: input.plannerContext.scheduleInsights,
      plannerMemory: input.plannerContext.plannerMemory,
      aiSignals: input.plannerContext.aiSignals,
    });

const parseAfterTimeCutoff = (message: string): string | null => {
  const match = message.match(/\bafter\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match?.[1]) return null;

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2] ?? "0", 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  const meridiem = match[3]?.toLowerCase() ?? null;
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  if (!meridiem && hours >= 1 && hours <= 7) hours += 12;

  return formatMinutes((hours * 60) + minutes);
};

const isCampaignAdjustmentIntent = (message: string): boolean =>
  /\b(push|extend|delay|stretch|restructure|reshape|scope|trim|reduce|remove|drop|add|change|adjust)\b/i
    .test(message) &&
  /\b(campaign|journey|epic|ritual|habit)\b/i.test(message);

const parseRequestedDate = (
  message: string,
  currentDate: string,
  parsedInput?: ParsedInputHint | null,
): string => {
  if (parsedInput?.scheduledDate) return parsedInput.scheduledDate;
  if (/\btoday\b/i.test(message)) return currentDate;
  if (/\bday after tomorrow\b/i.test(message)) {
    return addDaysToDateKey(currentDate, 2);
  }
  if (/\btomorrow\b/i.test(message)) return addDaysToDateKey(currentDate, 1);

  const weekdayReference = findWeekdayReference(message);
  if (weekdayReference) {
    return resolveWeekdayDate(
      currentDate,
      weekdayReference.weekday,
      weekdayReference.qualifier,
    ) ?? currentDate;
  }

  return currentDate;
};

const resolveDayPartRange = (
  message: string,
): { start: number; end: number; label: string } | null => {
  if (/\bmorning\b/i.test(message)) {
    return { start: 8 * 60, end: 12 * 60, label: "morning" };
  }
  if (/\bafternoon\b/i.test(message)) {
    return { start: 12 * 60, end: 17 * 60, label: "afternoon" };
  }
  if (/\bevening\b/i.test(message)) {
    return { start: 17 * 60, end: 21 * 60, label: "evening" };
  }
  if (/\bnight\b/i.test(message)) {
    return { start: 20 * 60, end: 23 * 60, label: "night" };
  }
  return null;
};

const createId = () => crypto.randomUUID();

const isRepeatedIntent = (
  message: string,
  parsedInput?: ParsedInputHint | null,
): boolean => {
  if (parsedInput?.recurrencePattern) return true;

  return /\b(daily|weekly|monthly|every day|every morning|every evening|every week|every month|every weekday|weekdays|repeat|recurring|each day|each week)\b/i
    .test(message);
};

const isEditIntent = (message: string): boolean =>
  /\b(move|reschedule|shift|change|adjust|update|edit|rename|make it|instead|push|pull|switch)\b/i
    .test(message);

const hasScheduleMoveIntent = (message: string): boolean =>
  /\b(move|reschedule|shift|adjust|push|pull|switch|instead)\b/i.test(message);

const isReminderIntent = (message: string): boolean =>
  /\b(remind|reminder|alert|ping me|nudge me)\b/i.test(message);

const isReminderRemovalIntent = (message: string): boolean =>
  /\b(remove|clear|delete|no|without)\s*(?:the\s*)?remind(?:er)?\b/i.test(
    message,
  );

const hasPlanningVerb = (message: string): boolean =>
  /\b(plan|schedule|reschedule|move|shift|push|pull|adjust|update|edit|rename|create|add|set up|break down|make time|organize|prioritize|fit|repeat|remind|turn .+ into)\b/i
    .test(message);

const hasCampaignStructureLanguage = (message: string): boolean =>
  /\b(campaign|journey|epic|ritual|habit)\b/i.test(message);

const looksLikeActionableTitle = (
  message: string,
  parsedInput?: ParsedInputHint | null,
): boolean => {
  const normalized = message.trim().toLowerCase();
  if (normalized.endsWith("?")) return false;
  if (
    /\b(i('| a)m|i feel|i'm feeling|help me think|pep talk|talk it through|talk to me|how do i|what should i|can you|could you|should i)\b/i
      .test(normalized)
  ) {
    return false;
  }
  if (hasPlanningVerb(normalized)) return true;
  if (
    /^(call|write|get|finish|book|send|draft|review|plan|move|practice|prep|clean|organize|outline|work on)\b/i
      .test(normalized)
  ) {
    return true;
  }

  return Boolean(parsedInput?.text?.trim()) &&
    normalized.split(/\s+/).length <= 10;
};

const looksConversational = (
  input: PlannerBuildInput,
  matched: MatchedEntities,
  repeated: boolean,
  classificationHint: ClassificationHint,
): boolean => {
  if (input.sessionState.openQuestionIds.length > 0) return false;
  if (isScheduleQuestion(input.message)) return false;
  if (
    isEditIntent(input.message) || isReminderIntent(input.message) ||
    isCampaignAdjustmentIntent(input.message)
  ) {
    return false;
  }
  if (repeated) return false;
  if (
    classificationHint.type === "epic" || classificationHint.type === "habit"
  ) return false;
  if (
    input.parsedInput?.scheduledDate || input.parsedInput?.scheduledTime ||
    input.parsedInput?.newTitle
  ) {
    return false;
  }
  if (matched.task || matched.ritual || matched.epic) {
    return false;
  }
  if (looksLikeActionableTitle(input.message, input.parsedInput)) {
    return false;
  }
  if (hasPlanningVerb(input.message)) {
    return false;
  }

  return classificationHint.type === "brain-dump" ||
    !/\b(quest|tasks?|campaign|ritual|calendar|today|tomorrow|week)\b/i.test(
      input.message,
    );
};

const isVaguePlanningPrompt = (
  input: PlannerBuildInput,
  matched: MatchedEntities,
  repeated: boolean,
): boolean => {
  if (input.sessionState.openQuestionIds.length > 0) return false;
  if (isScheduleQuestion(input.message)) return false;
  if (
    isEditIntent(input.message) || isReminderIntent(input.message) ||
    isCampaignAdjustmentIntent(input.message)
  ) {
    return false;
  }
  if (
    input.parsedInput?.scheduledDate || input.parsedInput?.scheduledTime ||
    input.parsedInput?.newTitle
  ) {
    return false;
  }
  if (matched.task || matched.ritual || matched.epic || matched.calendarEvent) {
    return false;
  }
  if (repeated) return false;

  return /\b(help me make room for what matters|make room for what matters|help me break a big goal into steps|break a big goal into steps|help me plan(?: my day| today| tomorrow| this week)?|plan(?: my day| today| tomorrow| this week)|help me prioritize(?: my day| today| this week)?|prioritize(?: my day| today| this week)?|help me organize(?: my day| today| this week)?|organize(?: my day| today| this week)?|help me figure out(?: my day| what matters| what to focus on)?|figure out(?: my day| what matters| what to focus on)|what matters most)\b/i
    .test(input.message);
};

const isLikelyAnswerOnly = (
  message: string,
  sessionState: PlannerSessionState,
): boolean => {
  if (sessionState.openQuestionIds.length === 0) {
    return false;
  }

  if (
    !sessionState.draft.title &&
    !sessionState.draft.scheduledTime &&
    !sessionState.draft.timeOfDay &&
    !sessionState.draft.scheduledDate &&
    !sessionState.draft.draftKind
  ) {
    return false;
  }

  return (
    message.length <= 160 &&
    !/\b(add|create|make|plan|move|rename|reschedule|change|update|need to|want to|set up)\b/i
      .test(message)
  );
};

const extractTimeQuestionSlotAnswer = (
  message: string,
  sessionState: PlannerSessionState,
): { scheduledDate: string | null; scheduledTime: string } | null => {
  if (!sessionState.openQuestionIds.includes("time_of_day")) return null;

  const trimmed = message.trim();
  const datedMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\b/);
  if (datedMatch?.[1] && datedMatch?.[2]) {
    const scheduledTime = normalizeClockTime(datedMatch[2]);
    if (!scheduledTime) return null;

    return {
      scheduledDate: datedMatch[1],
      scheduledTime,
    };
  }

  const timeOnlyMatch = trimmed.match(/^(\d{1,2}:\d{2})\b/);
  if (!timeOnlyMatch?.[1]) return null;

  const scheduledTime = normalizeClockTime(timeOnlyMatch[1]);
  if (!scheduledTime) return null;

  return {
    scheduledDate: null,
    scheduledTime,
  };
};

const ensureParsedInput = (
  input: PlannerBuildInput,
): NonNullable<PlannerBuildInput["parsedInput"]> => ({
  text: input.message,
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
  ...(input.parsedInput ?? {}),
});

const withResolvedTimeQuestionAnswer = (
  input: PlannerBuildInput,
): PlannerBuildInput => {
  if (input.parsedInput?.scheduledTime) return input;

  const slotAnswer = extractTimeQuestionSlotAnswer(
    input.message,
    input.sessionState,
  );
  if (!slotAnswer) return input;

  const parsedInput = ensureParsedInput(input);
  return {
    ...input,
    parsedInput: {
      ...parsedInput,
      scheduledDate: slotAnswer.scheduledDate ?? parsedInput.scheduledDate,
      scheduledTime: slotAnswer.scheduledTime,
    },
  };
};

const extractTimeOfDay = (
  message: string,
  parsedInput?: ParsedInputHint | null,
): string | null => {
  if (parsedInput?.scheduledTime) {
    const hour = Number.parseInt(
      parsedInput.scheduledTime.split(":")[0] ?? "",
      10,
    );
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

const extractTimeReason = (
  message: string,
  sessionState: PlannerSessionState,
): string | null => {
  const becauseMatch = message.match(/\b(?:because|since)\s+(.+)/i);
  if (becauseMatch?.[1]) return becauseMatch[1].trim();

  const worksMatch = message.match(
    /\b(.+?)\s+(?:works best|fits best|helps me|keeps me|feels best)\b/i,
  );
  if (worksMatch?.[1]) return worksMatch[1].trim();

  if (
    sessionState.openQuestionIds.includes("time_reason") &&
    message.trim().length > 18
  ) {
    return message.trim();
  }

  return null;
};

const extractReminderMinutes = (message: string): number | null => {
  const explicit = message.match(
    /\b(\d{1,3})\s*(?:minutes?|mins?)\s*(?:before|ahead|early)\b/i,
  );
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

  if (
    kind === "create_campaign" || kind === "create_ritual" ||
    kind === "update_ritual"
  ) {
    return 10;
  }

  return 15;
};

const timeOfDayToClock = (
  timeOfDay: string | null | undefined,
): string | null => {
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

  const matchedTasks = tasks.filter((task) =>
    entityTitleMatches(haystack, task.title)
  );
  const matchedRituals = context.rituals.filter((ritual) =>
    entityTitleMatches(haystack, ritual.title)
  );
  const matchedEpics = context.activeEpics.filter((epic) =>
    entityTitleMatches(haystack, epic.title)
  );
  const matchedCalendarEvents = context.calendarEvents.filter((event) =>
    entityTitleMatches(haystack, event.title)
  );

  const matchedTask = matchedTasks[0] ?? null;
  const matchedRitual = matchedRituals[0] ?? null;
  const matchedEpic = matchedEpics[0] ?? null;
  const calendarEvent = matchedCalendarEvents[0] ?? null;

  return {
    tasks: matchedTasks,
    task: matchedTask,
    rituals: matchedRituals,
    ritual: matchedRitual,
    epics: matchedEpics,
    epic: matchedEpic ?? (
      matchedRitual
        ? context.activeEpics.find((epic) =>
          epic.id === matchedRitual.epicId
        ) ?? null
        : null
    ),
    calendarEvents: matchedCalendarEvents,
    calendarEvent,
  };
};

const parseRenameTitle = (message: string): string | null => {
  const renameMatch = message.match(
    /\b(?:rename|change(?: the name of)?)\b.+?\bto\b\s+[""]?(.+?)[""]?$/i,
  );
  if (renameMatch?.[1]) return renameMatch[1].trim();
  return null;
};

const resolveCadence = (
  message: string,
  parsedInput?: ParsedInputHint | null,
): ResolvedCadence => {
  const pattern = parsedInput?.recurrencePattern ?? null;
  const recurrenceDays = parsedInput?.recurrenceDays?.length
    ? [...parsedInput.recurrenceDays]
    : null;
  const recurrenceMonthDays = parsedInput?.recurrenceMonthDays?.length
    ? [...parsedInput.recurrenceMonthDays]
    : null;
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

  const dayMatches = DAY_KEYWORDS.filter(([word]) =>
    new RegExp(`\\b${word}\\b`, "i").test(message)
  ).map(([, day]) => day);
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

  const timeOfDay = extractTimeOfDay(input.message, parsed) ??
    base.timeOfDay ??
    input.sessionState.preferredTimeOfDay ??
    plannerMemory?.preferredTimeOfDay ??
    null;
  const timeReason = extractTimeReason(input.message, input.sessionState) ??
    base.timeReason ??
    input.sessionState.preferredTimeReason ??
    plannerMemory?.preferredTimeReason ??
    null;
  const cadence = resolveCadence(input.message, parsed).label ?? base.cadence ??
    null;

  const parsedTitle = input.sessionState.pendingStarterIntent === "quest_capture" &&
      isTimingOnlyReply(input.message, parsed)
    ? null
    : sanitizeProposalTitle(parsed?.text);
  const carriedTitle = sanitizeProposalTitle(base.title);
  const renameTitle = parsed?.newTitle?.trim() ||
    parseRenameTitle(input.message) || null;

  const draftTitle = matched.task?.title ??
    matched.ritual?.title ??
    carriedTitle ??
    parsedTitle;

  return {
    ...base,
    title: renameTitle
      ? matched.epic?.title ?? matched.task?.title ?? matched.ritual?.title ??
        draftTitle
      : draftTitle,
    taskId: matched.task?.id ?? base.taskId ?? null,
    ritualId: matched.ritual?.id ?? base.ritualId ?? null,
    epicId: matched.epic?.id ?? matched.ritual?.epicId ?? base.epicId ?? null,
    epicTitle: matched.epic?.title ?? matched.ritual?.epicTitle ??
      base.epicTitle ?? null,
    scheduledDate: parsed?.scheduledDate ?? base.scheduledDate ??
      matched.task?.taskDate ?? input.currentDate,
    scheduledTime: parsed?.scheduledTime ?? base.scheduledTime ?? null,
    timeOfDay,
    timeReason,
    cadence,
    endDate: parsed?.recurrenceEndDate ??
      input.classificationHint?.suggestedDeadline ?? base.endDate ?? null,
    durationMinutes: parsed?.estimatedDuration ??
      input.classificationHint?.suggestedDuration ?? base.durationMinutes ??
      null,
    reminderMinutesBefore: isReminderRemovalIntent(input.message)
      ? null
      : extractReminderMinutes(input.message) ??
        base.reminderMinutesBefore ??
        plannerMemory?.reminderMinutesBefore ??
        null,
  };
};

const hasConcreteOneOffSchedulingPayload = (
  input: PlannerBuildInput,
  draft: PlannerDraftState,
  repeated: boolean,
): boolean => {
  if (repeated) return false;

  const hasActionableTitle = Boolean(
    sanitizeProposalTitle(draft.title) ??
      sanitizeProposalTitle(input.parsedInput?.text),
  );

  if (!hasActionableTitle) return false;

  return Boolean(
    input.parsedInput?.scheduledDate ||
      input.parsedInput?.scheduledTime ||
      extractReminderMinutes(input.message),
  );
};

const isReminderOnlyIntent = (
  input: PlannerBuildInput,
  repeated: boolean,
): boolean => {
  if (!isReminderIntent(input.message)) return false;
  if (repeated) return false;
  if (isCampaignAdjustmentIntent(input.message)) return false;
  if (parseRenameTitle(input.message) || input.parsedInput?.newTitle) return false;
  if (hasScheduleMoveIntent(input.message)) return false;
  if (input.parsedInput?.scheduledTime) return false;
  if (input.parsedInput?.recurrencePattern) return false;

  return true;
};

const resolveKind = (
  input: PlannerBuildInput,
  draft: PlannerDraftState,
  matched: MatchedEntities,
  repeated: boolean,
): PlannerProposalKind => {
  const editIntent = isEditIntent(input.message);
  const renameTitle = input.parsedInput?.newTitle ??
    parseRenameTitle(input.message);
  const reminderOnlyIntent = isReminderOnlyIntent(input, repeated);
  const concreteOneOffScheduling = hasConcreteOneOffSchedulingPayload(
    input,
    draft,
    repeated,
  );

  if (matched.ritual && reminderOnlyIntent) return "update_ritual";
  if (matched.task && reminderOnlyIntent) return "suggest_reminder";
  if (matched.ritual && editIntent) return "update_ritual";
  if (
    matched.epic && isCampaignAdjustmentIntent(input.message) && !renameTitle
  ) return "adjust_campaign_plan";
  if (matched.task && editIntent) return "update_quest";
  if (matched.epic && renameTitle) return "update_campaign";

  if (matched.ritual && repeated) return "update_ritual";
  if (
    repeated &&
    (matched.epic || draft.epicId || hasCampaignStructureLanguage(input.message))
  ) {
    return "create_ritual";
  }
  if (repeated) return "create_quest";

  if (concreteOneOffScheduling) return "create_quest";

  if (input.classificationHint?.type === "epic") return "create_campaign";
  if (
    input.classificationHint?.type === "habit" &&
    (draft.epicId || hasCampaignStructureLanguage(input.message))
  ) {
    return "create_ritual";
  }
  if (input.classificationHint?.type === "habit") return "create_quest";

  return "create_quest";
};

const defaultQuestDate = (
  input: PlannerBuildInput,
  draft: PlannerDraftState,
): string | null => {
  if (draft.scheduledDate) return draft.scheduledDate;
  if (input.horizon === "day") return input.currentDate;
  return input.currentDate;
};

const hasExplicitSchedulingIntent = (
  input: PlannerBuildInput,
  kind: PlannerProposalKind,
): boolean => {
  if (
    input.parsedInput?.scheduledDate ||
    input.parsedInput?.scheduledTime ||
    input.parsedInput?.recurrencePattern
  ) {
    return true;
  }

  if (isRepeatedIntent(input.message, input.parsedInput)) {
    return true;
  }

  if (kind === "update_quest" || kind === "update_ritual") {
    return isEditIntent(input.message);
  }

  return /\b(schedule|scheduled|calendar|slot|time|when should|put it|place it|remind|today|tomorrow|tonight|this morning|this afternoon|this evening|morning|afternoon|evening|night|at \d)\b/i
    .test(input.message);
};

const hasExplicitOneOffQuestTiming = (
  input: PlannerBuildInput,
  kind: PlannerProposalKind,
): boolean =>
  kind === "create_quest" &&
  Boolean(input.parsedInput?.scheduledTime) &&
  !isRepeatedIntent(input.message, input.parsedInput);

const shouldAskTimingQuestions = (
  input: PlannerBuildInput,
  kind: PlannerProposalKind,
): boolean => {
  if (
    kind === "create_campaign" || kind === "update_campaign" ||
    kind === "adjust_campaign_plan" || kind === "suggest_reminder"
  ) {
    return false;
  }

  if (hasExplicitOneOffQuestTiming(input, kind)) {
    return false;
  }

  if (kind === "update_quest" || kind === "update_ritual") {
    const explicitSchedule = Boolean(input.parsedInput?.scheduledDate) ||
      Boolean(input.parsedInput?.scheduledTime) ||
      /\b(today|tomorrow|morning|afternoon|evening|night|at \d)/i.test(
        input.message,
      );
    const renameOnly = Boolean(
      input.parsedInput?.newTitle ?? parseRenameTitle(input.message),
    );

    if (renameOnly) return false;
    if (
      explicitSchedule && !isRepeatedIntent(input.message, input.parsedInput)
    ) {
      return false;
    }
  }

  return hasExplicitSchedulingIntent(input, kind);
};

const missingFieldsForKind = (
  input: PlannerBuildInput,
  kind: PlannerProposalKind,
  draft: PlannerDraftState,
  cadence: ResolvedCadence,
): string[] => {
  if (kind === "suggest_reminder") return [];

  const missing = new Set<string>();
  const effectiveTime = preferredTime(draft);
  const forceQuestCaptureTiming = kind === "create_quest" &&
    input.sessionState.pendingStarterIntent === "quest_capture";

  if (shouldAskTimingQuestions(input, kind) || (forceQuestCaptureTiming && !effectiveTime)) {
    if (!effectiveTime) missing.add("time of day");
    if (!forceQuestCaptureTiming && !draft.timeReason) {
      missing.add("why that time works");
    }
  }

  if (
    (kind === "create_quest" || kind === "update_quest") &&
    (draft.draftKind === "create_quest" || draft.draftKind === "update_quest")
  ) {
    if (draft.cadence && !cadence.recurrencePattern) {
      missing.add("repeat cadence");
    }
  }

  if (
    (kind === "create_quest" || kind === "update_quest") && draft.cadence &&
    !draft.endDate
  ) {
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

const question = (
  input: Omit<PlannerQuestion, "id"> & { id?: string },
): PlannerQuestion => ({
  id: input.id ?? input.field,
  prompt: input.prompt,
  reason: input.reason ?? null,
  required: input.required,
  field: input.field,
  options: input.options,
});

const formatSlotLabel = (slot: PlannerOpenSlot, selectedDate: string): string =>
  slot.date === selectedDate ? slot.time : `${slot.date} ${slot.time}`;

const buildTimeQuestion = (input: PlannerBuildInput): PlannerQuestion => {
  const insights = input.plannerContext.scheduleInsights;
  const plannerMemory = input.plannerContext.plannerMemory;
  const suggestedSlots = insights?.suggestedSlots?.slice(0, 3) ?? [];
  const slotOptions = suggestedSlots.map((slot) =>
    formatSlotLabel(slot, insights?.selectedDate ?? input.currentDate)
  );
  const preferredTimeOfDay = plannerMemory?.preferredTimeOfDay ??
    input.sessionState.preferredTimeOfDay ?? null;
  const preferredReason = plannerMemory?.preferredTimeReason ??
    input.sessionState.preferredTimeReason ?? null;

  if (suggestedSlots.length > 0) {
    const slotText = slotOptions.join(", ");
    if (preferredTimeOfDay) {
      return question({
        field: "time_of_day",
        prompt:
          `I found a few open windows: ${slotText}. You usually do well in the ${preferredTimeOfDay}. If you want to place this, pick the one that fits best.`,
        reason: preferredReason
          ? `You've said ${preferredTimeOfDay} tends to work because ${preferredReason}. I can reuse that rhythm if it still fits.`
          : "I want to place this in a real opening instead of guessing.",
        required: true,
        options: slotOptions,
      });
    }

    return question({
      field: "time_of_day",
      prompt:
        `I found a few open windows: ${slotText}. If you want to put this on the calendar, pick the one that fits best.`,
      reason: suggestedSlots[0]?.reason ??
        "I want to place this in a real opening instead of guessing.",
      required: true,
      options: slotOptions,
    });
  }

  if (preferredTimeOfDay) {
    return question({
      field: "time_of_day",
      prompt:
        `You usually prefer the ${preferredTimeOfDay} for this kind of work. Want me to place it there again, or use a different part of the day?`,
      reason: preferredReason
        ? `You've told me ${preferredTimeOfDay} works because ${preferredReason}.`
        : "I'll use that pattern unless this one needs a different rhythm.",
      required: true,
      options: ["Morning", "Afternoon", "Evening", "Night"],
    });
  }

  return question({
    field: "time_of_day",
    prompt: "If we're putting this on the calendar, what time of day fits best?",
    reason:
      "I want to place it where you're actually likely to follow through.",
    required: true,
    options: ["Morning", "Afternoon", "Evening", "Night"],
  });
};

const buildBalanceQuestion = (
  input: PlannerBuildInput,
): PlannerQuestion | null => {
  const suggestion = input.plannerContext.scheduleInsights?.moveSuggestions
    ?.[0];
  if (!suggestion) return null;

  return question({
    id: "details",
    field: "details",
    prompt: suggestion.suggestedTime
      ? `${suggestion.fromDate} looks crowded. Want me to aim "${
        suggestion.taskTitle ?? "this"
      }" for ${suggestion.toDate} at ${suggestion.suggestedTime} instead?`
      : `${suggestion.fromDate} looks crowded. Want me to aim "${
        suggestion.taskTitle ?? "this"
      }" for ${suggestion.toDate} instead?`,
    reason: suggestion.reason,
    required: false,
    options: [
      suggestion.suggestedTime
        ? `${suggestion.toDate} ${suggestion.suggestedTime}`
        : suggestion.toDate,
      "Keep the original day",
    ],
  });
};

const buildTitleClarificationQuestion = (
  kind: PlannerProposalKind,
): PlannerQuestion | null => {
  if (kind === "create_quest") {
    return question({
      field: "details",
      prompt: "What should I call this quest?",
      reason: "I don't want to save it with a broken or placeholder title.",
      required: true,
    });
  }

  if (kind === "create_ritual") {
    return question({
      field: "details",
      prompt: "What should I call this ritual?",
      reason: "I don't want to save it with a broken or placeholder title.",
      required: true,
    });
  }

  if (kind === "create_campaign") {
    return question({
      field: "details",
      prompt: "What should I call this campaign?",
      reason: "I don't want to save it with a broken or placeholder title.",
      required: true,
    });
  }

  return null;
};

const buildFollowUpQuestions = (
  input: PlannerBuildInput,
  kind: PlannerProposalKind,
  draft: PlannerDraftState,
  cadence: ResolvedCadence,
): PlannerQuestion[] => {
  if (kind === "suggest_reminder") return [];

  const questions: PlannerQuestion[] = [];
  const effectiveTime = preferredTime(draft);
  const explicitTimeOfDay = extractTimeOfDay(input.message, input.parsedInput);
  const explicitTimeReason = extractTimeReason(
    input.message,
    input.sessionState,
  );
  const carryForwardAnswer = isLikelyAnswerOnly(
    input.message,
    input.sessionState,
  );
  const shouldConfirmLearnedTime = !carryForwardAnswer &&
    !input.parsedInput?.scheduledTime && !explicitTimeOfDay;
  const shouldConfirmLearnedReason = !carryForwardAnswer && !explicitTimeReason;
  const forceQuestCaptureTiming = kind === "create_quest" &&
    input.sessionState.pendingStarterIntent === "quest_capture";
  const askTimingQuestions = shouldAskTimingQuestions(input, kind) ||
    (forceQuestCaptureTiming && !effectiveTime);
  const titleQuestion = buildTitleClarificationQuestion(kind);

  if (titleQuestion && !sanitizeProposalTitle(draft.title)) {
    return [titleQuestion];
  }

  if (askTimingQuestions && (!effectiveTime || shouldConfirmLearnedTime)) {
    questions.push(buildTimeQuestion(input));
  }

  if (
    askTimingQuestions &&
    !forceQuestCaptureTiming &&
    (!draft.timeReason || shouldConfirmLearnedReason)
  ) {
    questions.push(question({
      field: "time_reason",
      prompt: input.plannerContext.plannerMemory?.preferredTimeReason
        ? `What makes this timing the right fit today? I know you've previously said ${input.plannerContext.plannerMemory.preferredTimeReason}.`
        : "What makes that timing a good fit?",
      reason:
        "I'll reuse your reasoning when I suggest future timing and reminders.",
      required: true,
    }));
  }

  if (
    (kind === "create_quest" || kind === "update_quest" ||
      kind === "create_ritual" || kind === "update_ritual") &&
    isRepeatedIntent(input.message, input.parsedInput)
  ) {
    if (!cadence.label) {
      questions.push(question({
        field: "cadence",
        prompt: "How often should this repeat?",
        reason: "I need the cadence before I can set up the repeat cleanly.",
        required: true,
        options: ["Daily", "Weekdays", "Weekly", "Monthly"],
      }));
    }

    if (
      (kind === "create_quest" || kind === "update_quest") && !draft.endDate
    ) {
      questions.push(question({
        field: "end_date",
        prompt: "When should this repetition stop?",
        reason:
          "That helps me choose a recurring quest instead of an open-ended loop.",
        required: true,
      }));
    }
  }

  if (
    (kind === "create_quest" || kind === "create_ritual") &&
    input.plannerContext.activeEpics.length > 0 && !draft.epicId &&
    isRepeatedIntent(input.message, input.parsedInput)
  ) {
    questions.push(question({
      field: "campaign_link",
      prompt: "Should this support one of your campaigns, or stay standalone?",
      reason:
        "If it feeds a bigger goal, I can turn it into a campaign ritual instead.",
      required: false,
      options: [
        ...input.plannerContext.activeEpics.map((epic) => epic.title),
        "Keep it standalone",
      ],
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
  if (
    balanceQuestion &&
    !questions.some((candidate) => candidate.id === balanceQuestion.id)
  ) {
    questions.push(balanceQuestion);
  }

  return questions;
};

const stripUndefined = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;

const buildReminderProposal = (
  input: PlannerBuildInput,
  draft: PlannerDraftState,
  matchedTask: PlannerContextTask,
): PlannerProposal => {
  const removeReminder = isReminderRemovalIntent(input.message);
  const reminderMinutesBefore = removeReminder
    ? null
    : draft.reminderMinutesBefore ?? inferReminderMinutes(
      "create_quest",
      matchedTask.scheduledTime,
      extractReminderMinutes(input.message),
    );

  return {
    id: createId(),
    kind: "suggest_reminder",
    title: `Update reminder for ${matchedTask.title}`,
    summary: removeReminder
      ? `Remove the reminder for "${matchedTask.title}".`
      : `Set a ${
        reminderMinutesBefore ?? 15
      }-minute reminder for "${matchedTask.title}".`,
    reasoning:
      "This reads like a reminder-only change on an existing quest, so I'm adjusting the reminder instead of creating a duplicate quest.",
    payload: {
      taskId: matchedTask.id,
      updates: stripUndefined({
        reminder_enabled: removeReminder ? false : true,
        reminder_minutes_before: removeReminder
          ? null
          : reminderMinutesBefore ?? 15,
      }),
    },
    status: "pending",
    readyToConfirm: true,
    missingFields: [],
  };
};

const buildQuestProposal = (
  input: PlannerBuildInput,
  draft: PlannerDraftState,
  cadence: ResolvedCadence,
  kind: "create_quest" | "update_quest",
  matchedTask: PlannerContextTask | null,
): PlannerProposal => {
  const scheduledTime = preferredTime(draft);
  const reminderMinutesBefore = inferReminderMinutes(
    kind,
    scheduledTime,
    draft.reminderMinutesBefore ?? null,
  );
  const rawTitle = matchedTask?.title ??
    sanitizeProposalTitle(draft.title) ??
    sanitizeProposalTitle(input.parsedInput?.text);
  const title = kind === "create_quest" &&
      rawTitle &&
      Boolean(input.parsedInput?.scheduledTime) &&
      !cadence.recurrencePattern
    ? formatGeneratedTaskTitle(rawTitle)
    : rawTitle;
  const summarySchedule = input.parsedInput?.scheduledDate && scheduledTime
    ? ` on ${input.parsedInput.scheduledDate} at ${scheduledTime}`
    : input.parsedInput?.scheduledDate
    ? ` on ${input.parsedInput.scheduledDate}`
    : scheduledTime
    ? ` at ${scheduledTime}`
    : "";

  if (kind === "update_quest" && matchedTask) {
    const updates = stripUndefined({
      task_text: input.parsedInput?.newTitle ??
        parseRenameTitle(input.message) ?? undefined,
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
        ? `Update "${matchedTask.title}" as a recurring quest with ${
          cadence.label ?? "your chosen cadence"
        }${draft.endDate ? ` until ${draft.endDate}` : ""}.`
        : `Adjust "${matchedTask.title}"${
          scheduledTime ? ` to ${scheduledTime}` : ""
        }${draft.scheduledDate ? ` on ${draft.scheduledDate}` : ""}.`,
      reasoning:
        "This reads like an existing quest adjustment rather than a brand-new structure.",
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
    title: title ? `Create ${title}` : "Create quest",
    summary: title
      ? cadence.recurrencePattern
      ? `Create a recurring quest for "${title}"${
        draft.endDate ? ` until ${draft.endDate}` : ""
      }.`
      : `Create a quest for "${title}"${summarySchedule}.`
      : "I need the quest title before I can save this.",
    reasoning: cadence.recurrencePattern
      ? "This is repeated work, so I'm treating it as a recurring quest by default."
      : "This looks like a one-off or short-lived action, so it fits best as a quest.",
    payload: {
      taskText: title ?? "",
      difficulty: input.plannerContext.aiSignals?.preferredDifficulty ??
        "medium",
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
  const reminderMinutesBefore = inferReminderMinutes(
    kind,
    scheduledTime,
    draft.reminderMinutesBefore ?? null,
  );
  const renamedTitle = input.parsedInput?.newTitle ??
    parseRenameTitle(input.message);
  const title = sanitizeProposalTitle(draft.title) ??
    sanitizeProposalTitle(input.parsedInput?.text);
  const targetDays = input.classificationHint?.suggestedDuration ??
    input.plannerContext.aiSignals?.preferredEpicDuration ??
    30;

  if (kind === "update_campaign" && matchedEpic && renamedTitle) {
    return {
      id: createId(),
      kind,
      title: `Rename ${matchedEpic.title}`,
      summary: `Rename "${matchedEpic.title}" to "${renamedTitle}".`,
      reasoning:
        "I found a live campaign reference and this message reads like a title change.",
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
    title: title ? `Create ${title}` : "Create campaign",
    summary: title
      ? `Create a campaign for "${title}" with a starter ritual so it becomes actionable right away.`
      : "I need the campaign title before I can save this.",
    reasoning:
      "This feels like a multi-step outcome that belongs in a campaign rather than a single quest.",
    payload: {
      title: title ?? "",
      target_days: targetDays,
      habits: [
        {
          title: title ? `Work on ${title}` : "Starter ritual",
          difficulty: input.plannerContext.aiSignals?.preferredDifficulty ??
            "medium",
          frequency: cadence.habitFrequency ??
            input.plannerContext.aiSignals?.preferredHabitFrequency ?? "daily",
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
  const reminderMinutesBefore = inferReminderMinutes(
    kind,
    scheduledTime,
    draft.reminderMinutesBefore ?? null,
  );
  const title = matchedRitual?.title ??
    sanitizeProposalTitle(draft.title) ??
    sanitizeProposalTitle(input.parsedInput?.text);
  const epicId = draft.epicId ?? matchedRitual?.epicId ?? null;
  const epicTitle = draft.epicTitle ?? matchedRitual?.epicTitle ??
    "your campaign";

  if (kind === "update_ritual" && matchedRitual) {
    return {
      id: createId(),
      kind,
      title: `Update ${matchedRitual.title}`,
      summary:
        `Update the ritual "${matchedRitual.title}" inside ${matchedRitual.epicTitle}.`,
      reasoning:
        "You referenced an existing campaign ritual, so I'm keeping the change attached to that campaign.",
      payload: {
        habitId: matchedRitual.id,
        title,
        description: input.parsedInput?.notes ?? null,
        difficulty: input.plannerContext.aiSignals?.preferredDifficulty ??
          "medium",
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
    title: title ? `Add ${title}` : "Add ritual",
    summary: title
      ? `Add "${title}" as a ritual inside ${epicTitle}.`
      : `I need the ritual title before I can add it inside ${epicTitle}.`,
    reasoning:
      "This repeat work seems tied to a bigger goal, so it belongs as a campaign ritual.",
    payload: {
      epicId,
      title: title ?? "",
      difficulty: input.plannerContext.aiSignals?.preferredDifficulty ??
        "medium",
      frequency: cadence.habitFrequency ??
        input.plannerContext.aiSignals?.preferredHabitFrequency ?? "daily",
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

const extractCampaignAdjustmentType = (message: string): string => {
  if (/\b(push|extend|delay|stretch)\b/i.test(message)) {
    return "extend_deadline";
  }
  if (
    /\b(remove|drop)\b/i.test(message) && /\b(ritual|habit)\b/i.test(message)
  ) return "remove_habits";
  if (
    /\b(add|include)\b/i.test(message) && /\b(ritual|habit)\b/i.test(message)
  ) return "add_habits";
  if (/\b(scope|trim|reduce)\b/i.test(message)) return "reduce_scope";
  if (/\b(reschedule|move|shift)\b/i.test(message)) return "reschedule";
  return "custom";
};

const buildCampaignAdjustmentProposal = (
  input: PlannerBuildInput,
  draft: PlannerDraftState,
  matchedEpic: PlannerContextEpic,
): PlannerProposal => {
  const adjustmentType = extractCampaignAdjustmentType(input.message);
  const summaryParts = [matchedEpic.title];
  if (/\b(push|extend|delay|stretch)\b/i.test(input.message)) {
    const weekMatch = input.message.match(/\b(\d+)\s+week/i);
    const dayMatch = input.message.match(/\b(\d+)\s+day/i);
    if (weekMatch?.[1]) {
      summaryParts.push(
        `move the timeline out by ${weekMatch[1]} week${
          weekMatch[1] === "1" ? "" : "s"
        }`,
      );
    } else if (dayMatch?.[1]) {
      summaryParts.push(
        `move the timeline out by ${dayMatch[1]} day${
          dayMatch[1] === "1" ? "" : "s"
        }`,
      );
    }
  }
  if (/\b(remove|drop)\b.+\b(ritual|habit)\b/i.test(input.message)) {
    summaryParts.push("remove at least one lower-priority ritual");
  }
  if (/\b(add|include)\b.+\b(ritual|habit)\b/i.test(input.message)) {
    summaryParts.push("add supporting ritual changes");
  }

  return {
    id: createId(),
    kind: "adjust_campaign_plan",
    title: `Adjust ${matchedEpic.title}`,
    summary: summaryParts.length > 1
      ? `Generate a revised plan for "${matchedEpic.title}" to ${
        summaryParts.slice(1).join(" and ")
      }.`
      : `Generate a revised plan for "${matchedEpic.title}" based on this request.`,
    reasoning:
      "This reads like a campaign restructure, so I'm preparing an adjustment plan instead of a simple rename.",
    payload: {
      epicId: matchedEpic.id,
      epicTitle: matchedEpic.title,
      adjustmentType,
      reason: input.message.trim(),
      requestedSummary: draft.title ?? input.message.trim(),
    },
    status: "pending",
    readyToConfirm: true,
    missingFields: [],
  };
};

const buildTaskIntervalsForDate = (
  tasks: PlannerContextTask[],
  date: string,
): TimelineInterval[] =>
  tasks
    .filter((task) =>
      task.completed !== true && task.taskDate === date && task.scheduledTime
    )
    .map((task): TimelineInterval | null => {
      const startMinutes = parseTimeToMinutes(task.scheduledTime);
      if (startMinutes === null) return null;

      return {
        id: task.id,
        title: task.title,
        source: "quest" as const,
        startMinutes,
        endMinutes: startMinutes + getTaskDuration(task),
      };
    })
    .filter((interval): interval is TimelineInterval => interval !== null)
    .sort((left, right) => left.startMinutes - right.startMinutes);

const buildCalendarIntervalsForDate = (
  events: PlannerContextCalendarEvent[],
  date: string,
  plannerMemory?: PlannerMemoryProfile | null,
): TimelineInterval[] => {
  const dayStart = new Date(`${date}T00:00:00`);
  const nextDay = addDaysToDateKey(date, 1);
  const dayEnd = new Date(`${nextDay}T00:00:00`);
  const wakeMinutes = getWakeMinutes(plannerMemory);
  const windDownMinutes = getWindDownMinutes(plannerMemory);

  return events
    .map((event): TimelineInterval | null => {
      const start = new Date(event.start);
      const end = new Date(event.end);
      if (end <= dayStart || start >= dayEnd) return null;

      if (event.isAllDay) {
        return {
          id: event.id,
          title: event.title,
          source: "calendar" as const,
          startMinutes: wakeMinutes,
          endMinutes: windDownMinutes,
        };
      }

      const localStart = start < dayStart ? dayStart : start;
      const localEnd = end > dayEnd ? dayEnd : end;
      const startMinutes = (localStart.getHours() * 60) +
        localStart.getMinutes();
      const endMinutes = (localEnd.getHours() * 60) + localEnd.getMinutes();
      if (endMinutes <= startMinutes) return null;

      return {
        id: event.id,
        title: event.title,
        source: "calendar" as const,
        startMinutes,
        endMinutes,
      };
    })
    .filter((interval): interval is TimelineInterval => interval !== null)
    .sort((left, right) => left.startMinutes - right.startMinutes);
};

const buildIntervalsForDate = (
  input: PlannerBuildInput,
  date: string,
): TimelineInterval[] => ([
  ...buildTaskIntervalsForDate([
    ...input.plannerContext.tasks,
    ...input.plannerContext.inboxTasks,
  ], date),
  ...buildCalendarIntervalsForDate(
    input.plannerContext.calendarEvents,
    date,
    input.plannerContext.plannerMemory,
  ),
].sort((left, right) => left.startMinutes - right.startMinutes));

const buildFreeWindowsForDate = (
  input: PlannerBuildInput,
  date: string,
  dayPart: { start: number; end: number; label: string } | null,
) => {
  const intervals = buildIntervalsForDate(input, date);
  const wakeMinutes = dayPart?.start ??
    getWakeMinutes(input.plannerContext.plannerMemory);
  const windDownMinutes = dayPart?.end ??
    getWindDownMinutes(input.plannerContext.plannerMemory);
  const windows: Array<{ start: string; end: string }> = [];
  const currentDateKey = getLocalDateFromDateTime(input.currentDateTime);
  const currentMinutes = getLocalMinutesFromDateTime(input.currentDateTime);

  let cursor = wakeMinutes;
  if (date === currentDateKey && currentMinutes !== null) {
    cursor = Math.max(cursor, currentMinutes);
  }
  for (const interval of intervals) {
    if (
      interval.endMinutes <= wakeMinutes ||
      interval.startMinutes >= windDownMinutes
    ) continue;
    if (interval.startMinutes > cursor) {
      windows.push({
        start: formatMinutes(cursor),
        end: formatMinutes(Math.min(interval.startMinutes, windDownMinutes)),
      });
    }
    cursor = Math.max(cursor, interval.endMinutes);
  }

  if (cursor < windDownMinutes) {
    windows.push({
      start: formatMinutes(cursor),
      end: formatMinutes(windDownMinutes),
    });
  }

  return windows.filter((window) =>
    parseTimeToMinutes(window.end)! - parseTimeToMinutes(window.start)! >= 30
  );
};

const formatEventTimeLabel = (event: PlannerContextCalendarEvent): string => {
  if (event.isAllDay) return "All day";

  const start = new Date(event.start);
  const end = new Date(event.end);
  const startLabel = `${String(start.getHours()).padStart(2, "0")}:${
    String(start.getMinutes()).padStart(2, "0")
  }`;
  const endLabel = `${String(end.getHours()).padStart(2, "0")}:${
    String(end.getMinutes()).padStart(2, "0")
  }`;
  return `${startLabel}-${endLabel}`;
};

const collectScheduleItemsForDate = (
  input: PlannerBuildInput,
  date: string,
  remainingOnly: boolean,
) => {
  const now = new Date(input.currentDateTime);
  const currentDateKey = getLocalDateFromDateTime(input.currentDateTime);
  const currentMinutes = getLocalMinutesFromDateTime(input.currentDateTime);
  const tasks = [
    ...input.plannerContext.tasks,
    ...input.plannerContext.inboxTasks,
  ]
    .filter((task) => task.completed !== true && task.taskDate === date)
    .filter((task) => {
      if (!remainingOnly || date !== currentDateKey) return true;
      const scheduledMinutes = parseTimeToMinutes(task.scheduledTime);
      if (scheduledMinutes === null || currentMinutes === null) return true;
      return scheduledMinutes >= currentMinutes;
    })
    .map((task) => ({
      label: `${task.scheduledTime ?? "Unscheduled"} ${task.title}`,
      sortMinutes: parseTimeToMinutes(task.scheduledTime),
    }));

  const events = input.plannerContext.calendarEvents
    .filter((event) => {
      const start = new Date(event.start);
      const end = new Date(event.end);
      const dayStart = new Date(`${date}T00:00:00`);
      const dayEnd = new Date(`${addDaysToDateKey(date, 1)}T00:00:00`);
      if (!(end > dayStart && start < dayEnd)) return false;
      if (!remainingOnly || date !== currentDateKey) return true;
      return end > now;
    })
    .map((event) => ({
      label: `${formatEventTimeLabel(event)} ${event.title}`,
      sortMinutes: event.isAllDay
        ? -1
        : parseTimeToMinutes(formatEventTimeLabel(event)),
    }));

  return [...tasks, ...events].sort((left, right) => (
    (left.sortMinutes ?? 9999) - (right.sortMinutes ?? 9999)
  ));
};

const buildDayDigest = (
  input: PlannerBuildInput,
  date: string,
  label: string,
  remainingOnly = false,
): string => {
  const items = collectScheduleItemsForDate(input, date, remainingOnly);
  const openings = buildFreeWindowsForDate(input, date, null).slice(0, 2);

  if (items.length === 0 && openings.length === 0) {
    return `${label}: wide open right now.`;
  }

  const nextItems = items.slice(0, 3).map((item) => item.label).join("; ");
  const openingText = openings.length > 0
    ? `Best opening${openings.length === 1 ? "" : "s"}: ${
      openings.map((window) => `${window.start}-${window.end}`).join(", ")
    }.`
    : "No obvious open window yet without reshuffling something.";

  if (items.length === 0) {
    return `${label}: no scheduled items. ${openingText}`;
  }

  const overflowCount = items.length - 3;
  const overflowText = overflowCount > 0
    ? ` Plus ${overflowCount} more item${overflowCount === 1 ? "" : "s"}.`
    : "";
  return `${label}: ${nextItems}.${overflowText} ${openingText}`;
};

const isWittySassyTone = (tonePack: PlannerTonePack): boolean =>
  tonePack === "witty_sassy";

const buildWittyAvailabilityCallout = (
  input: PlannerBuildInput,
  targetDate: string,
  remainingOnly = false,
): string | null => {
  if (!isWittySassyTone(input.tonePack)) return null;

  const items = collectScheduleItemsForDate(input, targetDate, remainingOnly);
  const scheduleInsights = input.plannerContext.scheduleInsights;
  const dayLoadStatus = scheduleInsights?.dayLoads.find((day) => day.date === targetDate)?.status ?? null;
  const isExplicitlyEmpty = scheduleInsights?.emptyDates.includes(targetDate) ?? false;
  const isOpen = items.length === 0 || isExplicitlyEmpty || dayLoadStatus === "open";
  const isLight = !isOpen && (items.length <= 1 || dayLoadStatus === "balanced");
  const targetLabel = formatScheduleReference(input.currentDate, targetDate, true);

  if (targetDate === input.currentDate) {
    if (isOpen) {
      return "Your calendar is wide open today. According to what I see, time is all you got, so let's stop letting random nonsense cosplay as a packed life.";
    }

    if (isLight) {
      return "Today is pretty open. This is not a 'too much on my plate' emergency; this is a priorities problem wearing a fake mustache.";
    }

    return null;
  }

  if (isOpen) {
    return `Your calendar is wide open on ${targetLabel}. According to what I see, time is all you got there too, so the fake 'I'm slammed' storyline can take the day off.`;
  }

  if (isLight) {
    return `${targetLabel} is pretty open. The calendar is not exactly suffocating, so let's not let fake urgency write the script.`;
  }

  return null;
};

const buildOpenDayRouteOptions = (
  input: PlannerBuildInput,
): string[] => {
  const workload = input.plannerContext.aiSignals?.suggestedWorkload ?? "normal";
  const options = [
    "Momentum day: one meaningful work block, some movement, one cleanup or admin win, and one relationship touchpoint.",
    "Money day: follow up, make something useful, ship one small thing, or do work that compounds.",
    "Reset day: clean up your space, get clear on priorities, and set the rest of the week up well.",
  ];

  if (workload === "light") {
    return [options[2], options[0], options[1]];
  }

  if (workload === "heavy") {
    return [options[1], options[0], options[2]];
  }

  return options;
};

const buildOpenDayReply = (
  input: PlannerBuildInput,
  targetDate: string,
): string | null => {
  const items = collectScheduleItemsForDate(input, targetDate, false);
  if (items.length > 0) return null;

  const scheduleLead = buildWittyAvailabilityCallout(input, targetDate) ?? (
    targetDate === input.currentDate
      ? "Your calendar's clear today."
      : `Your calendar's pretty open on ${
        formatScheduleReference(input.currentDate, targetDate, true)
      }.`
  );
  const optionLines = buildOpenDayRouteOptions(input)
    .map((option) => `- ${option}`)
    .join("\n");
  const purposeLead = isWittySassyTone(input.tonePack)
    ? "That gives us room to do something deliberate instead of free-styling chaos."
    : "That gives us room to shape the day on purpose.";
  const closer = isWittySassyTone(input.tonePack)
    ? "Pick a lane and I'll help you move without the fake-busy performance."
    : "Tell me which lane fits, and I'll help shape it.";

  return [
    scheduleLead,
    purposeLead,
    "A few solid directions we could take:",
    optionLines,
    closer,
  ].join("\n\n");
};

const buildUpcomingDigestReply = (input: PlannerBuildInput): string => {
  const tomorrow = addDaysToDateKey(input.currentDate, 1);
  const lead = isWittySassyTone(input.tonePack)
    ? `${buildWittyAvailabilityCallout(input, input.currentDate, true) ?? "Here's what's coming up, minus the dramatic retelling."}`
    : "Here's the shape of what's coming up.";
  const closer = isWittySassyTone(input.tonePack)
    ? "Tell me what actually matters, and I'll help cut the bullshit out of the schedule."
    : "Tell me what feels most important, and I'll help from there.";

  return [
    lead,
    buildDayDigest(input, input.currentDate, "Today", true),
    buildDayDigest(input, tomorrow, "Tomorrow"),
    closer,
  ].join("\n\n");
};

const buildMakeRoomStarterReply = (input: PlannerBuildInput): string => {
  const weekSummary = input.plannerContext.scheduleInsights?.summary ??
    "The week still has room to flex.";
  const lead = isWittySassyTone(input.tonePack)
    ? buildWittyAvailabilityCallout(input, input.currentDate, true)
      ?? "Here's the room I see right now, minus the decorative chaos."
    : "Here's the room I see right now.";
  const closer = isWittySassyTone(input.tonePack)
    ? "Tell me what actually matters, and I'll help make room for it without the decorative bullshit."
    : "Tell me what matters most, and I'll help make room for it.";

  return [
    lead,
    buildDayDigest(input, input.currentDate, "Today", true),
    `Week ahead: ${weekSummary}`,
    closer,
  ].join("\n\n");
};

const describeScheduleTarget = (
  currentDate: string,
  targetDate: string,
): { leadLabel: string; digestLabel: string } => {
  if (targetDate === currentDate) {
    return {
      leadLabel: "today",
      digestLabel: "Today",
    };
  }

  if (targetDate === addDaysToDateKey(currentDate, 1)) {
    return {
      leadLabel: "tomorrow",
      digestLabel: "Tomorrow",
    };
  }

  return {
    leadLabel: formatScheduleReference(currentDate, targetDate),
    digestLabel: formatScheduleReference(currentDate, targetDate, true),
  };
};

const buildDayOverviewReply = (
  input: PlannerBuildInput,
  targetDate: string,
): string => {
  const openDayReply = buildOpenDayReply(input, targetDate);
  if (openDayReply) return openDayReply;

  const { leadLabel, digestLabel } = describeScheduleTarget(
    input.currentDate,
    targetDate,
  );
  const lead = isWittySassyTone(input.tonePack)
    ? `Here's the shape of ${leadLabel}, without the self-serving mythology.`
    : `Here's the shape of ${leadLabel}.`;
  const closer = isWittySassyTone(input.tonePack)
    ? "Tell me what actually matters, and I'll help strip the bullshit out of the plan."
    : "Tell me what feels most important, and I'll help from there.";

  return [
    lead,
    buildDayDigest(input, targetDate, digestLabel),
    closer,
  ].join("\n\n");
};

const buildReadOnlyScheduleReply = (
  input: PlannerBuildInput,
  message: string,
): string => {
  if (
    isUpcomingDigestQuestion(message) &&
    !hasExplicitDateReference(message, input.parsedInput)
  ) {
    return buildUpcomingDigestReply(input);
  }

  const targetDate = parseRequestedDate(
    message,
    input.currentDate,
    input.parsedInput,
  );

  if (isAvailabilityQuestion(message)) {
    const dayPart = resolveDayPartRange(message);
    const freeWindows = buildFreeWindowsForDate(input, targetDate, dayPart)
      .slice(0, 3);
    const targetLabel = formatScheduleReference(
      input.currentDate,
      targetDate,
      true,
    );
    if (freeWindows.length === 0) {
      if (isWittySassyTone(input.tonePack)) {
        return dayPart
          ? `I don't see a clean ${dayPart.label} opening on ${targetLabel} yet. The calendar is being difficult, not mystical. If you want, I'll help drag the bullshit out of the schedule and make room.`
          : `I don't see a clear opening on ${targetLabel} yet. The calendar is being difficult, not mystical. If you want, I'll help drag the bullshit out of the schedule and make room.`;
      }

      return dayPart
        ? `I don't see a clean ${dayPart.label} opening on ${targetLabel} yet. I can still help you reshuffle quests around those blocks if you want.`
        : `I don't see a clear opening on ${targetLabel} yet. I can still help you reshuffle quests around those blocks if you want.`;
    }

    const windowsLabel = freeWindows.map((window) =>
      `${window.start}-${window.end}`
    ).join(", ");
    if (isWittySassyTone(input.tonePack)) {
      return dayPart
        ? `Your best ${dayPart.label} openings on ${targetLabel} are ${windowsLabel}. That's the actual room, not the dramatic retelling.`
        : `Your best openings on ${targetLabel} are ${windowsLabel}. That's the actual room, not the dramatic retelling.`;
    }

    return dayPart
      ? `Your best ${dayPart.label} openings on ${targetLabel} are ${windowsLabel}. That includes both Cosmiq quests and connected calendar events.`
      : `Your best openings on ${targetLabel} are ${windowsLabel}. That includes both Cosmiq quests and connected calendar events.`;
  }

  return buildDayOverviewReply(input, targetDate);
};

const buildAmbiguousEntityResponse = (
  label: string,
  choices: string[],
  sessionState: PlannerSessionState,
): PlannerBuildResult => ({
  mode: "conversational",
  reply:
    `I found a few ${label}s that could fit. Pick one and I'll keep the change scoped correctly.`,
  followUpQuestions: [question({
    field: "details",
    prompt: `Which ${label} did you mean?`,
    reason: "I do not want to move the wrong thing.",
    required: true,
    options: choices.slice(0, 6),
  })],
  proposals: [],
  suggestedReminders: [],
  memoryUpdates: {
    preferredTimeOfDay: sessionState.preferredTimeOfDay ?? null,
    preferredTimeReason: sessionState.preferredTimeReason ?? null,
    reminderPreference: sessionState.reminderPreference ?? null,
  },
  sessionState: {
    ...sessionState,
    openQuestionIds: ["details"],
    pendingStarterIntent: null,
  },
});

const buildReadOnlyResponse = (
  reply: string,
  sessionState: PlannerSessionState,
  mode: PlannerResponseMode = "conversational",
): PlannerBuildResult => ({
  mode,
  reply,
  followUpQuestions: [],
  proposals: [],
  suggestedReminders: [],
  memoryUpdates: {
    preferredTimeOfDay: sessionState.preferredTimeOfDay ?? null,
    preferredTimeReason: sessionState.preferredTimeReason ?? null,
    reminderPreference: sessionState.reminderPreference ?? null,
  },
  sessionState: {
    ...sessionState,
    openQuestionIds: [],
    pendingStarterIntent: null,
  },
});

const buildBatchQuestProposals = (
  input: PlannerBuildInput,
  targetDate: string,
  targetTime: string | null,
): PlannerProposal[] => {
  const sourceTasks = [
    ...input.plannerContext.tasks,
    ...input.plannerContext.inboxTasks,
  ]
    .filter((task) =>
      task.completed !== true && task.taskDate === input.currentDate
    );

  return sourceTasks.map((task) => ({
    id: createId(),
    kind: "update_quest" as const,
    title: `Move ${task.title}`,
    summary: `Move "${task.title}" to ${targetDate}${
      targetTime ? ` at ${targetTime}` : ""
    }.`,
    reasoning:
      "This reads like a batch reschedule request, so I'm preparing one confirmable quest update per matching quest.",
    payload: {
      taskId: task.id,
      updates: {
        task_date: targetDate,
        scheduled_time: targetTime ?? task.scheduledTime ?? undefined,
      },
    },
    status: "pending",
    readyToConfirm: true,
    missingFields: [],
  }));
};

const summarizePriorityScore = (score: PlannerPriorityScore): string => {
  if (score.reasons.length === 0) return score.title;
  if (score.reasons.length === 1) return `${score.title} because ${score.reasons[0]}.`;
  return `${score.title} because ${score.reasons[0]} and ${score.reasons[1]}.`;
};

const STAT_LABELS: Record<NonNullable<PlannerStatInterpretation["statProfile"]>["dominantStat"], string> = {
  vitality: "Vitality",
  wisdom: "Wisdom",
  discipline: "Discipline",
  resolve: "Resolve",
  creativity: "Creativity",
  alignment: "Alignment",
};

const getHighestStatNeed = (
  statInterpretation: PlannerStatInterpretation | undefined,
) => {
  if (!statInterpretation) return null;

  return Object.entries(statInterpretation.statNeeds)
    .sort((left, right) => {
      const weight = (level: string) => level === "high" ? 3 : level === "medium" ? 2 : 1;
      const diff = weight(right[1].level) - weight(left[1].level);
      if (diff !== 0) return diff;
      return right[1].reasons.length - left[1].reasons.length;
    })[0] ?? null;
};

const getCompanionInterpretationLead = (
  input: PlannerBuildInput,
): string | null => {
  const interpretation = input.plannerContext.statInterpretation;
  if (!interpretation) return null;

  const highestNeed = getHighestStatNeed(interpretation);
  const needLine = highestNeed && highestNeed[1].level !== "low"
    ? `${STAT_LABELS[highestNeed[0] as keyof typeof STAT_LABELS]} is the clearest rebalance need right now.`
    : null;

  return [interpretation.narrativeBrief, needLine].filter(Boolean).join(" ");
};

const buildRecoveryProposal = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
): PlannerBuildResult | null => {
  const vitalityNeed = input.plannerContext.statInterpretation?.statNeeds?.vitality;
  if (!vitalityNeed || vitalityNeed.level !== "high") return null;

  const alreadyHasRecoveryWork = [...input.plannerContext.tasks, ...input.plannerContext.inboxTasks]
    .some((task) =>
      task.taskDate === input.currentDate
      && /\b(recovery|reset|rest|walk|breath|breathe|pause|break)\b/i.test(task.title)
    );

  if (alreadyHasRecoveryWork) return null;

  const suggestedSlot = input.plannerContext.scheduleInsights?.suggestedSlots.find((slot) =>
    slot.date === input.currentDate
  ) ?? null;
  const interpretationLead = getCompanionInterpretationLead(input);
  const proposal: PlannerProposal = {
    id: createId(),
    kind: "create_quest",
    title: "Create Recovery reset block",
    summary: `Create a 30-minute recovery reset${suggestedSlot?.time ? ` at ${suggestedSlot.time}` : " today"}.`,
    reasoning: "Vitality is under pressure, so I'm turning recovery into a confirmable block instead of hoping it happens by accident.",
    payload: {
      taskText: "Recovery reset",
      difficulty: "easy",
      taskDate: input.currentDate,
      scheduledTime: suggestedSlot?.time ?? null,
      estimatedDuration: 30,
      source: "manual",
      category: "body",
      notes: vitalityNeed.reasons[0] ?? "Protect your energy before the rest of the day asks for more.",
    },
    status: "pending",
    readyToConfirm: true,
    missingFields: [],
  };

  return {
    mode: "proposal",
    reply: [
      interpretationLead,
      "You've been carrying a lot of load. I'm protecting your energy with a 30-minute reset block you can confirm if it feels right.",
    ].filter(Boolean).join(" "),
    followUpQuestions: [],
    proposals: [proposal],
    suggestedReminders: [],
    memoryUpdates: {
      preferredTimeOfDay: sessionState.preferredTimeOfDay ??
        input.plannerContext.plannerMemory?.preferredTimeOfDay ??
        null,
      preferredTimeReason: sessionState.preferredTimeReason ??
        input.plannerContext.plannerMemory?.preferredTimeReason ??
        null,
      reminderPreference: sessionState.reminderPreference ??
        (input.plannerContext.plannerMemory?.reminderMinutesBefore
          ? `${input.plannerContext.plannerMemory.reminderMinutesBefore} minutes`
          : null),
    },
    sessionState: {
      ...sessionState,
      openQuestionIds: [],
      pendingStarterIntent: null,
      lastClassification: classificationHint.type,
    },
  };
};

const buildPriorityOverviewResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
): PlannerBuildResult => {
  const priorityScores = getResolvedPriorityScores(input).slice(0, 4);
  if (priorityScores.length === 0) {
    return buildReadOnlyResponse(
      buildDayOverviewReply(input, input.currentDate),
      {
        ...sessionState,
        lastClassification: classificationHint.type,
      },
      "schedule_read",
    );
  }

  const starterIntent = getResolvedStarterIntent(input);
  const briefingFocus = input.plannerContext.briefingContext?.focus;
  const interpretationLead = getCompanionInterpretationLead(input);
  const lead = starterIntent === "what_matters"
    ? "If we strip the noise out, here's what matters most."
    : starterIntent === "make_room"
    ? "Here's what I would protect first so we can make room without breaking the day."
    : starterIntent === "briefing_followup"
    ? "Here's the planner read that follows from your briefing."
    : "Here's the cleanest read on today from the planner side.";
  const focusLead = briefingFocus
    ? `Briefing focus: ${briefingFocus}.`
    : null;
  const rankedLead = priorityScores
    .slice(0, 3)
    .map((score, index) => `${index + 1}. ${summarizePriorityScore(score)}`)
    .join("\n");

  return buildReadOnlyResponse(
    [
      interpretationLead,
      lead,
      focusLead,
      buildDayDigest(input, input.currentDate, "Today", true),
      `Top ranked next moves:\n${rankedLead}`,
    ].filter(Boolean).join("\n\n"),
    {
      ...sessionState,
      lastClassification: classificationHint.type,
    },
    "schedule_read",
  );
};

const buildRelationshipTouchResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
): PlannerBuildResult => {
  const contacts = input.plannerContext.contactsNeedingAttention ?? [];
  const targetContact = contacts[0] ?? null;
  if (!targetContact) {
    return buildReadOnlyResponse(
      "I do not see a cold or overdue relationship touchpoint right now. If you name someone anyway, I can still draft the quest.",
      {
        ...sessionState,
        lastClassification: classificationHint.type,
      },
      "schedule_read",
    );
  }

  const suggestedSlot = input.plannerContext.scheduleInsights?.suggestedSlots.find((slot) =>
    slot.date === input.currentDate
  ) ?? null;
  const interpretationLead = getCompanionInterpretationLead(input);
  const proposal: PlannerProposal = {
    id: createId(),
    kind: "create_quest",
    title: `Create Reach out to ${targetContact.name}`,
    summary: `Create a quest to reach out to "${targetContact.name}"${suggestedSlot?.time ? ` at ${suggestedSlot.time}` : " today"}.`,
    reasoning: targetContact.hasOverdueReminder
      ? "This contact already has an overdue reminder, so I am drafting the fastest clean follow-up."
      : "This relationship is going cold, so I am turning it into a concrete follow-up quest.",
    payload: {
      taskText: `Reach out to ${targetContact.name}`,
      difficulty: "easy",
      taskDate: input.currentDate,
      scheduledTime: suggestedSlot?.time ?? null,
      estimatedDuration: 15,
      source: "manual",
      contactId: targetContact.id,
      autoLogInteraction: true,
      notes: targetContact.reminderReason ?? undefined,
    },
    status: "pending",
    readyToConfirm: true,
    missingFields: [],
  };

  return {
    mode: "proposal",
    reply: [
      interpretationLead,
      `${targetContact.name} is the clearest relationship touch right now. I drafted a confirmable quest so you can follow through without overthinking it.`,
    ].filter(Boolean).join(" "),
    followUpQuestions: [],
    proposals: [proposal],
    suggestedReminders: [],
    memoryUpdates: {
      preferredTimeOfDay: sessionState.preferredTimeOfDay ??
        input.plannerContext.plannerMemory?.preferredTimeOfDay ??
        null,
      preferredTimeReason: sessionState.preferredTimeReason ??
        input.plannerContext.plannerMemory?.preferredTimeReason ??
        null,
      reminderPreference: sessionState.reminderPreference ??
        (input.plannerContext.plannerMemory?.reminderMinutesBefore
          ? `${input.plannerContext.plannerMemory.reminderMinutesBefore} minutes`
          : null),
    },
    sessionState: {
      ...sessionState,
      openQuestionIds: [],
      pendingStarterIntent: null,
      lastClassification: classificationHint.type,
    },
  };
};

const buildFreeUpAfterResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
): PlannerBuildResult | null => {
  const cutoff = parseAfterTimeCutoff(input.message);
  if (!cutoff) return null;

  const cutoffMinutes = parseTimeToMinutes(cutoff);
  if (cutoffMinutes === null) return null;

  const targetDate = parseRequestedDate(input.message, input.currentDate, input.parsedInput);
  const nextDate = addDaysToDateKey(targetDate, 1);
  const candidateTasks = [...input.plannerContext.tasks, ...input.plannerContext.inboxTasks]
    .filter((task) => task.completed !== true && task.taskDate === targetDate)
    .filter((task) => {
      const scheduledMinutes = parseTimeToMinutes(task.scheduledTime);
      return scheduledMinutes !== null && scheduledMinutes >= cutoffMinutes;
    });

  if (candidateTasks.length === 0) {
    return buildReadOnlyResponse(
      `I do not see any scheduled Cosmiq quests after ${cutoff} on ${targetDate}, so there is nothing to clear yet.`,
      {
        ...sessionState,
        lastClassification: classificationHint.type,
      },
      "schedule_read",
    );
  }

  const proposals = candidateTasks.map((task) => ({
    id: createId(),
    kind: "update_quest" as const,
    title: `Move ${task.title}`,
    summary: `Move "${task.title}" off ${targetDate} after ${cutoff} and into ${nextDate}.`,
    reasoning: "You asked to free up the back half of the day, so I am shifting the quests that live after that cutoff.",
    payload: {
      taskId: task.id,
      updates: {
        task_date: nextDate,
        scheduled_time: task.scheduledTime ?? undefined,
      },
    },
    status: "pending" as const,
    readyToConfirm: true,
    missingFields: [],
  }));

  return {
    mode: "proposal",
    reply: `I drafted ${proposals.length} quest move${proposals.length === 1 ? "" : "s"} to clear your schedule after ${cutoff}. Review them and confirm if that lineup works.`,
    followUpQuestions: [],
    proposals,
    suggestedReminders: [],
    memoryUpdates: {
      preferredTimeOfDay: sessionState.preferredTimeOfDay ??
        input.plannerContext.plannerMemory?.preferredTimeOfDay ??
        null,
      preferredTimeReason: sessionState.preferredTimeReason ??
        input.plannerContext.plannerMemory?.preferredTimeReason ??
        null,
      reminderPreference: sessionState.reminderPreference ??
        (input.plannerContext.plannerMemory?.reminderMinutesBefore
          ? `${input.plannerContext.plannerMemory.reminderMinutesBefore} minutes`
          : null),
    },
    sessionState: {
      ...sessionState,
      draft: {
        ...sessionState.draft,
        draftKind: "update_quest",
        scheduledDate: nextDate,
      },
      openQuestionIds: [],
      pendingStarterIntent: null,
      lastClassification: classificationHint.type,
    },
  };
};

const buildLowEnergyAdjustmentResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
): PlannerBuildResult => {
  const scoredTasks = getResolvedPriorityScores(input)
    .filter((score) => score.kind === "task" && score.taskId)
    .map((score) => ({
      score,
      task: [...input.plannerContext.tasks, ...input.plannerContext.inboxTasks]
        .find((task) => task.id === score.taskId) ?? null,
    }))
    .filter((entry): entry is { score: PlannerPriorityScore; task: PlannerContextTask } => Boolean(entry.task))
    .filter((entry) => entry.task.taskDate === input.currentDate);

  const protectedTaskIds = new Set(
    scoredTasks
      .filter((entry, index) =>
        index < 1 || entry.task.habitSourceId || entry.task.priority === "high"
      )
      .map((entry) => entry.task.id),
  );
  const moveCandidates = scoredTasks
    .filter((entry) => !protectedTaskIds.has(entry.task.id))
    .slice(0, 4);

  if (moveCandidates.length === 0) {
    const recoveryProposal = buildRecoveryProposal(input, sessionState, classificationHint);
    if (recoveryProposal) {
      return recoveryProposal;
    }

    return buildReadOnlyResponse(
      [
        getCompanionInterpretationLead(input),
        "Today is already pretty lean from the Cosmiq side. I would keep the current plan and just protect the top one or two moves.",
      ].filter(Boolean).join(" "),
      {
        ...sessionState,
        lastClassification: classificationHint.type,
      },
      "schedule_read",
    );
  }

  const nextDate = addDaysToDateKey(input.currentDate, 1);
  const proposals = moveCandidates.map(({ task }) => ({
    id: createId(),
    kind: "update_quest" as const,
    title: `Move ${task.title}`,
    summary: `Move "${task.title}" to ${nextDate} so today stays lighter.`,
    reasoning: "You asked for a lighter day, so I am preserving the strongest moves and pushing the lower-priority work out.",
    payload: {
      taskId: task.id,
      updates: {
        task_date: nextDate,
        scheduled_time: task.scheduledTime ?? undefined,
      },
    },
    status: "pending" as const,
    readyToConfirm: true,
    missingFields: [],
  }));

  return {
    mode: "proposal",
    reply: [
      getCompanionInterpretationLead(input),
      `I drafted ${proposals.length} move${proposals.length === 1 ? "" : "s"} to lighten today while protecting the strongest priorities. Review them and confirm what you want to keep.`,
    ].filter(Boolean).join(" "),
    followUpQuestions: [],
    proposals,
    suggestedReminders: [],
    memoryUpdates: {
      preferredTimeOfDay: sessionState.preferredTimeOfDay ??
        input.plannerContext.plannerMemory?.preferredTimeOfDay ??
        null,
      preferredTimeReason: sessionState.preferredTimeReason ??
        input.plannerContext.plannerMemory?.preferredTimeReason ??
        null,
      reminderPreference: sessionState.reminderPreference ??
        (input.plannerContext.plannerMemory?.reminderMinutesBefore
          ? `${input.plannerContext.plannerMemory.reminderMinutesBefore} minutes`
          : null),
    },
    sessionState: {
      ...sessionState,
      draft: {
        ...sessionState.draft,
        draftKind: "update_quest",
        scheduledDate: nextDate,
      },
      openQuestionIds: [],
      pendingStarterIntent: null,
      lastClassification: classificationHint.type,
    },
  };
};

const composeReply = (
  input: PlannerBuildInput,
  tonePack: PlannerTonePack,
  kind: PlannerProposalKind,
  readyToConfirm: boolean,
): string => {
  const baseLabel = ({
    create_quest: "quest",
    update_quest: "quest edit",
    create_campaign: "campaign",
    update_campaign: "campaign edit",
    adjust_campaign_plan: "campaign adjustment",
    create_ritual: "campaign ritual",
    update_ritual: "ritual edit",
    suggest_reminder: "reminder tweak",
  })[kind];
  const scheduleSummary = input.plannerContext.scheduleInsights?.summary;
  const interpretationLead = getCompanionInterpretationLead(input);
  const preferredTimeOfDay = input.plannerContext.plannerMemory
    ?.preferredTimeOfDay;
  const memoryLead = preferredTimeOfDay
    ? `You usually land work like this in the ${preferredTimeOfDay}. `
    : "";
  const scheduleLead = scheduleSummary ? `${scheduleSummary} ` : "";

  if (isWittySassyTone(tonePack)) {
    if (readyToConfirm) {
      return `${interpretationLead ? `${interpretationLead} ` : ""}${scheduleLead}I drafted this as a ${baseLabel}. Review it, confirm it if it holds up, and spare me the fake ceremony.`;
    }

    return `${interpretationLead ? `${interpretationLead} ` : ""}${scheduleLead}${memoryLead}I can shape this into a ${baseLabel}, but I need one real detail before we dress vague intentions up like a finished plan.`;
  }

  if (readyToConfirm) {
    return `${interpretationLead ? `${interpretationLead} ` : ""}${scheduleLead}I drafted this as a ${baseLabel}. Take a look, and confirm it if it fits.`;
  }

  return `${interpretationLead ? `${interpretationLead} ` : ""}${scheduleLead}${memoryLead}I can help shape this into a ${baseLabel}. First I need one quick detail.`;
};

const buildConversationalResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
): PlannerBuildResult => {
  const message = input.message.toLowerCase();
  const scheduleSummary = input.plannerContext.scheduleInsights?.summary;
  const scheduleLead =
    /\b(today|tomorrow|week|calendar|schedule)\b/i.test(message) &&
      scheduleSummary
      ? `${scheduleSummary} `
      : "";

  return {
    mode: "conversational",
    reply:
      isWittySassyTone(input.tonePack)
        ? `${scheduleLead}I'm with you. Tell me what actually matters, or point at the bullshit and I'll help turn it into a draft quest or campaign.`
        : `${scheduleLead}I'm here with you. Tell me what feels most important, or ask me to turn it into a draft quest or campaign when you're ready.`,
    followUpQuestions: [],
    proposals: [],
    suggestedReminders: [],
    memoryUpdates: {
      preferredTimeOfDay: sessionState.preferredTimeOfDay ??
        input.plannerContext.plannerMemory?.preferredTimeOfDay ?? null,
      preferredTimeReason: sessionState.preferredTimeReason ??
        input.plannerContext.plannerMemory?.preferredTimeReason ?? null,
      reminderPreference: sessionState.reminderPreference ??
        (input.plannerContext.plannerMemory?.reminderMinutesBefore
          ? `${input.plannerContext.plannerMemory.reminderMinutesBefore} minutes`
          : null),
    },
    sessionState: {
      ...sessionState,
      openQuestionIds: [],
      pendingStarterIntent: null,
      lastClassification: classificationHint.type,
    },
  };
};

const buildGoalBreakdownStarterResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
): PlannerBuildResult => ({
  mode: "conversational",
  reply:
    isWittySassyTone(input.tonePack)
      ? "Name the goal. The real one, not the cinematic fog machine version, and I'll break it into steps that can survive contact with reality."
      : "Name the goal you want to break down, and I'll help turn it into concrete steps.",
  followUpQuestions: [],
  proposals: [],
  suggestedReminders: [],
  memoryUpdates: {
    preferredTimeOfDay: sessionState.preferredTimeOfDay ??
      input.plannerContext.plannerMemory?.preferredTimeOfDay ?? null,
    preferredTimeReason: sessionState.preferredTimeReason ??
      input.plannerContext.plannerMemory?.preferredTimeReason ?? null,
    reminderPreference: sessionState.reminderPreference ??
      (input.plannerContext.plannerMemory?.reminderMinutesBefore
        ? `${input.plannerContext.plannerMemory.reminderMinutesBefore} minutes`
        : null),
  },
  sessionState: {
    ...sessionState,
    draft: {},
    openQuestionIds: [],
    pendingStarterIntent: "goal_breakdown_start",
    lastClassification: classificationHint.type,
  },
});

const buildUpcomingStarterResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
): PlannerBuildResult => ({
  mode: "conversational",
  reply: UPCOMING_STARTER_WINDOW_PROMPT,
  followUpQuestions: [],
  proposals: [],
  suggestedReminders: [],
  memoryUpdates: {
    preferredTimeOfDay: sessionState.preferredTimeOfDay ??
      input.plannerContext.plannerMemory?.preferredTimeOfDay ?? null,
    preferredTimeReason: sessionState.preferredTimeReason ??
      input.plannerContext.plannerMemory?.preferredTimeReason ?? null,
    reminderPreference: sessionState.reminderPreference ??
      (input.plannerContext.plannerMemory?.reminderMinutesBefore
        ? `${input.plannerContext.plannerMemory.reminderMinutesBefore} minutes`
        : null),
  },
  sessionState: {
    ...sessionState,
    draft: {},
    openQuestionIds: [],
    pendingStarterIntent: "upcoming_start",
    lastClassification: classificationHint.type,
  },
});

const buildQuestCaptureStarterResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
): PlannerBuildResult => ({
  mode: "conversational",
  reply:
    isWittySassyTone(input.tonePack)
      ? "Tell me the quest and when you want it to happen. Give me both, and I won't waste your time pretending that counts as complexity."
      : "Tell me the quest you want to create and when you want it scheduled.",
  followUpQuestions: [],
  proposals: [],
  suggestedReminders: [],
  memoryUpdates: {
    preferredTimeOfDay: sessionState.preferredTimeOfDay ??
      input.plannerContext.plannerMemory?.preferredTimeOfDay ?? null,
    preferredTimeReason: sessionState.preferredTimeReason ??
      input.plannerContext.plannerMemory?.preferredTimeReason ?? null,
    reminderPreference: sessionState.reminderPreference ??
      (input.plannerContext.plannerMemory?.reminderMinutesBefore
        ? `${input.plannerContext.plannerMemory.reminderMinutesBefore} minutes`
        : null),
  },
  sessionState: {
    ...sessionState,
    draft: {
      draftKind: "create_quest",
    },
    openQuestionIds: [],
    pendingStarterIntent: "quest_capture",
    lastClassification: classificationHint.type,
  },
});

const buildIntentFirstResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
): PlannerBuildResult => ({
  mode: "conversational",
  reply:
    isWittySassyTone(input.tonePack)
      ? "Tell me what you actually want done. Once we stop flirting with vagueness, I'll look at what's open."
      : "Let's start with what you want to get done. Once I have that, I'll look at what's open.",
  followUpQuestions: [question({
    field: "details",
    prompt: "What do you want to get done?",
    reason:
      "Once you name the goal, I'll look at what's open and shape the plan around it.",
    required: true,
  })],
  proposals: [],
  suggestedReminders: [],
  memoryUpdates: {
    preferredTimeOfDay: sessionState.preferredTimeOfDay ??
      input.plannerContext.plannerMemory?.preferredTimeOfDay ?? null,
    preferredTimeReason: sessionState.preferredTimeReason ??
      input.plannerContext.plannerMemory?.preferredTimeReason ?? null,
    reminderPreference: sessionState.reminderPreference ??
      (input.plannerContext.plannerMemory?.reminderMinutesBefore
        ? `${input.plannerContext.plannerMemory.reminderMinutesBefore} minutes`
        : null),
  },
  sessionState: {
    ...sessionState,
    draft: {},
    openQuestionIds: ["details"],
    pendingStarterIntent: null,
    lastClassification: classificationHint.type,
  },
});

const inferClassification = (
  message: string,
  repeated: boolean,
): ClassificationHint => {
  if (
    /\b(license|exam|launch|build|learn|train for|prepare for|by [a-z]+|\bin \d+ (weeks?|months?)\b)\b/i
      .test(message)
  ) {
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

export function buildPlannerResponse(
  input: PlannerBuildInput,
): PlannerBuildResult {
  const normalizedParsedInput = normalizeParsedInput(input);
  const resolvedInput = withResolvedTimeQuestionAnswer({
    ...input,
    parsedInput: normalizedParsedInput,
  });
  const repeated = isRepeatedIntent(
    resolvedInput.message,
    resolvedInput.parsedInput,
  );
  const classificationHint = resolvedInput.classificationHint ??
    inferClassification(resolvedInput.message, repeated);
  const matched = findMatchedEntities(
    resolvedInput.message,
    resolvedInput.plannerContext,
  );
  const starterIntent = getResolvedStarterIntent(resolvedInput);
  const pendingStarterIntent = resolvedInput.sessionState.pendingStarterIntent ?? null;

  const freeUpAfterResponse = buildFreeUpAfterResponse(
    resolvedInput,
    resolvedInput.sessionState,
    classificationHint,
  );
  if (freeUpAfterResponse) {
    return freeUpAfterResponse;
  }

  if (starterIntent === "upcoming_start") {
    return buildUpcomingStarterResponse(
      resolvedInput,
      resolvedInput.sessionState,
      classificationHint,
    );
  }

  if (starterIntent === "quest_capture") {
    return buildQuestCaptureStarterResponse(
      resolvedInput,
      resolvedInput.sessionState,
      classificationHint,
    );
  }

  if (starterIntent === "goal_breakdown_start") {
    return buildGoalBreakdownStarterResponse(
      resolvedInput,
      resolvedInput.sessionState,
      classificationHint,
    );
  }

  if (pendingStarterIntent === "upcoming_start") {
    const followUpMessage = resolveUpcomingStarterFollowUpMessage(
      resolvedInput.message,
    );
    const followUpInput = {
      ...resolvedInput,
      message: followUpMessage,
    };

    return buildReadOnlyResponse(
      buildReadOnlyScheduleReply(followUpInput, followUpMessage),
      {
        ...resolvedInput.sessionState,
        pendingStarterIntent: null,
        lastClassification: classificationHint.type,
      },
      "schedule_read",
    );
  }

  if (starterIntent === "low_energy_adjust") {
    return buildLowEnergyAdjustmentResponse(
      resolvedInput,
      resolvedInput.sessionState,
      classificationHint,
    );
  }

  if (isScheduleQuestion(resolvedInput.message)) {
    return buildReadOnlyResponse(
      buildReadOnlyScheduleReply(resolvedInput, resolvedInput.message),
      {
        ...resolvedInput.sessionState,
        lastClassification: classificationHint.type,
      },
      "schedule_read",
    );
  }

  if (starterIntent === "goal_breakdown" || isBreakBigGoalStarterIntent(resolvedInput.message)) {
    return buildGoalBreakdownStarterResponse(
      resolvedInput,
      resolvedInput.sessionState,
      classificationHint,
    );
  }

  if (
    starterIntent === "plan_day" ||
    starterIntent === "make_room" ||
    starterIntent === "what_matters" ||
    starterIntent === "briefing_followup"
  ) {
    return buildPriorityOverviewResponse(
      resolvedInput,
      resolvedInput.sessionState,
      classificationHint,
    );
  }

  if (starterIntent === "relationship_touch") {
    return buildRelationshipTouchResponse(
      resolvedInput,
      resolvedInput.sessionState,
      classificationHint,
    );
  }

  if (isMakeRoomStarterIntent(resolvedInput.message)) {
    return buildReadOnlyResponse(
      buildMakeRoomStarterReply(resolvedInput),
      {
        ...resolvedInput.sessionState,
        lastClassification: classificationHint.type,
      },
      "schedule_read",
    );
  }

  if (isVaguePlanningPrompt(resolvedInput, matched, repeated)) {
    return buildIntentFirstResponse(
      resolvedInput,
      resolvedInput.sessionState,
      classificationHint,
    );
  }

  if (
    looksConversational(resolvedInput, matched, repeated, classificationHint)
  ) {
    return buildConversationalResponse(
      resolvedInput,
      resolvedInput.sessionState,
      classificationHint,
    );
  }

  if (
    isEditIntent(resolvedInput.message) && matched.tasks.length > 1 &&
    !isQuestCollectionIntent(resolvedInput.message)
  ) {
    return buildAmbiguousEntityResponse(
      "quest",
      matched.tasks.map((task) => task.title),
      {
        ...resolvedInput.sessionState,
        lastClassification: classificationHint.type,
      },
    );
  }

  if (
    (parseRenameTitle(resolvedInput.message) ||
      isCampaignAdjustmentIntent(resolvedInput.message)) &&
    matched.epics.length > 1
  ) {
    return buildAmbiguousEntityResponse(
      "campaign",
      matched.epics.map((epic) => epic.title),
      {
        ...resolvedInput.sessionState,
        lastClassification: classificationHint.type,
      },
    );
  }

  if (
    isEditIntent(resolvedInput.message) &&
    matched.tasks.length === 0 &&
    matched.calendarEvents.length > 0 &&
    !isQuestCollectionIntent(resolvedInput.message)
  ) {
    return buildReadOnlyResponse(
      `I found the connected calendar event "${
        matched.calendarEvents[0]?.title ?? "that event"
      }", but external calendar events are read-only here for now. I can still move your Cosmiq quests around it if you want.`,
      {
        ...resolvedInput.sessionState,
        lastClassification: classificationHint.type,
      },
    );
  }

  if (
    isEditIntent(resolvedInput.message) &&
    isQuestCollectionIntent(resolvedInput.message)
  ) {
    const targetDate = parseRequestedDate(
      resolvedInput.message,
      resolvedInput.currentDate,
      resolvedInput.parsedInput,
    );
    const proposals = buildBatchQuestProposals(
      resolvedInput,
      targetDate,
      resolvedInput.parsedInput?.scheduledTime ?? null,
    );

    if (proposals.length === 0) {
      return buildReadOnlyResponse(
        `I do not see any matching Cosmiq quests on ${resolvedInput.currentDate} to move yet.`,
        {
          ...resolvedInput.sessionState,
          lastClassification: classificationHint.type,
        },
      );
    }

    return {
      mode: "proposal",
      reply: `I pulled together ${proposals.length} quest move${
        proposals.length === 1 ? "" : "s"
      } for ${targetDate}. Review them and use confirm all when you're ready.`,
      followUpQuestions: [],
      proposals,
      suggestedReminders: [],
      memoryUpdates: {
        preferredTimeOfDay: resolvedInput.sessionState.preferredTimeOfDay ??
          resolvedInput.plannerContext.plannerMemory?.preferredTimeOfDay ??
          null,
        preferredTimeReason: resolvedInput.sessionState.preferredTimeReason ??
          resolvedInput.plannerContext.plannerMemory?.preferredTimeReason ??
          null,
        reminderPreference: resolvedInput.sessionState.reminderPreference ??
          (resolvedInput.plannerContext.plannerMemory?.reminderMinutesBefore
            ? `${resolvedInput.plannerContext.plannerMemory.reminderMinutesBefore} minutes`
            : null),
      },
      sessionState: {
        ...resolvedInput.sessionState,
        draft: {
          ...resolvedInput.sessionState.draft,
          draftKind: "update_quest",
          scheduledDate: targetDate,
          scheduledTime: resolvedInput.parsedInput?.scheduledTime ?? null,
        },
        openQuestionIds: [],
        pendingStarterIntent: null,
        lastClassification: classificationHint.type,
      },
    };
  }

  const draft = mergeDraft({ ...resolvedInput, classificationHint }, matched);
  const cadence = resolveCadence(
    resolvedInput.message,
    resolvedInput.parsedInput,
  );

  if (!draft.epicId && draft.epicTitle) {
    const matchingEpic = resolvedInput.plannerContext.activeEpics.find((epic) =>
      normalizeText(epic.title) === normalizeText(draft.epicTitle)
    );
    if (matchingEpic) {
      draft.epicId = matchingEpic.id;
      draft.epicTitle = matchingEpic.title;
    }
  }

  const kind = resolveKind(
    { ...resolvedInput, classificationHint },
    draft,
    matched,
    repeated,
  );
  draft.draftKind = kind;

  const proposal = kind === "adjust_campaign_plan" && matched.epic
    ? buildCampaignAdjustmentProposal(
      { ...resolvedInput, classificationHint },
      draft,
      matched.epic,
    )
    : kind === "suggest_reminder" && matched.task
    ? buildReminderProposal(
      { ...resolvedInput, classificationHint },
      draft,
      matched.task,
    )
    : kind === "create_campaign" || kind === "update_campaign"
    ? buildCampaignProposal(
      { ...resolvedInput, classificationHint },
      draft,
      cadence,
      kind,
      matched.epic,
    )
    : kind === "create_ritual" || kind === "update_ritual"
    ? buildRitualProposal(
      { ...resolvedInput, classificationHint },
      draft,
      cadence,
      kind,
      matched.ritual,
    )
    : buildQuestProposal(
      { ...resolvedInput, classificationHint },
      draft,
      cadence,
      kind as "create_quest" | "update_quest",
      matched.task,
    );

  const followUpQuestions = buildFollowUpQuestions(
    { ...resolvedInput, classificationHint },
    kind,
    draft,
    cadence,
  );
  const missingFields = missingFieldsForKind(
    resolvedInput,
    kind,
    draft,
    cadence,
  );
  proposal.readyToConfirm = followUpQuestions.length === 0 &&
    missingFields.length === 0;
  proposal.missingFields = missingFields;

  const memoryUpdates = {
    preferredTimeOfDay: draft.timeOfDay ??
      resolvedInput.sessionState.preferredTimeOfDay ??
      resolvedInput.plannerContext.plannerMemory?.preferredTimeOfDay ??
      null,
    preferredTimeReason: draft.timeReason ??
      resolvedInput.sessionState.preferredTimeReason ??
      resolvedInput.plannerContext.plannerMemory?.preferredTimeReason ??
      null,
    reminderPreference: draft.reminderMinutesBefore !== null
      ? `${draft.reminderMinutesBefore} minutes`
      : resolvedInput.sessionState.reminderPreference ??
        (resolvedInput.plannerContext.plannerMemory?.reminderMinutesBefore
          ? `${resolvedInput.plannerContext.plannerMemory.reminderMinutesBefore} minutes`
          : null),
  };

  return {
    mode: "proposal",
    reply: composeReply(
      resolvedInput,
      resolvedInput.tonePack,
      proposal.kind,
      proposal.readyToConfirm,
    ),
    followUpQuestions,
    proposals: [proposal],
    suggestedReminders: [],
    memoryUpdates,
    sessionState: {
      ...resolvedInput.sessionState,
      draft,
      openQuestionIds: followUpQuestions.map((question) => question.id),
      pendingStarterIntent: null,
      preferredTimeOfDay: memoryUpdates.preferredTimeOfDay,
      preferredTimeReason: memoryUpdates.preferredTimeReason,
      reminderPreference: memoryUpdates.reminderPreference,
      lastClassification: classificationHint.type,
    },
  };
}
