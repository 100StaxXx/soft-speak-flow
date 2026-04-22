export type CompanionIntentType =
  | "conversation"
  | "quest"
  | "campaign"
  | "clarification";

export type CompanionTimeHorizon = "today" | "short_term" | "long_term";

export interface CompanionIntentMetadata {
  intentType: CompanionIntentType;
  timeHorizon: CompanionTimeHorizon;
  isRecurring: boolean;
  shouldCreateQuest: boolean;
  shouldPromptCampaign: boolean;
}

export type CompanionDayAssessment =
  | "open"
  | "balanced"
  | "busy"
  | "behind"
  | "productive"
  | "low_energy";

export type CompanionSuggestedQuestType = "must" | "should" | "nice";

export type CompanionSuggestedQuestSource =
  | "campaign"
  | "habit"
  | "recovery"
  | "optimization";

export interface CompanionSuggestedQuest {
  suggestionId: string;
  proposalId?: string | null;
  title: string;
  type: CompanionSuggestedQuestType;
  estimatedDuration: string;
  estimatedDurationMinutes: number | null;
  source: CompanionSuggestedQuestSource;
  reason: string;
}

export interface CompanionPlanDayStructuredOutput {
  message: string;
  dayAssessment: CompanionDayAssessment;
  suggestedQuests: CompanionSuggestedQuest[];
}

export interface CompanionScheduleItem {
  id: string;
  title: string;
  label: string;
  startsAt: string | null;
  endsAt: string | null;
  isAllDay: boolean;
  source: "task" | "calendar";
}

export type CompanionTomorrowSummary = "busy" | "light" | "open";

export interface CompanionMissedItem {
  id: string;
  title: string;
  label: string;
  source: "task";
}

export interface CompanionComingUpStructuredOutput {
  message: string;
  nextEvent: CompanionScheduleItem | null;
  remainingToday: CompanionScheduleItem[];
  tomorrowSummary: CompanionTomorrowSummary;
  missedItems: CompanionMissedItem[];
}

export interface CompanionStructuredResponse {
  intent: CompanionIntentMetadata;
  planDay?: CompanionPlanDayStructuredOutput | null;
  comingUp?: CompanionComingUpStructuredOutput | null;
}
