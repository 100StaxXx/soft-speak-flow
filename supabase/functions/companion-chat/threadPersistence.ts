type CompanionChatSurface = "companion" | "journeys";
type CompanionChatInputMode = "text" | "voice";

const THREAD_TITLE_MAX_LENGTH = 72;
const THREAD_PREVIEW_MAX_LENGTH = 160;

const collapseWhitespace = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const truncateText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
};

const normalizeThreadText = (value: string, maxLength: number) => {
  const normalized = collapseWhitespace(value);
  if (!normalized) return "";
  return truncateText(normalized, maxLength);
};

export const buildCompanionChatThreadTitle = (value: string) =>
  normalizeThreadText(value, THREAD_TITLE_MAX_LENGTH) || "New thread";

export const buildCompanionChatThreadPreview = (value: string) =>
  normalizeThreadText(value, THREAD_PREVIEW_MAX_LENGTH) || "No messages yet.";

const updateThreadRow = async (
  supabase: any,
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
  supabase: any;
  userId: string;
  companionId: string;
  sessionId: string;
  surface: CompanionChatSurface;
  title: string;
  previewText: string;
  createdAt: string;
  lastMessageAt: string;
}) => {
  const { error } = await params.supabase
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

export async function persistCompanionChatTurn(params: {
  supabase: any;
  userId: string;
  companionId: string;
  sessionId: string;
  surface: CompanionChatSurface;
  message: string;
  reply: string;
  inputMode: CompanionChatInputMode;
  createdAt?: string;
}) {
  const createdAt = params.createdAt ?? new Date().toISOString();

  const { error: chatError } = await params.supabase
    .from("companion_chats")
    .insert([
      {
        user_id: params.userId,
        companion_id: params.companionId,
        role: "user",
        content: params.message,
        input_mode: params.inputMode,
        session_id: params.sessionId,
        surface: params.surface,
        source: "chat",
        created_at: createdAt,
      },
      {
        user_id: params.userId,
        companion_id: params.companionId,
        role: "assistant",
        content: params.reply,
        input_mode: null,
        session_id: params.sessionId,
        surface: params.surface,
        source: "chat",
        created_at: createdAt,
      },
    ]);

  if (chatError) throw chatError;

  const previewText = buildCompanionChatThreadPreview(params.reply);
  const updatedThread = await updateThreadRow(
    params.supabase,
    params.sessionId,
    previewText,
    createdAt,
  );

  if (updatedThread) return;

  try {
    await insertThreadRow({
      supabase: params.supabase,
      userId: params.userId,
      companionId: params.companionId,
      sessionId: params.sessionId,
      surface: params.surface,
      title: buildCompanionChatThreadTitle(params.message),
      previewText,
      createdAt,
      lastMessageAt: createdAt,
    });
  } catch (error) {
    const maybePostgrestError = error as { code?: string } | null;
    if (maybePostgrestError?.code !== "23505") {
      throw error;
    }

    await updateThreadRow(
      params.supabase,
      params.sessionId,
      previewText,
      createdAt,
    );
  }
}
