import {
  parseFunctionInvokeError,
  toUserFacingFunctionError,
  type ParsedFunctionInvokeError,
} from "@/utils/supabaseFunctionErrors";

const normalizeText = (value?: string | null) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const getCompanionPlannerErrorCode = (parsed: ParsedFunctionInvokeError) =>
  normalizeText(parsed.responsePayload?.code ?? parsed.code);

const getCompanionPlannerErrorSource = (parsed: ParsedFunctionInvokeError) =>
  [
    parsed.name,
    parsed.message,
    parsed.backendMessage,
    parsed.responsePayload?.error,
    parsed.responsePayload?.message,
    parsed.responsePayload?.code,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(" ");

const isMissingPlannerFunctionError = (parsed: ParsedFunctionInvokeError) => {
  const code = getCompanionPlannerErrorCode(parsed);
  const source = getCompanionPlannerErrorSource(parsed);

  return (
    code.includes("function_not_found")
    || source.includes("function not found")
    || source.includes("no route matched")
    || (parsed.status === 404 && !parsed.backendMessage)
  );
};

const isPlannerSetupError = (parsed: ParsedFunctionInvokeError) => {
  const source = getCompanionPlannerErrorSource(parsed);
  const hasPlannerDependencySignal = [
    "consume_abuse_protection",
    "record_abuse_event",
    "daily_planning_preferences",
    "user_ai_learning",
    "companion-planner-chat",
    "classify-task-intent",
  ].some((token) => source.includes(token));
  const hasSchemaSignal =
    source.includes("does not exist")
    || source.includes("undefined_table")
    || source.includes("undefined_function")
    || source.includes("schema cache")
    || source.includes("relation")
    || source.includes("column");

  return hasPlannerDependencySignal && hasSchemaSignal;
};

export function toUserFacingCompanionPlannerError(
  parsed: ParsedFunctionInvokeError,
  opts?: { action?: string },
): string {
  if (isMissingPlannerFunctionError(parsed)) {
    return "Companion Planner isn't live in this environment yet. Please try again after the backend is updated.";
  }

  if (isPlannerSetupError(parsed)) {
    return "Companion Planner is still being set up here. Please try again after the latest database update.";
  }

  return toUserFacingFunctionError(parsed, {
    action: opts?.action ?? "plan with your companion",
  });
}

export async function resolveCompanionPlannerError(
  error: unknown,
  opts?: { action?: string },
): Promise<string> {
  const parsed = await parseFunctionInvokeError(error);
  return toUserFacingCompanionPlannerError(parsed, opts);
}
