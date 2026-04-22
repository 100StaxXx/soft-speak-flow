import {
  buildCompanionChatThreadPreview,
  buildCompanionChatThreadTitle,
} from "../companion-chat/threadPersistence.ts";
import type {
  ChatRow,
  CompanionAgentIntent,
  CompanionPendingActionType,
  PendingActionCandidate,
  PendingActionRow,
  ThreadRow,
} from "./types.ts";

const DEFAULT_PENDING_ACTION_TTL_MS = Number(
  Deno.env.get("COMPANION_PENDING_ACTION_TTL_MS") ?? String(1000 * 60 * 60 * 12),
);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const mapPendingActionRow = (row: Record<string, unknown> | null): PendingActionRow | null => {
  if (!row) return null;

  return {
    id: String(row.id),
    thread_id: String(row.thread_id),
    session_id: String(row.session_id),
    user_id: String(row.user_id),
    companion_id: String(row.companion_id),
    status: String(row.status) as PendingActionRow["status"],
    intent: String(row.intent) as CompanionAgentIntent,
    action_type: String(row.action_type) as CompanionPendingActionType,
    normalized_payload: asRecord(row.normalized_payload) ?? {},
    summary: String(row.summary ?? ""),
    affected_entities: asRecord(row.affected_entities),
    confirmation_message: typeof row.confirmation_message === "string"
      ? row.confirmation_message
      : null,
    created_at: String(row.created_at),
    expires_at: String(row.expires_at),
    confirmed_at: typeof row.confirmed_at === "string" ? row.confirmed_at : null,
    cancelled_at: typeof row.cancelled_at === "string" ? row.cancelled_at : null,
    executed_at: typeof row.executed_at === "string" ? row.executed_at : null,
    execution_result: asRecord(row.execution_result),
    execution_error: asRecord(row.execution_error),
    idempotency_key: String(row.idempotency_key),
    replaced_by_action_id: typeof row.replaced_by_action_id === "string"
      ? row.replaced_by_action_id
      : null,
    metadata: asRecord(row.metadata),
  };
};

export async function loadThread(
  supabase: any,
  userId: string,
  sessionId: string,
): Promise<ThreadRow | null> {
  const { data, error } = await supabase
    .from("companion_chat_threads")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as ThreadRow | null;
}

export async function loadRecentMessages(
  supabase: any,
  userId: string,
  sessionId: string,
  limit = 18,
): Promise<ChatRow[]> {
  const { data, error } = await supabase
    .from("companion_chats")
    .select("id, role, content, created_at, input_mode, source, surface, session_id")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as ChatRow[]).reverse();
}

export async function loadActivePendingAction(
  supabase: any,
  userId: string,
  sessionId: string,
): Promise<PendingActionRow | null> {
  const { data, error } = await supabase
    .from("companion_pending_actions")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return mapPendingActionRow(data as Record<string, unknown> | null);
}

async function loadThreadMessageCount(
  supabase: any,
  sessionId: string,
  surface: "companion" | "journeys",
) {
  const { count, error } = await supabase
    .from("companion_chats")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("surface", surface);

  if (error) throw error;
  return count ?? 0;
}

export async function ensureThreadRow(params: {
  supabase: any;
  userId: string;
  companionId: string;
  sessionId: string;
  surface: "companion" | "journeys";
  firstUserMessage: string;
  previewText: string;
  lastMessageAt: string;
  openaiConversationId?: string | null;
  lastOpenAIResponseId?: string | null;
}) {
  const messageCount = await loadThreadMessageCount(
    params.supabase,
    params.sessionId,
    params.surface,
  );

  const patch = {
    preview_text: params.previewText,
    last_message_at: params.lastMessageAt,
    archived_at: null,
    message_count: messageCount,
    openai_conversation_id: params.openaiConversationId ?? null,
    last_openai_response_id: params.lastOpenAIResponseId ?? null,
  };

  const { data: updated, error: updateError } = await params.supabase
    .from("companion_chat_threads")
    .update(patch)
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .select("session_id")
    .maybeSingle();

  if (updateError) throw updateError;
  if (updated) return;

  const { error: insertError } = await params.supabase
    .from("companion_chat_threads")
    .insert({
      session_id: params.sessionId,
      user_id: params.userId,
      companion_id: params.companionId,
      surface: params.surface,
      title: buildCompanionChatThreadTitle(params.firstUserMessage),
      preview_text: params.previewText,
      created_at: params.lastMessageAt,
      last_message_at: params.lastMessageAt,
      archived_at: null,
      message_count: messageCount,
      openai_conversation_id: params.openaiConversationId ?? null,
      last_openai_response_id: params.lastOpenAIResponseId ?? null,
    });

  if (!insertError) return;
  if (insertError.code !== "23505") throw insertError;

  const { error: retryError } = await params.supabase
    .from("companion_chat_threads")
    .update(patch)
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId);

  if (retryError) throw retryError;
}

export async function persistAgentTurn(params: {
  supabase: any;
  userId: string;
  companionId: string;
  sessionId: string;
  surface: "companion" | "journeys";
  userMessage: string;
  assistantReply: string;
  inputMode: "text" | "voice";
  createdAt?: string;
  openaiConversationId?: string | null;
  lastOpenAIResponseId?: string | null;
}) {
  const createdAt = params.createdAt ?? new Date().toISOString();
  const rows = [
    {
      user_id: params.userId,
      companion_id: params.companionId,
      role: "user",
      content: params.userMessage,
      input_mode: params.inputMode,
      session_id: params.sessionId,
      surface: params.surface,
      source: "agent",
      created_at: createdAt,
    },
    {
      user_id: params.userId,
      companion_id: params.companionId,
      role: "assistant",
      content: params.assistantReply,
      input_mode: null,
      session_id: params.sessionId,
      surface: params.surface,
      source: "agent",
      created_at: createdAt,
    },
  ];

  const { error } = await params.supabase
    .from("companion_chats")
    .insert(rows);

  if (error) throw error;

  await ensureThreadRow({
    supabase: params.supabase,
    userId: params.userId,
    companionId: params.companionId,
    sessionId: params.sessionId,
    surface: params.surface,
    firstUserMessage: params.userMessage,
    previewText: buildCompanionChatThreadPreview(params.assistantReply),
    lastMessageAt: createdAt,
    openaiConversationId: params.openaiConversationId ?? null,
    lastOpenAIResponseId: params.lastOpenAIResponseId ?? null,
  });
}

export async function persistActionReceipt(params: {
  supabase: any;
  userId: string;
  companionId: string;
  sessionId: string;
  surface: "companion" | "journeys";
  userMessage: string;
  assistantReply: string;
  createdAt?: string;
  inputMode?: "text" | "voice";
}) {
  const createdAt = params.createdAt ?? new Date().toISOString();
  const { error } = await params.supabase
    .from("companion_chats")
    .insert([
      {
        user_id: params.userId,
        companion_id: params.companionId,
        role: "user",
        content: params.userMessage,
        input_mode: params.inputMode ?? "text",
        session_id: params.sessionId,
        surface: params.surface,
        source: "agent",
        created_at: createdAt,
      },
      {
        user_id: params.userId,
        companion_id: params.companionId,
        role: "assistant",
        content: params.assistantReply,
        input_mode: null,
        session_id: params.sessionId,
        surface: params.surface,
        source: "agent",
        created_at: createdAt,
      },
    ]);

  if (error) throw error;

  await ensureThreadRow({
    supabase: params.supabase,
    userId: params.userId,
    companionId: params.companionId,
    sessionId: params.sessionId,
    surface: params.surface,
    firstUserMessage: params.userMessage,
    previewText: buildCompanionChatThreadPreview(params.assistantReply),
    lastMessageAt: createdAt,
  });
}

export async function replacePendingAction(params: {
  supabase: any;
  userId: string;
  companionId: string;
  sessionId: string;
  intent: CompanionAgentIntent;
  candidate: PendingActionCandidate;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
}) {
  const now = new Date().toISOString();
  const expiresAt = params.expiresAt
    ?? new Date(Date.now() + DEFAULT_PENDING_ACTION_TTL_MS).toISOString();

  const { data: expiredRows, error: expireError } = await params.supabase
    .from("companion_pending_actions")
    .update({
      status: "expired",
      execution_error: null,
      execution_result: null,
      metadata: {
        replacedAt: now,
      },
    })
    .eq("thread_id", params.sessionId)
    .eq("user_id", params.userId)
    .eq("status", "pending")
    .select("id");

  if (expireError) throw expireError;

  const { data, error } = await params.supabase
    .from("companion_pending_actions")
    .insert({
      id: params.candidate.id,
      thread_id: params.sessionId,
      session_id: params.sessionId,
      user_id: params.userId,
      companion_id: params.companionId,
      status: "pending",
      intent: params.intent,
      action_type: params.candidate.actionType,
      normalized_payload: params.candidate.normalizedPayload,
      summary: params.candidate.summary,
      affected_entities: params.candidate.affectedEntities ?? {},
      confirmation_message: params.candidate.confirmationMessage,
      created_at: now,
      expires_at: expiresAt,
      idempotency_key: `${params.sessionId}:${params.candidate.id}`,
      metadata: params.metadata ?? {},
      replaced_by_action_id: null,
    })
    .select("*")
    .single();

  if (error) throw error;

  const replacedIds = (expiredRows ?? [])
    .map((row: { id?: string | null }) => row.id)
    .filter((value: string | null | undefined): value is string =>
      typeof value === "string" && value.length > 0
    );

  if (replacedIds.length > 0) {
    const { error: replacementError } = await params.supabase
      .from("companion_pending_actions")
      .update({
        replaced_by_action_id: params.candidate.id,
      })
      .in("id", replacedIds);

    if (replacementError) throw replacementError;
  }

  const mapped = mapPendingActionRow(data as Record<string, unknown>);
  if (!mapped) {
    throw new Error("Failed to map pending action row");
  }
  return mapped;
}

export async function loadPendingActionForResolution(params: {
  supabase: any;
  userId: string;
  sessionId: string;
  actionId?: string;
}) {
  let query = params.supabase
    .from("companion_pending_actions")
    .select("*")
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (params.actionId) {
    query = query.eq("id", params.actionId);
  } else {
    query = query.eq("status", "pending");
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return mapPendingActionRow(data as Record<string, unknown> | null);
}

export async function updatePendingAction(
  supabase: any,
  actionId: string,
  patch: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .from("companion_pending_actions")
    .update(patch)
    .eq("id", actionId)
    .select("*")
    .single();

  if (error) throw error;
  const mapped = mapPendingActionRow(data as Record<string, unknown>);
  if (!mapped) {
    throw new Error("Failed to map updated pending action row");
  }
  return mapped;
}
