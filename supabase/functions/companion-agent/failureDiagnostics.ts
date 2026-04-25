export type CompanionAgentFailureStage =
  | "auth"
  | "request_parse"
  | "cost_guardrail"
  | "agent_run";

const ERROR_FIELDS = [
  "name",
  "message",
  "code",
  "details",
  "hint",
  "error",
] as const;

const stringField = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const readErrorFields = (error: unknown) => {
  if (!error || typeof error !== "object") return null;
  const source = error as Record<string, unknown>;
  const fields: Partial<Record<(typeof ERROR_FIELDS)[number], string>> = {};
  for (const key of ERROR_FIELDS) {
    const value = stringField(source[key]);
    if (value) fields[key] = value;
  }
  return fields;
};

export const normalizeErrorSource = (error: unknown) => {
  if (!error) return "";
  if (typeof error === "string") return error.toLowerCase();
  if (typeof error !== "object") return String(error).toLowerCase();

  const fields = readErrorFields(error) ?? {};
  return ERROR_FIELDS.map((key) => fields[key])
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
};

const getAgentRunSubStage = (error: unknown): string | null => {
  if (!error || typeof error !== "object") return null;
  const e = error as { name?: unknown; subStage?: unknown };
  if (e.name !== "AgentRunSubStageError") return null;
  return typeof e.subStage === "string" ? e.subStage : null;
};

const unwrapAgentRunSubStage = (error: unknown): unknown => {
  if (!error || typeof error !== "object") return error;
  const e = error as { name?: unknown; originalError?: unknown };
  if (e.name !== "AgentRunSubStageError") return error;
  return e.originalError ?? error;
};

export const buildErrorLog = (error: unknown) => {
  if (!error) return { message: "(no error)" };
  if (typeof error !== "object") return { message: String(error) };

  const fields = readErrorFields(error) ?? {};
  const e = error as { stack?: unknown; cause?: unknown };
  const cause = e.cause;
  return {
    name: fields.name,
    message: fields.message,
    code: fields.code,
    details: fields.details,
    hint: fields.hint,
    nestedError: fields.error,
    stack: stringField(e.stack),
    cause: cause === undefined
      ? undefined
      : cause instanceof Error
      ? { name: cause.name, message: cause.message }
      : String(cause),
  };
};

const hasSchemaSignal = (source: string) =>
  source.includes("does not exist") ||
  source.includes("undefined_table") ||
  source.includes("undefined_column") ||
  source.includes("undefined_function") ||
  source.includes("schema cache") ||
  source.includes("relation") ||
  source.includes("column");

export const isCompanionAgentSetupFailure = (source: string) => {
  if (!hasSchemaSignal(source)) return false;

  return [
    "companion_chats",
    "companion_chat_threads",
    "companion_pending_actions",
    "openai_conversation_id",
    "last_openai_response_id",
    "companion_mode",
    "companion_mode_adaptation_enabled",
    "consume_abuse_protection",
    "abuse_protection_config",
    "cost_guardrail_config",
    "cost_guardrail_state",
    "user_companion",
    "daily_tasks",
    "external_calendar_events",
    "companion_memories",
    "user_reflections",
    "daily_check_ins",
    "focus_sessions",
    "habits",
    "epics",
    "user_ai_learning",
    "user_ai_preferences",
    "daily_planning_preferences",
    "profiles",
  ].some((token) => source.includes(token));
};

const inferBaseFailureReason = (
  source: string,
  stage: CompanionAgentFailureStage,
) => {
  if (
    source.includes("permission denied") ||
    source.includes("not authorized") ||
    source.includes("unauthorized")
  ) {
    return "db_permission_error";
  }
  if (
    source.includes("violates foreign key") ||
    source.includes("violates unique") ||
    source.includes("violates check") ||
    source.includes("violates row-level security")
  ) {
    return "db_constraint_error";
  }
  if (source.includes("notcapable") || source.includes("not capable")) {
    return "deno_capability_error";
  }
  if (isCompanionAgentSetupFailure(source)) return "schema_mismatch";
  if (source.includes("cost_guardrail")) return "cost_guardrail_setup";
  if (source.includes("abuse protection")) return "abuse_protection_setup";
  if (source.includes("openai")) return "openai_provider_error";
  if (source.includes("timeout") || source.includes("timed out")) {
    return "timeout";
  }
  if (
    source.includes("unexpected token") ||
    (source.includes("json") && source.includes("parse"))
  ) {
    return "json_parse_error";
  }

  return `${stage}_failed`;
};

export const getCompanionAgentFailureReason = (
  error: unknown,
  stage: CompanionAgentFailureStage,
) => {
  const subStage = getAgentRunSubStage(error);
  const inspected = subStage ? unwrapAgentRunSubStage(error) : error;
  const source = normalizeErrorSource(inspected);
  const baseReason = inferBaseFailureReason(source, stage);
  return subStage ? `${subStage}.${baseReason}` : baseReason;
};
