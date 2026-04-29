import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export const COMPANION_AGENT_MODES = [
  "conversation",
  "clarify",
  "schedule_read",
  "pending_confirmation",
  "receipt",
] as const;

export const COMPANION_AGENT_INTENTS = [
  "schedule_task",
  "plan_day",
  "plan_week",
  "check_calendar",
  "update_existing_plan",
  "goal_setting",
  "journal",
  "explore",
  "reflect",
  "unknown",
] as const;

export const COMPANION_AGENT_STARTER_INTENTS = [
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

export const COMPANION_CAMPAIGN_LIFECYCLE_STATUSES = [
  "active",
  "completed",
  "abandoned",
] as const;

export const COMPANION_PENDING_ACTION_TYPES = [
  "task_create",
  "task_update",
  "ritual_create",
  "reminder_create",
  "campaign_update",
  "campaign_adjust",
  "journal_entry",
] as const;

export const COMPANION_PENDING_ACTION_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
  "expired",
  "failed",
  "executed",
] as const;

export const COMPANION_AGENT_UNDERSTANDING_STATES = [
  "needs_followup",
  "enough_to_discuss",
  "ready_to_propose",
  "ready_to_draft",
] as const;

export const COMPANION_AGENT_SELECTED_PROPOSED_ACTION_INTENTS = [
  "draft",
  "discuss",
] as const;

const CompanionIntentMetadataSchema = z.object({
  intentType: z.enum(["conversation", "quest", "campaign", "clarification"]),
  timeHorizon: z.enum(["today", "short_term", "long_term"]),
  isRecurring: z.boolean(),
  shouldCreateQuest: z.boolean(),
  shouldPromptCampaign: z.boolean(),
});

const CompanionSuggestedQuestSchema = z.object({
  suggestionId: z.string().min(1).max(200),
  proposalId: z.string().min(1).max(200).nullable().optional(),
  title: z.string().min(1).max(200),
  type: z.enum(["must", "should", "nice"]),
  estimatedDuration: z.string().min(1).max(80),
  estimatedDurationMinutes: z.number().int().min(0).max(1440).nullable(),
  source: z.enum(["campaign", "habit", "recovery", "optimization"]),
  reason: z.string().min(1).max(2000),
});

const CompanionScheduleItemSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  label: z.string().min(1).max(500),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  isAllDay: z.boolean(),
  source: z.enum(["task", "calendar"]),
});

const CompanionMissedItemSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  label: z.string().min(1).max(500),
  source: z.literal("task"),
});

const CompanionCampaignHealthSnapshotSchema = z.object({
  overdueQuestCount: z.number().int().min(0).max(999),
  protectedTodayCount: z.number().int().min(0).max(999),
  recentCompletedQuestCount: z.number().int().min(0).max(999),
  daysWithoutMomentum: z.number().int().min(0).max(3650).nullable(),
  activeCampaignCount: z.number().int().min(0).max(999),
});

const CompanionStructuredResponseSchema = z.object({
  intent: CompanionIntentMetadataSchema,
  planDay: z.object({
    message: z.string().min(1).max(4000),
    dayAssessment: z.enum([
      "open",
      "balanced",
      "busy",
      "behind",
      "productive",
      "low_energy",
    ]),
    suggestedQuests: z.array(CompanionSuggestedQuestSchema).max(5),
    campaignFocus: z.object({
      campaignTitle: z.string().min(1).max(200),
      campaignStatus: z.enum(["moving", "drifting", "stalled", "at_risk"])
        .nullable(),
      campaignInterventionLevel: z.enum([
        "steady",
        "nudge",
        "protect",
        "reset",
      ]).nullable(),
      campaignReason: z.string().min(1).max(2000).nullable(),
      campaignHealth: CompanionCampaignHealthSnapshotSchema.nullable(),
      focusItems: z.array(z.string().min(1).max(200)).max(6),
    }).nullable().optional(),
  }).nullable().optional(),
  weeklyPlan: z.object({
    message: z.string().min(1).max(4000),
    weeklyTheme: z.string().min(1).max(2000).nullable(),
    focusCampaignTitle: z.string().min(1).max(200).nullable(),
    focusCampaignStatus: z.enum(["moving", "drifting", "stalled", "at_risk"])
      .nullable(),
    focusCampaignInterventionLevel: z.enum([
      "steady",
      "nudge",
      "protect",
      "reset",
    ]).nullable(),
    focusCampaignReason: z.string().min(1).max(2000).nullable(),
    focusCampaignHealth: CompanionCampaignHealthSnapshotSchema.nullable(),
    topPriorities: z.array(CompanionSuggestedQuestSchema).max(5),
    busyDays: z.array(z.string().min(1).max(40)).max(7),
    openDays: z.array(z.string().min(1).max(40)).max(7),
  }).nullable().optional(),
  priorityOverview: z.object({
    title: z.string().min(1).max(80),
    message: z.string().min(1).max(4000),
    campaignPressure: z.string().min(1).max(2000).nullable(),
    focusCampaignTitle: z.string().min(1).max(200).nullable().optional(),
    focusCampaignStatus: z.enum(["moving", "drifting", "stalled", "at_risk"])
      .nullable().optional(),
    focusCampaignInterventionLevel: z.enum([
      "steady",
      "nudge",
      "protect",
      "reset",
    ]).nullable().optional(),
    focusCampaignHealth: CompanionCampaignHealthSnapshotSchema.nullable()
      .optional(),
    topPriorities: z.array(CompanionSuggestedQuestSchema).max(5),
  }).nullable().optional(),
  reflectionBridge: z.object({
    message: z.string().min(1).max(4000),
    carryForward: z.string().min(1).max(2000).nullable(),
    tomorrowSummary: z.enum(["busy", "light", "open"]),
    firstAction: CompanionSuggestedQuestSchema.nullable(),
    tomorrowSchedule: z.array(CompanionScheduleItemSchema).max(24),
  }).nullable().optional(),
  comingUp: z.object({
    message: z.string().min(1).max(4000),
    nextEvent: CompanionScheduleItemSchema.nullable(),
    nextBestAction: CompanionSuggestedQuestSchema.nullable(),
    remainingToday: z.array(CompanionScheduleItemSchema).max(24),
    tomorrowSummary: z.enum(["busy", "light", "open"]),
    missedItems: z.array(CompanionMissedItemSchema).max(24),
  }).nullable().optional(),
  rightNow: z.object({
    message: z.string().min(1).max(4000),
    currentWindow: z.string().min(1).max(120),
    recommendedAction: CompanionSuggestedQuestSchema.nullable(),
    fallbackAction: CompanionSuggestedQuestSchema.nullable(),
  }).nullable().optional(),
  dayAdjust: z.object({
    message: z.string().min(1).max(4000),
    keep: z.array(CompanionSuggestedQuestSchema).max(5),
    move: z.array(CompanionSuggestedQuestSchema).max(5),
    dropOrShrink: z.array(CompanionSuggestedQuestSchema).max(5),
  }).nullable().optional(),
  campaignMomentum: z.object({
    message: z.string().min(1).max(4000),
    campaignId: z.string().min(1).max(200).nullable(),
    campaignTitle: z.string().min(1).max(200).nullable(),
    status: z.enum(["moving", "drifting", "stalled", "at_risk"]).nullable(),
    interventionLevel: z.enum(["steady", "nudge", "protect", "reset"])
      .nullable(),
    statusReason: z.string().min(1).max(2000).nullable(),
    healthSnapshot: CompanionCampaignHealthSnapshotSchema.nullable(),
    pressureSignals: z.array(z.string().min(1).max(200)).max(5),
    nextStep: CompanionSuggestedQuestSchema.nullable(),
    supportActions: z.array(CompanionSuggestedQuestSchema).max(5),
  }).nullable().optional(),
});

export const SurfaceSchema = z.enum(["companion", "journeys"]);
export const InputModeSchema = z.enum(["text", "voice"]);
export const ModeSchema = z.enum(COMPANION_AGENT_MODES);
export const IntentSchema = z.enum(COMPANION_AGENT_INTENTS);
export const StarterIntentSchema = z.enum(COMPANION_AGENT_STARTER_INTENTS);
export const PendingActionTypeSchema = z.enum(COMPANION_PENDING_ACTION_TYPES);
export const PendingActionStatusSchema = z.enum(
  COMPANION_PENDING_ACTION_STATUSES,
);
export const UnderstandingStateSchema = z.enum(
  COMPANION_AGENT_UNDERSTANDING_STATES,
);
export const SelectedProposedActionIntentSchema = z.enum(
  COMPANION_AGENT_SELECTED_PROPOSED_ACTION_INTENTS,
);
export const CampaignLifecycleStatusSchema = z.enum(
  COMPANION_CAMPAIGN_LIFECYCLE_STATUSES,
);

export const CompanionAgentFollowUpSchema = z.object({
  question: z.string().min(1).max(500),
  reason: z.string().min(1).max(1000).optional().nullable(),
  expectedAnswerType: z.enum([
    "free_text",
    "choice",
    "time",
    "priority",
    "confirmation",
  ]).default("free_text"),
  options: z.array(z.string().min(1).max(120)).max(6).optional(),
  blocksDrafting: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

export const CompanionAgentProposedActionSchema = z.object({
  type: z.string().min(1).max(80),
  title: z.string().min(1).max(200).optional().nullable(),
  summary: z.string().min(1).max(1000).optional().nullable(),
  reason: z.string().min(1).max(2000).optional().nullable(),
  normalizedPayload: z.record(z.unknown()).optional(),
  confidence: z.number().min(0).max(1).optional(),
}).passthrough();

export const SelectedEntityIdsSchema = z.object({
  taskIds: z.array(z.string().uuid()).max(12).optional(),
  ritualIds: z.array(z.string().uuid()).max(12).optional(),
  campaignIds: z.array(z.string().uuid()).max(12).optional(),
  reminderIds: z.array(z.string().uuid()).max(12).optional(),
  calendarEventIds: z.array(z.string()).max(12).optional(),
}).optional();

export const CompanionAgentRequestSchema = z.object({
  surface: SurfaceSchema.default("companion"),
  sessionId: z.string().min(1).max(200),
  message: z.string().min(1).max(4000).trim(),
  inputMode: InputModeSchema.default("text"),
  currentDateTime: z.string().datetime({ offset: true }),
  starterIntent: StarterIntentSchema.optional(),
  selectedProposalId: z.string().min(1).max(200).optional(),
  visibleDateStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  visibleDateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  horizonDays: z.number().int().min(1).max(31).optional(),
  selectedEntityIds: SelectedEntityIdsSchema,
  activeFollowUp: CompanionAgentFollowUpSchema.nullable().optional(),
  activeProposedActions: z.array(CompanionAgentProposedActionSchema).max(8)
    .optional(),
  selectedProposedAction: CompanionAgentProposedActionSchema.optional(),
  selectedProposedActionIntent: SelectedProposedActionIntentSchema.optional(),
});

export const CompanionAgentActionRequestSchema = z.object({
  sessionId: z.string().min(1).max(200),
  actionId: z.string().uuid().optional(),
  action: z.enum(["confirm", "cancel"]),
});

export const SubmitCompanionResultSchema = z.object({
  reply: z.string().min(1).max(4000),
  mode: ModeSchema,
  intent: IntentSchema,
  confidence: z.number().min(0).max(1),
  understanding_state: UnderstandingStateSchema.optional(),
  follow_up: CompanionAgentFollowUpSchema.nullable().optional(),
  proposed_actions: z.array(CompanionAgentProposedActionSchema).max(8)
    .optional(),
  assumptions: z.array(z.string().min(1).max(500)).max(8).optional(),
  evidence_ids: z.array(z.string().min(1).max(200)).max(24).optional(),
  structured_response: CompanionStructuredResponseSchema.nullable().optional(),
  prepared_action_id: z.string().uuid().nullable().optional(),
});

export type CompanionAgentRequest = z.infer<typeof CompanionAgentRequestSchema>;
export type CompanionAgentActionRequest = z.infer<
  typeof CompanionAgentActionRequestSchema
>;
export type CompanionAgentMode = z.infer<typeof ModeSchema>;
export type CompanionAgentIntent = z.infer<typeof IntentSchema>;
export type CompanionPendingActionType = z.infer<
  typeof PendingActionTypeSchema
>;
export type CompanionPendingActionStatus = z.infer<
  typeof PendingActionStatusSchema
>;
export type CompanionAgentUnderstandingState = z.infer<
  typeof UnderstandingStateSchema
>;
export type CompanionAgentSelectedProposedActionIntent = z.infer<
  typeof SelectedProposedActionIntentSchema
>;
export type CompanionAgentFollowUp = z.infer<
  typeof CompanionAgentFollowUpSchema
>;
export type CompanionAgentProposedAction = z.infer<
  typeof CompanionAgentProposedActionSchema
>;
export type CompanionCampaignLifecycleStatus = z.infer<
  typeof CampaignLifecycleStatusSchema
>;
export type SubmitCompanionResult = z.infer<typeof SubmitCompanionResultSchema>;

export const isCompanionCampaignLifecycleStatus = (
  value: unknown,
): value is CompanionCampaignLifecycleStatus =>
  typeof value === "string" &&
  (COMPANION_CAMPAIGN_LIFECYCLE_STATUSES as readonly string[]).includes(value);

export interface PendingActionCandidate {
  id: string;
  actionType: CompanionPendingActionType;
  intent: CompanionAgentIntent;
  summary: string;
  confirmationMessage: string | null;
  normalizedPayload: Record<string, unknown>;
  affectedEntities: Record<string, unknown> | null;
}

export interface PendingActionRow {
  id: string;
  thread_id: string;
  session_id: string;
  user_id: string;
  companion_id: string;
  status: CompanionPendingActionStatus;
  intent: CompanionAgentIntent;
  action_type: CompanionPendingActionType;
  normalized_payload: Record<string, unknown>;
  summary: string;
  affected_entities: Record<string, unknown> | null;
  confirmation_message: string | null;
  created_at: string;
  expires_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  executed_at: string | null;
  execution_result: Record<string, unknown> | null;
  execution_error: Record<string, unknown> | null;
  idempotency_key: string;
  replaced_by_action_id: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ThreadRow {
  session_id: string;
  user_id: string;
  companion_id: string;
  surface: "companion" | "journeys";
  title: string;
  preview_text: string;
  created_at: string;
  last_message_at: string;
  archived_at: string | null;
  message_count: number;
  openai_conversation_id: string | null;
  last_openai_response_id: string | null;
}

export interface ChatRow {
  id: string;
  role: "assistant" | "user";
  content: string;
  created_at: string;
  input_mode: "text" | "voice" | null;
  source: string;
  surface: string;
  session_id: string;
  metadata?: Record<string, unknown> | null;
}

export interface LoadedCompanionAgentContext {
  thread: ThreadRow | null;
  messages: ChatRow[];
  tasks: Array<Record<string, unknown>>;
  recentCompletedTasks: Array<Record<string, unknown>>;
  rituals: Array<Record<string, unknown>>;
  campaigns: Array<Record<string, unknown>>;
  calendarEvents: Array<Record<string, unknown>>;
  reminders: Array<Record<string, unknown>>;
  goals: string[];
  recentMemory: Record<string, unknown>;
  reflections: Array<Record<string, unknown>>;
  activePendingAction: PendingActionRow | null;
  companionMode: "alpha" | "calm" | "strategic" | "chaotic" | "mentor";
  companionModeAdaptationEnabled: boolean;
  visibleDateStart: string;
  visibleDateEnd: string;
  currentDateTime: string;
  timezone: string;
}
