import type { IntentClassification } from "@/hooks/useIntentClassifier";
import type { OnboardingScheduleArchetype } from "@/shared/onboardingScheduleArchetype";
import type {
  CompanionMissInterpretation,
  CompanionMomentumState,
  CompanionStatAttribute,
  CompanionStatNeed,
  CompanionStatProfileSummary,
} from "@/shared/companionStatSignals";
import type {
  PlannerContract,
  CompanionStructuredResponse,
  CompanionSuggestedQuest,
} from "@/shared/companionStructuredOutput";

export type PlannerHorizon = "day" | "week" | "month";

export type PlannerTonePack = "soft" | "playful" | "witty_sassy";

export type CompanionPlannerResponseMode = "conversational" | "schedule_read" | "proposal";

export type CompanionPlannerStarterIntent =
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
  | "goal_breakdown_start"
  | "thread_history";

export type CompanionPlannerContextStarterIntent = Exclude<
  CompanionPlannerStarterIntent,
  "thread_history"
>;

export type CompanionPlannerLaunchTarget =
  | "auto"
  | "conversation"
  | "planner"
  | "campaign_builder";

export type CompanionPlannerProposalKind =
  | "create_quest"
  | "update_quest"
  | "create_campaign"
  | "update_campaign"
  | "adjust_campaign_plan"
  | "create_ritual"
  | "update_ritual"
  | "suggest_reminder";

export type CompanionPlannerMessageRole = "companion" | "user";

export type CompanionPlannerInputMode = "text" | "voice";

export type CompanionPlannerProposalStatus = "pending" | "confirmed" | "modified" | "rejected";

export interface CompanionPlannerQuestion {
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

export interface CompanionPlannerProposal {
  id: string;
  kind: CompanionPlannerProposalKind;
  title: string;
  summary: string;
  reasoning?: string | null;
  suggestedType?: CompanionSuggestedQuest["type"];
  payload: Record<string, unknown>;
  status: CompanionPlannerProposalStatus;
  readyToConfirm: boolean;
  missingFields?: string[];
}

export interface CompanionPlannerMessage {
  id: string;
  role: CompanionPlannerMessageRole;
  content: string;
  createdAt: string;
  inputMode?: CompanionPlannerInputMode;
  questions?: CompanionPlannerQuestion[];
  proposalIds?: string[];
  structuredResponse?: CompanionStructuredResponse | null;
  dayPlan?: CompanionDayPlan | null;
}

export interface CompanionPlannerDraftState {
  title?: string | null;
  taskId?: string | null;
  ritualId?: string | null;
  epicId?: string | null;
  epicTitle?: string | null;
  draftKind?: CompanionPlannerProposalKind | null;
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

export type CompanionPlanDayEnergyLevel = "low" | "medium" | "high";

export interface CompanionPlannerSessionState {
  draft: CompanionPlannerDraftState;
  openQuestionIds: string[];
  preferredTimeOfDay?: string | null;
  preferredTimeReason?: string | null;
  reminderPreference?: string | null;
  pendingStarterIntent?: CompanionPlannerStarterIntent | null;
  lastClassification?: IntentClassification["type"] | null;
  planDayEnergy?: CompanionPlanDayEnergyLevel | null;
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

export interface CompanionPlannerLaunchIntent {
  id: string;
  message: string;
  starterIntent: CompanionPlannerStarterIntent;
  target?: CompanionPlannerLaunchTarget;
  briefingContext?: PlannerBriefingContext | null;
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
  scheduleArchetype?: OnboardingScheduleArchetype | null;
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
  statProfile: CompanionStatProfileSummary;
  statNeeds: Record<CompanionStatAttribute, CompanionStatNeed>;
  momentumState: CompanionMomentumState;
  recentMissInterpretation: CompanionMissInterpretation;
  narrativeBrief: string;
  dailyNarrative: string;
  weeklyNarrative?: string;
  identityBootstrap?: string;
}

export interface CompanionPlannerQuestSubtaskPlan {
  mode: "append" | "replace";
  titles: string[];
}

export interface CompanionPlannerRequest {
  message: string;
  currentDate: string;
  currentDateTime: string;
  timezone?: string;
  horizon: PlannerHorizon;
  tonePack: PlannerTonePack;
  conversationHistory: Array<{
    role: "assistant" | "user";
    content: string;
  }>;
  sessionState: CompanionPlannerSessionState;
  parsedInput?: {
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
  };
  classificationHint?: Pick<
    IntentClassification,
    | "type"
    | "confidence"
    | "reasoning"
    | "suggestedDeadline"
    | "suggestedDuration"
    | "suggestedActivityDurationMinutes"
    | "timelineAnalysis"
  > | null;
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
    starterIntent?: CompanionPlannerContextStarterIntent;
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
  selectedEntityIds?: {
    taskId?: string | null;
    epicId?: string | null;
    ritualId?: string | null;
  };
  activeDayPlan?: CompanionDayPlan | null;
}

export type CompanionDayPlanStatus = "draft" | "committed";

export type CompanionDayPlanBlockSource =
  | "campaign"
  | "habit"
  | "recovery"
  | "optimization";

export type CompanionDayPlanBlockEnergyType =
  | "deep"
  | "admin"
  | "physical"
  | "errand"
  | "social"
  | "creative"
  | "recovery";

export interface CompanionDayPlanBlock {
  id: string;
  proposalId: string | null;
  questId: string | null;
  title: string;
  startTime: string | null;
  durationMinutes: number;
  energyType: CompanionDayPlanBlockEnergyType | null;
  source: CompanionDayPlanBlockSource;
  reasoning: string;
  epicId?: string | null;
  habitSourceId?: string | null;
}

export interface CompanionDayPlan {
  id: string | null;
  date: string;
  status: CompanionDayPlanStatus;
  blocks: CompanionDayPlanBlock[];
  updatedAt: string;
}

export interface CompanionPlannerResponse {
  mode: CompanionPlannerResponseMode;
  reply: string;
  plannerContract?: PlannerContract;
  followUpQuestions: CompanionPlannerQuestion[];
  proposals: CompanionPlannerProposal[];
  suggestedReminders: CompanionPlannerProposal[];
  structuredResponse?: CompanionStructuredResponse | null;
  dayPlan?: CompanionDayPlan | null;
  memoryUpdates: {
    preferredTimeOfDay?: string | null;
    preferredTimeReason?: string | null;
    reminderPreference?: string | null;
  };
  sessionState: CompanionPlannerSessionState;
}
