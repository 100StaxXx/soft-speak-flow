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

export type PlannerContractMode =
  | "schedule_read"
  | "suggest_only"
  | "propose_schedule"
  | "clarify_first";

export type PlannerContractWritePolicy =
  | "read_only"
  | "confirmation_required";

export type PlannerContractDecisionAction =
  | "confirm_schedule"
  | "make_lighter"
  | "answer_clarification"
  | "open_editor"
  | "none";

export type PlannerReasonCode =
  | "calendar_constraint"
  | "due_today"
  | "overdue"
  | "open_window"
  | "campaign_momentum"
  | "low_energy_hint"
  | "busy_day"
  | "overloaded_day"
  | "actual_duration_pattern"
  | "user_preference"
  | "needs_clarification"
  | "schedule_validation_warning";

export interface PlannerContractDecisionPoint {
  label: string;
  action: PlannerContractDecisionAction;
}

export interface PlannerContract {
  mode: PlannerContractMode;
  writePolicy: PlannerContractWritePolicy;
  decisionSummary: string;
  reasonCodes: PlannerReasonCode[];
  decisionPoint: PlannerContractDecisionPoint;
  clarifyingQuestion?: string | null;
}

export type CompanionDayAssessment =
  | "open"
  | "balanced"
  | "busy"
  | "behind"
  | "productive"
  | "low_energy";

export type CompanionDailyLoadLabel =
  | "barely_anything"
  | "light"
  | "productive"
  | "busy"
  | "overwhelming";

export interface CompanionDailyLoadSummary {
  label: CompanionDailyLoadLabel;
  score: number;
  openTasks: number;
  completedTasks: number;
  scheduledMinutes: number;
  gapMinutes: number;
  recommendation: string;
}

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
  dailyLoad?: CompanionDailyLoadSummary;
  suggestedQuests: CompanionSuggestedQuest[];
  campaignFocus?: {
    campaignTitle: string;
    campaignStatus: CompanionCampaignStatus | null;
    campaignInterventionLevel: CompanionCampaignInterventionLevel | null;
    campaignReason: string | null;
    campaignHealth: CompanionCampaignHealthSnapshot | null;
    focusItems: string[];
  } | null;
}

export interface CompanionWeeklyPlanStructuredOutput {
  message: string;
  weeklyTheme: string | null;
  focusCampaignTitle: string | null;
  focusCampaignStatus: CompanionCampaignStatus | null;
  focusCampaignInterventionLevel: CompanionCampaignInterventionLevel | null;
  focusCampaignReason: string | null;
  focusCampaignHealth: CompanionCampaignHealthSnapshot | null;
  topPriorities: CompanionSuggestedQuest[];
  busyDays: string[];
  openDays: string[];
}

export interface CompanionPriorityOverviewStructuredOutput {
  title: string;
  message: string;
  campaignPressure: string | null;
  focusCampaignTitle?: string | null;
  focusCampaignStatus?: CompanionCampaignStatus | null;
  focusCampaignInterventionLevel?: CompanionCampaignInterventionLevel | null;
  focusCampaignHealth?: CompanionCampaignHealthSnapshot | null;
  topPriorities: CompanionSuggestedQuest[];
}

export interface CompanionReflectionBridgeStructuredOutput {
  message: string;
  carryForward: string | null;
  tomorrowSummary: CompanionTomorrowSummary;
  firstAction: CompanionSuggestedQuest | null;
  tomorrowSchedule: CompanionScheduleItem[];
}

export type CompanionCampaignStatus =
  | "moving"
  | "drifting"
  | "stalled"
  | "at_risk";

export type CompanionCampaignInterventionLevel =
  | "steady"
  | "nudge"
  | "protect"
  | "reset";

export interface CompanionCampaignHealthSnapshot {
  overdueQuestCount: number;
  protectedTodayCount: number;
  recentCompletedQuestCount: number;
  daysWithoutMomentum: number | null;
  activeCampaignCount: number;
}

export interface CompanionCampaignMomentumStructuredOutput {
  message: string;
  campaignId: string | null;
  campaignTitle: string | null;
  status: CompanionCampaignStatus | null;
  interventionLevel: CompanionCampaignInterventionLevel | null;
  statusReason: string | null;
  healthSnapshot: CompanionCampaignHealthSnapshot | null;
  pressureSignals: string[];
  nextStep: CompanionSuggestedQuest | null;
  supportActions: CompanionSuggestedQuest[];
}

export interface CompanionScheduleItem {
  id: string;
  title: string;
  label: string;
  startsAt: string | null;
  endsAt: string | null;
  isAllDay: boolean;
  source: "task" | "calendar" | "ritual";
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
  nextBestAction: CompanionSuggestedQuest | null;
  remainingToday: CompanionScheduleItem[];
  tomorrowSchedule?: CompanionScheduleItem[];
  tomorrowSummary: CompanionTomorrowSummary;
  missedItems: CompanionMissedItem[];
}

export interface CompanionStructuredResponse {
  plannerContract?: PlannerContract;
  intent: CompanionIntentMetadata;
  planDay?: CompanionPlanDayStructuredOutput | null;
  weeklyPlan?: CompanionWeeklyPlanStructuredOutput | null;
  priorityOverview?: CompanionPriorityOverviewStructuredOutput | null;
  reflectionBridge?: CompanionReflectionBridgeStructuredOutput | null;
  comingUp?: CompanionComingUpStructuredOutput | null;
  campaignMomentum?: CompanionCampaignMomentumStructuredOutput | null;
}
