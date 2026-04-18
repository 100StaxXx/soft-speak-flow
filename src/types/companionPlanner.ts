import type { IntentClassification } from "@/hooks/useIntentClassifier";

export type PlannerHorizon = "day" | "week" | "month";

export type PlannerTonePack = "soft" | "playful" | "witty_sassy";

export type CompanionPlannerProposalKind =
  | "create_quest"
  | "update_quest"
  | "create_campaign"
  | "update_campaign"
  | "create_ritual"
  | "update_ritual"
  | "suggest_reminder";

export type CompanionPlannerMessageRole = "companion" | "user";

export type CompanionPlannerInputMode = "text" | "voice";

export type CompanionPlannerProposalStatus = "pending" | "confirmed" | "rejected";

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
}

export interface CompanionPlannerSessionState {
  draft: CompanionPlannerDraftState;
  openQuestionIds: string[];
  preferredTimeOfDay?: string | null;
  preferredTimeReason?: string | null;
  reminderPreference?: string | null;
  lastClassification?: IntentClassification["type"] | null;
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

export interface CompanionPlannerRequest {
  message: string;
  currentDate: string;
  horizon: PlannerHorizon;
  tonePack: PlannerTonePack;
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
    | "timelineAnalysis"
  > | null;
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
  selectedEntityIds?: {
    taskId?: string | null;
    epicId?: string | null;
    ritualId?: string | null;
  };
}

export interface CompanionPlannerResponse {
  reply: string;
  followUpQuestions: CompanionPlannerQuestion[];
  proposals: CompanionPlannerProposal[];
  suggestedReminders: CompanionPlannerProposal[];
  memoryUpdates: {
    preferredTimeOfDay?: string | null;
    preferredTimeReason?: string | null;
    reminderPreference?: string | null;
  };
  sessionState: CompanionPlannerSessionState;
}
