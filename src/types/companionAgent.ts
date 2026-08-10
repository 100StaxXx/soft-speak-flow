import type { Json } from "@/integrations/supabase/types";
import type { CompanionStructuredResponse } from "@/shared/companionStructuredOutput";
import type {
  CompanionChatInputMode,
  CompanionChatRole,
  CompanionChatSurface,
} from "@/types/companionChatPrimitives";
import type { CompanionPlannerStarterIntent } from "@/types/companionPlanner";

export type CompanionAgentMode =
  | "conversation"
  | "clarify"
  | "schedule_read"
  | "pending_confirmation"
  | "receipt";

export type CompanionAgentIntent =
  | "schedule_task"
  | "plan_day"
  | "plan_week"
  | "check_calendar"
  | "update_existing_plan"
  | "goal_setting"
  | "journal"
  | "explore"
  | "reflect"
  | "unknown";

export type CompanionAgentActionStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "expired"
  | "failed"
  | "executed";

export type CompanionAgentUnderstandingState =
  | "needs_followup"
  | "enough_to_discuss"
  | "ready_to_propose"
  | "ready_to_draft";

export type CompanionAgentTurnOrigin =
  | "launcher"
  | "composer"
  | "follow_up_option";

export interface CompanionAgentFollowUp {
  question: string;
  reason?: string | null;
  expectedAnswerType:
    | "free_text"
    | "choice"
    | "time"
    | "priority"
    | "confirmation";
  options?: string[];
  metadata?: Record<string, Json | undefined>;
}

export type CompanionPendingActionType =
  | "task_create"
  | "task_update"
  | "ritual_create"
  | "reminder_create"
  | "campaign_create"
  | "campaign_update"
  | "campaign_adjust"
  | "day_plan_apply"
  | "journal_entry";

export interface CompanionAgentSelectedEntityIds {
  taskIds?: string[];
  ritualIds?: string[];
  campaignIds?: string[];
  reminderIds?: string[];
  calendarEventIds?: string[];
}

export interface PendingActionView {
  id: string;
  status: CompanionAgentActionStatus;
  intent: CompanionAgentIntent;
  actionType: CompanionPendingActionType;
  proposalId?: string | null;
  summary: string;
  confirmationMessage: string | null;
  normalizedPayload: Json;
  affectedEntities: Json | null;
  expiresAt: string;
  createdAt: string;
}

export interface ActionReceiptView {
  actionId: string;
  status: Extract<
    CompanionAgentActionStatus,
    "cancelled" | "failed" | "executed"
  >;
  proposalId?: string | null;
  message: string;
  summary?: string | null;
  createdAt: string;
  executionResult?: Json | null;
  executionError?: Json | null;
}

export interface CompanionAgentThreadState {
  threadId: string;
  sessionId: string;
  openaiConversationId?: string | null;
  lastOpenAIResponseId?: string | null;
  hasPendingAction: boolean;
}

export interface CompanionAgentRequest {
  surface: CompanionChatSurface;
  sessionId: string;
  message: string;
  inputMode: CompanionChatInputMode;
  currentDateTime: string;
  turnOrigin?: CompanionAgentTurnOrigin;
  starterIntent?: CompanionPlannerStarterIntent;
  visibleDateStart?: string;
  visibleDateEnd?: string;
  horizonDays?: number;
  selectedEntityIds?: CompanionAgentSelectedEntityIds;
  activeFollowUp?: CompanionAgentFollowUp | null;
}

export interface CompanionAgentResponse {
  reply: string;
  mode: CompanionAgentMode;
  intent: CompanionAgentIntent;
  confidence: number;
  understandingState?: CompanionAgentUnderstandingState;
  followUp?: CompanionAgentFollowUp | null;
  assumptions?: string[];
  evidenceIds?: string[];
  structuredResponse?: CompanionStructuredResponse | null;
  pendingAction?: PendingActionView;
  receipt?: ActionReceiptView;
  threadState: CompanionAgentThreadState;
}

export interface CompanionAgentActionRequest {
  sessionId: string;
  actionId?: string;
  action: "confirm" | "cancel";
}

export interface CompanionAgentMessage {
  id: string;
  role: CompanionChatRole;
  content: string;
  createdAt: string;
  source: "agent";
  inputMode?: CompanionChatInputMode;
  mode?: CompanionAgentMode;
  intent?: CompanionAgentIntent;
  understandingState?: CompanionAgentUnderstandingState;
  followUp?: CompanionAgentFollowUp | null;
  assumptions?: string[];
  evidenceIds?: string[];
  structuredResponse?: CompanionStructuredResponse | null;
  pendingAction?: PendingActionView;
  receipt?: ActionReceiptView;
}
