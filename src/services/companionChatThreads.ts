import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { stripMarkdown } from "@/lib/utils";
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

type PersistableThreadMessage = {
  role: CompanionChatRole;
  content: string;
  createdAt: string;
  inputMode?: CompanionChatInputMode | null;
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
});

const mapThreadMessage = (
  row: CompanionChatRow,
): CompanionChatThreadMessage => ({
  id: row.id,
  sessionId: row.session_id,
  role: row.role,
  content: row.content,
  createdAt: row.created_at,
  inputMode: row.input_mode as CompanionChatInputMode | null ?? undefined,
  source: row.source as CompanionChatSource,
});

const updateThreadRow = async (
  sessionId: string,
  previewText: string,
  lastMessageAt: string,
) => {
  const { data, error } = await supabase
    .from("companion_chat_threads")
    .update({
      preview_text: previewText,
      last_message_at: lastMessageAt,
      archived_at: null,
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
    });

  if (error) throw error;
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
    .select("session_id, companion_id, surface, title, preview_text, created_at, last_message_at, archived_at")
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
    .select("id, session_id, role, content, created_at, input_mode, source")
    .eq("session_id", sessionId)
    .eq("surface", surface)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapThreadMessage);
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

  const updatedThread = await updateThreadRow(
    params.sessionId,
    previewText,
    lastRow.created_at,
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
