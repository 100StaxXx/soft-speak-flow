import type { Tables } from "@/integrations/supabase/types";
import type { AiActivity } from "@/types/domain";

type AiInteractionRow = Tables<"ai_interactions">;
type AiValidationRow = Tables<"ai_output_validation_log">;
type CompanionChatRow = Tables<"companion_chats">;
type CompanionChatThreadRow = Tables<"companion_chat_threads">;
type CompanionPendingActionRow = Tables<"companion_pending_actions">;

const normalizeSummary = (...values: Array<string | null | undefined>) =>
  values
    .find((value) => typeof value === "string" && value.trim().length > 0)
    ?.trim()
  ?? "Untitled AI activity";

export const toAiActivityFromInteraction = (
  row: AiInteractionRow,
): AiActivity => ({
  id: row.id,
  activityType: "interaction",
  createdAt: row.created_at,
  surface: null,
  sessionId: row.session_id ?? null,
  intent: row.detected_intent ?? null,
  status: row.user_action ?? null,
  summary: normalizeSummary(row.input_text, row.user_action, row.interaction_type),
  sourceTable: "ai_interactions",
  threadId: null,
  role: null,
  metadata: row.ai_response ?? row.modifications ?? row.context_snapshot,
});

export const toAiActivityFromValidation = (
  row: AiValidationRow,
): AiActivity => ({
  id: row.id,
  activityType: "validation",
  createdAt: row.created_at ?? null,
  surface: null,
  sessionId: null,
  intent: null,
  status: row.validation_passed ? "passed" : "failed",
  summary: normalizeSummary(row.template_key),
  sourceTable: "ai_output_validation_log",
  threadId: null,
  role: null,
  metadata: row.output_data,
});

export const toAiActivityFromChat = (
  row: CompanionChatRow | CompanionChatThreadRow,
): AiActivity => {
  if ("role" in row) {
    return {
      id: row.id,
      activityType: "chat_message",
      createdAt: row.created_at,
      surface: row.surface,
      sessionId: row.session_id,
      intent: null,
      status: null,
      summary: normalizeSummary(row.content),
      sourceTable: "companion_chats",
      threadId: row.session_id,
      role: row.role,
      metadata: null,
    };
  }

  return {
    id: row.session_id,
    activityType: "chat_thread",
    createdAt: row.created_at,
    surface: row.surface,
    sessionId: row.session_id,
    intent: null,
    status: row.archived_at ? "archived" : "active",
    summary: normalizeSummary(row.preview_text, row.title),
    sourceTable: "companion_chat_threads",
    threadId: row.session_id,
    role: null,
    metadata: null,
  };
};

export const toAiActivityFromPendingAction = (
  row: CompanionPendingActionRow,
): AiActivity => ({
  id: row.id,
  activityType: "pending_action",
  createdAt: row.created_at,
  surface: null,
  sessionId: row.session_id,
  intent: row.intent,
  status: row.status,
  summary: normalizeSummary(row.summary, row.confirmation_message),
  sourceTable: "companion_pending_actions",
  threadId: row.thread_id,
  role: null,
  metadata: row.normalized_payload,
});
