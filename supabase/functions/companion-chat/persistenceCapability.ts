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
  };

  return [
    source.name,
    source.message,
    source.code,
    source.details,
    source.hint,
    source.error,
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

export function isCompanionChatPersistenceSetupError(error: unknown): boolean {
  const source = collectErrorSource(error);
  if (!hasSchemaSignal(source)) return false;

  return (
    source.includes("companion_chat_threads")
    || hasCompanionChatsColumnSignal(source, "surface")
    || hasCompanionChatsColumnSignal(source, "source")
  );
}

export async function withCompanionChatPersistenceCapability(
  persistConversation: () => Promise<void>,
): Promise<boolean> {
  try {
    await persistConversation();
    return true;
  } catch (error) {
    if (!isCompanionChatPersistenceSetupError(error)) {
      throw error;
    }

    console.warn("[companion-chat] persistence unavailable during rollout", error);
    return false;
  }
}
