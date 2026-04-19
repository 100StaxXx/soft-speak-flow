const normalizeText = (value?: string | null) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const collectErrorSource = (error: unknown): string => {
  if (!error) return "";

  if (typeof error === "string") {
    return normalizeText(error);
  }

  if (typeof error !== "object") {
    return "";
  }

  const source = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    details?: unknown;
    hint?: unknown;
    error?: unknown;
    backendMessage?: unknown;
    responsePayload?: {
      message?: unknown;
      error?: unknown;
      code?: unknown;
    };
  };

  return [
    source.name,
    source.message,
    source.code,
    source.details,
    source.hint,
    source.error,
    source.backendMessage,
    source.responsePayload?.message,
    source.responsePayload?.error,
    source.responsePayload?.code,
  ]
    .map((value) => normalizeText(typeof value === "string" ? value : undefined))
    .filter(Boolean)
    .join(" ");
};

const hasSchemaSignal = (source: string) =>
  source.includes("does not exist")
  || source.includes("undefined_table")
  || source.includes("undefined_column")
  || source.includes("schema cache")
  || source.includes("relation")
  || source.includes("column");

const hasCompanionChatsColumnSignal = (source: string, column: "surface" | "source") => (
  source.includes(`companion_chats.${column}`)
  || (
    source.includes("companion_chats")
    && source.includes("column")
    && (
      source.includes(`'${column}'`)
      || source.includes(`"${column}"`)
      || source.includes(` ${column} `)
    )
  )
);

export const COMPANION_CHAT_THREAD_HISTORY_DISABLED_REASON =
  "Thread history will be available after the latest backend update.";

export const COMPANION_CHAT_THREAD_HISTORY_EMPTY_STATE =
  "Past chats will show up after the latest backend update.";

export function isCompanionChatSetupError(error: unknown): boolean {
  const source = collectErrorSource(error);
  if (!hasSchemaSignal(source)) return false;

  return (
    source.includes("companion_chats")
    || source.includes("companion_chat_threads")
    || hasCompanionChatsColumnSignal(source, "surface")
    || hasCompanionChatsColumnSignal(source, "source")
  );
}

export function isCompanionChatPersistenceSetupError(error: unknown): boolean {
  const source = collectErrorSource(error);
  if (!hasSchemaSignal(source)) return false;

  return (
    source.includes("companion_chat_threads")
    || hasCompanionChatsColumnSignal(source, "surface")
    || hasCompanionChatsColumnSignal(source, "source")
  );
}
