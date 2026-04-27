import { parseNaturalLanguage } from "../../../src/shared/naturalLanguageTaskParser.ts";
import {
  extractActionBundleCandidates,
  type ExtractedActionBundleCandidate,
  hasDayShapingLanguage,
} from "../../../src/shared/actionBundleScheduling.ts";
import type {
  PlannerOptimizerTaskToSchedule,
  PlannerTaskTimingLabel,
} from "../../../src/shared/plannerOptimizer.ts";
import {
  normalizeBundlePriority,
  normalizePlannerScorePriority,
} from "../../../src/shared/plannerScoringPolicy.ts";
import {
  cleanGeneratedTaskTitle,
  formatGeneratedTaskTitle,
} from "../../../src/shared/taskTitleNormalization.ts";
import { analyzeSchedulingIntent } from "../../../src/shared/schedulingIntent.ts";
import { computePlannerPriorityScores } from "../../../src/shared/companionPlannerPriority.ts";
import {
  fitPlannerDurationBucketWithin,
  normalizePlannerDurationBucket,
} from "../_shared/plannerDurationBuckets.ts";
import {
  buildAssistantEventScheduleLabel,
  buildAssistantTaskScheduleLabel,
  formatAssistantTime,
  formatAssistantTimeRange,
  normalizeAssistantTimeText,
} from "../_shared/assistantScheduleCopy.ts";
import type {
  CompanionCampaignStatus,
  CompanionDayAssessment,
  CompanionIntentMetadata,
  CompanionMissedItem,
  PlannerContract,
  PlannerReasonCode,
  CompanionScheduleItem,
  CompanionStructuredResponse,
  CompanionSuggestedQuest,
  CompanionSuggestedQuestSource,
  CompanionTomorrowSummary,
} from "../../../src/shared/companionStructuredOutput.ts";

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
  | "plan_week"
  | "advance_campaign_start"
  | "right_now_start"
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
  suggestedType?: CompanionSuggestedQuest["type"];
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
  actualDurationMinutes?: number | null;
  actualTimeSpent?: number | null;
  notes?: string | null;
  subtaskTitles?: string[];
  difficulty?: string | null;
  flexibility?: "fixed" | "preferred" | "flexible" | null;
  energyType?: "deep" | "admin" | "physical" | "errand" | "social" | "creative" | "recovery" | null;
  mustCalendarBlock?: boolean | null;
  deadlineAt?: string | null;
  recurrencePattern: string | null;
  recurrenceEndDate?: string | null;
  completed?: boolean | null;
  completedAt?: string | null;
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
  estimatedMinutes?: number | null;
  actualDurationMinutes?: number | null;
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
  dialogueTone:
    | "joyful"
    | "content"
    | "neutral"
    | "reserved"
    | "quiet"
    | "silent";
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
  summary?: string;
}

export interface PlannerMemoryProfile {
  tonePack?: PlannerTonePack;
  scheduleArchetype?:
    | "nine_to_five"
    | "business_owner"
    | "after_work_builder"
    | "student"
    | "variable_schedule"
    | "flexible_transition"
    | null;
  scheduleArchetypeLabel?: string | null;
  scheduleArchetypePlanningHint?: string | null;
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
    dominantStat:
      | "vitality"
      | "wisdom"
      | "discipline"
      | "resolve"
      | "creativity"
      | "alignment";
    secondaryStat:
      | "vitality"
      | "wisdom"
      | "discipline"
      | "resolve"
      | "creativity"
      | "alignment";
  };
  statNeeds: Record<
    | "vitality"
    | "wisdom"
    | "discipline"
    | "resolve"
    | "creativity"
    | "alignment",
    {
      level: "low" | "medium" | "high";
      reasons: string[];
    }
  >;
  momentumState: "locked_in" | "coasting" | "slipping" | "rebuilding";
  recentMissInterpretation:
    | "overload"
    | "low_energy"
    | "avoidance"
    | "interruption"
    | "normal_variance";
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
  suggestedActivityDurationMinutes?: number;
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
    recentCompletedTasks?: PlannerContextTask[];
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
  timezone?: string;
}

export interface PlannerBuildResult {
  mode: PlannerResponseMode;
  reply: string;
  plannerContract?: PlannerContract;
  followUpQuestions: PlannerQuestion[];
  proposals: PlannerProposal[];
  suggestedReminders: PlannerProposal[];
  structuredResponse?: CompanionStructuredResponse | null;
  memoryUpdates: {
    preferredTimeOfDay?: string | null;
    preferredTimeReason?: string | null;
    reminderPreference?: string | null;
  };
  sessionState: PlannerSessionState;
}

const normalizePlannerDisplayText = <T extends string | null | undefined>(
  value: T,
): T => {
  if (typeof value !== "string") return value;
  return normalizeAssistantTimeText(value) as T;
};

export const normalizePlannerBuildResultText = (
  result: PlannerBuildResult,
): PlannerBuildResult => ({
  ...result,
  reply: normalizePlannerDisplayText(result.reply),
  followUpQuestions: result.followUpQuestions.map((question) => ({
    ...question,
    prompt: normalizePlannerDisplayText(question.prompt),
    reason: normalizePlannerDisplayText(question.reason),
  })),
  proposals: result.proposals.map((proposal) => ({
    ...proposal,
    summary: normalizePlannerDisplayText(proposal.summary),
  })),
  structuredResponse: result.structuredResponse
    ? {
      ...result.structuredResponse,
      planDay: result.structuredResponse.planDay
        ? {
          ...result.structuredResponse.planDay,
          message: normalizePlannerDisplayText(result.reply),
          campaignFocus: result.structuredResponse.planDay.campaignFocus
            ? {
              ...result.structuredResponse.planDay.campaignFocus,
              campaignTitle: normalizePlannerDisplayText(
                result.structuredResponse.planDay.campaignFocus
                  .campaignTitle,
              ),
              campaignReason: normalizePlannerDisplayText(
                result.structuredResponse.planDay.campaignFocus
                  .campaignReason,
              ),
              focusItems: result.structuredResponse.planDay.campaignFocus
                .focusItems.map((item) => normalizePlannerDisplayText(item)),
            }
            : result.structuredResponse.planDay.campaignFocus,
          suggestedQuests: result.structuredResponse.planDay.suggestedQuests
            .map((quest) => ({
              ...quest,
              title: normalizePlannerDisplayText(quest.title),
              estimatedDuration: normalizePlannerDisplayText(
                quest.estimatedDuration,
              ),
              reason: normalizePlannerDisplayText(quest.reason),
            })),
        }
        : result.structuredResponse.planDay,
      weeklyPlan: result.structuredResponse.weeklyPlan
        ? {
          ...result.structuredResponse.weeklyPlan,
          message: normalizePlannerDisplayText(result.reply),
          weeklyTheme: normalizePlannerDisplayText(
            result.structuredResponse.weeklyPlan.weeklyTheme,
          ),
          focusCampaignTitle: normalizePlannerDisplayText(
            result.structuredResponse.weeklyPlan.focusCampaignTitle,
          ),
          focusCampaignReason: normalizePlannerDisplayText(
            result.structuredResponse.weeklyPlan.focusCampaignReason,
          ),
          topPriorities: result.structuredResponse.weeklyPlan.topPriorities.map(
            (quest) => ({
              ...quest,
              title: normalizePlannerDisplayText(quest.title),
              estimatedDuration: normalizePlannerDisplayText(
                quest.estimatedDuration,
              ),
              reason: normalizePlannerDisplayText(quest.reason),
            }),
          ),
          busyDays: result.structuredResponse.weeklyPlan.busyDays.map(
            normalizePlannerDisplayText,
          ),
          openDays: result.structuredResponse.weeklyPlan.openDays.map(
            normalizePlannerDisplayText,
          ),
        }
        : result.structuredResponse.weeklyPlan,
      priorityOverview: result.structuredResponse.priorityOverview
        ? {
          ...result.structuredResponse.priorityOverview,
          title: normalizePlannerDisplayText(
            result.structuredResponse.priorityOverview.title,
          ),
          message: normalizePlannerDisplayText(result.reply),
          campaignPressure: normalizePlannerDisplayText(
            result.structuredResponse.priorityOverview.campaignPressure,
          ),
          focusCampaignTitle: normalizePlannerDisplayText(
            result.structuredResponse.priorityOverview.focusCampaignTitle,
          ),
          topPriorities: result.structuredResponse.priorityOverview
            .topPriorities
            .map((quest) => ({
              ...quest,
              title: normalizePlannerDisplayText(quest.title),
              estimatedDuration: normalizePlannerDisplayText(
                quest.estimatedDuration,
              ),
              reason: normalizePlannerDisplayText(quest.reason),
            })),
        }
        : result.structuredResponse.priorityOverview,
      reflectionBridge: result.structuredResponse.reflectionBridge
        ? {
          ...result.structuredResponse.reflectionBridge,
          message: normalizePlannerDisplayText(result.reply),
          carryForward: normalizePlannerDisplayText(
            result.structuredResponse.reflectionBridge.carryForward,
          ),
          firstAction: result.structuredResponse.reflectionBridge.firstAction
            ? {
              ...result.structuredResponse.reflectionBridge.firstAction,
              title: normalizePlannerDisplayText(
                result.structuredResponse.reflectionBridge.firstAction.title,
              ),
              estimatedDuration: normalizePlannerDisplayText(
                result.structuredResponse.reflectionBridge.firstAction
                  .estimatedDuration,
              ),
              reason: normalizePlannerDisplayText(
                result.structuredResponse.reflectionBridge.firstAction.reason,
              ),
            }
            : null,
          tomorrowSchedule: result.structuredResponse.reflectionBridge
            .tomorrowSchedule.map(
              (item) => ({
                ...item,
                title: normalizePlannerDisplayText(item.title),
                label: normalizePlannerDisplayText(item.label),
              }),
            ),
        }
        : result.structuredResponse.reflectionBridge,
      comingUp: result.structuredResponse.comingUp
        ? {
          ...result.structuredResponse.comingUp,
          message: normalizePlannerDisplayText(result.reply),
          nextEvent: result.structuredResponse.comingUp.nextEvent
            ? {
              ...result.structuredResponse.comingUp.nextEvent,
              title: normalizePlannerDisplayText(
                result.structuredResponse.comingUp.nextEvent.title,
              ),
              label: normalizePlannerDisplayText(
                result.structuredResponse.comingUp.nextEvent.label,
              ),
            }
            : null,
          nextBestAction: result.structuredResponse.comingUp.nextBestAction
            ? {
              ...result.structuredResponse.comingUp.nextBestAction,
              title: normalizePlannerDisplayText(
                result.structuredResponse.comingUp.nextBestAction.title,
              ),
              estimatedDuration: normalizePlannerDisplayText(
                result.structuredResponse.comingUp.nextBestAction
                  .estimatedDuration,
              ),
              reason: normalizePlannerDisplayText(
                result.structuredResponse.comingUp.nextBestAction.reason,
              ),
            }
            : null,
          remainingToday: result.structuredResponse.comingUp.remainingToday.map(
            (item) => ({
              ...item,
              title: normalizePlannerDisplayText(item.title),
              label: normalizePlannerDisplayText(item.label),
            }),
          ),
          missedItems: result.structuredResponse.comingUp.missedItems.map(
            (item) => ({
              ...item,
              title: normalizePlannerDisplayText(item.title),
              label: normalizePlannerDisplayText(item.label),
            }),
          ),
        }
        : result.structuredResponse.comingUp,
      rightNow: result.structuredResponse.rightNow
        ? {
          ...result.structuredResponse.rightNow,
          message: normalizePlannerDisplayText(result.reply),
          currentWindow: normalizePlannerDisplayText(
            result.structuredResponse.rightNow.currentWindow,
          ),
          recommendedAction:
            result.structuredResponse.rightNow.recommendedAction
              ? {
                ...result.structuredResponse.rightNow.recommendedAction,
                title: normalizePlannerDisplayText(
                  result.structuredResponse.rightNow.recommendedAction.title,
                ),
                estimatedDuration: normalizePlannerDisplayText(
                  result.structuredResponse.rightNow.recommendedAction
                    .estimatedDuration,
                ),
                reason: normalizePlannerDisplayText(
                  result.structuredResponse.rightNow.recommendedAction.reason,
                ),
              }
              : null,
          fallbackAction: result.structuredResponse.rightNow.fallbackAction
            ? {
              ...result.structuredResponse.rightNow.fallbackAction,
              title: normalizePlannerDisplayText(
                result.structuredResponse.rightNow.fallbackAction.title,
              ),
              estimatedDuration: normalizePlannerDisplayText(
                result.structuredResponse.rightNow.fallbackAction
                  .estimatedDuration,
              ),
              reason: normalizePlannerDisplayText(
                result.structuredResponse.rightNow.fallbackAction.reason,
              ),
            }
            : null,
        }
        : result.structuredResponse.rightNow,
      dayAdjust: result.structuredResponse.dayAdjust
        ? {
          ...result.structuredResponse.dayAdjust,
          message: normalizePlannerDisplayText(result.reply),
          keep: result.structuredResponse.dayAdjust.keep.map((quest) => ({
            ...quest,
            title: normalizePlannerDisplayText(quest.title),
            estimatedDuration: normalizePlannerDisplayText(
              quest.estimatedDuration,
            ),
            reason: normalizePlannerDisplayText(quest.reason),
          })),
          move: result.structuredResponse.dayAdjust.move.map((quest) => ({
            ...quest,
            title: normalizePlannerDisplayText(quest.title),
            estimatedDuration: normalizePlannerDisplayText(
              quest.estimatedDuration,
            ),
            reason: normalizePlannerDisplayText(quest.reason),
          })),
          dropOrShrink: result.structuredResponse.dayAdjust.dropOrShrink.map((
            quest,
          ) => ({
            ...quest,
            title: normalizePlannerDisplayText(quest.title),
            estimatedDuration: normalizePlannerDisplayText(
              quest.estimatedDuration,
            ),
            reason: normalizePlannerDisplayText(quest.reason),
          })),
        }
        : result.structuredResponse.dayAdjust,
    }
    : result.structuredResponse,
});

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

type QuestCaptureAssumption =
  | {
    kind: "inbox";
  }
  | {
    kind: "date_only";
    date: string;
  }
  | {
    kind: "slot";
    date: string;
    time: string;
  }
  | {
    kind: "preferred_time";
    date: string;
    time: string;
    timeOfDay: NonNullable<PlannerMemoryProfile["preferredTimeOfDay"]>;
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
  "weekdays",
  "weekend",
  "weekends",
  "pm",
  "on",
  "until",
  "by",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "jan",
  "feb",
  "mar",
  "apr",
  "jun",
  "jul",
  "aug",
  "sep",
  "sept",
  "oct",
  "nov",
  "dec",
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
    !parsed?.recurrencePattern &&
    !parsed?.recurrenceEndDate
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
    /^\d+$/.test(token) || /^\d+(?:am|pm)$/.test(token) ||
    TIMING_ONLY_REPLY_TOKENS.has(token)
  );
};

const isCadenceOnlyReply = (
  message: string,
  parsed?: ParsedInputHint | null,
): boolean => {
  if (!parsed?.recurrencePattern) return false;

  const normalized = normalizeText(message);
  if (!normalized) return false;
  if (hasPlanningVerb(normalized)) return false;

  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length === 0) return false;

  return tokens.every((token) =>
    TIMING_ONLY_REPLY_TOKENS.has(token) ||
    token === "daily" ||
    token === "weekly" ||
    token === "monthly" ||
    token === "every" ||
    token === "custom"
  );
};

const isCampaignLinkOnlyReply = (message: string): boolean =>
  /^(?:keep it standalone|standalone|link it to .+|tie it to .+|connect it to .+)$/i
    .test(message.trim());

const hasExplicitSlotSignal = (message: string): boolean =>
  /\b(at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2}\b|today|tomorrow|day after tomorrow|tonight|this morning|this afternoon|this evening|this weekend|next week|next month|weekdays?|weekends?|every day|every week|every month|monday|tuesday|wednesday|thursday|friday|saturday|sunday|in \d+\s+(?:minutes?|hours?|days?|weeks?|months?)|\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{4})?|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i
    .test(message);

const looksLikeMultiClauseScheduledTitle = (
  value: string | null | undefined,
): boolean => {
  const normalized = cleanGeneratedTaskTitle(value);
  if (!normalized) return false;

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount > 10) return true;
  if (/[.!?;]/.test(normalized)) return true;
  if (/,/.test(normalized)) return true;
  if (/\s[-–—]\s/.test(normalized)) return true;

  return /\b(?:and|but|then|also|later)\b/i.test(normalized) && wordCount > 6;
};

const shouldUseServerSchedulePayload = (
  input: PlannerBuildInput,
  analysis: ReturnType<typeof analyzeSchedulingIntent>,
): boolean => {
  if (analysis.disposition !== "schedule_action") return false;
  if (
    isReminderIntent(input.message) && !hasExplicitSlotSignal(input.message)
  ) {
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
  const sanitizedClientText = sanitizeProposalTitle(cleanedClientText);
  const sanitizedServerText = sanitizeProposalTitle(cleanedServerText);
  const fallbackText = cleanedClientText || cleanedServerText ||
    clientParsed?.text || serverParsed.text;
  const classificationActivityDuration = normalizePlannerDurationBucket(
    input.classificationHint?.suggestedActivityDurationMinutes ??
      (input.classificationHint?.type === "epic"
        ? undefined
        : input.classificationHint?.suggestedDuration),
  );
  const hasExplicitActivityDuration = hasExplicitActivityDurationMention(
    input.message,
  );
  const preferServerScheduledMetadata = useServerSchedulePayload &&
    Boolean(serverParsed.scheduledDate || serverParsed.scheduledTime) &&
    Boolean(sanitizedServerText) &&
    (
      !sanitizedClientText ||
      looksLikeMultiClauseScheduledTitle(clientParsed?.text)
    );

  const text = preferServerScheduledMetadata
    ? sanitizedServerText ?? sanitizedClientText ?? fallbackText
    : sanitizedClientText ?? sanitizedServerText ??
      fallbackText;

  return {
    text,
    scheduledTime: preferServerScheduledMetadata
      ? serverParsed.scheduledTime ?? clientParsed?.scheduledTime ?? null
      : clientParsed?.scheduledTime ??
        (useServerSchedulePayload ? serverParsed.scheduledTime : null),
    scheduledDate: preferServerScheduledMetadata
      ? serverParsed.scheduledDate ?? clientParsed?.scheduledDate ?? null
      : clientParsed?.scheduledDate ??
        (useServerSchedulePayload ? serverParsed.scheduledDate : null),
    estimatedDuration: clientParsed?.estimatedDuration ??
      (hasExplicitActivityDuration ? serverParsed.estimatedDuration : null) ??
      classificationActivityDuration ??
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
    category: preferServerScheduledMetadata
      ? serverParsed.category ?? null
      : clientParsed?.category ?? serverParsed.category ?? null,
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

const diffDateKeys = (start: string, end: string): number | null => {
  const startDate = parseDateKey(start);
  const endDate = parseDateKey(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
};

const toDateKeyFromTimestamp = (
  value: string | null | undefined,
): string | null => {
  if (typeof value !== "string" || value.length < 10) return null;
  const dateKey = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : null;
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

const getOpenSlotDurationMinutes = (
  slot: PlannerOpenSlot | null | undefined,
): number | null => {
  const startMinutes = parseTimeToMinutes(slot?.time);
  const endMinutes = parseTimeToMinutes(slot?.endTime);
  if (
    startMinutes === null || endMinutes === null || endMinutes <= startMinutes
  ) {
    return null;
  }

  return endMinutes - startMinutes;
};

const findSuggestedSlot = (
  input: PlannerBuildInput,
  targetDate: string,
  targetTime?: string | null,
): PlannerOpenSlot | null =>
  (targetTime
    ? input.plannerContext.scheduleInsights?.suggestedSlots.find((slot) =>
      slot.date === targetDate && slot.time === targetTime
    ) ?? null
    : null) ??
    input.plannerContext.scheduleInsights?.suggestedSlots.find((slot) =>
      slot.date === targetDate
    ) ??
    null;

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

const getClassificationActivityDurationMinutes = (
  classificationHint?: ClassificationHint | null,
): number | null =>
  normalizePlannerDurationBucket(
    classificationHint?.suggestedActivityDurationMinutes ??
      (classificationHint?.type === "epic"
        ? undefined
        : classificationHint?.suggestedDuration),
  );

const getRitualDurationMinutes = (
  ritual: Pick<PlannerContextRitual, "actualDurationMinutes" | "estimatedMinutes">,
): number =>
  normalizePlannerDurationBucket(ritual.actualDurationMinutes) ??
    normalizePlannerDurationBucket(ritual.estimatedMinutes) ?? 20;

const getMeaningfulTokens = (value: string) =>
  normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

const buildCampaignStarterRitualTitle = (
  campaignTitle: string | null | undefined,
): string => {
  const cleanTitle = sanitizeProposalTitle(campaignTitle);
  if (!cleanTitle) return "Starter ritual";
  return normalizeText(cleanTitle).startsWith("work on ")
    ? cleanTitle
    : `Work on ${cleanTitle}`;
};

const getHistoricalActivityDurationMinutes = (
  input: PlannerBuildInput,
  title: string | null | undefined,
  preferredKind: "quest" | "ritual" = "quest",
  options: {
    category?: string | null;
  } = {},
): number | null => {
  const normalizedTitle = normalizeText(sanitizeProposalTitle(title) ?? title);
  if (normalizedTitle.length < 3) return null;

  type HistoricalDurationCandidate = {
    title: string;
    kind: "quest" | "ritual";
    category?: string | null;
    actualMinutes: number | null;
    estimatedMinutes: number | null;
    minutes: number;
  };
  const toTaskCandidate = (
    task: PlannerContextTask,
  ): HistoricalDurationCandidate | null => {
    const actualMinutes = normalizePlannerDurationBucket(
      task.actualDurationMinutes,
    );
    const estimatedMinutes = normalizePlannerDurationBucket(
      task.estimatedDuration,
    );
    const minutes = actualMinutes ?? estimatedMinutes;
    if (minutes === null) return null;
    return {
      title: task.title,
      kind: "quest",
      category: task.category ?? null,
      actualMinutes,
      estimatedMinutes,
      minutes,
    };
  };
  const toRitualCandidate = (
    ritual: PlannerContextRitual,
  ): HistoricalDurationCandidate | null => {
    const actualMinutes = normalizePlannerDurationBucket(
      ritual.actualDurationMinutes,
    );
    const estimatedMinutes = normalizePlannerDurationBucket(
      ritual.estimatedMinutes,
    );
    const minutes = actualMinutes ?? estimatedMinutes;
    if (minutes === null) return null;
    return {
      title: ritual.title,
      kind: "ritual",
      actualMinutes,
      estimatedMinutes,
      minutes,
    };
  };

  const taskSources = [
    ...(input.plannerContext.recentCompletedTasks ?? []),
    ...input.plannerContext.tasks,
  ];
  const taskCandidates = taskSources
    .map(toTaskCandidate)
    .filter((
      candidate,
    ): candidate is HistoricalDurationCandidate => candidate !== null);
  const ritualCandidates = input.plannerContext.rituals
    .map(toRitualCandidate)
    .filter((
      candidate,
    ): candidate is HistoricalDurationCandidate => candidate !== null);
  const orderedCandidates = preferredKind === "ritual"
    ? [...ritualCandidates, ...taskCandidates]
    : [...taskCandidates, ...ritualCandidates];

  for (const candidate of orderedCandidates) {
    if (normalizeText(candidate.title) === normalizedTitle) {
      return candidate.minutes;
    }
  }

  const titleTokens = getMeaningfulTokens(normalizedTitle);
  if (titleTokens.length > 0) {
    const titleTokenSet = new Set(titleTokens);
    const fuzzyMatches = orderedCandidates
      .map((candidate) => {
        const candidateTokens = getMeaningfulTokens(candidate.title);
        if (candidateTokens.length === 0) return null;
        const sharedTokenCount = candidateTokens.filter((token) =>
          titleTokenSet.has(token)
        ).length;
        const overlapScore = sharedTokenCount /
          Math.min(titleTokens.length, candidateTokens.length);
        const categoryBoost = options.category &&
            candidate.kind === "quest" &&
            normalizeText(candidate.category) ===
              normalizeText(options.category)
          ? 0.15
          : 0;

        return {
          candidate,
          sharedTokenCount,
          score: overlapScore + categoryBoost,
        };
      })
      .filter((
        match,
      ): match is {
        candidate: HistoricalDurationCandidate;
        sharedTokenCount: number;
        score: number;
      } =>
        match !== null &&
        (match.sharedTokenCount >= 2 ||
          (titleTokens.length === 1 && match.sharedTokenCount === 1)) &&
        match.score >= 0.65
      )
      .sort((left, right) => right.score - left.score);

    if (fuzzyMatches[0]) return fuzzyMatches[0].candidate.minutes;
  }

  if (options.category && preferredKind === "quest") {
    const normalizedCategory = normalizeText(options.category);
    const categoryMatches = taskCandidates.filter((candidate) =>
      normalizeText(candidate.category) === normalizedCategory
    );
    if (categoryMatches.length > 0) {
      const sortedDurations = categoryMatches
        .map((candidate) => candidate.minutes)
        .sort((left, right) => left - right);
      return sortedDurations[Math.floor((sortedDurations.length - 1) / 2)] ??
        null;
    }
  }

  return null;
};

const getHistoricalOrDefaultActivityDurationMinutes = (
  input: PlannerBuildInput,
  title: string | null | undefined,
  defaultMinutes: number,
  preferredKind: "quest" | "ritual" = "quest",
  options: {
    category?: string | null;
  } = {},
): number =>
  getHistoricalActivityDurationMinutes(input, title, preferredKind, options) ??
    defaultMinutes;

const getRelationshipTouchEstimatedDurationMinutes = (
  input: PlannerBuildInput,
  contactName: string | null | undefined,
): number =>
  getHistoricalOrDefaultActivityDurationMinutes(
    input,
    `Reach out to ${contactName ?? "contact"}`,
    15,
    "quest",
  );

const getRecoveryResetEstimatedDurationMinutes = (
  input: PlannerBuildInput,
): number =>
  getHistoricalOrDefaultActivityDurationMinutes(
    input,
    "Recovery reset",
    30,
    "quest",
  );

const getQuickResetEstimatedDurationMinutes = (
  input: PlannerBuildInput,
  availableMinutes: number | null | undefined,
): number => {
  const historicalDuration = getHistoricalActivityDurationMinutes(
    input,
    "Take a reset and clear one quick blocker",
    "quest",
  ) ??
    getHistoricalActivityDurationMinutes(input, "Recovery reset", "quest") ??
    10;
  const baseDuration = Math.min(historicalDuration, 20);
  const availableDuration = typeof availableMinutes === "number" &&
      Number.isFinite(availableMinutes) && availableMinutes > 0
    ? Math.min(availableMinutes, baseDuration)
    : baseDuration;

  return fitPlannerDurationBucketWithin(availableDuration) ?? 10;
};

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

  if (
    normalizedMessage === "quest?"
  ) {
    return "quest_capture";
  }
  if (
    /\b(advance my campaign|move my campaign forward|progress my campaign|unstick my campaign|help me progress (?:this|my) campaign)\b/
      .test(normalizedMessage)
  ) {
    return "advance_campaign_start";
  }
  if (
    /\b(what should i do right now|what should i do now|right now|next 30 minutes|next 60 minutes|next hour)\b/
      .test(normalizedMessage)
  ) {
    return "right_now_start";
  }
  if (
    /\b(tired|drained|fried|make it light|light day|low energy)\b/.test(
      normalizedMessage,
    )
  ) {
    return "low_energy_adjust";
  }
  if (/\b(free me up|make room|clear space)\b/.test(normalizedMessage)) {
    return "make_room";
  }
  if (
    /\b(what matters most|top priority|prioritize|focus on)\b/.test(
      normalizedMessage,
    )
  ) {
    return "what_matters";
  }
  if (
    !isScheduleQuestion(normalizedMessage) &&
    /\b(prepare me for tomorrow|prep me for tomorrow|help me prepare for tomorrow|set me up for tomorrow|tomorrow prep)\b/
      .test(normalizedMessage)
  ) {
    return "briefing_followup";
  }
  if (
    !isScheduleQuestion(normalizedMessage) &&
    /\b(plan my week|help me plan this week|plan the week|what does this week look like|what(?:'s| is) my week like)\b/
      .test(normalizedMessage)
  ) {
    return "plan_week";
  }
  if (
    !isScheduleQuestion(normalizedMessage) &&
    /\b(plan my day|what does today look like|show me today|today look like)\b/
      .test(normalizedMessage)
  ) {
    return "plan_day";
  }
  if (
    /\b(relationship touch|who should i (?:text|call|reach out to)|who needs attention|follow up with|reach out to someone)\b/
      .test(normalizedMessage)
  ) {
    return "relationship_touch";
  }
  if (
    /\b(adjust my day|adjust today|rework today|reschedule today|move today around)\b/
      .test(
        normalizedMessage,
      )
  ) {
    return "adjust_today";
  }
  if (
    /\b(break this goal down|break a big goal|turn this into steps)\b/.test(
      normalizedMessage,
    )
  ) {
    return "goal_breakdown";
  }

  return "general";
};

const getResolvedStarterIntent = (
  input: PlannerBuildInput,
): PlannerStarterIntent =>
  input.plannerContext.starterIntent ??
    inferPlannerStarterIntentFromMessage(input.message);

const shouldSuppressLearnedTimingLanguage = (
  input: PlannerBuildInput,
): boolean =>
  input.sessionState.pendingStarterIntent === "plan_day" ||
  getResolvedStarterIntent(input) === "plan_day";

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
  parsed?: ParsedInputHint | null,
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

  const parsedTitle = sanitizeProposalTitle(parsed?.newTitle ?? parsed?.text);
  const draftTitle = sanitizeProposalTitle(sessionState.draft.title);
  const normalizedParsedTitle = normalizeText(parsedTitle);
  const normalizedDraftTitle = normalizeText(draftTitle);
  const sameDraftTitle = Boolean(
    normalizedParsedTitle &&
      normalizedDraftTitle &&
      normalizedParsedTitle === normalizedDraftTitle,
  );
  const hasExplicitSchedule = Boolean(
    parsed?.scheduledDate || parsed?.scheduledTime,
  );
  const answersOpenQuestion = isTimingOnlyReply(message, parsed) ||
    (
      sessionState.openQuestionIds.includes("time_of_day") &&
      (
        Boolean(extractTimeOfDay(message)) ||
        (hasExplicitSchedule && (!parsedTitle || sameDraftTitle))
      )
    ) ||
    (
      sessionState.openQuestionIds.includes("time_reason") &&
      Boolean(extractTimeReason(message, sessionState))
    ) ||
    (
      sessionState.openQuestionIds.includes("cadence") &&
      isCadenceOnlyReply(message, parsed)
    ) ||
    (
      sessionState.openQuestionIds.includes("end_date") &&
      (
        Boolean(parsed?.recurrenceEndDate) ||
        (hasExplicitSchedule && (!parsedTitle || sameDraftTitle))
      )
    ) ||
    (
      sessionState.openQuestionIds.includes("campaign_link") &&
      isCampaignLinkOnlyReply(message)
    );

  if (!answersOpenQuestion) {
    const introducesFreshTitle = Boolean(
      normalizedParsedTitle &&
        (!normalizedDraftTitle ||
          normalizedParsedTitle !== normalizedDraftTitle),
    );
    if (introducesFreshTitle || hasExplicitSchedule) {
      return false;
    }
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

const hasExplicitActivityDurationMention = (message: string): boolean =>
  /\b\d{1,3}\s*(?:minutes?|mins?|hours?|hrs?)\b/i.test(message) ||
  /\bhalf an hour\b/i.test(message) ||
  /\bquarter of an hour\b/i.test(message);

const getExplicitParsedActivityDuration = (
  input: PlannerBuildInput,
): number | null =>
  hasExplicitActivityDurationMention(input.message)
    ? input.parsedInput?.estimatedDuration ?? null
    : null;

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

const parseTimeOfDayFromClock = (
  time: string | null | undefined,
): PlannerMemoryProfile["preferredTimeOfDay"] => {
  const minutes = parseTimeToMinutes(time);
  if (minutes === null) return null;
  if (minutes < 12 * 60) return "morning";
  if (minutes < 17 * 60) return "afternoon";
  if (minutes < 21 * 60) return "evening";
  return "night";
};

const normalizeTimeReason = (
  value: string | null | undefined,
): string | null => {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveTimeReasonFromSources = (input: {
  resolvedTimeOfDay: string | null | undefined;
  explicitTimeReason?: string | null | undefined;
  sources: Array<{
    timeOfDay: string | null | undefined;
    timeReason: string | null | undefined;
  }>;
}): string | null => {
  const explicitTimeReason = normalizeTimeReason(input.explicitTimeReason);
  if (explicitTimeReason) return explicitTimeReason;

  for (const source of input.sources) {
    const timeReason = normalizeTimeReason(source.timeReason);
    if (!timeReason) continue;

    const sourceTimeOfDay = source.timeOfDay ?? null;
    if (
      !input.resolvedTimeOfDay ||
      !sourceTimeOfDay ||
      sourceTimeOfDay === input.resolvedTimeOfDay
    ) {
      return timeReason;
    }
  }

  return null;
};

const preferredTime = (draft: PlannerDraftState): string | null =>
  draft.scheduledTime ?? timeOfDayToClock(draft.timeOfDay);

const isQuestCaptureCreateQuest = (
  input: PlannerBuildInput,
  kind: PlannerProposalKind,
): boolean =>
  kind === "create_quest" &&
  input.sessionState.pendingStarterIntent === "quest_capture";

const hasExplicitQuestCaptureTiming = (
  input: PlannerBuildInput,
  kind: PlannerProposalKind,
): boolean =>
  isQuestCaptureCreateQuest(input, kind) &&
  Boolean(input.parsedInput?.scheduledTime);

const getPreferredQuestCaptureTimeOfDay = (
  input: PlannerBuildInput,
): NonNullable<PlannerMemoryProfile["preferredTimeOfDay"]> | null => {
  const preferredTimeOfDay = input.plannerContext.plannerMemory
    ?.preferredTimeOfDay ?? input.sessionState.preferredTimeOfDay ?? null;

  return preferredTimeOfDay === "morning" ||
      preferredTimeOfDay === "afternoon" ||
      preferredTimeOfDay === "evening" ||
      preferredTimeOfDay === "night"
    ? preferredTimeOfDay
    : null;
};

const getSuggestedSlotForDate = (
  input: PlannerBuildInput,
  date: string,
): PlannerOpenSlot | null =>
  input.plannerContext.scheduleInsights?.suggestedSlots?.find((slot) =>
    slot.date === date
  ) ?? null;

const getQuestCaptureTargetDate = (input: PlannerBuildInput): string =>
  input.plannerContext.scheduleInsights?.selectedDate ?? input.currentDate;

const resolveQuestCaptureDraft = (
  input: PlannerBuildInput,
  kind: PlannerProposalKind,
  draft: PlannerDraftState,
): { draft: PlannerDraftState; assumption: QuestCaptureAssumption | null } => {
  if (!isQuestCaptureCreateQuest(input, kind)) {
    return {
      draft,
      assumption: null,
    };
  }

  if (input.parsedInput?.scheduledTime) {
    return {
      draft,
      assumption: null,
    };
  }

  if (input.parsedInput?.scheduledDate) {
    const explicitDate = input.parsedInput.scheduledDate;
    const suggestedSlot = getSuggestedSlotForDate(input, explicitDate);
    if (suggestedSlot) {
      return {
        draft: {
          ...draft,
          scheduledDate: explicitDate,
          scheduledTime: suggestedSlot.time,
          timeOfDay: parseTimeOfDayFromClock(suggestedSlot.time),
        },
        assumption: {
          kind: "slot",
          date: explicitDate,
          time: suggestedSlot.time,
        },
      };
    }

    const preferredTimeOfDay = getPreferredQuestCaptureTimeOfDay(input);
    const preferredTime = timeOfDayToClock(preferredTimeOfDay);
    if (preferredTimeOfDay && preferredTime) {
      return {
        draft: {
          ...draft,
          scheduledDate: explicitDate,
          scheduledTime: preferredTime,
          timeOfDay: preferredTimeOfDay,
        },
        assumption: {
          kind: "preferred_time",
          date: explicitDate,
          time: preferredTime,
          timeOfDay: preferredTimeOfDay,
        },
      };
    }

    return {
      draft: {
        ...draft,
        scheduledDate: explicitDate,
        scheduledTime: null,
        timeOfDay: null,
      },
      assumption: {
        kind: "date_only",
        date: explicitDate,
      },
    };
  }

  const targetDate = getQuestCaptureTargetDate(input);
  const suggestedSlot = getSuggestedSlotForDate(input, targetDate);
  if (suggestedSlot) {
    return {
      draft: {
        ...draft,
        scheduledDate: targetDate,
        scheduledTime: suggestedSlot.time,
        timeOfDay: parseTimeOfDayFromClock(suggestedSlot.time),
      },
      assumption: {
        kind: "slot",
        date: targetDate,
        time: suggestedSlot.time,
      },
    };
  }

  const preferredTimeOfDay = getPreferredQuestCaptureTimeOfDay(input);
  const preferredTime = timeOfDayToClock(preferredTimeOfDay);
  if (preferredTimeOfDay && preferredTime) {
    return {
      draft: {
        ...draft,
        scheduledDate: targetDate,
        scheduledTime: preferredTime,
        timeOfDay: preferredTimeOfDay,
      },
      assumption: {
        kind: "preferred_time",
        date: targetDate,
        time: preferredTime,
        timeOfDay: preferredTimeOfDay,
      },
    };
  }

  return {
    draft: {
      ...draft,
      scheduledDate: null,
      scheduledTime: null,
      timeOfDay: null,
      timeReason: null,
    },
    assumption: {
      kind: "inbox",
    },
  };
};

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
  const carryForward = isLikelyAnswerOnly(
    input.message,
    input.sessionState,
    input.parsedInput,
  );
  const base = carryForward ? { ...input.sessionState.draft } : {};
  const parsed = input.parsedInput;
  const plannerMemory = input.plannerContext.plannerMemory;

  const timeOfDay = extractTimeOfDay(input.message, parsed) ??
    base.timeOfDay ??
    input.sessionState.preferredTimeOfDay ??
    plannerMemory?.preferredTimeOfDay ??
    null;
  const explicitTimeReason = extractTimeReason(
    input.message,
    input.sessionState,
  );
  const timeReason = resolveTimeReasonFromSources({
    resolvedTimeOfDay: timeOfDay,
    explicitTimeReason,
    sources: [
      {
        timeOfDay: base.timeOfDay ?? null,
        timeReason: base.timeReason ?? null,
      },
      {
        timeOfDay: input.sessionState.preferredTimeOfDay ?? null,
        timeReason: input.sessionState.preferredTimeReason ?? null,
      },
      {
        timeOfDay: plannerMemory?.preferredTimeOfDay ?? null,
        timeReason: plannerMemory?.preferredTimeReason ?? null,
      },
    ],
  });
  const cadence = resolveCadence(input.message, parsed).label ?? base.cadence ??
    null;

  const parsedTitle =
    input.sessionState.pendingStarterIntent === "quest_capture" &&
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
    durationMinutes: (() => {
      const historicalDuration = getHistoricalActivityDurationMinutes(
        input,
        input.classificationHint?.type === "epic" && draftTitle
          ? buildCampaignStarterRitualTitle(parsedTitle ?? draftTitle)
          : draftTitle,
        input.classificationHint?.type === "habit" ||
          input.classificationHint?.type === "epic"
          ? "ritual"
          : "quest",
        {
          category: parsed?.category ?? null,
        },
      );
      const explicitDuration = getExplicitParsedActivityDuration(input);
      const inferredDuration = parsed?.estimatedDuration ??
        getClassificationActivityDurationMinutes(input.classificationHint) ??
        base.durationMinutes ??
        null;

      // Duration precedence: explicit user duration, learned history, then inferred estimates.
      return explicitDuration ??
        historicalDuration ??
        inferredDuration;
    })(),
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
  if (parseRenameTitle(input.message) || input.parsedInput?.newTitle) {
    return false;
  }
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
    (matched.epic || draft.epicId ||
      hasCampaignStructureLanguage(input.message))
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

type ScheduledCalendarConflict = {
  title: string;
  date: string;
  isAllDay: boolean;
  startMinutes: number | null;
  endMinutes: number | null;
};

const getDraftDurationMinutes = (
  draft: PlannerDraftState,
  matchedTask: PlannerContextTask | null,
): number =>
  Number.isFinite(draft.durationMinutes) && (draft.durationMinutes ?? 0) > 0
    ? Number(draft.durationMinutes)
    : matchedTask
    ? getTaskDuration(matchedTask)
    : DEFAULT_TASK_DURATION_MINUTES;

const findCalendarConflictForQuestDraft = (
  input: PlannerBuildInput,
  draft: PlannerDraftState,
  kind: PlannerProposalKind,
  matchedTask: PlannerContextTask | null,
): ScheduledCalendarConflict | null => {
  if (kind !== "create_quest" && kind !== "update_quest") return null;

  const taskDate = defaultQuestDate(input, draft);
  const scheduledTime = preferredTime(draft);
  const startMinutes = parseTimeToMinutes(scheduledTime);
  if (!taskDate || startMinutes === null) return null;

  const endMinutes = startMinutes + getDraftDurationMinutes(draft, matchedTask);
  const offset = getDateTimeOffset(input.currentDateTime);
  const dayStart = new Date(buildOffsetDateTime(taskDate, "00:00", offset));
  const nextDay = addDaysToDateKey(taskDate, 1);
  const dayEnd = new Date(buildOffsetDateTime(nextDay, "00:00", offset));

  for (const event of input.plannerContext.calendarEvents) {
    const start = new Date(event.start);
    const end = new Date(event.end);
    if (end <= dayStart || start >= dayEnd) continue;

    if (event.isAllDay) {
      return {
        title: event.title,
        date: taskDate,
        isAllDay: true,
        startMinutes: null,
        endMinutes: null,
      };
    }

    const localStart = start < dayStart ? dayStart : start;
    const localEnd = end > dayEnd ? dayEnd : end;
    const eventStartMinutes = Math.max(
      0,
      Math.round((localStart.getTime() - dayStart.getTime()) / 60000),
    );
    const eventEndMinutes = Math.min(
      24 * 60,
      Math.round((localEnd.getTime() - dayStart.getTime()) / 60000),
    );
    if (eventEndMinutes <= startMinutes || eventStartMinutes >= endMinutes) {
      continue;
    }

    return {
      title: event.title,
      date: taskDate,
      isAllDay: false,
      startMinutes: eventStartMinutes,
      endMinutes: eventEndMinutes,
    };
  }

  return null;
};

const buildCalendarConflictReplyNote = (
  input: PlannerBuildInput,
  conflict: ScheduledCalendarConflict | null,
): string | null => {
  if (!conflict) return null;

  const dateLabel = formatScheduleReference(input.currentDate, conflict.date);
  if (conflict.isAllDay) {
    return `Heads up: this overlaps with your saved calendar event "${conflict.title}" ${
      dateLabel === "today" || dateLabel === "tomorrow"
        ? dateLabel
        : `on ${dateLabel}`
    }.`;
  }

  const timeRange = formatAssistantTimeRange(
    formatMinutes(conflict.startMinutes ?? 0),
    formatMinutes(conflict.endMinutes ?? 0),
  ) ??
    `${formatMinutes(conflict.startMinutes ?? 0)}-${
      formatMinutes(conflict.endMinutes ?? 0)
    }`;

  return `Heads up: this overlaps with your saved calendar event "${conflict.title}" ${
    dateLabel === "today" || dateLabel === "tomorrow"
      ? `${dateLabel} from ${timeRange}`
      : `on ${dateLabel} from ${timeRange}`
  }.`;
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
  questCaptureAssumption: QuestCaptureAssumption | null,
): string[] => {
  if (kind === "suggest_reminder") return [];

  const missing = new Set<string>();
  const effectiveTime = preferredTime(draft);
  const keepCreateQuestConfirmable = kind === "create_quest";
  const bypassQuestCaptureTimingQuestions =
    isQuestCaptureCreateQuest(input, kind) &&
    questCaptureAssumption !== null;
  const askTimingQuestions = !bypassQuestCaptureTimingQuestions &&
    shouldAskTimingQuestions(input, kind);

  if (!keepCreateQuestConfirmable && askTimingQuestions) {
    if (!effectiveTime) missing.add("time of day");
    if (!draft.timeReason) {
      missing.add("why that time works");
    }
  }

  if (
    kind === "update_quest" &&
    (draft.draftKind === "create_quest" || draft.draftKind === "update_quest")
  ) {
    if (draft.cadence && !cadence.recurrencePattern) {
      missing.add("repeat cadence");
    }
  }

  if (kind === "update_quest" && draft.cadence && !draft.endDate) {
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

const formatSlotLabel = (
  slot: PlannerOpenSlot,
  selectedDate: string,
): string => {
  const startLabel = formatAssistantTime(slot.time) ?? slot.time;
  return slot.date === selectedDate ? startLabel : `${slot.date} ${startLabel}`;
};

const buildTimeQuestion = (input: PlannerBuildInput): PlannerQuestion => {
  const insights = input.plannerContext.scheduleInsights;
  const plannerMemory = input.plannerContext.plannerMemory;
  const suggestedSlots = insights?.suggestedSlots?.slice(0, 3) ?? [];
  const slotOptions = suggestedSlots.map((slot) =>
    formatSlotLabel(slot, insights?.selectedDate ?? input.currentDate)
  );
  const preferredTimeOfDay = shouldSuppressLearnedTimingLanguage(input)
    ? null
    : plannerMemory?.preferredTimeOfDay ??
      input.sessionState.preferredTimeOfDay ?? null;
  const preferredReason = shouldSuppressLearnedTimingLanguage(input)
    ? null
    : plannerMemory?.preferredTimeReason ??
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
    prompt:
      "If we're putting this on the calendar, what time of day fits best?",
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
  questCaptureAssumption: QuestCaptureAssumption | null,
): PlannerQuestion[] => {
  if (kind === "suggest_reminder") return [];

  const questions: PlannerQuestion[] = [];
  const effectiveTime = preferredTime(draft);
  const explicitTimeOfDay = extractTimeOfDay(input.message, input.parsedInput);
  const carryForwardAnswer = isLikelyAnswerOnly(
    input.message,
    input.sessionState,
    input.parsedInput,
  );
  const shouldConfirmLearnedTime = !carryForwardAnswer &&
    !input.parsedInput?.scheduledTime && !explicitTimeOfDay;
  const bypassQuestCaptureTimingQuestions =
    isQuestCaptureCreateQuest(input, kind) &&
    questCaptureAssumption !== null;
  const askTimingQuestions = !bypassQuestCaptureTimingQuestions &&
    shouldAskTimingQuestions(input, kind);
  const titleQuestion = buildTitleClarificationQuestion(kind);

  if (titleQuestion && !sanitizeProposalTitle(draft.title)) {
    return [titleQuestion];
  }
  const keepCreateQuestConfirmable = kind === "create_quest";

  if (
    !keepCreateQuestConfirmable &&
    askTimingQuestions &&
    (!effectiveTime || shouldConfirmLearnedTime)
  ) {
    questions.push(buildTimeQuestion(input));
  }

  if (
    (kind === "update_quest" ||
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

    if (kind === "update_quest" && !draft.endDate) {
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
    kind === "create_ritual" &&
    input.plannerContext.activeEpics.length > 0 &&
    !draft.epicId &&
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

  const balanceQuestion = keepCreateQuestConfirmable ||
      isQuestCaptureCreateQuest(input, kind)
    ? null
    : buildBalanceQuestion(input);
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
  questCaptureAssumption: QuestCaptureAssumption | null,
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
  const taskDate = questCaptureAssumption?.kind === "inbox"
    ? null
    : defaultQuestDate(input, draft);
  const summarySchedule = input.parsedInput?.scheduledDate && scheduledTime
    ? ` on ${input.parsedInput.scheduledDate} at ${scheduledTime}`
    : input.parsedInput?.scheduledDate
    ? ` on ${input.parsedInput.scheduledDate}`
    : scheduledTime
    ? ` at ${scheduledTime}`
    : "";

  if (kind === "update_quest" && matchedTask) {
    const shouldUpdateDuration = hasExplicitActivityDurationMention(
      input.message,
    );
    const updates = stripUndefined({
      task_text: input.parsedInput?.newTitle ??
        parseRenameTitle(input.message) ?? undefined,
      task_date: draft.scheduledDate ?? matchedTask.taskDate ?? undefined,
      scheduled_time: scheduledTime ?? undefined,
      estimated_duration: shouldUpdateDuration
        ? draft.durationMinutes ?? undefined
        : undefined,
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
      ? questCaptureAssumption?.kind === "inbox"
        ? `Capture "${title}" in Inbox so you can schedule it later.`
        : questCaptureAssumption?.kind === "slot"
        ? `Create a quest for "${title}" on ${questCaptureAssumption.date} at ${questCaptureAssumption.time}, assuming that slot based on your open window.`
        : questCaptureAssumption?.kind === "preferred_time"
        ? `Create a quest for "${title}" on ${questCaptureAssumption.date} at ${questCaptureAssumption.time}, assuming your usual ${questCaptureAssumption.timeOfDay} pattern.`
        : cadence.recurrencePattern
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
      taskDate,
      scheduledTime,
      estimatedDuration: draft.durationMinutes ??
        getClassificationActivityDurationMinutes(input.classificationHint) ??
        30,
      recurrencePattern: cadence.recurrencePattern,
      recurrenceDays: cadence.recurrenceDays,
      recurrenceMonthDays: cadence.recurrenceMonthDays,
      recurrenceCustomPeriod: cadence.recurrenceCustomPeriod,
      recurrenceEndDate: draft.endDate ?? null,
      reminderEnabled: reminderMinutesBefore !== null,
      reminderMinutesBefore: reminderMinutesBefore ?? 15,
      category: input.parsedInput?.category ?? undefined,
      notes: input.parsedInput?.notes ?? undefined,
      source: questCaptureAssumption?.kind === "inbox" ? "inbox" : "manual",
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
  const starterRitualTitle = buildCampaignStarterRitualTitle(
    sanitizeProposalTitle(input.parsedInput?.text) ?? title,
  );
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
          title: starterRitualTitle,
          difficulty: input.plannerContext.aiSignals?.preferredDifficulty ??
            "medium",
          frequency: cadence.habitFrequency ??
            input.plannerContext.aiSignals?.preferredHabitFrequency ?? "daily",
          custom_days: cadence.habitCustomDays ?? [],
          custom_month_days: cadence.habitCustomMonthDays ?? [],
          preferred_time: scheduledTime,
          estimated_minutes: draft.durationMinutes ??
            getHistoricalActivityDurationMinutes(
              input,
              starterRitualTitle,
              "ritual",
            ) ??
            getClassificationActivityDurationMinutes(
              input.classificationHint,
            ) ??
            45,
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
    const shouldUpdateDuration = hasExplicitActivityDurationMention(
      input.message,
    );
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
        estimatedMinutes: shouldUpdateDuration
          ? draft.durationMinutes ??
            getClassificationActivityDurationMinutes(
              input.classificationHint,
            ) ??
            30
          : undefined,
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
      estimatedMinutes: draft.durationMinutes ??
        getClassificationActivityDurationMinutes(input.classificationHint) ??
        30,
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
      label: buildAssistantTaskScheduleLabel({
        title: task.title,
        taskDate: task.taskDate,
        scheduledTime: task.scheduledTime,
        estimatedDuration: task.estimatedDuration,
        currentDate: input.currentDate,
        currentDateTime: input.currentDateTime,
      }),
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
      label: buildAssistantEventScheduleLabel({
        title: event.title,
        start: event.start,
        end: event.end,
        isAllDay: event.isAllDay,
        currentDate: input.currentDate,
        currentDateTime: input.currentDateTime,
      }),
      sortMinutes: event.isAllDay ? -1 : parseTimeToMinutes(
        `${new Date(event.start).getHours()}:${
          String(new Date(event.start).getMinutes()).padStart(2, "0")
        }`,
      ),
    }));

  return [...tasks, ...events].sort((left, right) => (
    (left.sortMinutes ?? 9999) - (right.sortMinutes ?? 9999)
  ));
};

const getStructuredTaskStart = (
  task: PlannerContextTask,
): string | null => {
  if (!task.taskDate || !task.scheduledTime) return null;
  return `${task.taskDate}T${task.scheduledTime}:00`;
};

const getStructuredTaskEnd = (
  task: PlannerContextTask,
): string | null => {
  const start = getStructuredTaskStart(task);
  if (!start) return null;

  const end = new Date(start);
  end.setMinutes(end.getMinutes() + getTaskDuration(task));
  return end.toISOString();
};

const collectStructuredScheduleItemsForDate = (
  input: PlannerBuildInput,
  date: string,
  remainingOnly: boolean,
): CompanionScheduleItem[] => {
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
      id: task.id,
      title: task.title,
      label: buildAssistantTaskScheduleLabel({
        title: task.title,
        taskDate: task.taskDate,
        scheduledTime: task.scheduledTime,
        estimatedDuration: task.estimatedDuration,
        currentDate: input.currentDate,
        currentDateTime: input.currentDateTime,
      }),
      startsAt: getStructuredTaskStart(task),
      endsAt: getStructuredTaskEnd(task),
      isAllDay: false,
      source: "task" as const,
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
      id: event.id,
      title: event.title,
      label: buildAssistantEventScheduleLabel({
        title: event.title,
        start: event.start,
        end: event.end,
        isAllDay: event.isAllDay,
        currentDate: input.currentDate,
        currentDateTime: input.currentDateTime,
      }),
      startsAt: event.start,
      endsAt: event.end,
      isAllDay: event.isAllDay,
      source: "calendar" as const,
      sortMinutes: event.isAllDay ? -1 : parseTimeToMinutes(
        `${new Date(event.start).getHours()}:${
          String(new Date(event.start).getMinutes()).padStart(2, "0")
        }`,
      ),
    }));

  return [...tasks, ...events]
    .sort((left, right) =>
      (left.sortMinutes ?? 9999) - (right.sortMinutes ?? 9999)
    )
    .map(({ sortMinutes: _sortMinutes, ...item }) => item);
};

const collectMissedTasksForToday = (
  input: PlannerBuildInput,
): CompanionMissedItem[] => {
  const currentMinutes = getLocalMinutesFromDateTime(input.currentDateTime);

  return [
    ...input.plannerContext.tasks,
    ...input.plannerContext.inboxTasks,
  ]
    .filter((task) =>
      task.completed !== true &&
      task.taskDate === input.currentDate &&
      Boolean(task.scheduledTime)
    )
    .filter((task) => {
      const scheduledMinutes = parseTimeToMinutes(task.scheduledTime);
      if (scheduledMinutes === null || currentMinutes === null) return false;
      return scheduledMinutes < currentMinutes;
    })
    .sort((left, right) =>
      (parseTimeToMinutes(left.scheduledTime) ?? 9999) -
      (parseTimeToMinutes(right.scheduledTime) ?? 9999)
    )
    .map((task) => ({
      id: task.id,
      title: task.title,
      label: buildAssistantTaskScheduleLabel({
        title: task.title,
        taskDate: task.taskDate,
        scheduledTime: task.scheduledTime,
        estimatedDuration: task.estimatedDuration,
        currentDate: input.currentDate,
        currentDateTime: input.currentDateTime,
      }),
      source: "task" as const,
    }));
};

const getStructuredScheduleItemStartMinutes = (
  input: PlannerBuildInput,
  item: CompanionScheduleItem | null,
): number | null => {
  if (!item) return null;
  if (item.source === "task") {
    const task = findPlannerTaskById(input, item.id);
    return parseTimeToMinutes(task?.scheduledTime ?? null);
  }
  if (!item.startsAt) return null;

  const offset = getDateTimeOffset(input.currentDateTime);
  const dayStart = new Date(
    buildOffsetDateTime(input.currentDate, "00:00", offset),
  );
  const eventStart = new Date(item.startsAt);

  return Math.max(
    0,
    Math.round((eventStart.getTime() - dayStart.getTime()) / 60000),
  );
};

const buildComingUpNextBestAction = (
  input: PlannerBuildInput,
  nextEvent: CompanionScheduleItem | null,
): WindowSuggestedActionState => {
  const currentMinutes = getLocalMinutesFromDateTime(input.currentDateTime);
  const nextEventStartMinutes = getStructuredScheduleItemStartMinutes(
    input,
    nextEvent,
  );
  const minutesUntilNextEvent = currentMinutes === null ||
      nextEventStartMinutes === null
    ? null
    : nextEventStartMinutes - currentMinutes;
  const entries = getTodayScoredTaskEntries(input);

  if (nextEvent?.source === "task") {
    const nextTask = findPlannerTaskById(input, nextEvent.id);
    if (
      nextTask &&
      (minutesUntilNextEvent === null || minutesUntilNextEvent <= 45)
    ) {
      return {
        suggestion: buildSuggestedQuestFromTask(
          nextTask,
          "That's the next scheduled move, so starting there keeps the day simple.",
        ),
        proposal: null,
      };
    }
  }

  const missedTask = collectMissedTasksForToday(input)[0];
  const missedTaskRecord = findPlannerTaskById(input, missedTask?.id ?? null);
  if (
    missedTaskRecord &&
    (minutesUntilNextEvent === null ||
      getTaskDuration(missedTaskRecord) <= minutesUntilNextEvent)
  ) {
    return {
      suggestion: buildSuggestedQuestFromTask(
        missedTaskRecord,
        nextEvent
          ? `You can still clear this before ${nextEvent.title} and stop the rest of the day from dragging it around.`
          : "You missed this earlier, and clearing it now will keep the rest of the day cleaner.",
      ),
      proposal: null,
    };
  }

  const campaignCandidate = buildCampaignWindowNextBestAction(input, {
    availableMinutes: minutesUntilNextEvent,
    context: "coming_up",
    nextEvent,
  });
  if (entries.length === 0) {
    return campaignCandidate ?? { suggestion: null, proposal: null };
  }

  const fitCandidate = entries.find(({ task }) => {
    if (task.id === nextEvent?.id) return false;
    const scheduledMinutes = parseTimeToMinutes(task.scheduledTime);
    if (
      scheduledMinutes !== null &&
      nextEventStartMinutes !== null &&
      scheduledMinutes > nextEventStartMinutes
    ) {
      return false;
    }
    if (minutesUntilNextEvent === null) return true;
    return getTaskDuration(task) <= minutesUntilNextEvent;
  }) ?? null;

  if (
    campaignCandidate &&
    (
      !fitCandidate ||
      campaignCandidate.priorityScore > fitCandidate.score.score
    )
  ) {
    return {
      suggestion: campaignCandidate.suggestion,
      proposal: campaignCandidate.proposal,
    };
  }

  if (!fitCandidate) return { suggestion: null, proposal: null };

  return {
    suggestion: buildSuggestedQuestFromTask(
      fitCandidate.task,
      nextEvent
        ? `It fits before ${nextEvent.title} without crowding the rest of the day.`
        : fitCandidate.score.reasons[0] ??
          "It's the clearest useful move in the time you have left today.",
      {
        type: mapPriorityScoreToSuggestedQuestType(
          fitCandidate.score.score,
          fitCandidate.task,
        ),
      },
    ),
    proposal: null,
  };
};

const buildCampaignWindowNextBestAction = (
  input: PlannerBuildInput,
  options: {
    availableMinutes: number | null;
    context: "coming_up" | "right_now";
    nextEvent?: CompanionScheduleItem | null;
  },
): {
  suggestion: CompanionSuggestedQuest;
  proposal: PlannerProposal | null;
  priorityScore: number;
} | null => {
  const nextEvent = options.nextEvent ?? null;
  const currentMinutes = getLocalMinutesFromDateTime(input.currentDateTime);
  const nextEventStartMinutes = getStructuredScheduleItemStartMinutes(
    input,
    nextEvent,
  );
  for (const score of getResolvedPriorityScores(input)) {
    if (score.kind !== "epic" || !score.epicId) continue;

    const epic = input.plannerContext.activeEpics.find((candidate) =>
      candidate.id === score.epicId
    );
    if (!epic) continue;

    const campaignMomentum = buildCampaignMomentumCandidate(input, epic);
    if (campaignMomentum.status === "moving") continue;

    const linkedTask = selectCampaignNextTask(input, campaignMomentum);
    if (linkedTask) {
      const duration = getTaskDuration(linkedTask);
      if (
        options.availableMinutes !== null &&
        duration > options.availableMinutes
      ) {
        continue;
      }

      return {
        suggestion: buildSuggestedQuestFromTask(
          linkedTask,
          options.context === "coming_up" && nextEvent
            ? campaignMomentum.tooManyCampaigns
              ? `This protects the clearest campaign move before ${nextEvent.title} while too many active campaigns are competing for attention.`
              : campaignMomentum.interventionLevel === "reset"
              ? `${
                getCampaignPressureLead(campaignMomentum, {
                  preferRepeatedSlip: true,
                })
              } ${linkedTask.title} is the reset move to protect before ${nextEvent.title}.`
              : `This is the cleanest campaign move you can finish before ${nextEvent.title}.`
            : campaignMomentum.tooManyCampaigns
            ? "Too many active campaigns are competing for attention, and this is the cleanest move to stop the drift right now."
            : campaignMomentum.interventionLevel === "reset"
            ? `${
              getCampaignPressureLead(campaignMomentum, {
                preferRepeatedSlip: true,
              })
            } This is the reset move to protect right now.`
            : campaignMomentum.status === "at_risk"
            ? "This is the clearest concrete move to stop the campaign from slipping right now."
            : "This is the cleanest campaign move to use this window well.",
          {
            type: campaignMomentum.interventionLevel === "reset"
              ? "must"
              : mapPriorityScoreToSuggestedQuestType(score.score, linkedTask),
          },
        ),
        proposal: null,
        priorityScore: score.score +
          (campaignMomentum.interventionLevel === "reset" ? 18 : 0),
      };
    }

    const suggestionDuration = campaignMomentum.oversizedTask
      ? getCampaignBreakdownEstimatedDurationMinutes(
        input,
        campaignMomentum.oversizedTask,
      )
      : 15;
    if (
      options.availableMinutes !== null &&
      suggestionDuration > options.availableMinutes
    ) {
      continue;
    }

    if (campaignNeedsFollowUpDefinition(campaignMomentum)) {
      const windowedSuggestedSlot =
        input.plannerContext.scheduleInsights?.suggestedSlots?.find((slot) => {
          if (slot.date !== input.currentDate) return false;
          const slotStartMinutes = parseTimeToMinutes(slot.time);
          if (slotStartMinutes === null) return false;
          const slotEndMinutes = parseTimeToMinutes(slot.endTime) ??
            (slotStartMinutes + suggestionDuration);
          if (currentMinutes !== null && slotEndMinutes <= currentMinutes) {
            return false;
          }
          if (
            nextEventStartMinutes !== null &&
            slotEndMinutes > nextEventStartMinutes
          ) {
            return false;
          }
          if (
            currentMinutes !== null &&
            options.availableMinutes !== null &&
            slotEndMinutes > currentMinutes + options.availableMinutes
          ) {
            return false;
          }
          return true;
        }) ?? null;
      const followUpSuggestedType = getCampaignInterventionSuggestedType(
        campaignMomentum,
        campaignMomentum.status === "at_risk" ? "must" : "should",
      );

      if (shouldSuggestStrategicCampaignAdjustment(campaignMomentum)) {
        const adjustmentDuration =
          getCampaignAdjustmentEstimatedDurationMinutes(
            input,
            campaignMomentum,
          );
        if (
          options.availableMinutes !== null &&
          adjustmentDuration > options.availableMinutes
        ) {
          continue;
        }

        const adjustmentProposal = buildCampaignAdjustmentProposalForMomentum(
          input,
          campaignMomentum,
        );
        const pressureLead = getCampaignPressureLead(campaignMomentum, {
          preferRepeatedSlip: true,
        });
        const reason = options.context === "coming_up" && nextEvent
          ? `${pressureLead} The honest move before ${nextEvent.title} is resetting the campaign plan, not pretending one more task will fix it.`
          : `${pressureLead} The honest move right now is resetting the campaign plan, not pretending one more task will fix it.`;

        return {
          suggestion: buildSuggestedQuestFromProposal(
            input,
            adjustmentProposal,
            reason,
          ),
          proposal: adjustmentProposal,
          priorityScore: score.score + 18,
        };
      }

      if (options.availableMinutes !== null && !windowedSuggestedSlot) {
        return {
          suggestion: {
            suggestionId: `campaign-window-followup:${epic.id}`,
            proposalId: null,
            title: `Define next step for ${epic.title}`,
            type: followUpSuggestedType,
            estimatedDuration: formatEstimatedDurationLabel(
              suggestionDuration,
            ),
            estimatedDurationMinutes: suggestionDuration,
            source: "campaign",
            reason: options.context === "coming_up" && nextEvent
              ? `This is still the clearest campaign follow-up before ${nextEvent.title}, but there isn't a clean slot to schedule it automatically.`
              : `${campaignMomentum.statusReason} This is the cleanest next step right now, but there isn't a clean slot to schedule it automatically.`,
          },
          proposal: null,
          priorityScore: score.score,
        };
      }

      const followUpProposal = buildCampaignNextStepProposal(
        input,
        campaignMomentum,
        {
          targetDate: windowedSuggestedSlot?.date ?? input.currentDate,
          scheduledTime: windowedSuggestedSlot?.time ?? null,
          estimatedDuration: suggestionDuration,
        },
      );
      const reason = options.context === "coming_up" && nextEvent
        ? `This turns the recent progress on ${epic.title} into a concrete follow-up before ${nextEvent.title}.`
        : `${campaignMomentum.statusReason} Defining the next step is the cleanest way to keep that momentum alive right now.`;

      return {
        suggestion: buildSuggestedQuestFromProposal(
          input,
          followUpProposal,
          reason,
        ),
        proposal: followUpProposal,
        priorityScore: score.score,
      };
    }

    return {
      suggestion: {
        suggestionId: `campaign:${epic.id}`,
        proposalId: null,
        title: campaignMomentum.oversizedTask
          ? `Break down ${campaignMomentum.oversizedTask.title}`
          : campaignMomentum.interventionLevel === "reset"
          ? `Reset ${epic.title}`
          : campaignMomentum.status === "at_risk"
          ? `Stabilize ${epic.title}`
          : `Define next step for ${epic.title}`,
        type: campaignMomentum.interventionLevel === "reset"
          ? "must"
          : mapPriorityScoreToSuggestedQuestType(score.score),
        estimatedDuration: formatEstimatedDurationLabel(suggestionDuration),
        estimatedDurationMinutes: suggestionDuration,
        source: "campaign",
        reason: options.context === "coming_up" && nextEvent
          ? campaignMomentum.interventionLevel === "reset"
            ? `This campaign needs a reset move before ${nextEvent.title}, not another vague intention.`
            : `This gives ${epic.title} a clean foothold before ${nextEvent.title} instead of letting the campaign keep drifting.`
          : campaignMomentum.oversizedTask
          ? `${
            getCampaignPressureLead(campaignMomentum, {
              preferRepeatedSlip: true,
            })
          } Breaking down ${campaignMomentum.oversizedTask.title} is the cleanest reset move right now.`
          : campaignMomentum.interventionLevel === "reset"
          ? `${
            getCampaignPressureLead(campaignMomentum, {
              preferRepeatedSlip: true,
            })
          } This campaign needs a reset move right now.`
          : `${campaignMomentum.statusReason} This is the cleanest restart move right now.`,
      },
      proposal: null,
      priorityScore: score.score +
        (campaignMomentum.interventionLevel === "reset" ? 18 : 0),
    };
  }

  return null;
};

const buildDayDigest = (
  input: PlannerBuildInput,
  date: string,
  label: string,
  remainingOnly = false,
): string => {
  const items = collectScheduleItemsForDate(input, date, remainingOnly);
  if (items.length === 0) {
    return `${label}: nothing scheduled.`;
  }

  const nextItems = items.slice(0, 2).map((item) => item.label).join("; ");
  const overflowCount = items.length - 2;
  const overflowText = overflowCount > 0 ? `; +${overflowCount} more` : "";
  return `${label}: ${nextItems}${overflowText}.`;
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
  const dayLoadStatus =
    scheduleInsights?.dayLoads.find((day) => day.date === targetDate)?.status ??
      null;
  const isExplicitlyEmpty = scheduleInsights?.emptyDates.includes(targetDate) ??
    false;
  const isOpen = items.length === 0 || isExplicitlyEmpty ||
    dayLoadStatus === "open";
  const isLight = !isOpen &&
    (items.length <= 1 || dayLoadStatus === "balanced");
  const targetLabel = formatScheduleReference(
    input.currentDate,
    targetDate,
    true,
  );

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

const buildOpenDayReply = (
  input: PlannerBuildInput,
  targetDate: string,
): string | null => {
  const items = collectScheduleItemsForDate(input, targetDate, false);
  if (items.length > 0) return null;
  const label = formatScheduleReference(input.currentDate, targetDate, true);
  return `${label}: nothing scheduled.`;
};

const buildUpcomingDigestReply = (input: PlannerBuildInput): string => {
  const tomorrow = addDaysToDateKey(input.currentDate, 1);
  return [
    buildDayDigest(input, input.currentDate, "Today", true),
    buildDayDigest(input, tomorrow, "Tomorrow"),
  ].join("\n");
};

const formatEstimatedDurationLabel = (
  minutes: number | null | undefined,
): string => {
  if (!minutes || minutes <= 0) return "Flexible";
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 60 === 0) return `${minutes / 60} hr`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours} hr ${remainder} min`;
};

const mapPriorityScoreToSuggestedQuestType = (
  score: number | null | undefined,
  task?: PlannerContextTask | null,
): CompanionSuggestedQuest["type"] => {
  if (task?.priority === "high") return "must";
  if ((score ?? 0) >= 80) return "must";
  if ((score ?? 0) >= 55) return "should";
  return "nice";
};

const elevateSuggestedQuestType = (
  baseType: CompanionSuggestedQuest["type"],
  minimumType: CompanionSuggestedQuest["type"],
): CompanionSuggestedQuest["type"] => {
  const rank = (type: CompanionSuggestedQuest["type"]) =>
    type === "must" ? 3 : type === "should" ? 2 : 1;
  return rank(baseType) >= rank(minimumType) ? baseType : minimumType;
};

const getCampaignInterventionSuggestedType = (
  candidate: Pick<CampaignMomentumCandidate, "interventionLevel">,
  fallbackType: CompanionSuggestedQuest["type"],
): CompanionSuggestedQuest["type"] =>
  candidate.interventionLevel === "reset"
    ? "must"
    : candidate.interventionLevel === "protect"
    ? elevateSuggestedQuestType(fallbackType, "should")
    : fallbackType;

const mapDraftPriorityToSuggestedQuestType = (
  priority: number | null | undefined,
): CompanionSuggestedQuest["type"] => {
  if ((priority ?? 0) >= 5) return "must";
  if ((priority ?? 0) >= 3) return "should";
  return "nice";
};

const inferSuggestedQuestSourceFromTask = (
  task: PlannerContextTask | null | undefined,
): CompanionSuggestedQuestSource => {
  if (!task) return "optimization";
  if (
    /\b(recovery|reset|rest|walk|breath|breathe|pause|break)\b/i.test(
      task.title,
    )
  ) {
    return "recovery";
  }
  if (task.habitSourceId || task.recurrencePattern) return "habit";
  if (task.epicId || task.epicTitle) return "campaign";
  return "optimization";
};

const inferSuggestedQuestSourceFromProposal = (
  proposal: PlannerProposal,
  task?: PlannerContextTask | null,
): CompanionSuggestedQuestSource => {
  if (task) return inferSuggestedQuestSourceFromTask(task);

  const payload = proposal.payload as {
    category?: string | null;
    epicId?: string | null;
    notes?: string | null;
  };
  if (
    /\b(recovery|reset|rest|walk|breath|breathe|pause|break)\b/i.test(
      proposal.title,
    )
  ) {
    return "recovery";
  }
  if (payload.epicId) {
    return "campaign";
  }
  if (payload.category && /habit|ritual/i.test(payload.category)) {
    return "habit";
  }
  if (payload.notes && /epic|campaign/i.test(payload.notes)) {
    return "campaign";
  }
  return "optimization";
};

const findPlannerTaskById = (
  input: PlannerBuildInput,
  taskId: string | null | undefined,
): PlannerContextTask | null => {
  if (!taskId) return null;
  return [
    ...input.plannerContext.tasks,
    ...input.plannerContext.inboxTasks,
  ].find((task) => task.id === taskId) ?? null;
};

const getProposalTaskId = (proposal: PlannerProposal): string | null => {
  const payload = proposal.payload as {
    taskId?: string | null;
    task_id?: string | null;
  };
  return payload.taskId ?? payload.task_id ?? null;
};

const getProposalEstimatedDuration = (
  proposal: PlannerProposal,
  task?: PlannerContextTask | null,
): number | null => {
  const payload = proposal.payload as {
    estimatedDuration?: number | null;
    estimated_duration?: number | null;
    updates?: {
      estimated_duration?: number | null;
    };
  };
  return payload.estimatedDuration ??
    payload.estimated_duration ??
    payload.updates?.estimated_duration ??
    task?.estimatedDuration ??
    null;
};

const getSuggestedQuestTitleFromProposal = (
  proposal: PlannerProposal,
  task?: PlannerContextTask | null,
): string => {
  if (task?.title) return task.title;

  return proposal.title
    .replace(/^Create\s+/i, "")
    .replace(/^Move\s+/i, "")
    .trim();
};

const buildSuggestedQuestFromTask = (
  task: PlannerContextTask,
  reason: string,
  options?: {
    type?: CompanionSuggestedQuest["type"];
    proposalId?: string | null;
  },
): CompanionSuggestedQuest => ({
  suggestionId: `task:${task.id}`,
  proposalId: options?.proposalId ?? null,
  title: task.title,
  type: options?.type ?? mapPriorityScoreToSuggestedQuestType(null, task),
  estimatedDuration: formatEstimatedDurationLabel(task.estimatedDuration),
  estimatedDurationMinutes: task.estimatedDuration ?? null,
  source: inferSuggestedQuestSourceFromTask(task),
  reason,
});

const buildSuggestedQuestFromProposal = (
  input: PlannerBuildInput,
  proposal: PlannerProposal,
  reason?: string | null,
): CompanionSuggestedQuest => {
  const task = findPlannerTaskById(input, getProposalTaskId(proposal));

  return {
    suggestionId: proposal.id,
    proposalId: proposal.id,
    title: getSuggestedQuestTitleFromProposal(proposal, task),
    type: proposal.suggestedType ??
      mapPriorityScoreToSuggestedQuestType(null, task),
    estimatedDuration: formatEstimatedDurationLabel(
      getProposalEstimatedDuration(proposal, task),
    ),
    estimatedDurationMinutes: getProposalEstimatedDuration(proposal, task),
    source: inferSuggestedQuestSourceFromProposal(proposal, task),
    reason: reason ?? proposal.reasoning ?? proposal.summary,
  };
};

const proposalCountsAsQuestAction = (proposal: PlannerProposal): boolean =>
  proposal.kind === "create_quest" ||
  proposal.kind === "update_quest" ||
  proposal.kind === "suggest_reminder";

const proposalCountsAsCampaignAction = (
  proposal: PlannerProposal,
): boolean =>
  proposal.kind === "create_campaign" ||
  proposal.kind === "update_campaign" ||
  proposal.kind === "adjust_campaign_plan";

const shouldCreateQuestFromProposals = (
  proposals: PlannerProposal[],
): boolean => proposals.some(proposalCountsAsQuestAction);

const getProposalDrivenIntentType = (
  fallbackIntentType: CompanionIntentMetadata["intentType"],
  proposals: PlannerProposal[],
): CompanionIntentMetadata["intentType"] => {
  if (proposals.some(proposalCountsAsQuestAction)) return "quest";
  if (proposals.some(proposalCountsAsCampaignAction)) return "campaign";
  return fallbackIntentType;
};

type CampaignMomentumCandidate = {
  epic: PlannerContextEpic;
  linkedTasks: PlannerContextTask[];
  recentCompletedTasks: PlannerContextTask[];
  linkedRituals: PlannerContextRitual[];
  daysRemaining: number | null;
  progressPercentage: number;
  overdueTaskCount: number;
  scheduledTodayCount: number;
  unscheduledTaskCount: number;
  oversizedTask: PlannerContextTask | null;
  noRecentMomentum: boolean;
  daysWithoutMomentum: number | null;
  tooManyCampaigns: boolean;
  highestTaskScore: number;
  epicPriorityScore: number;
  status: CompanionCampaignStatus;
  statusReason: string;
  pressureSignals: string[];
  interventionLevel: "steady" | "nudge" | "protect" | "reset";
  selectionScore: number;
};

const getCampaignFollowUpEstimatedDurationMinutes = (
  input: PlannerBuildInput,
  candidate: CampaignMomentumCandidate,
): number => {
  if (candidate.oversizedTask) {
    return getHistoricalActivityDurationMinutes(
      input,
      `Break down ${candidate.oversizedTask.title}`,
      "quest",
    ) ?? 20;
  }
  if (campaignNeedsFollowUpDefinition(candidate)) {
    return getHistoricalActivityDurationMinutes(
      input,
      `Define next step for ${candidate.epic.title}`,
      "quest",
    ) ?? 20;
  }
  return 30;
};

const getCampaignBreakdownEstimatedDurationMinutes = (
  input: PlannerBuildInput,
  task: Pick<PlannerContextTask, "title">,
): number =>
  getHistoricalActivityDurationMinutes(
    input,
    `Break down ${task.title}`,
    "quest",
  ) ?? 20;

const getCampaignAdjustmentEstimatedDurationMinutes = (
  input: PlannerBuildInput,
  candidate: CampaignMomentumCandidate,
): number =>
  getHistoricalActivityDurationMinutes(
    input,
    `Adjust ${candidate.epic.title}`,
    "quest",
  ) ?? 20;

const getTaskPriorityScoreMap = (
  input: PlannerBuildInput,
): Map<string, PlannerPriorityScore> =>
  new Map(
    getResolvedPriorityScores(input)
      .filter((score) => score.kind === "task" && score.taskId)
      .map((score) => [score.taskId as string, score]),
  );

const getEpicPriorityScoreMap = (
  input: PlannerBuildInput,
): Map<string, PlannerPriorityScore> =>
  new Map(
    getResolvedPriorityScores(input)
      .filter((score) => score.kind === "epic" && score.epicId)
      .map((score) => [score.epicId as string, score]),
  );

const getEpicDaysRemaining = (
  input: PlannerBuildInput,
  epic: PlannerContextEpic,
): number | null => {
  if (
    typeof epic.daysRemaining === "number" &&
    Number.isFinite(epic.daysRemaining)
  ) {
    return epic.daysRemaining;
  }
  if (!epic.endDate) return null;

  const current = new Date(`${input.currentDate}T00:00:00`);
  const target = new Date(`${epic.endDate}T00:00:00`);
  if (Number.isNaN(current.getTime()) || Number.isNaN(target.getTime())) {
    return null;
  }

  return Math.ceil((target.getTime() - current.getTime()) / 86_400_000);
};

const REPEATED_CAMPAIGN_SLIP_SIGNAL =
  "This campaign has slipped repeatedly without a protected recovery move.";

const hasRepeatedCampaignSlip = (params: {
  overdueTaskCount: number;
  scheduledTodayCount: number;
  noRecentMomentum: boolean;
}): boolean =>
  params.overdueTaskCount > 0 &&
  params.scheduledTodayCount === 0 &&
  params.noRecentMomentum;

const classifyCampaignMomentum = (params: {
  daysRemaining: number | null;
  progressPercentage: number;
  linkedTaskCount: number;
  recentCompletedTaskCount: number;
  linkedRitualCount: number;
  overdueTaskCount: number;
  scheduledTodayCount: number;
  unscheduledTaskCount: number;
  oversizedTask: PlannerContextTask | null;
  noRecentMomentum: boolean;
  daysWithoutMomentum: number | null;
  tooManyCampaigns: boolean;
}): {
  status: CompanionCampaignStatus;
  statusReason: string;
} => {
  if (
    params.daysRemaining !== null &&
    params.daysRemaining <= 7 &&
    (
      params.progressPercentage < 70 ||
      params.overdueTaskCount > 0 ||
      params.scheduledTodayCount === 0
    )
  ) {
    return {
      status: "at_risk",
      statusReason: params.overdueTaskCount > 0
        ? "The deadline is close and unfinished campaign work is already slipping behind."
        : params.oversizedTask
        ? "The deadline is close and the remaining work is still too large to start cleanly."
        : params.linkedTaskCount === 0 && params.recentCompletedTaskCount > 0
        ? "The deadline is close and recent progress needs a concrete follow-up step protected next."
        : "The deadline is close and there is not a clear protected step on the board yet.",
    };
  }

  if (
    (params.linkedTaskCount === 0 && params.recentCompletedTaskCount === 0) ||
    (params.overdueTaskCount >= 2 && params.scheduledTodayCount === 0) ||
    (params.oversizedTask !== null && params.progressPercentage < 55) ||
    params.noRecentMomentum ||
    (
      params.linkedTaskCount > 0 &&
      params.unscheduledTaskCount === params.linkedTaskCount &&
      params.progressPercentage < 40
    )
  ) {
    return {
      status: "stalled",
      statusReason: params.linkedTaskCount === 0 &&
          params.recentCompletedTaskCount === 0
        ? "There is no concrete next step tied to this campaign right now."
        : params.oversizedTask
        ? "The next campaign task is still too large and undefined, so it is hard to start cleanly."
        : params.noRecentMomentum
        ? "The campaign has gone quiet long enough that it needs a smaller restart move."
        : "The campaign has work attached, but nothing is clearly moving it forward today.",
    };
  }

  if (
    params.scheduledTodayCount > 0 ||
    (
      params.progressPercentage >= 70 &&
      (params.linkedTaskCount > 0 || params.linkedRitualCount > 0)
    )
  ) {
    return {
      status: "moving",
      statusReason: params.scheduledTodayCount > 0
        ? "You already have campaign work lined up for today, so momentum is alive."
        : "The campaign already has active support around it and is not drifting.",
    };
  }

  return {
    status: "drifting",
    statusReason: params.tooManyCampaigns
      ? "This campaign still matters, but it is competing with too many active campaigns right now."
      : params.linkedTaskCount === 0 && params.recentCompletedTaskCount > 0
      ? "You made recent progress here, but there is no concrete follow-up quest linked yet."
      : params.linkedTaskCount > 0
      ? "There is still campaign work available, but it is not anchored strongly enough yet."
      : "The campaign still matters, but it needs one concrete move to get traction again.",
  };
};

const getCampaignPressureSignals = (
  input: PlannerBuildInput,
  params: {
    linkedTasks: PlannerContextTask[];
    recentCompletedTaskCount: number;
    daysRemaining: number | null;
    overdueTaskCount: number;
    scheduledTodayCount: number;
    unscheduledTaskCount: number;
    oversizedTask: PlannerContextTask | null;
    noRecentMomentum: boolean;
    daysWithoutMomentum: number | null;
    tooManyCampaigns: boolean;
  },
): string[] => {
  const signals: string[] = [];

  if (params.daysRemaining !== null && params.daysRemaining <= 7) {
    signals.push(
      params.daysRemaining <= 0
        ? "Deadline is due now."
        : `Deadline in ${params.daysRemaining} ${
          params.daysRemaining === 1 ? "day" : "days"
        }.`,
    );
  }

  if (params.overdueTaskCount > 0) {
    signals.push(
      `${params.overdueTaskCount} overdue ${
        params.overdueTaskCount === 1 ? "quest" : "quests"
      } ${params.overdueTaskCount === 1 ? "is" : "are"} already slipping.`,
    );
  }

  if (hasRepeatedCampaignSlip(params)) {
    signals.push(REPEATED_CAMPAIGN_SLIP_SIGNAL);
  }

  if (params.linkedTasks.length === 0) {
    signals.push(
      params.recentCompletedTaskCount > 0
        ? "Recent campaign progress needs a concrete follow-up quest."
        : "No concrete next quest is linked yet.",
    );
  } else if (params.scheduledTodayCount === 0) {
    if (params.unscheduledTaskCount === params.linkedTasks.length) {
      signals.push("No linked campaign work is scheduled yet.");
    } else {
      signals.push("No campaign step is protected today.");
    }
  }

  if (params.oversizedTask) {
    signals.push(
      `"${params.oversizedTask.title}" is still too large to start cleanly.`,
    );
  }

  if (params.noRecentMomentum) {
    signals.push(
      params.daysWithoutMomentum !== null
        ? `No visible campaign movement in the last ${params.daysWithoutMomentum} ${
          params.daysWithoutMomentum === 1 ? "day" : "days"
        }.`
        : "No visible campaign movement recently.",
    );
  }

  if (params.tooManyCampaigns) {
    signals.push(
      `Attention is split across ${input.plannerContext.activeEpics.length} active campaigns.`,
    );
  }

  return [...new Set(signals)].slice(0, 5);
};

const getCampaignPressureLead = (
  candidate: Pick<
    CampaignMomentumCandidate,
    | "pressureSignals"
    | "statusReason"
    | "overdueTaskCount"
    | "scheduledTodayCount"
    | "noRecentMomentum"
  >,
  options?: {
    preferRepeatedSlip?: boolean;
  },
): string =>
  options?.preferRepeatedSlip &&
    hasRepeatedCampaignSlip(candidate)
    ? REPEATED_CAMPAIGN_SLIP_SIGNAL
    : candidate.pressureSignals[0] ?? candidate.statusReason;

const getCampaignInterventionLevel = (params: {
  status: CompanionCampaignStatus;
  progressPercentage: number;
  linkedTaskCount: number;
  recentCompletedTaskCount: number;
  overdueTaskCount: number;
  scheduledTodayCount: number;
  unscheduledTaskCount: number;
  oversizedTask: PlannerContextTask | null;
  noRecentMomentum: boolean;
  daysWithoutMomentum: number | null;
  tooManyCampaigns: boolean;
}): CampaignMomentumCandidate["interventionLevel"] => {
  if (params.status === "moving") return "steady";

  if (
    hasRepeatedCampaignSlip(params) ||
    (params.daysWithoutMomentum !== null && params.daysWithoutMomentum >= 10) ||
    (params.tooManyCampaigns && params.progressPercentage < 60) ||
    (params.status === "at_risk" && (
      params.overdueTaskCount >= 2 ||
      params.noRecentMomentum ||
      params.oversizedTask !== null ||
      (
        params.linkedTaskCount === 0 &&
        params.recentCompletedTaskCount === 0
      )
    )) ||
    (params.status === "stalled" && (
      params.noRecentMomentum ||
      params.oversizedTask !== null ||
      params.linkedTaskCount === 0 ||
      (
        params.overdueTaskCount > 0 &&
        params.unscheduledTaskCount === params.linkedTaskCount
      )
    ))
  ) {
    return "reset";
  }

  if (params.status === "at_risk" || params.status === "stalled") {
    return "protect";
  }

  return "nudge";
};

const getTaskCampaignMomentum = (
  input: PlannerBuildInput,
  task: PlannerContextTask,
): CampaignMomentumCandidate | null => {
  if (!task.epicId) return null;
  const epic = input.plannerContext.activeEpics.find((candidate) =>
    candidate.id === task.epicId
  );
  if (!epic) return null;
  return buildCampaignMomentumCandidate(input, epic);
};

const buildCampaignMomentumCandidate = (
  input: PlannerBuildInput,
  epic: PlannerContextEpic,
  options?: {
    matchedEpicId?: string | null;
    taskScoreMap?: Map<string, PlannerPriorityScore>;
    epicScoreMap?: Map<string, PlannerPriorityScore>;
  },
): CampaignMomentumCandidate => {
  const linkedTasks = [
    ...input.plannerContext.tasks,
    ...input.plannerContext.inboxTasks,
  ]
    .filter((task) => task.completed !== true && task.epicId === epic.id);
  const linkedRituals = input.plannerContext.rituals.filter((ritual) =>
    ritual.epicId === epic.id
  );
  const recentCompletedTasks = (input.plannerContext.recentCompletedTasks ?? [])
    .filter((task) =>
      task.completed === true &&
      task.epicId === epic.id &&
      Boolean(toDateKeyFromTimestamp(task.completedAt) ?? task.taskDate)
    );
  const daysRemaining = getEpicDaysRemaining(input, epic);
  const progressPercentage = typeof epic.progressPercentage === "number" &&
      Number.isFinite(epic.progressPercentage)
    ? epic.progressPercentage
    : 0;
  const overdueTaskCount =
    linkedTasks.filter((task) =>
      Boolean(task.taskDate) && (task.taskDate as string) < input.currentDate
    ).length;
  const scheduledTodayCount =
    linkedTasks.filter((task) => task.taskDate === input.currentDate).length;
  const unscheduledTaskCount =
    linkedTasks.filter((task) => !task.taskDate && !task.scheduledTime).length;
  const oversizedTask = linkedTasks
    .filter((task) =>
      (task.estimatedDuration ?? 0) >= 90 &&
      (!task.subtaskTitles || task.subtaskTitles.length === 0)
    )
    .sort((left, right) =>
      (right.estimatedDuration ?? 0) - (left.estimatedDuration ?? 0)
    )[0] ?? null;
  const recentMomentumThreshold = addDaysToDateKey(input.currentDate, -5);
  const latestAnchoredMomentumDate = linkedTasks
    .map((task) => task.taskDate)
    .filter((date): date is string =>
      typeof date === "string" && date <= input.currentDate
    )
    .sort()
    .at(-1) ?? null;
  const latestCompletedMomentumDate = recentCompletedTasks
    .map((task) => toDateKeyFromTimestamp(task.completedAt) ?? task.taskDate)
    .filter((date): date is string =>
      typeof date === "string" && date <= input.currentDate
    )
    .sort()
    .at(-1) ?? null;
  const latestMomentumDate = [
    latestAnchoredMomentumDate,
    latestCompletedMomentumDate,
  ]
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1) ?? null;
  const hasRecentCompletedMomentum = recentCompletedTasks.some((task) => {
    const completedDate = toDateKeyFromTimestamp(task.completedAt) ??
      task.taskDate;
    return typeof completedDate === "string" &&
      completedDate >= recentMomentumThreshold &&
      completedDate <= input.currentDate;
  });
  const hasRecentAnchoredMomentum = linkedTasks.some((task) =>
    typeof task.taskDate === "string" &&
    task.taskDate >= recentMomentumThreshold &&
    task.taskDate <= input.currentDate
  );
  const hasUpcomingProtectedMomentum = linkedTasks.some((task) =>
    typeof task.taskDate === "string" && task.taskDate > input.currentDate
  );
  const daysWithoutMomentum = latestMomentumDate
    ? diffDateKeys(latestMomentumDate, input.currentDate)
    : null;
  const noRecentMomentum = linkedTasks.length > 0 &&
    !hasRecentAnchoredMomentum &&
    !hasRecentCompletedMomentum &&
    !hasUpcomingProtectedMomentum &&
    scheduledTodayCount === 0;
  const taskScoreMap = options?.taskScoreMap ?? getTaskPriorityScoreMap(input);
  const epicScoreMap = options?.epicScoreMap ?? getEpicPriorityScoreMap(input);
  const highestTaskScore = linkedTasks.reduce((highest, task) => {
    const score = taskScoreMap.get(task.id)?.score ?? 0;
    return Math.max(highest, score);
  }, 0);
  const epicPriorityScore = epicScoreMap.get(epic.id)?.score ?? 0;
  const { status, statusReason } = classifyCampaignMomentum({
    daysRemaining,
    progressPercentage,
    linkedTaskCount: linkedTasks.length,
    recentCompletedTaskCount: recentCompletedTasks.length,
    linkedRitualCount: linkedRituals.length,
    overdueTaskCount,
    scheduledTodayCount,
    unscheduledTaskCount,
    oversizedTask,
    noRecentMomentum,
    daysWithoutMomentum,
    tooManyCampaigns: input.plannerContext.activeEpics.length > 3,
  });
  const tooManyCampaigns = input.plannerContext.activeEpics.length > 3;
  const pressureSignals = getCampaignPressureSignals(input, {
    linkedTasks,
    recentCompletedTaskCount: recentCompletedTasks.length,
    daysRemaining,
    overdueTaskCount,
    scheduledTodayCount,
    unscheduledTaskCount,
    oversizedTask,
    noRecentMomentum,
    daysWithoutMomentum,
    tooManyCampaigns,
  });
  const interventionLevel = getCampaignInterventionLevel({
    status,
    progressPercentage,
    linkedTaskCount: linkedTasks.length,
    recentCompletedTaskCount: recentCompletedTasks.length,
    overdueTaskCount,
    scheduledTodayCount,
    unscheduledTaskCount,
    oversizedTask,
    noRecentMomentum,
    daysWithoutMomentum,
    tooManyCampaigns,
  });

  let selectionScore = epicPriorityScore + (highestTaskScore * 0.45) +
    (linkedRituals.length * 4);

  if (options?.matchedEpicId === epic.id) selectionScore += 1000;
  if (status === "at_risk") selectionScore += 90;
  else if (status === "stalled") selectionScore += 65;
  else if (status === "drifting") selectionScore += 35;
  else selectionScore += 15;

  if (daysRemaining !== null && daysRemaining <= 14) selectionScore += 18;
  if (overdueTaskCount > 0) selectionScore += overdueTaskCount * 10;
  if (linkedTasks.length === 0) selectionScore += 12;
  if (oversizedTask) selectionScore += 12;
  if (noRecentMomentum) selectionScore += 10;
  if (daysWithoutMomentum !== null && daysWithoutMomentum >= 10) {
    selectionScore += 8;
  }
  if (tooManyCampaigns) selectionScore += 6;
  if (interventionLevel === "reset") selectionScore += 24;
  else if (interventionLevel === "protect") selectionScore += 10;
  else if (interventionLevel === "nudge") selectionScore += 4;

  return {
    epic,
    linkedTasks,
    recentCompletedTasks,
    linkedRituals,
    daysRemaining,
    progressPercentage,
    overdueTaskCount,
    scheduledTodayCount,
    unscheduledTaskCount,
    oversizedTask,
    noRecentMomentum,
    daysWithoutMomentum,
    tooManyCampaigns,
    highestTaskScore,
    epicPriorityScore,
    status,
    statusReason,
    pressureSignals,
    interventionLevel,
    selectionScore,
  };
};

const selectCampaignMomentumCandidate = (
  input: PlannerBuildInput,
  matchedEpicId?: string | null,
): CampaignMomentumCandidate | null => {
  const taskScoreMap = getTaskPriorityScoreMap(input);
  const epicScoreMap = getEpicPriorityScoreMap(input);

  return input.plannerContext.activeEpics
    .map((epic) =>
      buildCampaignMomentumCandidate(input, epic, {
        matchedEpicId,
        taskScoreMap,
        epicScoreMap,
      })
    )
    .sort((left, right) => right.selectionScore - left.selectionScore)[0] ??
    null;
};

const buildRitualSupportAction = (
  ritual: PlannerContextRitual,
  campaignTitle: string,
): CompanionSuggestedQuest => {
  const estimatedDurationMinutes = getRitualDurationMinutes(ritual);
  return {
    suggestionId: `ritual:${ritual.id}`,
    proposalId: null,
    title: `Keep ${ritual.title}`,
    type: "nice",
    estimatedDuration: formatEstimatedDurationLabel(estimatedDurationMinutes),
    estimatedDurationMinutes,
    source: "habit",
    reason: ritual.preferredTime
      ? `${ritual.title} keeps ${campaignTitle} moving when you hit its usual ${ritual.preferredTime} slot.`
      : `${ritual.title} is a steady support move for ${campaignTitle}.`,
  };
};

const selectCampaignNextTask = (
  input: PlannerBuildInput,
  candidate: CampaignMomentumCandidate,
): PlannerContextTask | null => {
  const taskScoreMap = getTaskPriorityScoreMap(input);

  return candidate.linkedTasks
    .slice()
    .sort((left, right) => {
      const leftToday = left.taskDate === input.currentDate ? 1 : 0;
      const rightToday = right.taskDate === input.currentDate ? 1 : 0;
      if (rightToday !== leftToday) return rightToday - leftToday;

      const leftOverdue = left.taskDate && left.taskDate < input.currentDate
        ? 1
        : 0;
      const rightOverdue = right.taskDate && right.taskDate < input.currentDate
        ? 1
        : 0;
      if (rightOverdue !== leftOverdue) return rightOverdue - leftOverdue;

      const scoreDiff = (taskScoreMap.get(right.id)?.score ?? 0) -
        (taskScoreMap.get(left.id)?.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;

      const rightPriority = right.priority === "high"
        ? 2
        : right.priority === "medium"
        ? 1
        : 0;
      const leftPriority = left.priority === "high"
        ? 2
        : left.priority === "medium"
        ? 1
        : 0;
      if (rightPriority !== leftPriority) return rightPriority - leftPriority;

      if (left.taskDate && right.taskDate && left.taskDate !== right.taskDate) {
        return left.taskDate.localeCompare(right.taskDate);
      }

      const leftTime = parseTimeToMinutes(left.scheduledTime);
      const rightTime = parseTimeToMinutes(right.scheduledTime);
      return (leftTime ?? 9999) - (rightTime ?? 9999);
    })[0] ?? null;
};

const campaignNeedsFollowUpDefinition = (
  candidate: Pick<CampaignMomentumCandidate, "linkedTasks" | "oversizedTask">,
): boolean =>
  candidate.linkedTasks.length === 0 && candidate.oversizedTask === null;

const buildCampaignNextStepProposal = (
  input: PlannerBuildInput,
  candidate: CampaignMomentumCandidate,
  options?: {
    targetDate?: string;
    scheduledTime?: string | null;
    estimatedDuration?: number;
  },
): PlannerProposal => {
  const targetDate = options?.targetDate ?? input.currentDate;
  const explicitScheduledTime = options?.scheduledTime ?? null;
  const suggestedSlot = findSuggestedSlot(
    input,
    targetDate,
    explicitScheduledTime,
  ) ??
    (targetDate === input.currentDate
      ? input.plannerContext.scheduleInsights?.suggestedSlots[0] ?? null
      : null);
  const needsFollowUpDefinition = campaignNeedsFollowUpDefinition(candidate);
  const title = candidate.oversizedTask
    ? `Break down ${candidate.oversizedTask.title}`
    : candidate.status === "stalled" || needsFollowUpDefinition
    ? `Define next step for ${candidate.epic.title}`
    : `Progress ${candidate.epic.title}`;
  const defaultEstimatedDuration = candidate.oversizedTask
    ? 20
    : needsFollowUpDefinition
    ? 20
    : candidate.status === "at_risk"
    ? 45
    : 30;
  const baseEstimatedDuration = getHistoricalActivityDurationMinutes(
    input,
    title,
    "quest",
  ) ?? defaultEstimatedDuration;
  const estimatedDuration = options?.estimatedDuration ??
    fitPlannerDurationBucketWithin(
      Math.min(
        getOpenSlotDurationMinutes(suggestedSlot) ?? baseEstimatedDuration,
        baseEstimatedDuration,
      ),
    ) ?? baseEstimatedDuration;

  return {
    id: createId(),
    kind: "create_quest",
    title: `Create ${title}`,
    suggestedType: getCampaignInterventionSuggestedType(
      candidate,
      candidate.status === "at_risk"
        ? "must"
        : candidate.status === "stalled" || needsFollowUpDefinition
        ? "should"
        : "nice",
    ),
    summary: `Create a quest for "${title}"${
      suggestedSlot?.time ? ` at ${suggestedSlot.time}` : ""
    }.`,
    reasoning: candidate.oversizedTask
      ? "The remaining campaign work is too large to start cleanly, so I'm shrinking it into a smaller first move."
      : candidate.status === "stalled"
      ? "There is no clean next step attached to this campaign, so I'm drafting the smallest meaningful move."
      : needsFollowUpDefinition
      ? "You made progress here recently, but there is no linked follow-up step yet, so I'm drafting the cleanest next move."
      : "This campaign needs one protected action to keep momentum from drifting.",
    payload: {
      taskText: title,
      difficulty: candidate.oversizedTask
        ? "easy"
        : needsFollowUpDefinition
        ? "medium"
        : candidate.status === "at_risk"
        ? "hard"
        : "medium",
      taskDate: suggestedSlot?.date ?? targetDate,
      scheduledTime: explicitScheduledTime ?? suggestedSlot?.time ?? null,
      estimatedDuration,
      source: "optimizer",
      epicId: candidate.epic.id,
      notes: candidate.oversizedTask
        ? `Shrink "${candidate.oversizedTask.title}" into the smallest concrete first pass for ${candidate.epic.title}.`
        : candidate.statusReason,
    },
    status: "pending",
    readyToConfirm: true,
    missingFields: [],
  };
};

const shouldDraftCampaignAdjustment = (
  candidate: CampaignMomentumCandidate,
): boolean =>
  (
    candidate.interventionLevel === "reset" &&
    (
      hasRepeatedCampaignSlip(candidate) ||
      (candidate.noRecentMomentum && candidate.overdueTaskCount > 0) ||
      (
        candidate.linkedTasks.length === 0 &&
        candidate.recentCompletedTasks.length === 0
      ) ||
      candidate.tooManyCampaigns
    )
  ) ||
  (
    candidate.status === "at_risk" &&
    (
      candidate.overdueTaskCount >= 2 ||
      candidate.progressPercentage < 35 ||
      (
        candidate.daysRemaining !== null &&
        candidate.daysRemaining <= 3 &&
        candidate.scheduledTodayCount === 0
      )
    )
  ) ||
  (
    candidate.tooManyCampaigns &&
    candidate.status !== "moving" &&
    candidate.progressPercentage < 60
  );

const shouldSuggestStrategicCampaignAdjustment = (
  candidate: CampaignMomentumCandidate,
): boolean =>
  shouldDraftCampaignAdjustment(candidate) &&
  (
    hasRepeatedCampaignSlip(candidate) ||
    (
      candidate.linkedTasks.length === 0 &&
      candidate.recentCompletedTasks.length === 0
    )
  );

const buildCampaignAdjustmentSuggestedQuest = (
  input: PlannerBuildInput,
  candidate: CampaignMomentumCandidate,
  options?: {
    type?: CompanionSuggestedQuest["type"];
    reason?: string | null;
    suggestionIdPrefix?: string;
  },
): CompanionSuggestedQuest => {
  const pressureLead = getCampaignPressureLead(candidate, {
    preferRepeatedSlip: true,
  });
  const estimatedDurationMinutes =
    getCampaignAdjustmentEstimatedDurationMinutes(
      input,
      candidate,
    );

  return {
    suggestionId: `${
      options?.suggestionIdPrefix ?? "campaign-adjust"
    }:${candidate.epic.id}`,
    proposalId: null,
    title: `Adjust ${candidate.epic.title}`,
    type: options?.type ??
      getCampaignInterventionSuggestedType(candidate, "must"),
    estimatedDuration: formatEstimatedDurationLabel(estimatedDurationMinutes),
    estimatedDurationMinutes,
    source: "campaign",
    reason: options?.reason ??
      `${pressureLead} This needs a reset plan, not another isolated task.`,
  };
};

const buildCampaignAdjustmentProposalForMomentum = (
  input: PlannerBuildInput,
  candidate: CampaignMomentumCandidate,
): PlannerProposal => {
  const repeatedSlip = hasRepeatedCampaignSlip(candidate);
  const adjustmentType = candidate.tooManyCampaigns
    ? "reduce_scope"
    : repeatedSlip
    ? "reschedule"
    : candidate.progressPercentage < 35
    ? "reduce_scope"
    : candidate.overdueTaskCount >= 2
    ? "reschedule"
    : "custom";
  const estimatedDurationMinutes =
    getCampaignAdjustmentEstimatedDurationMinutes(
      input,
      candidate,
    );

  return {
    id: createId(),
    kind: "adjust_campaign_plan",
    title: `Adjust ${candidate.epic.title}`,
    suggestedType: getCampaignInterventionSuggestedType(candidate, "must"),
    summary:
      `Generate a revised plan for "${candidate.epic.title}" so the next step is realistic again before the current deadline.`,
    reasoning: repeatedSlip
      ? "This campaign has slipped more than once, so it needs a reset plan instead of another isolated task draft."
      : "This campaign is under enough pressure that it needs a plan adjustment, not just another optimistic task draft.",
    payload: {
      epicId: candidate.epic.id,
      epicTitle: candidate.epic.title,
      estimatedDuration: estimatedDurationMinutes,
      adjustmentType,
      reason: candidate.tooManyCampaigns
        ? `${candidate.statusReason} You have too many active campaigns competing for attention right now.`
        : repeatedSlip
        ? `${candidate.statusReason} This campaign has slipped repeatedly and needs a reset plan, not another isolated task.`
        : candidate.statusReason,
      requestedSummary: repeatedSlip
        ? `Reset ${candidate.epic.title} by shrinking the overdue work and protecting one smaller recovery move this week.`
        : candidate.daysRemaining !== null
        ? `Rework ${candidate.epic.title} so it can still move cleanly within ${candidate.daysRemaining} day${
          candidate.daysRemaining === 1 ? "" : "s"
        }.`
        : candidate.tooManyCampaigns
        ? `Rework ${candidate.epic.title} with a smaller scope or a cleaner priority order because too many active campaigns are competing at once.`
        : `Rework ${candidate.epic.title} so the next step becomes realistic again.`,
    },
    status: "pending",
    readyToConfirm: true,
    missingFields: [],
  };
};

const formatCampaignMomentumStatusLabel = (
  status: CompanionCampaignStatus,
): string => status === "at_risk" ? "at risk" : status;

const formatCampaignInterventionLabel = (
  level: CampaignMomentumCandidate["interventionLevel"],
): string =>
  level === "reset"
    ? "reset"
    : level === "protect"
    ? "protect"
    : level === "nudge"
    ? "nudge"
    : "steady";

const buildPriorityOverviewCampaignPressureLine = (
  input: PlannerBuildInput,
  priorityScores: PlannerPriorityScore[],
): string | null => {
  for (const score of priorityScores) {
    if (score.kind !== "epic" || !score.epicId) continue;

    const epic = input.plannerContext.activeEpics.find((candidate) =>
      candidate.id === score.epicId
    );
    if (!epic) continue;

    const campaignMomentum = buildCampaignMomentumCandidate(input, epic);
    if (campaignMomentum.status === "moving") continue;

    const linkedTask = selectCampaignNextTask(input, campaignMomentum);
    const pressureLead = getCampaignPressureLead(campaignMomentum, {
      preferRepeatedSlip: true,
    });
    const lead = `Campaign pressure: ${epic.title} is ${
      formatCampaignMomentumStatusLabel(campaignMomentum.status)
    }. ${pressureLead}`;

    if (shouldSuggestStrategicCampaignAdjustment(campaignMomentum)) {
      return `${lead} The honest next move is to adjust the campaign plan before adding more work.`;
    }

    if (campaignMomentum.tooManyCampaigns) {
      return linkedTask
        ? `${lead} Too many active campaigns are competing right now, so if you protect one move, make it ${linkedTask.title}.`
        : `${lead} Too many active campaigns are competing right now, so reducing scope or deliberately deprioritizing another campaign matters more than adding random work.`;
    }

    if (linkedTask) {
      return `${lead} If you protect one campaign move, make it ${linkedTask.title}.`;
    }

    if (campaignMomentum.oversizedTask) {
      return `${lead} The honest next move is to break down ${campaignMomentum.oversizedTask.title} before trying to push it.`;
    }

    return `${lead} The honest next move is to define one smaller step before you add more pressure.`;
  }

  return null;
};

const getPriorityOverviewFocusCampaign = (
  input: PlannerBuildInput,
  priorityScores: PlannerPriorityScore[],
): CampaignMomentumCandidate | null => {
  const seenEpicIds = new Set<string>();
  const candidates: CampaignMomentumCandidate[] = [];

  for (const score of priorityScores) {
    let candidate: CampaignMomentumCandidate | null = null;

    if (score.kind === "epic" && score.epicId) {
      const epic = input.plannerContext.activeEpics.find((activeEpic) =>
        activeEpic.id === score.epicId
      );
      if (epic) {
        candidate = buildCampaignMomentumCandidate(input, epic);
      }
    } else if (score.kind === "task" && score.taskId) {
      const task = findPlannerTaskById(input, score.taskId);
      if (task) {
        candidate = getTaskCampaignMomentum(input, task);
      }
    }

    if (
      !candidate || candidate.status === "moving" ||
      seenEpicIds.has(candidate.epic.id)
    ) {
      continue;
    }

    seenEpicIds.add(candidate.epic.id);
    candidates.push(candidate);
  }

  return candidates.sort((left, right) =>
    right.selectionScore - left.selectionScore
  )[0] ?? null;
};

const buildPriorityOverviewSummary = (
  input: PlannerBuildInput,
  score: PlannerPriorityScore,
): string => {
  if (score.kind === "epic" && score.epicId) {
    const epic = input.plannerContext.activeEpics.find((candidate) =>
      candidate.id === score.epicId
    );
    if (epic) {
      const campaignMomentum = buildCampaignMomentumCandidate(input, epic);
      if (campaignMomentum.status !== "moving") {
        const pressureLead = getCampaignPressureLead(campaignMomentum, {
          preferRepeatedSlip: true,
        });
        if (shouldSuggestStrategicCampaignAdjustment(campaignMomentum)) {
          return `${epic.title} because ${pressureLead} The honest next move is to adjust the campaign plan before adding more work.`;
        }
        const linkedTask = selectCampaignNextTask(input, campaignMomentum);
        if (linkedTask) {
          return `${epic.title} because ${pressureLead} Protect ${linkedTask.title} next.`;
        }
        if (campaignNeedsFollowUpDefinition(campaignMomentum)) {
          return `${epic.title} because ${pressureLead} Define the next step before you add more work.`;
        }
        return `${epic.title} because ${pressureLead}.`;
      }
    }
  }

  if (score.kind === "task" && score.taskId) {
    const task = findPlannerTaskById(input, score.taskId);
    const campaignMomentum = task ? getTaskCampaignMomentum(input, task) : null;
    if (task && campaignMomentum && campaignMomentum.status !== "moving") {
      const pressureLead = getCampaignPressureLead(campaignMomentum, {
        preferRepeatedSlip: true,
      });
      if (shouldSuggestStrategicCampaignAdjustment(campaignMomentum)) {
        return `${task.title} because ${pressureLead} The honest next move is to adjust the campaign plan before adding more work.`;
      }
      return `${task.title} because ${pressureLead} This is the clearest move to protect next.`;
    }
  }

  if (score.reasons.length === 0) return score.title;
  if (score.reasons.length === 1) {
    return `${score.title} because ${score.reasons[0]}.`;
  }
  return `${score.title} because ${score.reasons[0]} and ${score.reasons[1]}.`;
};

const buildPriorityOverviewSuggestion = (
  input: PlannerBuildInput,
  score: PlannerPriorityScore,
): CompanionSuggestedQuest | null => {
  if (score.kind === "task" && score.taskId) {
    const task = findPlannerTaskById(input, score.taskId);
    if (!task || task.completed === true) return null;

    const campaignMomentum = getTaskCampaignMomentum(input, task);
    const pressureLead = campaignMomentum
      ? getCampaignPressureLead(campaignMomentum, {
        preferRepeatedSlip: true,
      })
      : null;
    const baseType = mapPriorityScoreToSuggestedQuestType(score.score, task);

    if (
      campaignMomentum &&
      shouldSuggestStrategicCampaignAdjustment(campaignMomentum)
    ) {
      return buildCampaignAdjustmentSuggestedQuest(input, campaignMomentum, {
        suggestionIdPrefix: "priority:campaign-adjust",
        type: getCampaignInterventionSuggestedType(campaignMomentum, baseType),
      });
    }

    if (
      campaignMomentum?.oversizedTask?.id === task.id &&
      campaignMomentum.interventionLevel === "reset"
    ) {
      return {
        suggestionId: `priority:campaign-breakdown:${task.id}`,
        proposalId: null,
        title: `Break down ${task.title}`,
        type: getCampaignInterventionSuggestedType(campaignMomentum, baseType),
        estimatedDuration: formatEstimatedDurationLabel(
          getCampaignBreakdownEstimatedDurationMinutes(input, task),
        ),
        estimatedDurationMinutes: getCampaignBreakdownEstimatedDurationMinutes(
          input,
          task,
        ),
        source: "campaign",
        reason: `${pressureLead} This needs a smaller reset move right now.`,
      };
    }

    return buildSuggestedQuestFromTask(
      task,
      campaignMomentum && campaignMomentum.status !== "moving"
        ? campaignMomentum.interventionLevel === "reset"
          ? `${pressureLead} This needs a reset move right now.`
          : `${pressureLead} This is one of the clearest moves to protect right now.`
        : score.reasons[0] ??
          "This is one of the clearest moves to protect right now.",
      {
        type: campaignMomentum && campaignMomentum.status !== "moving"
          ? getCampaignInterventionSuggestedType(campaignMomentum, baseType)
          : baseType,
      },
    );
  }

  if (score.kind === "epic" && score.epicId) {
    const epic = input.plannerContext.activeEpics.find((candidate) =>
      candidate.id === score.epicId
    );
    if (!epic) return null;

    const campaignMomentum = buildCampaignMomentumCandidate(input, epic);
    const pressureLead = getCampaignPressureLead(campaignMomentum, {
      preferRepeatedSlip: true,
    });
    const linkedTask = selectCampaignNextTask(input, campaignMomentum);

    if (shouldSuggestStrategicCampaignAdjustment(campaignMomentum)) {
      return buildCampaignAdjustmentSuggestedQuest(input, campaignMomentum, {
        suggestionIdPrefix: "priority:campaign-adjust",
        type: getCampaignInterventionSuggestedType(
          campaignMomentum,
          campaignMomentum.status === "at_risk" ? "must" : "should",
        ),
      });
    }

    if (
      campaignMomentum.oversizedTask &&
      campaignMomentum.interventionLevel === "reset" &&
      (!linkedTask || linkedTask.id === campaignMomentum.oversizedTask.id)
    ) {
      return {
        suggestionId:
          `priority:campaign-breakdown:${campaignMomentum.oversizedTask.id}`,
        proposalId: null,
        title: `Break down ${campaignMomentum.oversizedTask.title}`,
        type: getCampaignInterventionSuggestedType(campaignMomentum, "should"),
        estimatedDuration: formatEstimatedDurationLabel(
          getCampaignBreakdownEstimatedDurationMinutes(
            input,
            campaignMomentum.oversizedTask,
          ),
        ),
        estimatedDurationMinutes: getCampaignBreakdownEstimatedDurationMinutes(
          input,
          campaignMomentum.oversizedTask,
        ),
        source: "campaign",
        reason: `${pressureLead} This needs a smaller reset move right now.`,
      };
    }

    if (linkedTask && linkedTask.completed !== true) {
      return buildSuggestedQuestFromTask(
        linkedTask,
        campaignMomentum.interventionLevel === "reset"
          ? `${pressureLead} This needs a reset move right now.`
          : pressureLead,
        {
          type: getCampaignInterventionSuggestedType(
            campaignMomentum,
            campaignMomentum.status === "at_risk"
              ? "must"
              : campaignMomentum.status === "stalled"
              ? "should"
              : mapPriorityScoreToSuggestedQuestType(score.score, linkedTask),
          ),
        },
      );
    }

    return {
      suggestionId: `priority:campaign:${epic.id}`,
      proposalId: null,
      title: campaignNeedsFollowUpDefinition(campaignMomentum)
        ? `Define next step for ${epic.title}`
        : campaignMomentum.interventionLevel === "reset"
        ? `Reset ${epic.title}`
        : campaignMomentum.status === "at_risk"
        ? `Protect ${epic.title}`
        : campaignMomentum.status === "stalled"
        ? `Define next step for ${epic.title}`
        : `Move ${epic.title} forward`,
      type: getCampaignInterventionSuggestedType(
        campaignMomentum,
        campaignMomentum.status === "at_risk"
          ? "must"
          : campaignMomentum.status === "stalled"
          ? "should"
          : "nice",
      ),
      estimatedDuration: `${
        getCampaignFollowUpEstimatedDurationMinutes(input, campaignMomentum)
      } min`,
      estimatedDurationMinutes: getCampaignFollowUpEstimatedDurationMinutes(
        input,
        campaignMomentum,
      ),
      source: "campaign",
      reason: campaignMomentum.interventionLevel === "reset"
        ? `${pressureLead} This needs a reset move right now.`
        : pressureLead,
    };
  }

  if (score.kind === "ritual" && score.ritualId) {
    const ritual = input.plannerContext.rituals.find((candidate) =>
      candidate.id === score.ritualId
    );
    if (!ritual) return null;

    return {
      suggestionId: `priority:ritual:${ritual.id}`,
      proposalId: null,
      title: `Keep ${ritual.title}`,
      type: "nice",
      estimatedDuration: formatEstimatedDurationLabel(
        getRitualDurationMinutes(ritual),
      ),
      estimatedDurationMinutes: getRitualDurationMinutes(ritual),
      source: "habit",
      reason: ritual.preferredTime
        ? `${ritual.title} stays easiest when you protect its usual ${ritual.preferredTime} slot.`
        : `${ritual.title} is a lighter support move worth keeping alive.`,
    };
  }

  if (score.kind === "contact") {
    const contactName = score.contactId
      ? input.plannerContext.contactsNeedingAttention?.find((candidate) =>
        candidate.id === score.contactId
      )?.name ?? score.title
      : score.title;
    const estimatedDurationMinutes =
      getRelationshipTouchEstimatedDurationMinutes(
        input,
        contactName,
      );
    return {
      suggestionId: `priority:contact:${
        score.contactId ?? normalizeText(score.title)
      }`,
      proposalId: null,
      title: `Reach out to ${contactName}`,
      type: "should",
      estimatedDuration: formatEstimatedDurationLabel(estimatedDurationMinutes),
      estimatedDurationMinutes,
      source: "optimization",
      reason: score.reasons[0] ??
        "This is the clearest relationship move worth protecting right now.",
    };
  }

  if (score.kind === "recovery") {
    const estimatedDurationMinutes = getRecoveryResetEstimatedDurationMinutes(
      input,
    );
    return {
      suggestionId: `priority:recovery:${score.id}`,
      proposalId: null,
      title: "Recovery reset",
      type: "should",
      estimatedDuration: formatEstimatedDurationLabel(estimatedDurationMinutes),
      estimatedDurationMinutes,
      source: "recovery",
      reason: score.reasons[0] ??
        "Your energy needs protecting before you add more pressure.",
    };
  }

  return null;
};

const buildPriorityOverviewItem = (
  input: PlannerBuildInput,
  score: PlannerPriorityScore,
): {
  quest: CompanionSuggestedQuest;
  proposal: PlannerProposal | null;
} | null => {
  if (score.kind === "task" && score.taskId) {
    const task = findPlannerTaskById(input, score.taskId);
    if (!task || task.completed === true) return null;

    const campaignMomentum = getTaskCampaignMomentum(input, task);
    if (
      campaignMomentum &&
      shouldSuggestStrategicCampaignAdjustment(campaignMomentum)
    ) {
      const proposal = buildCampaignAdjustmentProposalForMomentum(
        input,
        campaignMomentum,
      );
      return {
        quest: buildSuggestedQuestFromProposal(
          input,
          proposal,
          buildPriorityOverviewSuggestion(input, score)?.reason ??
            proposal.reasoning,
        ),
        proposal,
      };
    }
  }

  if (score.kind === "epic" && score.epicId) {
    const epic = input.plannerContext.activeEpics.find((candidate) =>
      candidate.id === score.epicId
    );
    if (epic) {
      const campaignMomentum = buildCampaignMomentumCandidate(input, epic);
      if (shouldSuggestStrategicCampaignAdjustment(campaignMomentum)) {
        const proposal = buildCampaignAdjustmentProposalForMomentum(
          input,
          campaignMomentum,
        );
        return {
          quest: buildSuggestedQuestFromProposal(
            input,
            proposal,
            buildPriorityOverviewSuggestion(input, score)?.reason ??
              proposal.reasoning,
          ),
          proposal,
        };
      }

      if (campaignNeedsFollowUpDefinition(campaignMomentum)) {
        const proposal = buildCampaignNextStepProposal(input, campaignMomentum);
        return {
          quest: buildSuggestedQuestFromProposal(
            input,
            proposal,
            buildPriorityOverviewSuggestion(input, score)?.reason ??
              proposal.reasoning,
          ),
          proposal,
        };
      }
    }
  }

  const quest = buildPriorityOverviewSuggestion(input, score);
  if (!quest) return null;

  return {
    quest,
    proposal: null,
  };
};

const buildCampaignMomentumStructuredOutput = (
  input: PlannerBuildInput,
  reply: string,
  classificationHint: ClassificationHint,
  options: {
    campaignId: string | null;
    campaignTitle: string | null;
    status: CompanionCampaignStatus | null;
    interventionLevel: CampaignMomentumCandidate["interventionLevel"] | null;
    statusReason: string | null;
    healthSnapshot: {
      overdueQuestCount: number;
      protectedTodayCount: number;
      recentCompletedQuestCount: number;
      daysWithoutMomentum: number | null;
      activeCampaignCount: number;
    } | null;
    pressureSignals: string[];
    nextStep: CompanionSuggestedQuest | null;
    supportActions: CompanionSuggestedQuest[];
    proposals: PlannerProposal[];
  },
): CompanionStructuredResponse => ({
  intent: mapPlannerIntentMetadata(input, classificationHint, {
    forceIntentType: getProposalDrivenIntentType("campaign", options.proposals),
    shouldCreateQuest: shouldCreateQuestFromProposals(options.proposals),
    shouldPromptCampaign: options.campaignId === null,
  }),
  planDay: null,
  weeklyPlan: null,
  comingUp: null,
  rightNow: null,
  dayAdjust: null,
  campaignMomentum: {
    message: reply,
    campaignId: options.campaignId,
    campaignTitle: options.campaignTitle,
    status: options.status,
    interventionLevel: options.interventionLevel,
    statusReason: options.statusReason,
    healthSnapshot: options.healthSnapshot,
    pressureSignals: options.pressureSignals,
    nextStep: options.nextStep,
    supportActions: options.supportActions,
  },
});

const buildCampaignHealthSnapshot = (
  input: PlannerBuildInput,
  candidate: CampaignMomentumCandidate,
) => ({
  overdueQuestCount: candidate.overdueTaskCount,
  protectedTodayCount: candidate.scheduledTodayCount,
  recentCompletedQuestCount: candidate.recentCompletedTasks.length,
  daysWithoutMomentum: candidate.daysWithoutMomentum,
  activeCampaignCount: input.plannerContext.activeEpics.length,
});

const buildPriorityOverviewStructuredOutput = (
  input: PlannerBuildInput,
  reply: string,
  classificationHint: ClassificationHint,
  options: {
    title: string;
    campaignPressure: string | null;
    focusCampaign: CampaignMomentumCandidate | null;
    topPriorities: CompanionSuggestedQuest[];
    proposals: PlannerProposal[];
  },
): CompanionStructuredResponse => ({
  intent: mapPlannerIntentMetadata(input, classificationHint, {
    forceIntentType: getProposalDrivenIntentType(
      options.focusCampaign ? "campaign" : "quest",
      options.proposals,
    ),
    shouldCreateQuest: shouldCreateQuestFromProposals(options.proposals),
    shouldPromptCampaign: false,
  }),
  planDay: null,
  weeklyPlan: null,
  priorityOverview: {
    title: options.title,
    message: reply,
    campaignPressure: options.campaignPressure,
    focusCampaignTitle: options.focusCampaign?.epic.title ?? null,
    focusCampaignStatus: options.focusCampaign?.status ?? null,
    focusCampaignInterventionLevel: options.focusCampaign?.interventionLevel ??
      null,
    focusCampaignHealth: options.focusCampaign
      ? buildCampaignHealthSnapshot(input, options.focusCampaign)
      : null,
    topPriorities: options.topPriorities,
  },
  reflectionBridge: null,
  comingUp: null,
  rightNow: null,
  dayAdjust: null,
  campaignMomentum: null,
});

const buildAdvanceCampaignResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
  matched?: MatchedEntities,
): PlannerBuildResult => {
  const selectedCampaign = selectCampaignMomentumCandidate(
    input,
    matched?.epic?.id ?? null,
  );

  if (!selectedCampaign) {
    const reply =
      "You don't have an active campaign to advance yet. If you want, we can lock in a goal first and then turn it into a clean next quest.";
    return buildReadOnlyResponse(
      reply,
      {
        ...sessionState,
        lastClassification: classificationHint.type,
      },
      "schedule_read",
      buildCampaignMomentumStructuredOutput(
        input,
        reply,
        classificationHint,
        {
          campaignId: null,
          campaignTitle: null,
          status: null,
          interventionLevel: null,
          statusReason: null,
          healthSnapshot: null,
          pressureSignals: [],
          nextStep: null,
          supportActions: [],
          proposals: [],
        },
      ),
    );
  }

  const nextTask = selectedCampaign.oversizedTask
    ? null
    : selectCampaignNextTask(input, selectedCampaign);
  const interventionLabel = formatCampaignInterventionLabel(
    selectedCampaign.interventionLevel,
  );
  const interventionLead = hasRepeatedCampaignSlip(selectedCampaign)
    ? "This has slipped more than once, so it needs a reset, not another blind push."
    : selectedCampaign.interventionLevel === "reset"
    ? "This needs a reset, not another blind push."
    : selectedCampaign.interventionLevel === "protect"
    ? "This needs a protected move next."
    : selectedCampaign.interventionLevel === "nudge"
    ? "This could use a cleaner nudge before it drifts further."
    : "Momentum is already steady.";
  const taskScoreMap = getTaskPriorityScoreMap(input);
  const nextTaskSuggestion = nextTask
    ? buildSuggestedQuestFromTask(
      nextTask,
      selectedCampaign.status === "moving"
        ? "It's already the clearest live step attached to this campaign."
        : selectedCampaign.status === "at_risk"
        ? "This is the fastest concrete move to stop the campaign from slipping."
        : "This is the cleanest next move already tied to the campaign.",
      {
        type: mapPriorityScoreToSuggestedQuestType(
          taskScoreMap.get(nextTask.id)?.score ?? null,
          nextTask,
        ),
      },
    )
    : null;
  const shouldAdjustCampaign = shouldDraftCampaignAdjustment(selectedCampaign);
  const adjustmentProposal = shouldAdjustCampaign
    ? buildCampaignAdjustmentProposalForMomentum(input, selectedCampaign)
    : null;
  const adjustmentSuggestion = adjustmentProposal
    ? buildSuggestedQuestFromProposal(
      input,
      adjustmentProposal,
      "This campaign is under enough pressure that it needs a plan adjustment before you keep pushing tasks around.",
    )
    : null;
  const supportTaskSuggestions = selectedCampaign.linkedTasks
    .filter((task) => task.id !== nextTask?.id)
    .slice()
    .sort((left, right) =>
      (taskScoreMap.get(right.id)?.score ?? 0) -
      (taskScoreMap.get(left.id)?.score ?? 0)
    )
    .slice(0, 2)
    .map((task) =>
      buildSuggestedQuestFromTask(
        task,
        "This is another useful support move if you want to keep the campaign moving after the main step.",
        {
          type: mapPriorityScoreToSuggestedQuestType(
            taskScoreMap.get(task.id)?.score ?? null,
            task,
          ),
        },
      )
    );
  const supportActions = [
    ...(shouldAdjustCampaign && nextTaskSuggestion ? [nextTaskSuggestion] : []),
    ...supportTaskSuggestions,
    ...selectedCampaign.linkedRituals.map((ritual) =>
      buildRitualSupportAction(ritual, selectedCampaign.epic.title)
    ),
  ].slice(0, 2);

  if (adjustmentProposal && adjustmentSuggestion) {
    const reply = `${selectedCampaign.epic.title} looks ${
      selectedCampaign.status.replace(/_/g, " ")
    }. ${selectedCampaign.statusReason} ${interventionLead} I drafted the campaign adjustment first.`;

    return {
      mode: "proposal",
      reply,
      followUpQuestions: [],
      proposals: [adjustmentProposal],
      suggestedReminders: [],
      structuredResponse: buildCampaignMomentumStructuredOutput(
        input,
        reply,
        classificationHint,
        {
          campaignId: selectedCampaign.epic.id,
          campaignTitle: selectedCampaign.epic.title,
          status: selectedCampaign.status,
          interventionLevel: selectedCampaign.interventionLevel,
          statusReason: selectedCampaign.statusReason,
          healthSnapshot: buildCampaignHealthSnapshot(input, selectedCampaign),
          pressureSignals: selectedCampaign.pressureSignals,
          nextStep: adjustmentSuggestion,
          supportActions,
          proposals: [adjustmentProposal],
        },
      ),
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
  }

  if (nextTaskSuggestion) {
    const reply = `${selectedCampaign.epic.title} looks ${
      selectedCampaign.status.replace(/_/g, " ")
    }. ${selectedCampaign.statusReason} ${interventionLead} The clearest ${interventionLabel} move is ${nextTaskSuggestion.title}.`;

    return buildReadOnlyResponse(
      reply,
      {
        ...sessionState,
        lastClassification: classificationHint.type,
      },
      "schedule_read",
      buildCampaignMomentumStructuredOutput(
        input,
        reply,
        classificationHint,
        {
          campaignId: selectedCampaign.epic.id,
          campaignTitle: selectedCampaign.epic.title,
          status: selectedCampaign.status,
          interventionLevel: selectedCampaign.interventionLevel,
          statusReason: selectedCampaign.statusReason,
          healthSnapshot: buildCampaignHealthSnapshot(input, selectedCampaign),
          pressureSignals: selectedCampaign.pressureSignals,
          nextStep: nextTaskSuggestion,
          supportActions,
          proposals: [],
        },
      ),
    );
  }

  const proposal = buildCampaignNextStepProposal(input, selectedCampaign);
  const proposedNextStep = buildSuggestedQuestFromProposal(
    input,
    proposal,
    selectedCampaign.status === "stalled"
      ? "There isn't a clean next task on the board yet, so this gives the campaign a concrete foothold."
      : "This is the cleanest next quest to keep the campaign moving.",
  );
  const reply = `${selectedCampaign.epic.title} looks ${
    selectedCampaign.status.replace(/_/g, " ")
  }. ${selectedCampaign.statusReason} ${interventionLead} I drafted the cleanest ${interventionLabel} move so you can confirm it without overthinking it.`;

  return {
    mode: "proposal",
    reply,
    followUpQuestions: [],
    proposals: [proposal],
    suggestedReminders: [],
    structuredResponse: buildCampaignMomentumStructuredOutput(
      input,
      reply,
      classificationHint,
      {
        campaignId: selectedCampaign.epic.id,
        campaignTitle: selectedCampaign.epic.title,
        status: selectedCampaign.status,
        interventionLevel: selectedCampaign.interventionLevel,
        statusReason: selectedCampaign.statusReason,
        healthSnapshot: buildCampaignHealthSnapshot(input, selectedCampaign),
        pressureSignals: selectedCampaign.pressureSignals,
        nextStep: proposedNextStep,
        supportActions,
        proposals: [proposal],
      },
    ),
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

const mapPlannerIntentMetadata = (
  input: PlannerBuildInput,
  classificationHint: ClassificationHint,
  options?: {
    forceIntentType?: CompanionIntentMetadata["intentType"];
    shouldCreateQuest?: boolean;
    shouldPromptCampaign?: boolean;
  },
): CompanionIntentMetadata => {
  const starterIntent = getResolvedStarterIntent(input);
  const normalizedMessage = normalizeText(input.message);
  const timeHorizon: CompanionIntentMetadata["timeHorizon"] =
    starterIntent === "advance_campaign_start"
      ? "long_term"
      : starterIntent === "plan_day" ||
          starterIntent === "right_now_start" ||
          starterIntent === "upcoming_start" ||
          starterIntent === "adjust_today" ||
          starterIntent === "low_energy_adjust" ||
          /\b(today|tonight|tomorrow|right now|next hour)\b/.test(
            normalizedMessage,
          )
      ? "today"
      : classificationHint.type === "epic" ||
          /\b(this month|next month|this quarter|long term|eventually)\b/.test(
            normalizedMessage,
          )
      ? "long_term"
      : "short_term";

  const inferredIntentType: CompanionIntentMetadata["intentType"] =
    starterIntent === "advance_campaign_start" ||
      starterIntent === "goal_breakdown" ||
      starterIntent === "goal_breakdown_start" ||
      classificationHint.type === "epic"
      ? "campaign"
      : starterIntent === "plan_day" ||
          starterIntent === "right_now_start" ||
          starterIntent === "adjust_today" ||
          starterIntent === "low_energy_adjust" ||
          classificationHint.type === "quest" ||
          classificationHint.type === "habit"
      ? "quest"
      : "conversation";

  const intentType = options?.forceIntentType ?? inferredIntentType;

  return {
    intentType,
    timeHorizon,
    isRecurring: Boolean(
      input.parsedInput?.recurrencePattern ||
        classificationHint.type === "habit",
    ),
    shouldCreateQuest: options?.shouldCreateQuest ??
      (intentType === "quest" && timeHorizon === "today"),
    shouldPromptCampaign: options?.shouldPromptCampaign ??
      (intentType === "campaign" && timeHorizon !== "today"),
  };
};

const buildComingUpStructuredOutput = (
  input: PlannerBuildInput,
  message: string,
  classificationHint: ClassificationHint,
  nextBestAction: CompanionSuggestedQuest | null,
  proposals: PlannerProposal[],
): CompanionStructuredResponse => {
  const remainingToday = collectStructuredScheduleItemsForDate(
    input,
    input.currentDate,
    true,
  );
  const nextEvent = remainingToday[0] ?? null;
  const tomorrow = addDaysToDateKey(input.currentDate, 1);
  const tomorrowLoad = input.plannerContext.scheduleInsights?.dayLoads.find((
    day,
  ) => day.date === tomorrow);
  const tomorrowSummary: CompanionTomorrowSummary = !tomorrowLoad ||
      tomorrowLoad.status === "open"
    ? "open"
    : tomorrowLoad.status === "balanced"
    ? "light"
    : "busy";
  return {
    intent: mapPlannerIntentMetadata(input, classificationHint, {
      forceIntentType: getProposalDrivenIntentType(
        "conversation",
        proposals,
      ),
      shouldCreateQuest: shouldCreateQuestFromProposals(proposals),
      shouldPromptCampaign: false,
    }),
    planDay: null,
    weeklyPlan: null,
    comingUp: {
      message,
      nextEvent,
      nextBestAction,
      remainingToday,
      tomorrowSummary,
      missedItems: collectMissedTasksForToday(input),
    },
    rightNow: null,
    dayAdjust: null,
  };
};

const stripSuggestionProposal = (
  suggestion: CompanionSuggestedQuest | null,
): CompanionSuggestedQuest | null =>
  suggestion
    ? {
      ...suggestion,
      proposalId: null,
    }
    : null;

type WindowSuggestedActionState = {
  suggestion: CompanionSuggestedQuest | null;
  proposal: PlannerProposal | null;
};

const buildMakeRoomStarterReply = (input: PlannerBuildInput): string => {
  const lead = isWittySassyTone(input.tonePack)
    ? buildWittyAvailabilityCallout(input, input.currentDate, true) ??
      "Here's the room I see right now, minus the decorative chaos."
    : "Here's the room I see right now.";
  const closer = isWittySassyTone(input.tonePack)
    ? "Tell me what actually matters, and I'll help make room for it without the decorative bullshit."
    : "Tell me what matters most, and I'll help make room for it.";

  return [
    lead,
    buildDayDigest(input, input.currentDate, "Today", true),
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
  const { digestLabel } = describeScheduleTarget(input.currentDate, targetDate);
  return buildDayDigest(input, targetDate, digestLabel);
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
      formatAssistantTimeRange(window.start, window.end) ??
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
  structuredResponse: CompanionStructuredResponse | null = null,
): PlannerBuildResult => ({
  mode,
  reply,
  followUpQuestions: [],
  proposals: [],
  suggestedReminders: [],
  structuredResponse,
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

const buildComingUpResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
  reply: string,
): PlannerBuildResult => {
  const nextEvent = collectStructuredScheduleItemsForDate(
    input,
    input.currentDate,
    true,
  )[0] ?? null;
  const nextBestActionState = buildComingUpNextBestAction(input, nextEvent);
  const structuredResponse = buildComingUpStructuredOutput(
    input,
    reply,
    classificationHint,
    stripSuggestionProposal(nextBestActionState.suggestion),
    [],
  );

  return buildReadOnlyResponse(
    reply,
    sessionState,
    "schedule_read",
    structuredResponse,
  );
};

const firstSentence = (value: string): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "I shaped this around the planner context I have.";
  const match = normalized.match(/^(.+?[.!?])(?:\s|$)/);
  return (match?.[1] ?? normalized).slice(0, 220);
};

const addReasonCode = (
  reasonCodes: PlannerReasonCode[],
  code: PlannerReasonCode,
  condition = true,
) => {
  if (condition && !reasonCodes.includes(code)) {
    reasonCodes.push(code);
  }
};

const getPlannerContractMode = (
  result: PlannerBuildResult,
): PlannerContract["mode"] => {
  if (result.followUpQuestions.length > 0) return "clarify_first";
  if (result.mode === "schedule_read") return "schedule_read";
  if (result.mode === "proposal") return "propose_schedule";
  return "suggest_only";
};

const getPlannerDecisionPoint = (
  result: PlannerBuildResult,
): PlannerContract["decisionPoint"] => {
  if (result.followUpQuestions[0]) {
    return {
      label: result.followUpQuestions[0].prompt,
      action: "answer_clarification",
    };
  }

  if (result.proposals.length > 0 || result.suggestedReminders.length > 0) {
    return {
      label: "Review and confirm the proposed changes.",
      action: "confirm_schedule",
    };
  }

  return {
    label: "No changes needed right now.",
    action: "none",
  };
};

const derivePlannerReasonCodes = (
  result: PlannerBuildResult,
): PlannerReasonCode[] => {
  const reasonCodes: PlannerReasonCode[] = [];
  const structured = result.structuredResponse;
  const dayAssessment = structured?.planDay?.dayAssessment;

  addReasonCode(reasonCodes, "needs_clarification", result.followUpQuestions.length > 0);
  addReasonCode(reasonCodes, "calendar_constraint", Boolean(structured?.comingUp?.nextEvent));
  addReasonCode(reasonCodes, "overdue", Boolean(structured?.comingUp?.missedItems.length));
  addReasonCode(reasonCodes, "low_energy_hint", dayAssessment === "low_energy");
  addReasonCode(reasonCodes, "busy_day", dayAssessment === "busy" || dayAssessment === "behind");
  addReasonCode(reasonCodes, "campaign_momentum", Boolean(
    structured?.campaignMomentum ||
      structured?.weeklyPlan?.focusCampaignTitle ||
      structured?.priorityOverview?.focusCampaignTitle,
  ));
  addReasonCode(reasonCodes, "open_window", Boolean(
    structured?.rightNow?.currentWindow ||
      result.proposals.some((proposal) => {
        const payload = proposal.payload as Record<string, unknown>;
        return typeof payload.scheduledTime === "string" &&
          payload.scheduledTime.length > 0;
      }),
  ));
  addReasonCode(reasonCodes, "schedule_validation_warning", result.proposals.some((proposal) => {
    const payload = proposal.payload as Record<string, unknown>;
    return payload.scheduleValidationStatus === "warning";
  }));

  if (reasonCodes.length === 0) {
    addReasonCode(reasonCodes, "user_preference");
  }

  return reasonCodes;
};

const buildPlannerContract = (
  result: PlannerBuildResult,
): PlannerContract => {
  const writePolicy: PlannerContract["writePolicy"] =
    result.proposals.length > 0 || result.suggestedReminders.length > 0
      ? "confirmation_required"
      : "read_only";
  const clarifyingQuestion = result.followUpQuestions[0]?.prompt ?? null;

  return {
    mode: getPlannerContractMode(result),
    writePolicy,
    decisionSummary: firstSentence(
      result.structuredResponse?.planDay?.message ??
        result.structuredResponse?.comingUp?.message ??
        result.structuredResponse?.rightNow?.message ??
        result.structuredResponse?.dayAdjust?.message ??
        result.structuredResponse?.priorityOverview?.message ??
        result.structuredResponse?.weeklyPlan?.message ??
        result.structuredResponse?.campaignMomentum?.message ??
        result.reply,
    ),
    reasonCodes: derivePlannerReasonCodes(result),
    decisionPoint: getPlannerDecisionPoint(result),
    clarifyingQuestion,
  };
};

type ScheduleValidationIssue = {
  code:
    | "overlaps_calendar"
    | "overlaps_task"
    | "outside_waking_hours"
    | "missing_duration";
  message: string;
};

const getProposalPayloadDateTime = (
  proposal: PlannerProposal,
): {
  taskDate: string | null;
  scheduledTime: string | null;
  durationMinutes: number | null;
  taskId: string | null;
} => {
  const payload = proposal.payload as Record<string, unknown>;
  const updates = payload.updates && typeof payload.updates === "object" &&
      !Array.isArray(payload.updates)
    ? payload.updates as Record<string, unknown>
    : {};
  const taskDate = typeof payload.taskDate === "string"
    ? payload.taskDate
    : typeof updates.task_date === "string"
    ? updates.task_date
    : null;
  const scheduledTime = typeof payload.scheduledTime === "string"
    ? payload.scheduledTime
    : typeof updates.scheduled_time === "string"
    ? updates.scheduled_time
    : null;
  const durationMinutes = typeof payload.estimatedDuration === "number"
    ? payload.estimatedDuration
    : null;
  const taskId = typeof payload.taskId === "string" ? payload.taskId : null;

  return {
    taskDate,
    scheduledTime,
    durationMinutes,
    taskId,
  };
};

const getEventDateKey = (value: string): string => value.slice(0, 10);

const validateProposalSchedule = (
  input: PlannerBuildInput,
  proposal: PlannerProposal,
): ScheduleValidationIssue[] => {
  const { taskDate, scheduledTime, durationMinutes, taskId } =
    getProposalPayloadDateTime(proposal);
  if (!taskDate || !scheduledTime) return [];

  const issues: ScheduleValidationIssue[] = [];
  const startMinutes = parseTimeToMinutes(scheduledTime);
  const duration = durationMinutes ?? 30;
  if (startMinutes === null) return issues;
  if (!durationMinutes) {
    issues.push({
      code: "missing_duration",
      message: "No explicit duration was provided, so validation used a 30 minute fallback.",
    });
  }

  const endMinutes = startMinutes + duration;
  const wakeMinutes = parseTimeToMinutes(
    input.plannerContext.plannerMemory?.wakeTime ?? "08:00",
  ) ?? 8 * 60;
  const windDownMinutes = parseTimeToMinutes(
    input.plannerContext.plannerMemory?.windDownTime ?? "21:00",
  ) ?? 21 * 60;
  if (startMinutes < wakeMinutes || endMinutes > windDownMinutes) {
    issues.push({
      code: "outside_waking_hours",
      message: "The proposed block sits outside the user's waking planning window.",
    });
  }

  const hasTaskOverlap = [
    ...input.plannerContext.tasks,
    ...input.plannerContext.inboxTasks,
  ].some((task) => {
    if (task.completed === true || task.id === taskId) return false;
    if (task.taskDate !== taskDate || !task.scheduledTime) return false;
    const taskStart = parseTimeToMinutes(task.scheduledTime);
    if (taskStart === null) return false;
    const taskEnd = taskStart + getTaskDuration(task);
    return startMinutes < taskEnd && endMinutes > taskStart;
  });
  if (hasTaskOverlap) {
    issues.push({
      code: "overlaps_task",
      message: "The proposed block overlaps an existing Cosmiq quest.",
    });
  }

  const hasCalendarOverlap = input.plannerContext.calendarEvents.some((event) => {
    if (event.isAllDay) return getEventDateKey(event.start) === taskDate;
    if (getEventDateKey(event.start) !== taskDate) return false;
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    const eventStartMinutes = (eventStart.getHours() * 60) +
      eventStart.getMinutes();
    const eventEndMinutes = (eventEnd.getHours() * 60) +
      eventEnd.getMinutes();
    return startMinutes < eventEndMinutes && endMinutes > eventStartMinutes;
  });
  if (hasCalendarOverlap) {
    issues.push({
      code: "overlaps_calendar",
      message: "The proposed block overlaps a connected calendar event.",
    });
  }

  return issues;
};

const withScheduleValidation = (
  input: PlannerBuildInput,
  result: PlannerBuildResult,
): PlannerBuildResult => {
  if (result.proposals.length === 0) return result;

  return {
    ...result,
    proposals: result.proposals.map((proposal) => {
      const issues = validateProposalSchedule(input, proposal);
      if (issues.length === 0) return proposal;

      return {
        ...proposal,
        payload: {
          ...proposal.payload,
          scheduleValidationStatus: "warning",
          scheduleValidationIssues: issues,
        },
      };
    }),
  };
};

const withPlannerContract = (
  result: PlannerBuildResult,
): PlannerBuildResult => {
  const plannerContract = result.plannerContract ?? buildPlannerContract(result);
  return {
    ...result,
    plannerContract,
    structuredResponse: result.structuredResponse
      ? {
        ...result.structuredResponse,
        plannerContract,
      }
      : result.structuredResponse,
  };
};

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

const STAT_LABELS: Record<
  NonNullable<PlannerStatInterpretation["statProfile"]>["dominantStat"],
  string
> = {
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
      const weight = (level: string) =>
        level === "high" ? 3 : level === "medium" ? 2 : 1;
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
    ? `${
      STAT_LABELS[highestNeed[0] as keyof typeof STAT_LABELS]
    } is the clearest rebalance need right now.`
    : null;

  return [interpretation.narrativeBrief, needLine].filter(Boolean).join(" ");
};

const buildRecoveryProposal = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
): PlannerBuildResult | null => {
  const vitalityNeed = input.plannerContext.statInterpretation?.statNeeds
    ?.vitality;
  if (!vitalityNeed || vitalityNeed.level !== "high") return null;

  const alreadyHasRecoveryWork = [
    ...input.plannerContext.tasks,
    ...input.plannerContext.inboxTasks,
  ]
    .some((task) =>
      task.taskDate === input.currentDate &&
      /\b(recovery|reset|rest|walk|breath|breathe|pause|break)\b/i.test(
        task.title,
      )
    );

  if (alreadyHasRecoveryWork) return null;

  const suggestedSlot =
    input.plannerContext.scheduleInsights?.suggestedSlots.find((slot) =>
      slot.date === input.currentDate
    ) ?? null;
  const baseDurationMinutes = getRecoveryResetEstimatedDurationMinutes(input);
  const fittedSlotDuration = fitPlannerDurationBucketWithin(
    Math.min(
      getOpenSlotDurationMinutes(suggestedSlot) ?? baseDurationMinutes,
      baseDurationMinutes,
    ),
  );
  const durationMinutes = fittedSlotDuration ?? baseDurationMinutes;
  const scheduledTime = fittedSlotDuration ? suggestedSlot?.time ?? null : null;
  const interpretationLead = getCompanionInterpretationLead(input);
  const proposal: PlannerProposal = {
    id: createId(),
    kind: "create_quest",
    title: "Create Recovery reset block",
    summary: `Create a ${durationMinutes}-minute recovery reset${
      scheduledTime ? ` at ${scheduledTime}` : " today"
    }.`,
    reasoning:
      "Vitality is under pressure, so I'm turning recovery into a confirmable block instead of hoping it happens by accident.",
    payload: {
      taskText: "Recovery reset",
      difficulty: "easy",
      taskDate: input.currentDate,
      scheduledTime,
      estimatedDuration: durationMinutes,
      source: "manual",
      category: "body",
      notes: vitalityNeed.reasons[0] ??
        "Protect your energy before the rest of the day asks for more.",
    },
    status: "pending",
    readyToConfirm: true,
    missingFields: [],
  };

  return {
    mode: "proposal",
    reply: [
      interpretationLead,
      `You've been carrying a lot of load. I'm protecting your energy with a ${durationMinutes}-minute reset block you can confirm if it feels right.`,
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
  const focusLead = briefingFocus ? `Briefing focus: ${briefingFocus}.` : null;
  const campaignPressureLine = buildPriorityOverviewCampaignPressureLine(
    input,
    priorityScores,
  );
  const topPriorityItems = priorityScores
    .map((score) => buildPriorityOverviewItem(input, score))
    .filter((
      item,
    ): item is {
      quest: CompanionSuggestedQuest;
      proposal: PlannerProposal | null;
    } => item !== null);
  const topPriorities = topPriorityItems
    .map((item) => item.quest)
    .slice(0, 5);
  const proposals = topPriorityItems
    .map((item) => item.proposal)
    .filter((proposal): proposal is PlannerProposal => proposal !== null)
    .filter((proposal, index, all) =>
      all.findIndex((candidate) => candidate.id === proposal.id) === index
    );
  const rankedLead = priorityScores
    .slice(0, 3)
    .map((score, index) =>
      `${index + 1}. ${buildPriorityOverviewSummary(input, score)}`
    )
    .join("\n");
  const focusCampaign = getPriorityOverviewFocusCampaign(input, priorityScores);
  const title = starterIntent === "what_matters"
    ? "What Matters"
    : starterIntent === "make_room"
    ? "Make Room"
    : "Priority Overview";
  const reply = [
    interpretationLead,
    lead,
    focusLead,
    buildDayDigest(input, input.currentDate, "Today", true),
    campaignPressureLine,
    `Top ranked next moves:\n${rankedLead}`,
  ].filter(Boolean).join("\n\n");
  const structuredResponse = buildPriorityOverviewStructuredOutput(
    input,
    reply,
    classificationHint,
    {
      title,
      campaignPressure: campaignPressureLine,
      focusCampaign,
      topPriorities,
      proposals,
    },
  );

  if (proposals.length > 0) {
    return {
      mode: "proposal",
      reply,
      followUpQuestions: [],
      proposals,
      suggestedReminders: [],
      structuredResponse,
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
        lastClassification: classificationHint.type,
      },
    };
  }

  return buildReadOnlyResponse(
    reply,
    {
      ...sessionState,
      lastClassification: classificationHint.type,
    },
    "schedule_read",
    structuredResponse,
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

  const suggestedSlot =
    input.plannerContext.scheduleInsights?.suggestedSlots.find((slot) =>
      slot.date === input.currentDate
    ) ?? null;
  const baseDurationMinutes = getRelationshipTouchEstimatedDurationMinutes(
    input,
    targetContact.name,
  );
  const fittedSlotDuration = fitPlannerDurationBucketWithin(
    Math.min(
      getOpenSlotDurationMinutes(suggestedSlot) ?? baseDurationMinutes,
      baseDurationMinutes,
    ),
  );
  const durationMinutes = fittedSlotDuration ?? baseDurationMinutes;
  const scheduledTime = fittedSlotDuration ? suggestedSlot?.time ?? null : null;
  const interpretationLead = getCompanionInterpretationLead(input);
  const proposal: PlannerProposal = {
    id: createId(),
    kind: "create_quest",
    title: `Create Reach out to ${targetContact.name}`,
    summary: `Create a quest to reach out to "${targetContact.name}"${
      scheduledTime ? ` at ${scheduledTime}` : " today"
    }.`,
    reasoning: targetContact.hasOverdueReminder
      ? "This contact already has an overdue reminder, so I am drafting the fastest clean follow-up."
      : "This relationship is going cold, so I am turning it into a concrete follow-up quest.",
    payload: {
      taskText: `Reach out to ${targetContact.name}`,
      difficulty: "easy",
      taskDate: input.currentDate,
      scheduledTime,
      estimatedDuration: durationMinutes,
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

  const targetDate = parseRequestedDate(
    input.message,
    input.currentDate,
    input.parsedInput,
  );
  const nextDate = addDaysToDateKey(targetDate, 1);
  const candidateTasks = [
    ...input.plannerContext.tasks,
    ...input.plannerContext.inboxTasks,
  ]
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
    summary:
      `Move "${task.title}" off ${targetDate} after ${cutoff} and into ${nextDate}.`,
    reasoning:
      "You asked to free up the back half of the day, so I am shifting the quests that live after that cutoff.",
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
    reply: `I drafted ${proposals.length} quest move${
      proposals.length === 1 ? "" : "s"
    } to clear your schedule after ${cutoff}. Review them and confirm if that lineup works.`,
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
  const recoveryProposal = buildRecoveryProposal(
    input,
    sessionState,
    classificationHint,
  );
  if (recoveryProposal) {
    return recoveryProposal;
  }

  const response = buildDayAdjustResponse(
    input,
    sessionState,
    classificationHint,
    { lowEnergy: true },
  );

  return {
    ...response,
    reply: [
      getCompanionInterpretationLead(input),
      response.reply,
    ].filter(Boolean).join(" "),
  };
};

const composeReply = (
  input: PlannerBuildInput,
  tonePack: PlannerTonePack,
  kind: PlannerProposalKind,
  readyToConfirm: boolean,
  draft: PlannerDraftState,
  questCaptureAssumption: QuestCaptureAssumption | null,
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
  const explicitQuestCaptureTiming = hasExplicitQuestCaptureTiming(input, kind);
  const interpretationLead = getCompanionInterpretationLead(input);
  const preferredTimeOfDay = shouldSuppressLearnedTimingLanguage(input) ||
      explicitQuestCaptureTiming
    ? null
    : input.plannerContext.plannerMemory?.preferredTimeOfDay;
  const memoryLead = preferredTimeOfDay
    ? `You usually land work like this in the ${preferredTimeOfDay}. `
    : "";
  const explicitQuestCaptureTime = preferredTime(draft);
  const explicitQuestCaptureTimeLabel = explicitQuestCaptureTime
    ? formatAssistantTime(explicitQuestCaptureTime) ?? explicitQuestCaptureTime
    : null;
  const explicitQuestCaptureDate = defaultQuestDate(input, draft);
  const explicitQuestCaptureDateLabel =
    explicitQuestCaptureDate === input.currentDate
      ? "today"
      : explicitQuestCaptureDate === addDaysToDateKey(input.currentDate, 1)
      ? "tomorrow"
      : explicitQuestCaptureDate
      ? formatReadableDate(explicitQuestCaptureDate)
      : null;
  const questCaptureReplyLead = readyToConfirm && kind === "create_quest"
    ? questCaptureAssumption?.kind === "inbox"
      ? "I captured this as a quest in Inbox so you can schedule it later. "
      : questCaptureAssumption?.kind === "slot"
      ? `I drafted this as a quest, assuming ${questCaptureAssumption.date} at ${questCaptureAssumption.time} based on your open slot. `
      : questCaptureAssumption?.kind === "preferred_time"
      ? `I drafted this as a quest, assuming ${questCaptureAssumption.date} at ${questCaptureAssumption.time} based on your usual ${questCaptureAssumption.timeOfDay} pattern. `
      : explicitQuestCaptureTiming && explicitQuestCaptureTimeLabel
      ? explicitQuestCaptureDateLabel
        ? `I drafted this as a quest for ${explicitQuestCaptureDateLabel} at ${explicitQuestCaptureTimeLabel}. `
        : `I drafted this as a quest for ${explicitQuestCaptureTimeLabel}. `
      : ""
    : "";

  if (isWittySassyTone(tonePack)) {
    if (readyToConfirm) {
      return `${interpretationLead ? `${interpretationLead} ` : ""}${
        questCaptureReplyLead || `I drafted this as a ${baseLabel}. `
      }Review it, confirm it if it holds up, and spare me the fake ceremony.`;
    }

    return `${
      interpretationLead ? `${interpretationLead} ` : ""
    }${memoryLead}I can shape this into a ${baseLabel}, but I need one real detail before we dress vague intentions up like a finished plan.`;
  }

  if (readyToConfirm) {
    return `${interpretationLead ? `${interpretationLead} ` : ""}${
      questCaptureReplyLead || `I drafted this as a ${baseLabel}. `
    }Take a look, and confirm it if it fits.`;
  }

  return `${
    interpretationLead ? `${interpretationLead} ` : ""
  }${memoryLead}I can help shape this into a ${baseLabel}. First I need one quick detail.`;
};

const buildConversationalResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
): PlannerBuildResult => {
  return {
    mode: "conversational",
    reply: isWittySassyTone(input.tonePack)
      ? "I'm with you. Tell me what actually matters, or point at the bullshit and I'll help turn it into a draft quest or campaign."
      : "I'm here with you. Tell me what feels most important, or ask me to turn it into a draft quest or campaign when you're ready.",
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
  reply: isWittySassyTone(input.tonePack)
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

type OptimizerDraftCandidate = {
  id: string;
  dedupeKey: string;
  title: string;
  scheduledDate: string;
  scheduledTime: string | null;
  estimatedDuration: number;
  reasoning: string;
  epicId?: string | null;
  category?: string | null;
  notes?: string | null;
  timingPreferenceLabel?: PlannerTaskTimingLabel;
  energyType: PlannerOptimizerTaskToSchedule["energy_type"];
  confidence: number;
  derivedFromMessage: string;
  priority?: number;
};

const getDateTimeOffset = (value: string): string => {
  const match = value.match(/([+-]\d{2}:\d{2}|Z)$/);
  return match?.[1] ?? "Z";
};

const buildOffsetDateTime = (
  dateKey: string,
  clockTime: string,
  offset: string,
): string => `${dateKey}T${clockTime}:00${offset}`;

const inferTimingLabelFromClock = (
  clockTime: string | null | undefined,
): PlannerTaskTimingLabel | undefined => {
  const minutes = parseTimeToMinutes(clockTime);
  if (minutes === null) return undefined;
  if (minutes < 12 * 60) return "morning";
  if (minutes < 17 * 60) return "afternoon";
  if (minutes < 20 * 60) return "evening";
  return "tonight";
};

const inferEnergyTypeFromTitle = (
  title: string,
): PlannerOptimizerTaskToSchedule["energy_type"] => {
  const normalized = title.toLowerCase();
  if (/\b(workout|exercise|lift|run|walk|stretch|gym)\b/.test(normalized)) {
    return "physical";
  }
  if (
    /\b(clean|vacuum|laundry|dishes|organize|tidy|house)\b/.test(normalized)
  ) return "errand";
  if (/\b(call|reply|email|pay|book|schedule)\b/.test(normalized)) {
    return "admin";
  }
  return "deep";
};

const getPlanDayTargetDate = (input: PlannerBuildInput): string =>
  input.plannerContext.scheduleInsights?.selectedDate ?? input.currentDate;

const getPlanDayWorkloadProfile = (
  input: PlannerBuildInput,
): "light" | "normal" | "heavy" =>
  input.plannerContext.plannerMemory?.workloadTolerance ??
    input.plannerContext.aiSignals?.suggestedWorkload ??
    "normal";

const getPlanDayLoadStatus = (
  input: PlannerBuildInput,
  targetDate: string,
): PlannerDayLoad["status"] | null =>
  input.plannerContext.scheduleInsights?.dayLoads.find((day) =>
    day.date === targetDate
  )?.status ??
    (input.plannerContext.scheduleInsights?.overloadedDates.includes(targetDate)
      ? "overloaded"
      : null);

type PlanDayLoadBreakdown = {
  visibleStandaloneQuests: PlannerContextTask[];
  campaignLinkedQuests: PlannerContextTask[];
  surfacedCampaignRituals: PlannerContextTask[];
  datedInboxItems: PlannerContextTask[];
  undatedInboxItems: PlannerContextTask[];
  calendarBlocks: PlannerContextCalendarEvent[];
  workItemsForProposalLimit: number;
};

type PlanDayCampaignFocus = NonNullable<
  NonNullable<CompanionStructuredResponse["planDay"]>["campaignFocus"]
>;

const calendarEventOverlapsDate = (
  event: PlannerContextCalendarEvent,
  date: string,
): boolean => {
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${addDaysToDateKey(date, 1)}T00:00:00`);
  const start = new Date(event.start);
  const end = new Date(event.end);
  return end > dayStart && start < dayEnd;
};

const isCampaignRitualTask = (task: PlannerContextTask): boolean =>
  Boolean(task.epicId && task.habitSourceId);

const getPlanDayLoadBreakdown = (
  input: PlannerBuildInput,
  targetDate: string,
): PlanDayLoadBreakdown => {
  const datedTasks = input.plannerContext.tasks.filter((task) =>
    task.completed !== true && task.taskDate === targetDate
  );
  const datedInboxItems = input.plannerContext.inboxTasks.filter((task) =>
    task.completed !== true && task.taskDate === targetDate
  );
  const undatedInboxItems = input.plannerContext.inboxTasks.filter((task) =>
    task.completed !== true && !task.taskDate
  );
  const surfacedCampaignRituals = datedTasks.filter(isCampaignRitualTask);
  const campaignLinkedQuests = datedTasks.filter((task) =>
    Boolean(task.epicId) && !isCampaignRitualTask(task)
  );
  const visibleStandaloneQuests = datedTasks.filter((task) =>
    !task.epicId && !task.habitSourceId
  );
  const calendarBlocks = input.plannerContext.calendarEvents.filter((event) =>
    calendarEventOverlapsDate(event, targetDate)
  );

  return {
    visibleStandaloneQuests,
    campaignLinkedQuests,
    surfacedCampaignRituals,
    datedInboxItems,
    undatedInboxItems,
    calendarBlocks,
    workItemsForProposalLimit: visibleStandaloneQuests.length +
      campaignLinkedQuests.length +
      surfacedCampaignRituals.length +
      datedInboxItems.length,
  };
};

const getPlanDayTargetTotal = (
  input: PlannerBuildInput,
  targetDate: string,
): number => {
  const loadStatus = getPlanDayLoadStatus(input, targetDate);
  const workload = getPlanDayWorkloadProfile(input);
  if (loadStatus === "busy" || loadStatus === "overloaded") {
    return workload === "light" ? 3 : 4;
  }

  if (workload === "light") return 3;

  if (workload === "heavy") {
    switch (input.plannerContext.statInterpretation?.momentumState) {
      case "locked_in":
        return 6;
      case "coasting":
        return 5;
      case "slipping":
      case "rebuilding":
        return 4;
      default:
        return 5;
    }
  }

  switch (input.plannerContext.statInterpretation?.momentumState) {
    case "locked_in":
      return 6;
    case "coasting":
      return 5;
    default:
      return 4;
  }
};

const hasPlanDayScheduledBlocks = (
  input: PlannerBuildInput,
  targetDate: string,
): boolean => buildIntervalsForDate(input, targetDate).length > 0;

const PLAN_DAY_GENERIC_FOCUS_TERMS = new Set([
  "active",
  "admin",
  "catch up",
  "catch up day",
  "catching up",
  "catchup",
  "chores",
  "fitness",
  "focus",
  "focus day",
  "focused",
  "focused day",
  "light",
  "life admin",
  "movement",
  "people",
  "personal",
  "recovery",
  "rest",
  "social",
  "something active",
  "something light",
  "work",
]);

const isGenericPlanDayFocusTitle = (value: string): boolean => {
  const normalized = normalizeText(value);
  if (!normalized) return true;
  if (PLAN_DAY_GENERIC_FOCUS_TERMS.has(normalized)) return true;

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const hasGenericFocusWord =
    /\b(work|active|light|admin|social|recovery|personal|focus(?:ed)?|catch(?:ing)?(?: up)?)\b/
      .test(normalized);
  return wordCount <= 2 && hasGenericFocusWord;
};

const isPlanDayStarterTitle = (value: string): boolean =>
  /^(?:help me )?plan(?: my day| today)$/.test(normalizeText(value));

const hasPlanDayContextAnchors = (input: PlannerBuildInput): boolean =>
  input.plannerContext.tasks.some((task) => task.completed !== true) ||
  input.plannerContext.inboxTasks.some((task) => task.completed !== true) ||
  input.plannerContext.activeEpics.length > 0 ||
  input.plannerContext.rituals.length > 0 ||
  Boolean(input.plannerContext.contactsNeedingAttention?.length);

const getPlanDayFocusLabels = (input: PlannerBuildInput): string[] => {
  const labels: string[] = [];
  const seen = new Set<string>();
  const pushLabel = (value: string | null | undefined) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    const normalized = normalizeText(trimmed);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    labels.push(trimmed);
  };

  for (const score of getResolvedPriorityScores(input)) {
    if (labels.length >= 3) break;
    if (score.kind === "contact" && score.contactId) {
      const contactName = input.plannerContext.contactsNeedingAttention?.find((
        candidate,
      ) => candidate.id === score.contactId)?.name ?? score.title;
      pushLabel(contactName);
      continue;
    }

    pushLabel(score.title);
  }

  if (labels.length < 3) {
    for (
      const task of [
        ...input.plannerContext.tasks,
        ...input.plannerContext.inboxTasks,
      ]
    ) {
      if (labels.length >= 3) break;
      if (task.completed === true) continue;
      pushLabel(task.title);
    }
  }

  if (labels.length < 3) {
    for (const epic of input.plannerContext.activeEpics) {
      if (labels.length >= 3) break;
      pushLabel(epic.title);
    }
  }

  if (labels.length < 3) {
    for (const ritual of input.plannerContext.rituals) {
      if (labels.length >= 3) break;
      pushLabel(ritual.title);
    }
  }

  return labels.slice(0, 3);
};

const buildPlanDayClarificationQuestion = (
  input: PlannerBuildInput,
): PlannerQuestion => {
  const focusOptions = getPlanDayFocusLabels(input);
  if (focusOptions.length === 0) {
    return question({
      id: "details",
      field: "details",
      prompt:
        "What kind of day are we making: focused, light, catch-up, or something else?",
      reason:
        "I don't want to invent quests when your day is still a blank page.",
      required: true,
      options: ["Focused", "Light", "Catch-up"],
    });
  }

  const currentMinutes = getLocalMinutesFromDateTime(input.currentDateTime);
  const prompt = currentMinutes !== null && currentMinutes < 12 * 60
    ? "What are you feeling like focusing on this morning?"
    : currentMinutes !== null && currentMinutes < 17 * 60
    ? "What are you feeling like focusing on this afternoon?"
    : "What are you feeling like focusing on right now?";

  return question({
    id: "details",
    field: "details",
    prompt,
    reason:
      "Once I know the direction, I can shape the rest of the day around it.",
    required: true,
    options: focusOptions,
  });
};

const buildPlanDayClarificationResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
  reply?: string,
): PlannerBuildResult => {
  const clarification = buildPlanDayClarificationQuestion(input);
  return {
    mode: "conversational",
    reply: reply ?? clarification.prompt,
    followUpQuestions: [clarification],
    proposals: [],
    suggestedReminders: [],
    structuredResponse: null,
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
      openQuestionIds: [clarification.id],
      pendingStarterIntent: "plan_day",
      lastClassification: classificationHint.type,
    },
  };
};

const isGenericPlanDayStarterRequest = (input: PlannerBuildInput): boolean => {
  const parsedTitle = sanitizeProposalTitle(input.parsedInput?.text);
  if (isPlanDayStarterTitle(input.message)) return true;
  if (parsedTitle && !isPlanDayStarterTitle(parsedTitle)) return false;

  return /\b(plan my day|help me plan(?: my day| today)|plan today)\b/i.test(
    input.message,
  );
};

const isVaguePlanDayDirection = (input: PlannerBuildInput): boolean => {
  const parsedTitle = sanitizeProposalTitle(input.parsedInput?.text);
  const normalized = normalizeText(parsedTitle || input.message);
  if (!normalized) return true;
  if (isGenericPlanDayFocusTitle(normalized)) return true;
  return /\b(idk|i don't know|not sure|whatever|anything|something|you pick|surprise me)\b/
    .test(normalized);
};

const scoreMatchesPlanDayFocus = (
  score: PlannerPriorityScore,
  focusText: string,
  input: PlannerBuildInput,
): boolean => {
  const normalizedFocus = normalizeText(focusText);
  if (!normalizedFocus) return false;

  const scoreTitle = normalizeText(score.title);
  if (
    scoreTitle.includes(normalizedFocus) || normalizedFocus.includes(scoreTitle)
  ) {
    return true;
  }

  if (
    score.reasons.some((reason) =>
      normalizeText(reason).includes(normalizedFocus)
    )
  ) {
    return true;
  }

  if (
    /\b(active|movement|workout|gym|run|walk|exercise|stretch|physical)\b/.test(
      normalizedFocus,
    )
  ) {
    return score.kind === "recovery" ||
      inferEnergyTypeFromTitle(score.title) === "physical";
  }

  if (
    /\b(light|admin|quick|easy|chores|clean|organize|errand|email|reply|call)\b/
      .test(normalizedFocus)
  ) {
    const energyType = inferEnergyTypeFromTitle(score.title);
    return energyType === "admin" || energyType === "errand" ||
      score.kind === "contact";
  }

  if (
    /\b(people|social|friend|family|mom|dad|text|reach out|follow up)\b/.test(
      normalizedFocus,
    )
  ) {
    return score.kind === "contact";
  }

  if (/\b(work|app|build|ship|code|project|focus)\b/.test(normalizedFocus)) {
    if (
      score.kind === "task" || score.kind === "epic" || score.kind === "ritual"
    ) {
      return inferEnergyTypeFromTitle(score.title) === "deep" ||
        inferEnergyTypeFromTitle(score.title) === "admin";
    }
  }

  if (score.kind === "contact" && score.contactId) {
    const contactName = input.plannerContext.contactsNeedingAttention?.find((
      candidate,
    ) => candidate.id === score.contactId)?.name;
    if (contactName) {
      const normalizedContactName = normalizeText(contactName);
      if (
        normalizedContactName.includes(normalizedFocus) ||
        normalizedFocus.includes(normalizedContactName)
      ) {
        return true;
      }
    }
  }

  return false;
};

const getPlanDayRankedScores = (
  input: PlannerBuildInput,
): PlannerPriorityScore[] => {
  const focusText = input.message;
  const scores = getResolvedPriorityScores(input);
  const matchingScores = scores.filter((score) =>
    scoreMatchesPlanDayFocus(score, focusText, input)
  );

  if (matchingScores.length === 0) return scores;

  const matchingIds = new Set(matchingScores.map((score) => score.id));
  return [
    ...matchingScores,
    ...scores.filter((score) => !matchingIds.has(score.id)),
  ];
};

const buildPlanDayAcknowledgement = (
  input: PlannerBuildInput,
): string | null => {
  const parsedTitle = getPlanDayConcreteCandidateTitle(input);
  if (
    parsedTitle &&
    !isPlanDayStarterTitle(parsedTitle) &&
    !isGenericPlanDayFocusTitle(parsedTitle)
  ) {
    return `Got it - let's focus on ${formatGeneratedTaskTitle(parsedTitle)}.`;
  }

  const matchedScore = getPlanDayRankedScores(input)[0];
  if (matchedScore?.title) {
    return `Got it - let's lean into ${matchedScore.title}.`;
  }

  return "Got it - let's shape the day around that.";
};

const getPlanDayConcreteCandidateTitle = (
  input: PlannerBuildInput,
): string | null => {
  if (isTimingOnlyReply(input.message, input.parsedInput)) return null;

  const parsedTitle = sanitizeProposalTitle(input.parsedInput?.text);
  const messageTitle = sanitizeProposalTitle(input.message);
  const title = parsedTitle && !isPlanDayStarterTitle(parsedTitle)
    ? parsedTitle
    : input.sessionState.pendingStarterIntent === "plan_day"
    ? messageTitle
    : parsedTitle ?? messageTitle;

  if (!title || isPlanDayStarterTitle(title)) return null;
  if (isGenericPlanDayFocusTitle(title)) return null;
  if (looksLikeMultiClauseScheduledTitle(title)) return null;
  if (
    getPlanDayFocusLabels(input).some((label) =>
      normalizeText(label) === normalizeText(title)
    )
  ) {
    return null;
  }

  return title;
};

const buildPlanDayConcreteCandidate = (
  input: PlannerBuildInput,
  targetDate: string,
): OptimizerDraftCandidate | null => {
  const parsedTitle = getPlanDayConcreteCandidateTitle(input);
  if (!parsedTitle) return null;
  const title = formatGeneratedTaskTitle(parsedTitle);
  if (!title) return null;
  const scheduledDate = input.parsedInput?.scheduledDate ?? targetDate;
  const suggestedSlot = findSuggestedSlot(
    input,
    scheduledDate,
    input.parsedInput?.scheduledTime ?? null,
  );

  return {
    id: createId(),
    dedupeKey: normalizeText(title),
    title,
    scheduledDate,
    scheduledTime: input.parsedInput?.scheduledTime ?? suggestedSlot?.time ??
      null,
    // Duration precedence: explicit user duration, learned history, then inferred estimates.
    estimatedDuration: getExplicitParsedActivityDuration(input) ??
      getHistoricalActivityDurationMinutes(input, title, "quest", {
        category: input.parsedInput?.category ?? null,
      }) ??
      getClassificationActivityDurationMinutes(input.classificationHint) ??
      input.parsedInput?.estimatedDuration ?? 30,
    reasoning:
      "You named this block directly, so I'm treating it as a real quest instead of leaving it vague.",
    category: input.parsedInput?.category ?? null,
    notes: input.parsedInput?.notes ?? null,
    timingPreferenceLabel: inferTimingLabelFromClock(
      input.parsedInput?.scheduledTime,
    ),
    energyType: inferEnergyTypeFromTitle(title),
    confidence: 0.95,
    derivedFromMessage: input.message,
    priority: 5,
  };
};

const buildPlanDayStrategicAdjustmentProposal = (
  input: PlannerBuildInput,
): PlannerProposal | null => {
  const seenCampaignIds = new Set<string>();

  for (const score of getPlanDayRankedScores(input)) {
    const epicId = score.kind === "epic"
      ? score.epicId
      : score.kind === "task"
      ? score.epicId ?? findPlannerTaskById(input, score.taskId)?.epicId ?? null
      : null;
    if (!epicId || seenCampaignIds.has(epicId)) continue;
    seenCampaignIds.add(epicId);

    const epic = input.plannerContext.activeEpics.find((candidate) =>
      candidate.id === epicId
    );
    if (!epic) continue;

    const campaignMomentum = buildCampaignMomentumCandidate(input, epic);
    if (!hasRepeatedCampaignSlip(campaignMomentum)) continue;
    if (!shouldSuggestStrategicCampaignAdjustment(campaignMomentum)) continue;

    return buildCampaignAdjustmentProposalForMomentum(input, campaignMomentum);
  }

  return null;
};

const buildPlanDayPriorityCandidate = (
  input: PlannerBuildInput,
  score: PlannerPriorityScore,
  targetDate: string,
): OptimizerDraftCandidate | null => {
  const reason = score.reasons[0] ??
    "This is one of the strongest next moves available.";
  const combinedTasks = [
    ...input.plannerContext.tasks,
    ...input.plannerContext.inboxTasks,
  ];

  if (score.kind === "task" && score.taskId) {
    const task = combinedTasks.find((candidate) =>
      candidate.id === score.taskId
    );
    if (!task || task.completed === true || task.taskDate === targetDate) {
      return null;
    }
    const campaignMomentum = getTaskCampaignMomentum(input, task);
    const campaignPressureLead = campaignMomentum
      ? getCampaignPressureLead(campaignMomentum, {
        preferRepeatedSlip: true,
      })
      : null;
    const priorityBase = normalizePlannerScorePriority(score.score);
    const boostedPriority = campaignMomentum?.status === "at_risk"
      ? 5
      : campaignMomentum?.status === "stalled"
      ? Math.max(priorityBase, 4)
      : campaignMomentum?.status === "drifting"
      ? Math.max(priorityBase, 3)
      : priorityBase;
    const reasoning = campaignPressureLead &&
        campaignMomentum?.status !== "moving"
      ? `${campaignPressureLead} This is the clearest move to protect that campaign today.`
      : reason;

    return {
      id: score.taskId,
      dedupeKey: `focus:${normalizeText(task.title)}`,
      title: `Focus block: ${task.title}`,
      scheduledDate: targetDate,
      scheduledTime: null,
      estimatedDuration: getTaskDuration(task),
      reasoning,
      epicId: task.epicId ?? null,
      category: task.category ?? null,
      notes: task.notes ?? campaignPressureLead ?? null,
      timingPreferenceLabel: inferTimingLabelFromClock(
        score.suggestedTime ?? null,
      ),
      energyType: inferEnergyTypeFromTitle(task.title),
      confidence: campaignMomentum?.status === "at_risk"
        ? 0.9
        : campaignMomentum?.status === "stalled"
        ? 0.87
        : 0.84,
      derivedFromMessage: task.title,
      priority: boostedPriority,
    };
  }

  if (score.kind === "ritual" && score.ritualId) {
    const ritual = input.plannerContext.rituals.find((candidate) =>
      candidate.id === score.ritualId
    );
    if (!ritual) return null;
    const ritualDurationMinutes = getRitualDurationMinutes(ritual);
    const suggestedSlot = findSuggestedSlot(
      input,
      targetDate,
      score.suggestedTime ?? ritual.preferredTime ?? null,
    );
    const estimatedDuration = fitPlannerDurationBucketWithin(
      Math.min(
        getOpenSlotDurationMinutes(suggestedSlot) ?? ritualDurationMinutes,
        ritualDurationMinutes,
      ),
    ) ?? ritualDurationMinutes;

    return {
      id: ritual.id,
      dedupeKey: `ritual:${normalizeText(ritual.title)}`,
      title: `Keep ${ritual.title}`,
      scheduledDate: targetDate,
      scheduledTime: null,
      estimatedDuration,
      reasoning: reason,
      epicId: ritual.epicId,
      timingPreferenceLabel: inferTimingLabelFromClock(
        score.suggestedTime ?? ritual.preferredTime ?? null,
      ),
      energyType: "admin",
      confidence: 0.78,
      derivedFromMessage: ritual.title,
      priority: normalizePlannerScorePriority(score.score),
    };
  }

  if (score.kind === "epic" && score.epicId) {
    const epic = input.plannerContext.activeEpics.find((candidate) =>
      candidate.id === score.epicId
    );
    if (!epic) return null;

    const campaignMomentum = buildCampaignMomentumCandidate(input, epic);
    const linkedTask = selectCampaignNextTask(input, campaignMomentum);
    if (linkedTask?.taskDate === targetDate) {
      return null;
    }

    if (linkedTask) {
      const campaignPressureLead = getCampaignPressureLead(campaignMomentum, {
        preferRepeatedSlip: true,
      });
      const priorityBase = normalizePlannerScorePriority(score.score);
      const boostedPriority = campaignMomentum.status === "at_risk"
        ? 5
        : campaignMomentum.status === "stalled"
        ? Math.max(priorityBase, 4)
        : campaignMomentum.status === "drifting"
        ? Math.max(priorityBase, 3)
        : priorityBase;
      return {
        id: linkedTask.id,
        dedupeKey: `campaign-focus:${normalizeText(linkedTask.title)}`,
        title: `Focus block: ${linkedTask.title}`,
        scheduledDate: targetDate,
        scheduledTime: null,
        estimatedDuration: getTaskDuration(linkedTask),
        reasoning: campaignMomentum.status === "moving"
          ? reason
          : `${campaignPressureLead} This is the clearest move to protect that campaign today.`,
        epicId: epic.id,
        category: linkedTask.category ?? null,
        notes: linkedTask.notes ?? campaignPressureLead,
        timingPreferenceLabel: inferTimingLabelFromClock(
          score.suggestedTime ?? null,
        ),
        energyType: inferEnergyTypeFromTitle(linkedTask.title),
        confidence: campaignMomentum.status === "at_risk" ? 0.88 : 0.82,
        derivedFromMessage: linkedTask.title,
        priority: boostedPriority,
      };
    }

    const title = campaignMomentum.status === "stalled" ||
        campaignNeedsFollowUpDefinition(campaignMomentum)
      ? `Define next step for ${epic.title}`
      : campaignMomentum.status === "at_risk"
      ? `Stabilize ${epic.title}`
      : `Progress ${epic.title}`;
    const suggestedSlot = findSuggestedSlot(
      input,
      targetDate,
      score.suggestedTime ?? null,
    );
    const estimatedDuration = fitPlannerDurationBucketWithin(
      Math.min(
        getOpenSlotDurationMinutes(suggestedSlot) ??
          (campaignMomentum.status === "at_risk" ? 45 : 30),
        campaignMomentum.status === "at_risk" ? 45 : 30,
      ),
    ) ?? (campaignMomentum.status === "at_risk" ? 45 : 30);

    return {
      id: epic.id,
      dedupeKey: `epic:${normalizeText(epic.title)}`,
      title,
      scheduledDate: targetDate,
      scheduledTime: null,
      estimatedDuration,
      reasoning: campaignMomentum.statusReason || reason,
      epicId: epic.id,
      timingPreferenceLabel: inferTimingLabelFromClock(
        score.suggestedTime ?? null,
      ),
      energyType: "deep",
      confidence: 0.8,
      derivedFromMessage: epic.title,
      priority: normalizePlannerScorePriority(score.score),
    };
  }

  if (score.kind === "contact") {
    const contactName = score.contactId
      ? input.plannerContext.contactsNeedingAttention?.find((candidate) =>
        candidate.id === score.contactId
      )?.name ?? score.title
      : score.title;
    if (!contactName) return null;
    const suggestedSlot = findSuggestedSlot(
      input,
      targetDate,
      score.suggestedTime ?? null,
    );
    const baseEstimatedDuration = getRelationshipTouchEstimatedDurationMinutes(
      input,
      contactName,
    );
    const estimatedDuration = fitPlannerDurationBucketWithin(
      Math.min(
        getOpenSlotDurationMinutes(suggestedSlot) ?? baseEstimatedDuration,
        baseEstimatedDuration,
      ),
    ) ?? baseEstimatedDuration;

    return {
      id: score.contactId ?? createId(),
      dedupeKey: `contact:${normalizeText(contactName)}`,
      title: `Reach out to ${contactName}`,
      scheduledDate: targetDate,
      scheduledTime: null,
      estimatedDuration,
      reasoning: reason,
      timingPreferenceLabel: inferTimingLabelFromClock(
        score.suggestedTime ?? null,
      ),
      energyType: "social",
      confidence: 0.75,
      derivedFromMessage: contactName,
      priority: normalizePlannerScorePriority(score.score),
    };
  }

  if (score.kind === "recovery") {
    const suggestedSlot = findSuggestedSlot(
      input,
      targetDate,
      score.suggestedTime ?? null,
    );
    const baseEstimatedDuration = getRecoveryResetEstimatedDurationMinutes(
      input,
    );
    const estimatedDuration = fitPlannerDurationBucketWithin(
      Math.min(
        getOpenSlotDurationMinutes(suggestedSlot) ?? baseEstimatedDuration,
        baseEstimatedDuration,
      ),
    ) ?? baseEstimatedDuration;

    return {
      id: score.id,
      dedupeKey: "recovery-reset",
      title: "Recovery reset",
      scheduledDate: targetDate,
      scheduledTime: null,
      estimatedDuration,
      reasoning: reason,
      timingPreferenceLabel: inferTimingLabelFromClock(
        score.suggestedTime ?? null,
      ),
      energyType: "physical",
      confidence: 0.72,
      derivedFromMessage: score.title,
      priority: normalizePlannerScorePriority(score.score),
    };
  }

  return null;
};

const buildOptimizerQuestProposal = (
  input: PlannerBuildInput,
  candidate: OptimizerDraftCandidate,
): PlannerProposal => {
  const reminderMinutesBefore = inferReminderMinutes(
    "create_quest",
    candidate.scheduledTime,
    null,
  );

  return {
    id: createId(),
    kind: "create_quest",
    title: `Create ${candidate.title}`,
    summary: `Create a quest for "${candidate.title}".`,
    reasoning: candidate.reasoning,
    suggestedType: mapDraftPriorityToSuggestedQuestType(candidate.priority),
    payload: {
      taskText: candidate.title,
      difficulty: input.plannerContext.aiSignals?.preferredDifficulty ??
        "medium",
      taskDate: candidate.scheduledDate,
      scheduledTime: candidate.scheduledTime,
      estimatedDuration: candidate.estimatedDuration,
      reminderEnabled: reminderMinutesBefore !== null,
      reminderMinutesBefore: reminderMinutesBefore ?? 15,
      epicId: candidate.epicId ?? undefined,
      category: candidate.category ?? undefined,
      notes: candidate.notes ?? undefined,
      source: "optimizer",
      optimizerMode: input.horizon === "week" ? "week" : "day",
      questSource: candidate.scheduledTime ? "manual" : "inbox",
      derivedFromMessage: candidate.derivedFromMessage,
    },
    status: "pending",
    readyToConfirm: true,
    missingFields: [],
  };
};

const buildOptimizerReply = (
  dateLabel: string,
  proposals: PlannerProposal[],
): string => {
  const usesPlannerMoves = proposals.some((proposal) =>
    proposal.kind !== "create_quest"
  );
  const body = [
    usesPlannerMoves
      ? `I drafted ${proposals.length} planner move${
        proposals.length === 1 ? "" : "s"
      } for ${dateLabel}.`
      : `I drafted ${proposals.length} quest${
        proposals.length === 1 ? "" : "s"
      } for ${dateLabel}.`,
    "Review them and confirm what fits.",
  ];

  return body.filter(Boolean).join(" ");
};

const formatPlanDayInlineList = (items: string[]): string => {
  const cleanItems = items
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (cleanItems.length <= 2) return cleanItems.join(" and ");
  return `${cleanItems.slice(0, -1).join(", ")}, and ${
    cleanItems[cleanItems.length - 1]
  }`;
};

const capitalizeScheduleReference = (value: string): string =>
  value === "today" || value === "tomorrow"
    ? `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`
    : value;

const getPlanDayHiddenCampaignTasks = (
  loadBreakdown: PlanDayLoadBreakdown,
): PlannerContextTask[] => [
  ...loadBreakdown.surfacedCampaignRituals,
  ...loadBreakdown.campaignLinkedQuests,
];

const buildPlanDayCampaignFocus = (
  input: PlannerBuildInput,
  loadBreakdown: PlanDayLoadBreakdown,
): PlanDayCampaignFocus | null => {
  const campaignTasks = getPlanDayHiddenCampaignTasks(loadBreakdown);
  if (campaignTasks.length === 0) return null;

  const groups = new Map<
    string,
    {
      epic: PlannerContextEpic | null;
      title: string;
      tasks: PlannerContextTask[];
      ritualCount: number;
    }
  >();

  for (const task of campaignTasks) {
    const epic = task.epicId
      ? input.plannerContext.activeEpics.find((candidate) =>
        candidate.id === task.epicId
      ) ?? null
      : null;
    const title = epic?.title ?? task.epicTitle ?? "Campaign";
    const key = task.epicId ?? `title:${normalizeText(title)}`;
    const existing = groups.get(key) ?? {
      epic,
      title,
      tasks: [],
      ritualCount: 0,
    };
    existing.tasks.push(task);
    if (isCampaignRitualTask(task)) existing.ritualCount += 1;
    groups.set(key, existing);
  }

  const selected =
    [...groups.values()].sort((left, right) =>
      right.tasks.length - left.tasks.length ||
      right.ritualCount - left.ritualCount ||
      left.title.localeCompare(right.title)
    )[0];
  if (!selected) return null;

  const campaignMomentum = selected.epic
    ? buildCampaignMomentumCandidate(input, selected.epic)
    : null;
  const focusItems = selected.tasks
    .map((task) => task.title)
    .filter((title, index, titles) =>
      titles.findIndex((candidate) =>
        normalizeText(candidate) === normalizeText(title)
      ) === index
    )
    .slice(0, 4);
  const focusItemList = formatPlanDayInlineList(focusItems);

  return {
    campaignTitle: selected.title,
    campaignStatus: campaignMomentum?.status ?? null,
    campaignInterventionLevel: campaignMomentum?.interventionLevel ?? null,
    campaignReason: selected.ritualCount > 0 && focusItemList
      ? `${focusItemList} ${
        focusItems.length === 1 ? "is" : "are"
      } already tucked into this campaign today.`
      : campaignMomentum?.statusReason ?? null,
    campaignHealth: campaignMomentum
      ? buildCampaignHealthSnapshot(input, campaignMomentum)
      : null,
    focusItems,
  };
};

const countPlanDayCampaignGroups = (
  loadBreakdown: PlanDayLoadBreakdown,
): number =>
  new Set(
    getPlanDayHiddenCampaignTasks(loadBreakdown).map((task) =>
      task.epicId ?? task.epicTitle ?? task.title
    ),
  ).size;

const buildPlanDayCampaignLoadMessage = (
  input: PlannerBuildInput,
  dateLabel: string,
  loadBreakdown: PlanDayLoadBreakdown,
): string | null => {
  const campaignFocus = buildPlanDayCampaignFocus(input, loadBreakdown);
  if (!campaignFocus || campaignFocus.focusItems.length === 0) return null;

  const dateLead = capitalizeScheduleReference(dateLabel);
  const focusItemList = formatPlanDayInlineList(campaignFocus.focusItems);
  const campaignGroupCount = countPlanDayCampaignGroups(loadBreakdown);
  const drawerLabel = campaignGroupCount > 1
    ? "those campaign drawers"
    : "that campaign drawer";
  const opener = loadBreakdown.visibleStandaloneQuests.length === 0
    ? `${dateLead} looks open in standalone quests, but your campaign work is already carrying the focus`
    : `${dateLead} already has campaign work carrying much of the focus`;

  return `${opener}: ${focusItemList} for ${campaignFocus.campaignTitle}. I'd work from ${drawerLabel} before adding more.`;
};

const derivePlanDayAssessment = (
  input: PlannerBuildInput,
  targetDate: string,
  loadBreakdown: PlanDayLoadBreakdown = getPlanDayLoadBreakdown(
    input,
    targetDate,
  ),
): CompanionDayAssessment => {
  const currentDayLoad = input.plannerContext.scheduleInsights?.dayLoads.find((
    day,
  ) => day.date === targetDate);
  const missedCount = collectMissedTasksForToday(input).length;
  const momentumState = input.plannerContext.statInterpretation?.momentumState;
  const latestEnergy = input.plannerContext.reflectionSignals?.[0]?.energy ??
    null;

  if (latestEnergy === "low") return "low_energy";
  if (missedCount >= 2) return "behind";
  if (
    loadBreakdown.workItemsForProposalLimit >=
      getPlanDayTargetTotal(input, targetDate)
  ) {
    return "busy";
  }
  if (momentumState === "locked_in") return "productive";
  if (
    currentDayLoad?.status === "overloaded" ||
    currentDayLoad?.status === "busy"
  ) {
    return "busy";
  }
  if (
    currentDayLoad?.status === "balanced" ||
    loadBreakdown.workItemsForProposalLimit > 0 ||
    loadBreakdown.calendarBlocks.length > 0
  ) return "balanced";
  return "open";
};

const buildPlanDayStructuredOutput = (
  input: PlannerBuildInput,
  reply: string,
  classificationHint: ClassificationHint,
  proposals: PlannerProposal[],
  loadBreakdown = getPlanDayLoadBreakdown(input, getPlanDayTargetDate(input)),
): CompanionStructuredResponse => ({
  intent: mapPlannerIntentMetadata(input, classificationHint, {
    forceIntentType: getProposalDrivenIntentType("quest", proposals),
    shouldCreateQuest: shouldCreateQuestFromProposals(proposals),
    shouldPromptCampaign: false,
  }),
  planDay: {
    message: reply,
    dayAssessment: derivePlanDayAssessment(
      input,
      getPlanDayTargetDate(input),
      loadBreakdown,
    ),
    suggestedQuests: proposals.slice(0, 5).map((proposal) =>
      buildSuggestedQuestFromProposal(input, proposal)
    ),
    campaignFocus: buildPlanDayCampaignFocus(input, loadBreakdown),
  },
  weeklyPlan: null,
  comingUp: null,
  rightNow: null,
  dayAdjust: null,
});

const WEEKDAY_SHORT_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
});

const getWeeklyRangeDates = (currentDate: string): string[] =>
  Array.from({ length: 7 }, (_, index) => addDaysToDateKey(currentDate, index));

const formatWeeklyDayLabel = (date: string): string =>
  WEEKDAY_SHORT_FORMATTER.format(new Date(`${date}T12:00:00`));

const getWeeklyLoadStatus = (
  input: PlannerBuildInput,
  date: string,
): "open" | "balanced" | "busy" | "overloaded" => {
  const insightStatus = input.plannerContext.scheduleInsights?.dayLoads.find((
    day,
  ) => day.date === date)?.status;
  if (insightStatus) return insightStatus;

  const intervals = buildIntervalsForDate(input, date);
  if (intervals.length === 0) return "open";

  const totalMinutes = intervals.reduce(
    (sum, interval) =>
      sum + Math.max(0, interval.endMinutes - interval.startMinutes),
    0,
  );

  if (totalMinutes >= 480 || intervals.length >= 6) return "overloaded";
  if (totalMinutes >= 300 || intervals.length >= 4) return "busy";
  return "balanced";
};

const buildWeeklyPrioritySuggestions = (
  input: PlannerBuildInput,
): CompanionSuggestedQuest[] => {
  const rangeDates = getWeeklyRangeDates(input.currentDate);
  const rangeEnd = rangeDates[rangeDates.length - 1] ?? input.currentDate;
  const suggestions: CompanionSuggestedQuest[] = [];
  const seen = new Set<string>();

  const addSuggestion = (suggestion: CompanionSuggestedQuest | null) => {
    if (!suggestion) return;
    const dedupeKey = suggestion.proposalId ?? suggestion.suggestionId;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    suggestions.push(suggestion);
  };

  for (
    const score of [...getResolvedPriorityScores(input)].sort((
      left,
      right,
    ) => right.score - left.score)
  ) {
    if (suggestions.length >= 5) break;

    if (score.kind === "task" && score.taskId) {
      const task = findPlannerTaskById(input, score.taskId);
      if (!task || task.completed === true) continue;
      if (task.taskDate && task.taskDate > rangeEnd) continue;
      const campaignMomentum = getTaskCampaignMomentum(input, task);
      const campaignPressureLead = campaignMomentum
        ? getCampaignPressureLead(campaignMomentum, {
          preferRepeatedSlip: true,
        })
        : null;

      if (
        campaignMomentum &&
        shouldSuggestStrategicCampaignAdjustment(campaignMomentum)
      ) {
        addSuggestion(
          buildCampaignAdjustmentSuggestedQuest(input, campaignMomentum, {
            suggestionIdPrefix: "week:campaign-adjust",
            type: getCampaignInterventionSuggestedType(
              campaignMomentum,
              mapPriorityScoreToSuggestedQuestType(score.score, task),
            ),
            reason:
              `${campaignPressureLead} This needs a reset plan this week, not another isolated task.`,
          }),
        );
        continue;
      }

      if (
        campaignMomentum?.oversizedTask?.id === task.id &&
        campaignMomentum.interventionLevel === "reset"
      ) {
        addSuggestion({
          suggestionId: `week:campaign-breakdown:${task.id}`,
          proposalId: null,
          title: `Break down ${task.title}`,
          type: getCampaignInterventionSuggestedType(
            campaignMomentum,
            mapPriorityScoreToSuggestedQuestType(score.score, task),
          ),
          estimatedDuration: formatEstimatedDurationLabel(
            getCampaignBreakdownEstimatedDurationMinutes(input, task),
          ),
          estimatedDurationMinutes:
            getCampaignBreakdownEstimatedDurationMinutes(
              input,
              task,
            ),
          source: "campaign",
          reason:
            `${campaignPressureLead} This needs a smaller reset move this week.`,
        });
        continue;
      }

      addSuggestion(buildSuggestedQuestFromTask(
        task,
        campaignMomentum && campaignMomentum.status !== "moving"
          ? campaignMomentum.interventionLevel === "reset"
            ? `${campaignPressureLead} This needs a reset move this week.`
            : `${campaignPressureLead} This is one of the clearest campaign moves to protect this week.`
          : score.reasons[0] ??
            "This is one of the clearest moves to protect this week.",
        {
          type: campaignMomentum && campaignMomentum.status !== "moving"
            ? getCampaignInterventionSuggestedType(
              campaignMomentum,
              mapPriorityScoreToSuggestedQuestType(score.score, task),
            )
            : mapPriorityScoreToSuggestedQuestType(score.score, task),
        },
      ));
      continue;
    }

    if (score.kind === "epic" && score.epicId) {
      const epic = input.plannerContext.activeEpics.find((candidate) =>
        candidate.id === score.epicId
      );
      if (!epic) continue;

      const momentum = buildCampaignMomentumCandidate(input, epic);
      const linkedTask = selectCampaignNextTask(input, momentum);
      const campaignPressureLead = getCampaignPressureLead(momentum, {
        preferRepeatedSlip: true,
      });

      if (shouldSuggestStrategicCampaignAdjustment(momentum)) {
        addSuggestion(buildCampaignAdjustmentSuggestedQuest(input, momentum, {
          suggestionIdPrefix: "week:campaign-adjust",
          type: getCampaignInterventionSuggestedType(
            momentum,
            momentum.status === "at_risk" ? "must" : "should",
          ),
          reason:
            `${campaignPressureLead} This needs a reset plan this week, not another isolated task.`,
        }));
        continue;
      }

      if (
        momentum.oversizedTask &&
        momentum.interventionLevel === "reset" &&
        (!linkedTask || linkedTask.id === momentum.oversizedTask.id)
      ) {
        addSuggestion({
          suggestionId: `week:campaign-breakdown:${momentum.oversizedTask.id}`,
          proposalId: null,
          title: `Break down ${momentum.oversizedTask.title}`,
          type: getCampaignInterventionSuggestedType(momentum, "should"),
          estimatedDuration: formatEstimatedDurationLabel(
            getCampaignBreakdownEstimatedDurationMinutes(
              input,
              momentum.oversizedTask,
            ),
          ),
          estimatedDurationMinutes:
            getCampaignBreakdownEstimatedDurationMinutes(
              input,
              momentum.oversizedTask,
            ),
          source: "campaign",
          reason:
            `${campaignPressureLead} This needs a smaller reset move this week.`,
        });
        continue;
      }

      if (
        linkedTask && linkedTask.completed !== true && (
          !linkedTask.taskDate || linkedTask.taskDate <= rangeEnd
        )
      ) {
        addSuggestion(buildSuggestedQuestFromTask(
          linkedTask,
          momentum.interventionLevel === "reset"
            ? `${campaignPressureLead} This needs a reset move this week.`
            : momentum.statusReason,
          {
            type: getCampaignInterventionSuggestedType(
              momentum,
              momentum.status === "at_risk"
                ? "must"
                : momentum.status === "stalled"
                ? "should"
                : mapPriorityScoreToSuggestedQuestType(score.score, linkedTask),
            ),
          },
        ));
        continue;
      }

      addSuggestion({
        suggestionId: `week:campaign:${epic.id}`,
        proposalId: null,
        title: momentum.oversizedTask
          ? `Break down ${momentum.oversizedTask.title}`
          : campaignNeedsFollowUpDefinition(momentum)
          ? `Define next step for ${epic.title}`
          : momentum.interventionLevel === "reset"
          ? `Reset ${epic.title}`
          : momentum.status === "at_risk"
          ? `Protect ${epic.title}`
          : momentum.status === "stalled"
          ? `Define next step for ${epic.title}`
          : `Move ${epic.title} forward`,
        type: getCampaignInterventionSuggestedType(
          momentum,
          momentum.status === "at_risk"
            ? "must"
            : momentum.status === "stalled"
            ? "should"
            : "nice",
        ),
        estimatedDuration: `${
          getCampaignFollowUpEstimatedDurationMinutes(input, momentum)
        } min`,
        estimatedDurationMinutes: getCampaignFollowUpEstimatedDurationMinutes(
          input,
          momentum,
        ),
        source: "campaign",
        reason: momentum.interventionLevel === "reset"
          ? `${
            getCampaignPressureLead(momentum, {
              preferRepeatedSlip: true,
            })
          } This needs a reset move this week.`
          : momentum.statusReason,
      });
      continue;
    }

    if (score.kind === "ritual" && score.ritualId) {
      const ritual = input.plannerContext.rituals.find((candidate) =>
        candidate.id === score.ritualId
      );
      if (!ritual) continue;

      addSuggestion({
        suggestionId: `week:ritual:${ritual.id}`,
        proposalId: null,
        title: `Keep ${ritual.title}`,
        type: "nice",
        estimatedDuration: formatEstimatedDurationLabel(
          getRitualDurationMinutes(ritual),
        ),
        estimatedDurationMinutes: getRitualDurationMinutes(ritual),
        source: "habit",
        reason: ritual.preferredTime
          ? `${ritual.title} stays easiest when you protect its usual ${ritual.preferredTime} slot.`
          : `${ritual.title} is a lighter weekly support move worth keeping alive.`,
      });
      continue;
    }
  }

  return suggestions.slice(0, 5);
};

const buildWeeklyPlanStructuredOutput = (
  input: PlannerBuildInput,
  reply: string,
  classificationHint: ClassificationHint,
  weeklyTheme: string | null,
  focusCampaign: CampaignMomentumCandidate | null,
  topPriorities: CompanionSuggestedQuest[],
  busyDays: string[],
  openDays: string[],
  proposals: PlannerProposal[],
): CompanionStructuredResponse => ({
  intent: mapPlannerIntentMetadata(input, classificationHint, {
    forceIntentType: getProposalDrivenIntentType(
      focusCampaign ? "campaign" : "quest",
      proposals,
    ),
    shouldCreateQuest: shouldCreateQuestFromProposals(proposals),
    shouldPromptCampaign: false,
  }),
  planDay: null,
  weeklyPlan: {
    message: reply,
    weeklyTheme,
    focusCampaignTitle: focusCampaign?.epic.title ?? null,
    focusCampaignStatus: focusCampaign?.status ?? null,
    focusCampaignInterventionLevel: focusCampaign?.interventionLevel ?? null,
    focusCampaignReason: focusCampaign
      ? getCampaignPressureLead(focusCampaign, {
        preferRepeatedSlip: true,
      })
      : null,
    focusCampaignHealth: focusCampaign
      ? buildCampaignHealthSnapshot(input, focusCampaign)
      : null,
    topPriorities,
    busyDays,
    openDays,
  },
  comingUp: null,
  rightNow: null,
  dayAdjust: null,
});

const buildPlanWeekStarterResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
): PlannerBuildResult => {
  const dayLabels = getWeeklyRangeDates(input.currentDate).map((date) => ({
    label: formatWeeklyDayLabel(date),
    status: getWeeklyLoadStatus(input, date),
  }));
  const busyDays = dayLabels
    .filter((day) => day.status === "busy" || day.status === "overloaded")
    .map((day) => day.label);
  const openDays = dayLabels
    .filter((day) => day.status === "open")
    .map((day) => day.label);
  const selectedCampaign = selectCampaignMomentumCandidate(input);
  const campaignPressureLead = selectedCampaign
    ? getCampaignPressureLead(selectedCampaign, {
      preferRepeatedSlip: true,
    })
    : null;
  const weeklyAdjustmentProposal = selectedCampaign &&
      shouldSuggestStrategicCampaignAdjustment(selectedCampaign)
    ? buildCampaignAdjustmentProposalForMomentum(input, selectedCampaign)
    : null;
  const weeklyFollowUpSchedulingHint = getWeeklyFollowUpSchedulingHint(input);
  const weeklyFollowUpProposal = !weeklyAdjustmentProposal &&
      selectedCampaign &&
      campaignNeedsFollowUpDefinition(selectedCampaign)
    ? buildCampaignNextStepProposal(
      input,
      selectedCampaign,
      weeklyFollowUpSchedulingHint,
    )
    : null;
  const weeklyTheme =
    input.plannerContext.statInterpretation?.weeklyNarrative ??
      (selectedCampaign
        ? campaignPressureLead
          ? `${selectedCampaign.epic.title} is the campaign to protect this week: ${campaignPressureLead}`
          : `${selectedCampaign.epic.title} is the campaign to protect this week.`
        : busyDays.length > 0
        ? "Protect the high-leverage moves early and keep the crowded days lighter."
        : "You have room for a focused, realistic week.");
  const weeklyProposal = weeklyAdjustmentProposal ?? weeklyFollowUpProposal;
  let weeklyProposalApplied = false;
  let topPriorities = buildWeeklyPrioritySuggestions(input).map((quest) => {
    if (
      weeklyAdjustmentProposal &&
      selectedCampaign &&
      quest.title === `Adjust ${selectedCampaign.epic.title}`
    ) {
      weeklyProposalApplied = true;
      return buildSuggestedQuestFromProposal(
        input,
        weeklyAdjustmentProposal,
        quest.reason,
      );
    }

    if (
      weeklyFollowUpProposal &&
      selectedCampaign &&
      quest.title === `Define next step for ${selectedCampaign.epic.title}`
    ) {
      weeklyProposalApplied = true;
      return buildSuggestedQuestFromProposal(
        input,
        weeklyFollowUpProposal,
        quest.reason,
      );
    }

    return quest;
  });

  if (
    weeklyFollowUpProposal &&
    selectedCampaign &&
    !weeklyProposalApplied
  ) {
    topPriorities = [
      buildSuggestedQuestFromProposal(
        input,
        weeklyFollowUpProposal,
        campaignPressureLead
          ? `${campaignPressureLead} Define the next step before you add more pressure this week.`
          : selectedCampaign.statusReason,
      ),
      ...topPriorities,
    ].slice(0, 5);
  }
  const busyDaySummary = busyDays.length > 0
    ? `${busyDays.slice(0, 2).join(" and ")} ${
      busyDays.length === 1 ? "looks" : "look"
    } tight, so avoid stacking extra hard work there.`
    : openDays.length > 0
    ? `${openDays.slice(0, 2).join(" and ")} ${
      openDays.length === 1 ? "is" : "are"
    } your best deeper-work opening${openDays.length === 1 ? "" : "s"}.`
    : "The week is fairly even, so the main job is protecting the few moves that matter most.";
  const reply = `${weeklyTheme} ${busyDaySummary}`.trim();

  const structuredResponse = buildWeeklyPlanStructuredOutput(
    input,
    reply,
    classificationHint,
    weeklyTheme,
    selectedCampaign,
    topPriorities,
    busyDays,
    openDays,
    weeklyProposal ? [weeklyProposal] : [],
  );

  if (weeklyProposal) {
    return {
      mode: "proposal",
      reply,
      followUpQuestions: [],
      proposals: [weeklyProposal],
      suggestedReminders: [],
      structuredResponse,
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
        lastClassification: classificationHint.type,
      },
    };
  }

  return buildReadOnlyResponse(
    reply,
    {
      ...sessionState,
      lastClassification: classificationHint.type,
    },
    "schedule_read",
    structuredResponse,
  );
};

const getDateSummary = (
  input: PlannerBuildInput,
  date: string,
): CompanionTomorrowSummary => {
  const dayLoad = input.plannerContext.scheduleInsights?.dayLoads.find((day) =>
    day.date === date
  );
  if (!dayLoad || dayLoad.status === "open") return "open";
  if (dayLoad.status === "balanced") return "light";
  return "busy";
};

const getWeeklyFollowUpSchedulingHint = (
  input: PlannerBuildInput,
): {
  targetDate: string;
  scheduledTime?: string | null;
} => {
  const weeklyDates = getWeeklyRangeDates(input.currentDate);
  const weeklyDateSet = new Set(weeklyDates);
  const suggestedSlot = input.plannerContext.scheduleInsights?.suggestedSlots
    .find(
      (slot) => weeklyDateSet.has(slot.date),
    );

  if (suggestedSlot) {
    return {
      targetDate: suggestedSlot.date,
      scheduledTime: suggestedSlot.time,
    };
  }

  const firstOpenOrBalancedDate = weeklyDates.find((date) => {
    const status = getWeeklyLoadStatus(input, date);
    return status === "open" || status === "balanced";
  });

  return {
    targetDate: firstOpenOrBalancedDate ?? input.currentDate,
  };
};

const buildTomorrowFirstAction = (
  input: PlannerBuildInput,
  tomorrow: string,
  carryForward: string | null,
): {
  firstAction: CompanionSuggestedQuest | null;
  proposal: PlannerProposal | null;
} => {
  const tomorrowTaskEntries = getResolvedPriorityScores(input)
    .filter((score) => score.kind === "task" && score.taskId)
    .map((score) => ({
      score,
      task: findPlannerTaskById(input, score.taskId ?? null),
    }))
    .filter((
      entry,
    ): entry is { score: PlannerPriorityScore; task: PlannerContextTask } =>
      entry.task !== null &&
      entry.task.completed !== true &&
      entry.task.taskDate === tomorrow
    )
    .sort((left, right) => right.score.score - left.score.score);

  const bestTomorrowTask = tomorrowTaskEntries[0] ?? null;
  if (bestTomorrowTask) {
    return {
      firstAction: buildSuggestedQuestFromTask(
        bestTomorrowTask.task,
        carryForward
          ? `${carryForward} This is the cleanest first move already on tomorrow's board.`
          : bestTomorrowTask.score.reasons[0] ??
            "This is the clearest move to protect first tomorrow.",
        {
          type: mapPriorityScoreToSuggestedQuestType(
            bestTomorrowTask.score.score,
            bestTomorrowTask.task,
          ),
        },
      ),
      proposal: null,
    };
  }

  const selectedCampaign = selectCampaignMomentumCandidate(input);
  if (!selectedCampaign) {
    return {
      firstAction: null,
      proposal: null,
    };
  }
  const campaignPressureLead = getCampaignPressureLead(selectedCampaign, {
    preferRepeatedSlip: true,
  });
  const interventionType = getCampaignInterventionSuggestedType(
    selectedCampaign,
    selectedCampaign.status === "at_risk" ? "must" : "should",
  );
  const adjustmentProposal = shouldSuggestStrategicCampaignAdjustment(
      selectedCampaign,
    )
    ? buildCampaignAdjustmentProposalForMomentum(input, selectedCampaign)
    : null;

  if (adjustmentProposal) {
    return {
      firstAction: buildSuggestedQuestFromProposal(
        input,
        adjustmentProposal,
        carryForward
          ? `${carryForward} The honest first move tomorrow is resetting ${selectedCampaign.epic.title} before you pile on more work.`
          : `${campaignPressureLead} The honest first move tomorrow is resetting ${selectedCampaign.epic.title} before you pile on more work.`,
      ),
      proposal: adjustmentProposal,
    };
  }

  const linkedTask = selectCampaignNextTask(input, selectedCampaign);
  if (
    selectedCampaign.oversizedTask &&
    selectedCampaign.interventionLevel === "reset" &&
    (!linkedTask || linkedTask.id === selectedCampaign.oversizedTask.id)
  ) {
    return {
      firstAction: {
        suggestionId:
          `tomorrow:campaign-breakdown:${selectedCampaign.oversizedTask.id}`,
        proposalId: null,
        title: `Break down ${selectedCampaign.oversizedTask.title}`,
        type: interventionType,
        estimatedDuration: formatEstimatedDurationLabel(
          getCampaignBreakdownEstimatedDurationMinutes(
            input,
            selectedCampaign.oversizedTask,
          ),
        ),
        estimatedDurationMinutes: getCampaignBreakdownEstimatedDurationMinutes(
          input,
          selectedCampaign.oversizedTask,
        ),
        source: "campaign",
        reason: carryForward
          ? `${carryForward} The smartest way to restart this campaign tomorrow is to make the next move smaller first.`
          : `${campaignPressureLead} The smartest way to restart this campaign tomorrow is to make the next move smaller first.`,
      },
      proposal: null,
    };
  }

  if (
    linkedTask &&
    linkedTask.completed !== true &&
    (!linkedTask.taskDate || linkedTask.taskDate <= input.currentDate)
  ) {
    return {
      firstAction: buildSuggestedQuestFromTask(
        linkedTask,
        carryForward
          ? `${carryForward} This is the strongest campaign move to carry into tomorrow.`
          : selectedCampaign.interventionLevel === "reset"
          ? `${campaignPressureLead} This needs a reset move first tomorrow.`
          : campaignPressureLead,
        {
          type: interventionType,
        },
      ),
      proposal: null,
    };
  }

  if (selectedCampaign.oversizedTask) {
    const estimatedDurationMinutes =
      getCampaignBreakdownEstimatedDurationMinutes(
        input,
        selectedCampaign.oversizedTask,
      );
    return {
      firstAction: {
        suggestionId: `tomorrow:campaign:${selectedCampaign.epic.id}`,
        proposalId: null,
        title: `Break down ${selectedCampaign.oversizedTask.title}`,
        type: interventionType,
        estimatedDuration: formatEstimatedDurationLabel(
          estimatedDurationMinutes,
        ),
        estimatedDurationMinutes,
        source: "campaign",
        reason: carryForward
          ? `${carryForward} The smartest way to protect this campaign tomorrow is to make the next move smaller first.`
          : selectedCampaign.interventionLevel === "reset"
          ? `${campaignPressureLead} The smartest way to restart this campaign tomorrow is to make the next move smaller first.`
          : campaignPressureLead,
      },
      proposal: null,
    };
  }

  if (campaignNeedsFollowUpDefinition(selectedCampaign)) {
    const followUpProposal = buildCampaignNextStepProposal(
      input,
      selectedCampaign,
      {
        targetDate: tomorrow,
      },
    );

    return {
      firstAction: buildSuggestedQuestFromProposal(
        input,
        followUpProposal,
        carryForward
          ? `${carryForward} The cleanest way to keep ${selectedCampaign.epic.title} moving tomorrow is to define the next step before the momentum fades.`
          : `${campaignPressureLead} The cleanest way to keep ${selectedCampaign.epic.title} moving tomorrow is to define the next step before the momentum fades.`,
      ),
      proposal: followUpProposal,
    };
  }

  return {
    firstAction: null,
    proposal: null,
  };
};

const buildReflectionBridgeStructuredOutput = (
  input: PlannerBuildInput,
  reply: string,
  classificationHint: ClassificationHint,
  options: {
    carryForward: string | null;
    tomorrowSummary: CompanionTomorrowSummary;
    firstAction: CompanionSuggestedQuest | null;
    tomorrowSchedule: CompanionScheduleItem[];
    proposals: PlannerProposal[];
  },
): CompanionStructuredResponse => ({
  intent: mapPlannerIntentMetadata(input, classificationHint, {
    forceIntentType: getProposalDrivenIntentType(
      options.firstAction ? "quest" : "conversation",
      options.proposals,
    ),
    shouldCreateQuest: shouldCreateQuestFromProposals(options.proposals),
    shouldPromptCampaign: false,
  }),
  planDay: null,
  weeklyPlan: null,
  reflectionBridge: {
    message: reply,
    carryForward: options.carryForward,
    tomorrowSummary: options.tomorrowSummary,
    firstAction: options.firstAction,
    tomorrowSchedule: options.tomorrowSchedule,
  },
  comingUp: null,
  rightNow: null,
  dayAdjust: null,
});

const buildReflectionBridgeResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
): PlannerBuildResult => {
  const tomorrow = addDaysToDateKey(input.currentDate, 1);
  const latestReflection = input.plannerContext.reflectionSignals?.[0] ?? null;
  const carryForward = latestReflection?.tomorrowAdjustment ?? null;
  const tomorrowSummary = getDateSummary(input, tomorrow);
  const tomorrowSchedule = collectStructuredScheduleItemsForDate(
    input,
    tomorrow,
    false,
  );
  const tomorrowActionState = buildTomorrowFirstAction(
    input,
    tomorrow,
    carryForward,
  );
  const firstAction = tomorrowActionState.firstAction;
  const selectedCampaign = carryForward
    ? null
    : selectCampaignMomentumCandidate(input);
  const campaignPressureLead = selectedCampaign
    ? getCampaignPressureLead(selectedCampaign, {
      preferRepeatedSlip: true,
    })
    : null;

  const openingLine = carryForward
    ? `You wanted to carry this into tomorrow: ${carryForward}`
    : selectedCampaign && campaignPressureLead
    ? selectedCampaign.interventionLevel === "reset"
      ? `The campaign to reset tomorrow is ${selectedCampaign.epic.title}: ${campaignPressureLead}`
      : `The campaign to protect tomorrow is ${selectedCampaign.epic.title}: ${campaignPressureLead}`
    : "Here's the cleanest planner handoff into tomorrow.";
  const scheduleLine = tomorrowSummary === "busy"
    ? "Tomorrow already looks busy, so keep the first move focused and realistic."
    : tomorrowSummary === "light"
    ? "Tomorrow has some room, so the goal is starting with the right move instead of adding more noise."
    : "Tomorrow looks open, so the main job is choosing a strong first move before the day fills itself.";
  const actionLine = firstAction
    ? `First move: ${firstAction.title}. ${firstAction.reason}`
    : "I don't see one obvious tomorrow move on the board yet, so keeping the first hour light and deliberate will matter more than overcommitting tonight.";
  const reply = [openingLine, scheduleLine, actionLine].join(" ");

  const structuredResponse = buildReflectionBridgeStructuredOutput(
    input,
    reply,
    classificationHint,
    {
      carryForward,
      tomorrowSummary,
      firstAction,
      tomorrowSchedule,
      proposals: tomorrowActionState.proposal
        ? [tomorrowActionState.proposal]
        : [],
    },
  );

  if (tomorrowActionState.proposal) {
    return {
      mode: "proposal",
      reply,
      followUpQuestions: [],
      proposals: [tomorrowActionState.proposal],
      suggestedReminders: [],
      structuredResponse,
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
        lastClassification: classificationHint.type,
      },
    };
  }

  return buildReadOnlyResponse(
    reply,
    {
      ...sessionState,
      lastClassification: classificationHint.type,
    },
    "schedule_read",
    structuredResponse,
  );
};

const buildCurrentWindowLabel = (input: PlannerBuildInput): string => {
  const currentMinutes = getLocalMinutesFromDateTime(input.currentDateTime);
  if (currentMinutes === null) return "the next hour";

  const intervals = buildIntervalsForDate(input, input.currentDate)
    .filter((interval) => interval.endMinutes > currentMinutes);
  const nextInterval = intervals.find((interval) =>
    interval.startMinutes > currentMinutes
  );
  const windDownMinutes = getWindDownMinutes(
    input.plannerContext.plannerMemory,
  );
  const defaultEnd = Math.min(currentMinutes + 60, windDownMinutes);
  const endMinutes = nextInterval
    ? Math.min(
      nextInterval.startMinutes,
      Math.max(defaultEnd, currentMinutes + 30),
    )
    : defaultEnd;

  return formatAssistantTimeRange(
    formatMinutes(currentMinutes),
    formatMinutes(Math.max(currentMinutes + 30, endMinutes)),
  ) ??
    "the next hour";
};

const getTodayScoredTaskEntries = (input: PlannerBuildInput) =>
  getResolvedPriorityScores(input)
    .filter((score) => score.kind === "task" && score.taskId)
    .map((score) => ({
      score,
      task: findPlannerTaskById(input, score.taskId ?? null),
    }))
    .filter((
      entry,
    ): entry is { score: PlannerPriorityScore; task: PlannerContextTask } =>
      entry.task !== null &&
      entry.task.taskDate === input.currentDate &&
      entry.task.completed !== true
    )
    .sort((left, right) => right.score.score - left.score.score);

const buildRightNowStructuredOutput = (
  input: PlannerBuildInput,
  reply: string,
  classificationHint: ClassificationHint,
  recommendedAction: CompanionSuggestedQuest | null,
  fallbackAction: CompanionSuggestedQuest | null,
  currentWindow: string,
  proposals: PlannerProposal[],
): CompanionStructuredResponse => ({
  intent: mapPlannerIntentMetadata(input, classificationHint, {
    forceIntentType: getProposalDrivenIntentType("quest", proposals),
    shouldCreateQuest: shouldCreateQuestFromProposals(proposals),
    shouldPromptCampaign: false,
  }),
  planDay: null,
  weeklyPlan: null,
  comingUp: null,
  rightNow: {
    message: reply,
    currentWindow,
    recommendedAction,
    fallbackAction,
  },
  dayAdjust: null,
});

const buildRightNowStarterResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
): PlannerBuildResult => {
  const currentMinutes = getLocalMinutesFromDateTime(input.currentDateTime);
  const currentWindow = buildCurrentWindowLabel(input);
  const entries = getTodayScoredTaskEntries(input);

  const inProgress = entries.find(({ task }) => {
    const startMinutes = parseTimeToMinutes(task.scheduledTime);
    if (startMinutes === null || currentMinutes === null) return false;
    return currentMinutes >= startMinutes &&
      currentMinutes < startMinutes + getTaskDuration(task);
  }) ?? null;
  const upcoming = entries.find(({ task }) => {
    const startMinutes = parseTimeToMinutes(task.scheduledTime);
    if (startMinutes === null || currentMinutes === null) return false;
    return startMinutes >= currentMinutes &&
      startMinutes <= currentMinutes + 60;
  }) ?? null;

  const intervals = buildIntervalsForDate(input, input.currentDate)
    .filter((interval) =>
      currentMinutes === null || interval.startMinutes > currentMinutes
    );
  const nextIntervalStart = intervals[0]?.startMinutes ??
    getWindDownMinutes(input.plannerContext.plannerMemory);
  const availableMinutes = currentMinutes === null
    ? 60
    : Math.max(0, nextIntervalStart - currentMinutes);
  const fitCandidate =
    entries.find(({ task }) =>
      parseTimeToMinutes(task.scheduledTime) === null &&
      getTaskDuration(task) <= availableMinutes
    ) ??
      entries.find(({ task }) => getTaskDuration(task) <= availableMinutes) ??
      null;
  const campaignCandidate = buildCampaignWindowNextBestAction(input, {
    availableMinutes,
    context: "right_now",
  });

  const chosenTask = inProgress ?? upcoming ??
    (
      campaignCandidate &&
        (!fitCandidate ||
          campaignCandidate.priorityScore > fitCandidate.score.score)
        ? null
        : fitCandidate
    );
  const recommendedAction = chosenTask
    ? buildSuggestedQuestFromTask(
      chosenTask.task,
      inProgress
        ? "It's already in your active window, so sticking with it is the cleanest move."
        : upcoming
        ? "It's the next scheduled move, so starting there keeps the day on track."
        : chosenTask.score.reasons[0] ??
          "It fits the current window without crowding the rest of the day.",
      {
        type: mapPriorityScoreToSuggestedQuestType(
          chosenTask.score.score,
          chosenTask.task,
        ),
      },
    )
    : campaignCandidate
    ? campaignCandidate.suggestion
    : null;

  const missedTask = collectMissedTasksForToday(input)[0];
  const missedTaskRecord = findPlannerTaskById(input, missedTask?.id ?? null);
  const fallbackAction = missedTaskRecord
    ? buildSuggestedQuestFromTask(
      missedTaskRecord,
      "You missed this earlier, so clearing it now helps the rest of the day stop dragging behind you.",
    )
    : recommendedAction
    ? null
    : (() => {
      const estimatedDurationMinutes = getQuickResetEstimatedDurationMinutes(
        input,
        availableMinutes,
      );
      return {
        suggestionId: "recovery:right-now",
        proposalId: null,
        title:
          `Take a ${estimatedDurationMinutes}-minute reset and clear one quick blocker`,
        type: "nice" as const,
        estimatedDuration: formatEstimatedDurationLabel(
          estimatedDurationMinutes,
        ),
        estimatedDurationMinutes,
        source: "recovery" as const,
        reason:
          "Nothing else fits cleanly right now, so the best move is to reset and create a little room.",
      };
    })();

  const reply = recommendedAction
    ? `For ${currentWindow}, do ${recommendedAction.title}. ${recommendedAction.reason}`
    : `For ${currentWindow}, keep it simple. ${
      fallbackAction?.reason ??
        "Use the next few minutes to reset and make room for one clean move."
    }`;

  const nextSessionState = {
    ...sessionState,
    lastClassification: classificationHint.type,
  };
  const proposals = !chosenTask &&
      campaignCandidate?.proposal &&
      recommendedAction?.proposalId === campaignCandidate.proposal.id
    ? [campaignCandidate.proposal]
    : [];

  if (proposals.length > 0) {
    return {
      mode: "proposal",
      reply,
      followUpQuestions: [],
      proposals,
      suggestedReminders: [],
      structuredResponse: buildRightNowStructuredOutput(
        input,
        reply,
        classificationHint,
        recommendedAction,
        fallbackAction,
        currentWindow,
        proposals,
      ),
      memoryUpdates: {
        preferredTimeOfDay: nextSessionState.preferredTimeOfDay ??
          input.plannerContext.plannerMemory?.preferredTimeOfDay ?? null,
        preferredTimeReason: nextSessionState.preferredTimeReason ??
          input.plannerContext.plannerMemory?.preferredTimeReason ?? null,
        reminderPreference: nextSessionState.reminderPreference ??
          (input.plannerContext.plannerMemory?.reminderMinutesBefore
            ? `${input.plannerContext.plannerMemory.reminderMinutesBefore} minutes`
            : null),
      },
      sessionState: nextSessionState,
    };
  }

  return buildReadOnlyResponse(
    reply,
    nextSessionState,
    "schedule_read",
    buildRightNowStructuredOutput(
      input,
      reply,
      classificationHint,
      recommendedAction,
      fallbackAction,
      currentWindow,
      [],
    ),
  );
};

const buildMoveProposalForTask = (
  input: PlannerBuildInput,
  task: PlannerContextTask,
  nextDate: string,
  reason: string,
): PlannerProposal => ({
  id: createId(),
  kind: "update_quest",
  title: `Move ${task.title}`,
  summary: `Move "${task.title}" to ${nextDate}${
    task.scheduledTime ? ` at ${task.scheduledTime}` : ""
  }.`,
  reasoning: reason,
  payload: {
    taskId: task.id,
    updates: {
      task_date: nextDate,
      scheduled_time: task.scheduledTime ?? undefined,
    },
  },
  status: "pending",
  readyToConfirm: true,
  missingFields: [],
});

const buildDayAdjustStructuredOutput = (
  input: PlannerBuildInput,
  reply: string,
  classificationHint: ClassificationHint,
  keep: CompanionSuggestedQuest[],
  move: CompanionSuggestedQuest[],
  dropOrShrink: CompanionSuggestedQuest[],
  proposals: PlannerProposal[],
): CompanionStructuredResponse => ({
  intent: mapPlannerIntentMetadata(input, classificationHint, {
    forceIntentType: getProposalDrivenIntentType("quest", proposals),
    shouldCreateQuest: shouldCreateQuestFromProposals(proposals),
    shouldPromptCampaign: false,
  }),
  planDay: null,
  weeklyPlan: null,
  comingUp: null,
  rightNow: null,
  dayAdjust: {
    message: reply,
    keep,
    move,
    dropOrShrink,
  },
});

const getDayAdjustCampaignProtectedTask = (
  input: PlannerBuildInput,
  entries: { score: PlannerPriorityScore; task: PlannerContextTask }[],
): {
  taskId: string;
  campaignTitle: string;
  status: CompanionCampaignStatus;
  reason: string;
} | null => {
  const todayTaskIds = new Set(entries.map((entry) => entry.task.id));

  for (const score of getResolvedPriorityScores(input)) {
    if (score.kind !== "epic" || !score.epicId) continue;

    const epic = input.plannerContext.activeEpics.find((candidate) =>
      candidate.id === score.epicId
    );
    if (!epic) continue;

    const campaignMomentum = buildCampaignMomentumCandidate(input, epic);
    if (campaignMomentum.status === "moving") continue;

    const linkedTask = selectCampaignNextTask(input, campaignMomentum);
    if (!linkedTask || !todayTaskIds.has(linkedTask.id)) continue;

    return {
      taskId: linkedTask.id,
      campaignTitle: epic.title,
      status: campaignMomentum.status,
      reason: campaignMomentum.tooManyCampaigns
        ? `This is the campaign move to protect while too many active campaigns are competing for attention.`
        : campaignMomentum.interventionLevel === "reset"
        ? `${
          getCampaignPressureLead(campaignMomentum, {
            preferRepeatedSlip: true,
          })
        } This is the reset move to protect today.`
        : campaignMomentum.status === "at_risk"
        ? `This is the clearest move to stop ${epic.title} from slipping today.`
        : campaignMomentum.status === "stalled"
        ? `This is the concrete restart move ${epic.title} needs today.`
        : `This keeps ${epic.title} from drifting further today.`,
    };
  }

  return null;
};

const getDayAdjustStrategicCampaignSuggestion = (
  input: PlannerBuildInput,
): {
  campaignTitle: string;
  momentum: CampaignMomentumCandidate;
} | null => {
  const seenCampaignIds = new Set<string>();

  for (const score of getResolvedPriorityScores(input)) {
    const epicId = score.kind === "epic"
      ? score.epicId
      : score.kind === "task"
      ? score.epicId ?? findPlannerTaskById(input, score.taskId)?.epicId ?? null
      : null;
    if (!epicId || seenCampaignIds.has(epicId)) continue;
    seenCampaignIds.add(epicId);

    const epic = input.plannerContext.activeEpics.find((candidate) =>
      candidate.id === epicId
    );
    if (!epic) continue;

    const campaignMomentum = buildCampaignMomentumCandidate(input, epic);
    const linkedTask = selectCampaignNextTask(input, campaignMomentum);
    if (linkedTask?.taskDate === input.currentDate) continue;
    if (!hasRepeatedCampaignSlip(campaignMomentum)) continue;
    if (!shouldSuggestStrategicCampaignAdjustment(campaignMomentum)) continue;

    return {
      campaignTitle: epic.title,
      momentum: campaignMomentum,
    };
  }

  return null;
};

const getDayAdjustCampaignFollowUpSuggestion = (
  input: PlannerBuildInput,
): {
  campaignTitle: string;
  momentum: CampaignMomentumCandidate;
} | null => {
  const seenCampaignIds = new Set<string>();

  for (const score of getResolvedPriorityScores(input)) {
    const epicId = score.kind === "epic"
      ? score.epicId
      : score.kind === "task"
      ? score.epicId ?? findPlannerTaskById(input, score.taskId)?.epicId ?? null
      : null;
    if (!epicId || seenCampaignIds.has(epicId)) continue;
    seenCampaignIds.add(epicId);

    const epic = input.plannerContext.activeEpics.find((candidate) =>
      candidate.id === epicId
    );
    if (!epic) continue;

    const campaignMomentum = buildCampaignMomentumCandidate(input, epic);
    if (shouldSuggestStrategicCampaignAdjustment(campaignMomentum)) continue;
    if (!campaignNeedsFollowUpDefinition(campaignMomentum)) continue;

    return {
      campaignTitle: epic.title,
      momentum: campaignMomentum,
    };
  }

  return null;
};

const buildDayAdjustResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
  options?: {
    lowEnergy?: boolean;
  },
): PlannerBuildResult => {
  const entries = getTodayScoredTaskEntries(input);
  const protectCount = options?.lowEnergy ? 1 : 2;
  const protectedCampaignTask = getDayAdjustCampaignProtectedTask(
    input,
    entries,
  );
  const protectedCampaignReset = protectedCampaignTask
    ? null
    : getDayAdjustStrategicCampaignSuggestion(input);
  const protectedCampaignFollowUp =
    protectedCampaignTask || protectedCampaignReset
      ? null
      : getDayAdjustCampaignFollowUpSuggestion(input);
  const protectedCampaignResetProposal = protectedCampaignReset
    ? buildCampaignAdjustmentProposalForMomentum(
      input,
      protectedCampaignReset.momentum,
    )
    : null;
  const protectedCampaignFollowUpProposal = protectedCampaignFollowUp
    ? buildCampaignNextStepProposal(input, protectedCampaignFollowUp.momentum, {
      targetDate: input.currentDate,
    })
    : null;
  const protectedIds = new Set(
    entries
      .filter((entry, index) =>
        index < protectCount || entry.task.habitSourceId ||
        entry.task.priority === "high" ||
        entry.task.id === protectedCampaignTask?.taskId
      )
      .map((entry) => entry.task.id),
  );
  const keepEntries = entries
    .filter((entry) => protectedIds.has(entry.task.id))
    .sort((left, right) => {
      const leftProtected = left.task.id === protectedCampaignTask?.taskId
        ? 1
        : 0;
      const rightProtected = right.task.id === protectedCampaignTask?.taskId
        ? 1
        : 0;
      if (rightProtected !== leftProtected) {
        return rightProtected - leftProtected;
      }
      return right.score.score - left.score.score;
    })
    .slice(0, 3);
  const moveEntries = entries.filter((entry) =>
    !protectedIds.has(entry.task.id)
  )
    .slice(0, 3);
  const dropEntries = entries.filter((entry) =>
    !protectedIds.has(entry.task.id) &&
    !moveEntries.some((candidate) => candidate.task.id === entry.task.id)
  )
    .filter((entry) =>
      getTaskDuration(entry.task) >= 45 || entry.score.score < 60
    )
    .slice(0, 2);

  const keep = [
    ...(protectedCampaignResetProposal
      ? [
        buildSuggestedQuestFromProposal(
          input,
          protectedCampaignResetProposal,
          `${
            getCampaignPressureLead(protectedCampaignReset!.momentum, {
              preferRepeatedSlip: true,
            })
          } Protect a reset move for ${
            protectedCampaignReset!.campaignTitle
          } today instead of crowding in more low-leverage work.`,
        ),
      ]
      : protectedCampaignFollowUpProposal
      ? [
        buildSuggestedQuestFromProposal(
          input,
          protectedCampaignFollowUpProposal,
          `${
            getCampaignPressureLead(protectedCampaignFollowUp!.momentum, {
              preferRepeatedSlip: true,
            })
          } Protect a concrete next step for ${
            protectedCampaignFollowUp!.campaignTitle
          } today before the momentum goes stale.`,
        ),
      ]
      : []),
    ...keepEntries.map((entry) =>
      buildSuggestedQuestFromTask(
        entry.task,
        entry.task.id === protectedCampaignTask?.taskId
          ? protectedCampaignTask.reason
          : entry.score.reasons[0] ??
            "This is one of the strongest moves left for today.",
        {
          type: mapPriorityScoreToSuggestedQuestType(
            entry.score.score,
            entry.task,
          ),
        },
      )
    ),
  ].slice(0, 3);
  const protectedCampaignTitle = protectedCampaignTask?.campaignTitle ??
    protectedCampaignReset?.campaignTitle ??
    protectedCampaignFollowUp?.campaignTitle ??
    null;
  const nextDate = addDaysToDateKey(input.currentDate, 1);
  const moveProposals = moveEntries.map((entry) =>
    buildMoveProposalForTask(
      input,
      entry.task,
      nextDate,
      options?.lowEnergy
        ? "You asked for a lighter day, so I'm moving this to protect the stronger priorities."
        : "Today needs less load, so I'm moving this to keep the day realistic.",
    )
  );
  const move = moveProposals.map((proposal, index) =>
    buildSuggestedQuestFromProposal(
      input,
      proposal,
      options?.lowEnergy
        ? protectedCampaignTask
          ? `Move this out so today's core plan stays light while ${protectedCampaignTask.campaignTitle} keeps its foothold.`
          : protectedCampaignReset
          ? `Move this out so ${protectedCampaignReset.campaignTitle} gets the reset space it needs today.`
          : protectedCampaignFollowUp
          ? `Move this out so ${protectedCampaignFollowUp.campaignTitle} gets a concrete next step today.`
          : "Move this out so today's core plan stays light."
        : protectedCampaignTask
        ? `Move this out so ${protectedCampaignTask.campaignTitle} keeps the cleaner slot in today's plan.`
        : protectedCampaignReset
        ? `Move this out so ${protectedCampaignReset.campaignTitle} gets the reset space it needs today.`
        : protectedCampaignFollowUp
        ? `Move this out so ${protectedCampaignFollowUp.campaignTitle} gets a concrete next step in today's plan.`
        : "Move this out so today's core plan stays realistic.",
    )
  );
  const dropOrShrink = dropEntries.map((entry) =>
    buildSuggestedQuestFromTask(
      entry.task,
      protectedCampaignTask
        ? `If time still feels tight, shrink this to a 15-minute pass or let it go so ${protectedCampaignTask.campaignTitle} keeps the space it needs.`
        : protectedCampaignReset
        ? `If time still feels tight, shrink this to a 15-minute pass or let it go so ${protectedCampaignReset.campaignTitle} has room for a reset move.`
        : protectedCampaignFollowUp
        ? `If time still feels tight, shrink this to a 15-minute pass or let it go so ${protectedCampaignFollowUp.campaignTitle} has room for a concrete next step.`
        : "If time still feels tight, shrink this to a 15-minute pass or let it go today.",
      { type: "nice" },
    )
  );

  const reply = moveProposals.length > 0
    ? options?.lowEnergy
      ? protectedCampaignTask
        ? `I'm lightening today by protecting the move that keeps ${protectedCampaignTask.campaignTitle} alive, shifting ${moveProposals.length}, and giving you permission to shrink the rest.`
        : protectedCampaignReset
        ? `I'm lightening today by protecting the reset move ${protectedCampaignReset.campaignTitle} needs, shifting ${moveProposals.length}, and giving you permission to shrink the rest.`
        : protectedCampaignFollowUp
        ? `I'm lightening today by protecting the next-step move ${protectedCampaignFollowUp.campaignTitle} needs, shifting ${moveProposals.length}, and giving you permission to shrink the rest.`
        : `I'm lightening today by protecting ${keep.length || 1} core move${
          keep.length === 1 ? "" : "s"
        }, shifting ${moveProposals.length}, and giving you permission to shrink the rest.`
      : protectedCampaignTask
      ? `I'm tightening today by protecting the move that keeps ${protectedCampaignTask.campaignTitle} from slipping, shifting ${moveProposals.length}, and trimming what doesn't need to stay.`
      : protectedCampaignReset
      ? `I'm tightening today by protecting the reset move ${protectedCampaignReset.campaignTitle} needs, shifting ${moveProposals.length}, and trimming what doesn't need to stay.`
      : protectedCampaignFollowUp
      ? `I'm tightening today by protecting the next-step move ${protectedCampaignFollowUp.campaignTitle} needs, shifting ${moveProposals.length}, and trimming what doesn't need to stay.`
      : `I'm tightening today by protecting the strongest move${
        keep.length === 1 ? "" : "s"
      }, shifting ${moveProposals.length}, and trimming what doesn't need to stay.`
    : keep.length > 0
    ? protectedCampaignTitle
      ? protectedCampaignReset
        ? `Today is already fairly lean. I'd protect the reset move ${protectedCampaignTitle} needs and avoid crowding the day.`
        : protectedCampaignFollowUp
        ? `Today is already fairly lean. I'd protect the next-step move ${protectedCampaignTitle} needs and avoid crowding the day.`
        : `Today is already fairly lean. I'd protect the move ${protectedCampaignTitle} needs and avoid crowding the day.`
      : "Today is already fairly lean. I'd keep the strongest move or two and avoid adding more."
    : "There's not much cleanly schedulable work left today. The best move is to keep the day light and avoid forcing it.";

  const proposals = [
    ...(protectedCampaignResetProposal ? [protectedCampaignResetProposal] : []),
    ...(protectedCampaignFollowUpProposal
      ? [protectedCampaignFollowUpProposal]
      : []),
    ...moveProposals,
  ];

  return {
    mode: proposals.length > 0 ? "proposal" : "schedule_read",
    reply,
    followUpQuestions: [],
    proposals,
    suggestedReminders: [],
    structuredResponse: buildDayAdjustStructuredOutput(
      input,
      reply,
      classificationHint,
      keep,
      move,
      dropOrShrink,
      proposals,
    ),
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

const buildPlanDayDraftResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
): PlannerBuildResult => {
  const targetDate = getPlanDayTargetDate(input);
  const loadBreakdown = getPlanDayLoadBreakdown(input, targetDate);
  const existingWorkItems = loadBreakdown.workItemsForProposalLimit;
  const targetTotal = getPlanDayTargetTotal(input, targetDate);
  const concreteCandidate = buildPlanDayConcreteCandidate(input, targetDate);
  const strategicAdjustmentProposal = buildPlanDayStrategicAdjustmentProposal(
    input,
  );
  const existingTitleKeys = new Set(
    [...input.plannerContext.tasks, ...input.plannerContext.inboxTasks]
      .filter((task) => task.completed !== true && task.taskDate === targetDate)
      .map((task) => normalizeText(task.title)),
  );
  const candidates: OptimizerDraftCandidate[] = [];
  const proposalTarget = Math.min(
    Math.max(0, 4 - (strategicAdjustmentProposal ? 1 : 0)),
    Math.max(
      concreteCandidate ? 1 : 0,
      targetTotal - existingWorkItems,
    ),
  );
  const addCandidate = (candidate: OptimizerDraftCandidate | null) => {
    if (!candidate) return false;
    const candidateKeys = [
      candidate.dedupeKey,
      normalizeText(candidate.title),
      normalizeText(candidate.derivedFromMessage),
    ].filter((key) => key.length > 0);
    if (candidateKeys.some((key) => existingTitleKeys.has(key))) return false;
    candidateKeys.forEach((key) => existingTitleKeys.add(key));
    candidates.push(candidate);
    return true;
  };

  addCandidate(concreteCandidate);

  if (candidates.length < proposalTarget) {
    for (const score of getPlanDayRankedScores(input)) {
      if (candidates.length >= proposalTarget) break;
      addCandidate(buildPlanDayPriorityCandidate(input, score, targetDate));
    }
  }
  const questProposals = candidates
    .slice(0, Math.min(4, proposalTarget))
    .map((candidate) => buildOptimizerQuestProposal(input, candidate));
  const proposals = [
    ...(strategicAdjustmentProposal ? [strategicAdjustmentProposal] : []),
    ...questProposals,
  ].slice(0, 4);
  const conflictNotes = proposals
    .map((proposal) => {
      const payload = proposal.payload as {
        taskDate?: string | null;
        scheduledTime?: string | null;
        estimatedDuration?: number | null;
      };
      return buildCalendarConflictReplyNote(
        input,
        findCalendarConflictForQuestDraft(
          input,
          {
            draftKind: "create_quest",
            scheduledDate: payload.taskDate ?? null,
            scheduledTime: payload.scheduledTime ?? null,
            durationMinutes: payload.estimatedDuration ?? null,
          },
          "create_quest",
          null,
        ),
      );
    })
    .filter((note): note is string => Boolean(note));
  const dateLabel = formatScheduleReference(input.currentDate, targetDate);
  const acknowledgement = input.sessionState.pendingStarterIntent === "plan_day"
    ? buildPlanDayAcknowledgement(input)
    : null;

  if (proposals.length === 0) {
    if (
      input.sessionState.pendingStarterIntent === "plan_day" &&
      existingWorkItems === 0 &&
      !hasPlanDayContextAnchors(input) &&
      isVaguePlanDayDirection(input)
    ) {
      return buildPlanDayClarificationResponse(
        input,
        sessionState,
        classificationHint,
        "I can shape that, but I need one real direction first. What kind of day are we making: focused, light, catch-up, or something else?",
      );
    }

    if (
      existingWorkItems < targetTotal &&
      !hasPlanDayScheduledBlocks(input, targetDate)
    ) {
      return buildPlanDayClarificationResponse(
        input,
        sessionState,
        classificationHint,
        "I don't see scheduled blocks in the way, but I need one more concrete direction before I draft quests. What kind of day are we making: focused, light, catch-up, or something else?",
      );
    }

    const campaignLoadMessage = existingWorkItems >= targetTotal
      ? buildPlanDayCampaignLoadMessage(input, dateLabel, loadBreakdown)
      : null;
    const noRoomReason = existingWorkItems >= targetTotal
      ? campaignLoadMessage ??
        `${
          capitalizeScheduleReference(dateLabel)
        } is already carrying about as much quest load as I want to give it.`
      : `I don't see enough open space on ${dateLabel} around your scheduled blocks to draft that cleanly.`;

    return {
      mode: "conversational",
      reply: [acknowledgement, noRoomReason]
        .filter(Boolean)
        .join(" "),
      followUpQuestions: [],
      proposals: [],
      suggestedReminders: [],
      structuredResponse: buildPlanDayStructuredOutput(
        input,
        [acknowledgement, noRoomReason].filter(Boolean).join(" "),
        classificationHint,
        [],
        loadBreakdown,
      ),
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
        pendingStarterIntent: null,
        lastClassification: classificationHint.type,
      },
    };
  }

  const reply = [
    acknowledgement,
    buildOptimizerReply(dateLabel, proposals),
    proposals.length < proposalTarget
      ? "That's all the strong next moves I found without crowding the day."
      : null,
    ...conflictNotes,
  ].filter(Boolean).join(" ");

  return {
    mode: "proposal",
    reply,
    followUpQuestions: [],
    proposals,
    suggestedReminders: [],
    structuredResponse: buildPlanDayStructuredOutput(
      input,
      reply,
      classificationHint,
      proposals,
      loadBreakdown,
    ),
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
      pendingStarterIntent: null,
      lastClassification: classificationHint.type,
    },
  };
};

const buildActionBundleDraftResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
): PlannerBuildResult | null => {
  const extracted = extractActionBundleCandidates(input.message, {
    referenceDateTime: input.currentDateTime,
  });
  if (extracted.length === 0) return null;
  if (extracted.length < 2 && !hasDayShapingLanguage(input.message)) {
    return null;
  }

  const targetDate =
    extracted.find((candidate) => candidate.scheduledDate)?.scheduledDate ??
      (hasDayShapingLanguage(input.message)
        ? input.currentDate
        : input.currentDate);
  const candidates: OptimizerDraftCandidate[] = extracted.map((
    candidate,
    index,
  ) => ({
    id: candidate.id,
    dedupeKey: normalizeText(candidate.title),
    title: candidate.title,
    scheduledDate: candidate.scheduledDate ?? targetDate,
    scheduledTime: candidate.scheduledTime ?? null,
    estimatedDuration: candidate.durationGuess,
    reasoning:
      `Extracted directly from what you said: "${candidate.derivedFromMessage}".`,
    category: candidate.category ?? null,
    notes: candidate.notes ?? null,
    timingPreferenceLabel: candidate.timingPreference ?? undefined,
    energyType: candidate.energyType,
    confidence: candidate.confidence,
    derivedFromMessage: candidate.derivedFromMessage,
    priority: normalizeBundlePriority(index),
  }));

  const proposals = candidates.map((candidate) =>
    buildOptimizerQuestProposal(input, candidate)
  );
  const dateLabel = formatScheduleReference(input.currentDate, targetDate);

  return {
    mode: "proposal",
    reply: buildOptimizerReply(dateLabel, proposals),
    followUpQuestions: [],
    proposals,
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
      pendingStarterIntent: null,
      lastClassification: classificationHint.type,
    },
  };
};

const buildPlanDayStarterResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
): PlannerBuildResult => {
  if (isGenericPlanDayStarterRequest(input)) {
    return buildPlanDayClarificationResponse(
      input,
      sessionState,
      classificationHint,
    );
  }

  return buildPlanDayDraftResponse(
    input,
    {
      ...sessionState,
      pendingStarterIntent: "plan_day",
    },
    classificationHint,
  );
};

const buildUpcomingStarterResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
): PlannerBuildResult =>
  buildComingUpResponse(
    input,
    {
      ...sessionState,
      draft: {},
      openQuestionIds: [],
      pendingStarterIntent: null,
      lastClassification: classificationHint.type,
    },
    classificationHint,
    buildUpcomingDigestReply(input),
  );

const buildQuestCaptureStarterResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
): PlannerBuildResult => ({
  mode: "conversational",
  reply: "Quest?",
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
  reply: isWittySassyTone(input.tonePack)
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

const buildPlanDayFollowUpResponse = (
  input: PlannerBuildInput,
  sessionState: PlannerSessionState,
  classificationHint: ClassificationHint,
): PlannerBuildResult =>
  buildPlanDayDraftResponse(input, sessionState, classificationHint);

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
  const rawResult = ((): PlannerBuildResult => {
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
    const pendingStarterIntent =
      resolvedInput.sessionState.pendingStarterIntent ?? null;

    if (pendingStarterIntent === "plan_day") {
      return buildPlanDayFollowUpResponse(
        resolvedInput,
        resolvedInput.sessionState,
        classificationHint,
      );
    }

    if (starterIntent === "plan_day") {
      return buildPlanDayStarterResponse(
        resolvedInput,
        resolvedInput.sessionState,
        classificationHint,
      );
    }

    if (starterIntent === "plan_week") {
      return buildPlanWeekStarterResponse(
        resolvedInput,
        resolvedInput.sessionState,
        classificationHint,
      );
    }

    if (starterIntent === "advance_campaign_start") {
      return buildAdvanceCampaignResponse(
        resolvedInput,
        resolvedInput.sessionState,
        classificationHint,
        matched,
      );
    }

    if (starterIntent === "right_now_start") {
      return buildRightNowStarterResponse(
        resolvedInput,
        resolvedInput.sessionState,
        classificationHint,
      );
    }

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
      const reply = buildReadOnlyScheduleReply(followUpInput, followUpMessage);
      return buildComingUpResponse(
        followUpInput,
        {
          ...resolvedInput.sessionState,
          pendingStarterIntent: null,
          lastClassification: classificationHint.type,
        },
        classificationHint,
        reply,
      );
    }

    if (starterIntent === "low_energy_adjust") {
      return buildLowEnergyAdjustmentResponse(
        resolvedInput,
        resolvedInput.sessionState,
        classificationHint,
      );
    }

    if (starterIntent === "adjust_today") {
      return buildDayAdjustResponse(
        resolvedInput,
        resolvedInput.sessionState,
        classificationHint,
      );
    }

    if (starterIntent === "briefing_followup") {
      return buildReflectionBridgeResponse(
        resolvedInput,
        resolvedInput.sessionState,
        classificationHint,
      );
    }

    if (isScheduleQuestion(resolvedInput.message)) {
      const reply = buildReadOnlyScheduleReply(
        resolvedInput,
        resolvedInput.message,
      );
      return buildComingUpResponse(
        resolvedInput,
        {
          ...resolvedInput.sessionState,
          lastClassification: classificationHint.type,
        },
        classificationHint,
        reply,
      );
    }

    if (
      starterIntent === "goal_breakdown" ||
      isBreakBigGoalStarterIntent(resolvedInput.message)
    ) {
      return buildGoalBreakdownStarterResponse(
        resolvedInput,
        resolvedInput.sessionState,
        classificationHint,
      );
    }

    if (
      starterIntent === "make_room" ||
      starterIntent === "what_matters"
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

    const actionBundleResponse = buildActionBundleDraftResponse(
      resolvedInput,
      resolvedInput.sessionState,
      classificationHint,
    );
    if (actionBundleResponse) {
      return actionBundleResponse;
    }

    if (isVaguePlanningPrompt(resolvedInput, matched, repeated)) {
      return buildIntentFirstResponse(
        resolvedInput,
        resolvedInput.sessionState,
        classificationHint,
      );
    }

    if (
      looksConversational(
        resolvedInput,
        matched,
        repeated,
        classificationHint,
      )
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

    const draft = mergeDraft(
      { ...resolvedInput, classificationHint },
      matched,
    );
    const cadence = resolveCadence(
      resolvedInput.message,
      resolvedInput.parsedInput,
    );

    if (!draft.epicId && draft.epicTitle) {
      const matchingEpic = resolvedInput.plannerContext.activeEpics.find((
        epic,
      ) => normalizeText(epic.title) === normalizeText(draft.epicTitle));
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
    const questCaptureResolution = resolveQuestCaptureDraft(
      { ...resolvedInput, classificationHint },
      kind,
      draft,
    );
    const resolvedDraft = {
      ...questCaptureResolution.draft,
      draftKind: kind,
    };

    const proposal = kind === "adjust_campaign_plan" && matched.epic
      ? buildCampaignAdjustmentProposal(
        { ...resolvedInput, classificationHint },
        resolvedDraft,
        matched.epic,
      )
      : kind === "suggest_reminder" && matched.task
      ? buildReminderProposal(
        { ...resolvedInput, classificationHint },
        resolvedDraft,
        matched.task,
      )
      : kind === "create_campaign" || kind === "update_campaign"
      ? buildCampaignProposal(
        { ...resolvedInput, classificationHint },
        resolvedDraft,
        cadence,
        kind,
        matched.epic,
      )
      : kind === "create_ritual" || kind === "update_ritual"
      ? buildRitualProposal(
        { ...resolvedInput, classificationHint },
        resolvedDraft,
        cadence,
        kind,
        matched.ritual,
      )
      : buildQuestProposal(
        { ...resolvedInput, classificationHint },
        resolvedDraft,
        cadence,
        kind as "create_quest" | "update_quest",
        matched.task,
        questCaptureResolution.assumption,
      );

    const followUpQuestions = buildFollowUpQuestions(
      { ...resolvedInput, classificationHint },
      kind,
      resolvedDraft,
      cadence,
      questCaptureResolution.assumption,
    );
    const missingFields = missingFieldsForKind(
      resolvedInput,
      kind,
      resolvedDraft,
      cadence,
      questCaptureResolution.assumption,
    );
    proposal.readyToConfirm = followUpQuestions.length === 0 &&
      missingFields.length === 0;
    proposal.missingFields = missingFields;
    const calendarConflictNote = buildCalendarConflictReplyNote(
      resolvedInput,
      findCalendarConflictForQuestDraft(
        resolvedInput,
        resolvedDraft,
        kind,
        matched.task,
      ),
    );

    const preferredTimeOfDay = resolvedDraft.timeOfDay ??
      resolvedInput.sessionState.preferredTimeOfDay ??
      resolvedInput.plannerContext.plannerMemory?.preferredTimeOfDay ??
      null;
    const preferredTimeReason = resolveTimeReasonFromSources({
      resolvedTimeOfDay: preferredTimeOfDay,
      explicitTimeReason: extractTimeReason(
        resolvedInput.message,
        resolvedInput.sessionState,
      ),
      sources: [
        {
          timeOfDay: resolvedDraft.timeOfDay ?? null,
          timeReason: resolvedDraft.timeReason ?? null,
        },
        {
          timeOfDay: resolvedInput.sessionState.preferredTimeOfDay ?? null,
          timeReason: resolvedInput.sessionState.preferredTimeReason ?? null,
        },
        {
          timeOfDay:
            resolvedInput.plannerContext.plannerMemory?.preferredTimeOfDay ??
              null,
          timeReason:
            resolvedInput.plannerContext.plannerMemory?.preferredTimeReason ??
              null,
        },
      ],
    });
    const memoryUpdates = {
      preferredTimeOfDay,
      preferredTimeReason,
      reminderPreference: resolvedDraft.reminderMinutesBefore !== null
        ? `${resolvedDraft.reminderMinutesBefore} minutes`
        : resolvedInput.sessionState.reminderPreference ??
          (resolvedInput.plannerContext.plannerMemory?.reminderMinutesBefore
            ? `${resolvedInput.plannerContext.plannerMemory.reminderMinutesBefore} minutes`
            : null),
    };

    return {
      mode: "proposal",
      reply: [
        composeReply(
          resolvedInput,
          resolvedInput.tonePack,
          proposal.kind,
          proposal.readyToConfirm,
          resolvedDraft,
          questCaptureResolution.assumption,
        ),
        calendarConflictNote,
      ].filter(Boolean).join("\n\n"),
      followUpQuestions,
      proposals: [proposal],
      suggestedReminders: [],
      memoryUpdates,
      sessionState: {
        ...resolvedInput.sessionState,
        draft: resolvedDraft,
        openQuestionIds: followUpQuestions.map((question) => question.id),
        pendingStarterIntent: null,
        preferredTimeOfDay: memoryUpdates.preferredTimeOfDay,
        preferredTimeReason: memoryUpdates.preferredTimeReason,
        reminderPreference: memoryUpdates.reminderPreference,
        lastClassification: classificationHint.type,
      },
    };
  })();

  return normalizePlannerBuildResultText(
    withPlannerContract(withScheduleValidation(input, rawResult)),
  );
}
