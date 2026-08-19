import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { stripMarkdown } from "@/lib/utils";
import type {
  ActionReceiptView,
  CompanionAgentIntent,
  CompanionAgentMode,
  PendingActionView,
} from "@/types/companionAgent";
import type { CompanionStructuredResponse } from "@/shared/companionStructuredOutput";
import type {
  CompanionChatInputMode,
  CompanionChatRole,
  CompanionChatSource,
  CompanionChatSurface,
  CompanionChatThreadMessage,
  CompanionChatThreadSummary,
} from "@/types/companionConversation";

type CompanionChatThreadRow = Tables<"companion_chat_threads">;
type CompanionChatRow = Tables<"companion_chats">;
type CompanionPendingActionRow = Tables<"companion_pending_actions">;

type PersistableThreadMessage = {
  role: CompanionChatRole;
  content: string;
  createdAt: string;
  inputMode?: CompanionChatInputMode | null;
  metadata?: CompanionChatRow["metadata"];
};

const isJsonValue = (value: unknown): value is CompanionChatRow["metadata"] => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((entry) => isJsonValue(entry));
  }

  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return false;
    }

    return Object.values(value as Record<string, unknown>).every((entry) =>
      entry === undefined || isJsonValue(entry)
    );
  }

  return false;
};

const THREAD_TITLE_MAX_LENGTH = 72;
const THREAD_PREVIEW_MAX_LENGTH = 160;

const collapseWhitespace = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const truncateText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
};

const normalizeThreadText = (value: string, maxLength: number) => {
  const normalized = collapseWhitespace(stripMarkdown(value));
  if (!normalized) return "";
  return truncateText(normalized, maxLength);
};

const mapThreadSummary = (
  row: CompanionChatThreadRow,
): CompanionChatThreadSummary => ({
  sessionId: row.session_id,
  companionId: row.companion_id,
  surface: row.surface as CompanionChatSurface,
  title: row.title,
  previewText: row.preview_text,
  createdAt: row.created_at,
  lastMessageAt: row.last_message_at,
  archivedAt: row.archived_at,
  messageCount: row.message_count,
});

const mapThreadMessage = (
  row: CompanionChatRow,
): CompanionChatThreadMessage => {
  const metadata = row.metadata && typeof row.metadata === "object" &&
      !Array.isArray(row.metadata)
    ? row.metadata as Record<string, unknown>
    : null;

  const parsePendingAction = (value: unknown): PendingActionView | undefined => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const pendingAction = value as Record<string, unknown>;
    if (
      typeof pendingAction.id !== "string" ||
      typeof pendingAction.status !== "string" ||
      typeof pendingAction.intent !== "string" ||
      typeof pendingAction.actionType !== "string" ||
      typeof pendingAction.summary !== "string" ||
      typeof pendingAction.createdAt !== "string" ||
      typeof pendingAction.expiresAt !== "string"
    ) {
      return undefined;
    }

    return {
      id: pendingAction.id,
      status: pendingAction.status as PendingActionView["status"],
      intent: pendingAction.intent as PendingActionView["intent"],
      actionType: pendingAction.actionType as PendingActionView["actionType"],
      proposalId: typeof pendingAction.proposalId === "string"
        ? pendingAction.proposalId
        : null,
      summary: pendingAction.summary,
      confirmationMessage: typeof pendingAction.confirmationMessage === "string"
        ? pendingAction.confirmationMessage
        : null,
      normalizedPayload: isJsonValue(pendingAction.normalizedPayload)
        ? pendingAction.normalizedPayload
        : {},
      affectedEntities: isJsonValue(pendingAction.affectedEntities)
        ? pendingAction.affectedEntities
        : null,
      expiresAt: pendingAction.expiresAt,
      createdAt: pendingAction.createdAt,
    };
  };

  const parseReceipt = (value: unknown): ActionReceiptView | undefined => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const receipt = value as Record<string, unknown>;
    if (
      typeof receipt.actionId !== "string" ||
      typeof receipt.status !== "string" ||
      typeof receipt.message !== "string" ||
      typeof receipt.createdAt !== "string"
    ) {
      return undefined;
    }

    return {
      actionId: receipt.actionId,
      status: receipt.status as ActionReceiptView["status"],
      proposalId: typeof receipt.proposalId === "string"
        ? receipt.proposalId
        : null,
      message: receipt.message,
      summary: typeof receipt.summary === "string" ? receipt.summary : null,
      createdAt: receipt.createdAt,
      executionResult: isJsonValue(receipt.executionResult)
        ? receipt.executionResult
        : null,
      executionError: isJsonValue(receipt.executionError)
        ? receipt.executionError
        : null,
    };
  };

  return {
    id: row.id,
    sessionId: row.session_id,
    // The database constrains companion_chats.role to this exact union, while
    // generated Supabase table types intentionally expose CHECKed text as string.
    role: row.role as CompanionChatRole,
    content: row.content,
    createdAt: row.created_at,
    inputMode: row.input_mode as CompanionChatInputMode | null ?? undefined,
    source: row.source as CompanionChatSource,
    metadata: row.metadata,
    mode: typeof metadata?.mode === "string"
      ? metadata.mode as CompanionAgentMode
      : null,
    intent: typeof metadata?.intent === "string"
      ? metadata.intent as CompanionAgentIntent
      : null,
    structuredResponse: metadata && "structuredResponse" in metadata
      ? metadata.structuredResponse as CompanionStructuredResponse | null
      : undefined,
    pendingAction: parsePendingAction(metadata?.pendingAction),
    receipt: parseReceipt(metadata?.receipt),
  };
};

export const readCompanionThreadReceiptProposalId = (
  receipt: ActionReceiptView | null | undefined,
) => {
  if (typeof receipt?.proposalId === "string" && receipt.proposalId.length > 0) {
    return receipt.proposalId;
  }

  return null;
};

const mapPendingAction = (
  row: CompanionPendingActionRow,
): PendingActionView => ({
  id: row.id,
  status: row.status as PendingActionView["status"],
  intent: row.intent as PendingActionView["intent"],
  actionType: row.action_type as PendingActionView["actionType"],
  proposalId: null,
  summary: row.summary,
  confirmationMessage: row.confirmation_message,
  normalizedPayload: row.normalized_payload,
  affectedEntities: row.affected_entities,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
});

const updateThreadRow = async (
  sessionId: string,
  previewText: string,
  lastMessageAt: string,
  messageCount: number,
) => {
  const { data, error } = await supabase
    .from("companion_chat_threads")
    .update({
      preview_text: previewText,
      last_message_at: lastMessageAt,
      archived_at: null,
      message_count: messageCount,
    })
    .eq("session_id", sessionId)
    .select("session_id")
    .maybeSingle();

  if (error) throw error;
  return data;
};

const insertThreadRow = async (params: {
  userId: string;
  companionId: string;
  sessionId: string;
  surface: CompanionChatSurface;
  title: string;
  previewText: string;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
}) => {
  const { error } = await supabase
    .from("companion_chat_threads")
    .insert({
      session_id: params.sessionId,
      user_id: params.userId,
      companion_id: params.companionId,
      surface: params.surface,
      title: params.title,
      preview_text: params.previewText,
      created_at: params.createdAt,
      last_message_at: params.lastMessageAt,
      archived_at: null,
      message_count: params.messageCount,
    });

  if (error) throw error;
};

const loadThreadMessageCount = async (
  sessionId: string,
  surface: CompanionChatSurface,
) => {
  const { count, error } = await supabase
    .from("companion_chats")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("surface", surface);

  if (error) throw error;
  return count ?? 0;
};

export const getCompanionChatThreadsQueryKey = (
  userId: string | null | undefined,
  companionId: string | null | undefined,
  surface: CompanionChatSurface,
) => ["companion-chat-threads", userId ?? "anon", companionId ?? "none", surface];

export const generateCompanionThreadSessionId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const buildCompanionThreadTitle = (value: string) =>
  normalizeThreadText(value, THREAD_TITLE_MAX_LENGTH) || "New thread";

export const buildCompanionThreadPreview = (value: string) =>
  normalizeThreadText(value, THREAD_PREVIEW_MAX_LENGTH) || "No messages yet.";

export const listCompanionChatThreads = async (
  companionId: string,
  surface: CompanionChatSurface,
) => {
  const { data, error } = await supabase
    .from("companion_chat_threads")
    .select("session_id, companion_id, surface, title, preview_text, created_at, last_message_at, archived_at, message_count")
    .eq("companion_id", companionId)
    .eq("surface", surface)
    .order("last_message_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapThreadSummary);
};

export const loadCompanionChatThreadMessages = async (
  sessionId: string,
  surface: CompanionChatSurface,
) => {
  const { data, error } = await supabase
    .from("companion_chats")
    .select("id, session_id, role, content, created_at, input_mode, source, metadata")
    .eq("session_id", sessionId)
    .eq("surface", surface)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapThreadMessage);
};

export const loadCompanionPendingAction = async (
  sessionId: string,
) => {
  const { data, error } = await supabase
    .from("companion_pending_actions")
    .select("*")
    .eq("session_id", sessionId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapPendingAction(data as CompanionPendingActionRow) : null;
};

export const persistCompanionThreadMessages = async (params: {
  userId: string;
  companionId: string;
  sessionId: string;
  surface: CompanionChatSurface;
  source: CompanionChatSource;
  rows: PersistableThreadMessage[];
}) => {
  if (params.rows.length === 0) return;

  const normalizedRows = params.rows.map((row) => ({
    user_id: params.userId,
    companion_id: params.companionId,
    role: row.role,
    content: row.content,
    input_mode: row.inputMode ?? null,
    metadata: row.metadata ?? {},
    session_id: params.sessionId,
    surface: params.surface,
    source: params.source,
    created_at: row.createdAt,
  }));

  const { error } = await supabase
    .from("companion_chats")
    .insert(normalizedRows);

  if (error) throw error;

  const lastRow = normalizedRows[normalizedRows.length - 1];
  if (!lastRow) return;

  const titleSource =
    normalizedRows.find((row) => row.role === "user")?.content
    ?? lastRow.content;
  const previewText = buildCompanionThreadPreview(lastRow.content);
  const createdAt = normalizedRows[0]?.created_at ?? lastRow.created_at;
  const messageCount = await loadThreadMessageCount(
    params.sessionId,
    params.surface,
  );

  const updatedThread = await updateThreadRow(
    params.sessionId,
    previewText,
    lastRow.created_at,
    messageCount,
  );

  if (updatedThread) return;

  try {
    await insertThreadRow({
      userId: params.userId,
      companionId: params.companionId,
      sessionId: params.sessionId,
      surface: params.surface,
      title: buildCompanionThreadTitle(titleSource),
      previewText,
      createdAt,
      lastMessageAt: lastRow.created_at,
      messageCount,
    });
  } catch (error) {
    const maybePostgrestError = error as { code?: string } | null;
    if (maybePostgrestError?.code !== "23505") {
      throw error;
    }

    await updateThreadRow(
      params.sessionId,
      previewText,
      lastRow.created_at,
      messageCount,
    );
  }
};

export const setCompanionChatThreadArchived = async (
  sessionId: string,
  archived: boolean,
) => {
  const { error } = await supabase
    .from("companion_chat_threads")
    .update({
      archived_at: archived ? new Date().toISOString() : null,
    })
    .eq("session_id", sessionId);

  if (error) throw error;
};
