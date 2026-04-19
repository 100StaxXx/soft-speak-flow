import {
  parseFunctionInvokeError,
  toUserFacingFunctionError,
  type ParsedFunctionInvokeError,
} from "@/utils/supabaseFunctionErrors";
import { isCompanionChatSetupError } from "@/utils/companionChatSetup";

const normalizeText = (value?: string | null) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const getCompanionChatErrorCode = (parsed: ParsedFunctionInvokeError) =>
  normalizeText(parsed.responsePayload?.code ?? parsed.code);

const getCompanionChatErrorSource = (parsed: ParsedFunctionInvokeError) =>
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

const isMissingEdgeFunctionError = (parsed: ParsedFunctionInvokeError) => {
  const code = getCompanionChatErrorCode(parsed);
  const source = getCompanionChatErrorSource(parsed);

  return (
    code.includes("function_not_found")
    || source.includes("function not found")
    || source.includes("no route matched")
    || source.includes("could not find function")
    || source.includes("could not find the function")
    || (parsed.status === 404 && !parsed.backendMessage)
  );
};

export function toUserFacingCompanionChatError(
  parsed: ParsedFunctionInvokeError,
  opts?: { action?: string },
): string {
  const code = getCompanionChatErrorCode(parsed);
  const source = getCompanionChatErrorSource(parsed);

  if (
    code === "premium_required"
    || source.includes("companion talk requires premium")
    || source.includes("premium access")
  ) {
    return "Companion Talk is available with Premium.";
  }

  if (isMissingEdgeFunctionError(parsed)) {
    return "Companion Talk isn't live in this environment yet. Please try again after the backend is updated.";
  }

  if (isCompanionChatSetupError(parsed)) {
    return "Companion Talk is still being set up here. Please try again after the latest database update.";
  }

  return toUserFacingFunctionError(parsed, {
    action: opts?.action ?? "talk with your companion",
  });
}

export async function resolveCompanionChatError(
  error: unknown,
  opts?: { action?: string },
): Promise<string> {
  const parsed = await parseFunctionInvokeError(error);
  return toUserFacingCompanionChatError(parsed, opts);
}
