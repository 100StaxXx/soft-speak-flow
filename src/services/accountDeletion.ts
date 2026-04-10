import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthScopedClientState } from "@/services/authScopedClientState";
import {
  parseFunctionInvokeError,
  toUserFacingFunctionError,
  type ParsedFunctionInvokeError,
} from "@/utils/supabaseFunctionErrors";

export interface AccountDeletionWarning {
  code?: string;
  message: string;
  details?: unknown;
}

export type AccountDeletionStage = "storage_cleanup" | "relational_cleanup" | "auth_delete";

export interface AccountDeletionErrorMetadata {
  code?: string;
  status?: number;
  requestId?: string;
  stage?: AccountDeletionStage;
}

interface DeleteAccountOptions {
  queryClient: QueryClient;
  userId: string;
  signOut: () => Promise<void>;
}

interface DeleteUserFunctionResponse {
  success?: boolean;
  error?: string;
  code?: string;
  status?: number;
  requestId?: string;
  stage?: AccountDeletionStage;
  warnings?: AccountDeletionWarning[];
}

const ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_MESSAGE =
  "Account deletion is temporarily unavailable. Please try again later.";
const ACCOUNT_DELETION_NOT_FOUND_MESSAGE =
  "We couldn't find this account anymore. Please sign in again.";

const ACCOUNT_DELETION_AUTH_CODES = new Set(["ACCOUNT_DELETION_AUTH_REQUIRED"]);
const ACCOUNT_DELETION_NOT_FOUND_CODES = new Set(["ACCOUNT_DELETION_NOT_FOUND"]);
const ACCOUNT_DELETION_TEMPORARY_CODES = new Set([
  "ACCOUNT_DELETION_AUTH_DELETE_FAILED",
  "ACCOUNT_DELETION_BACKEND_UNAVAILABLE",
  "ACCOUNT_DELETION_CONFIG_ERROR",
  "ACCOUNT_DELETION_UNKNOWN",
  "ACCOUNT_DELETION_RELATIONAL_CLEANUP_FAILED",
  "ACCOUNT_DELETION_STORAGE_CLEANUP_FAILED",
]);
const ACCOUNT_DELETION_STAGE_MESSAGES: Record<AccountDeletionStage, string> = {
  storage_cleanup: "We couldn't finish deleting your uploaded files, so your account wasn't removed. Please try again.",
  relational_cleanup: "We couldn't finish removing your account data, so your account wasn't removed. Please try again.",
  auth_delete: "We couldn't finish removing your sign-in record, so your account wasn't removed. Please try again.",
};

type AccountDeletionErrorWithMetadata = Error & AccountDeletionErrorMetadata & { cause?: unknown };

const isAccountDeletionStage = (value: unknown): value is AccountDeletionStage =>
  value === "storage_cleanup" || value === "relational_cleanup" || value === "auth_delete";

const getAccountDeletionStage = (value: unknown): AccountDeletionStage | undefined =>
  isAccountDeletionStage(value) ? value : undefined;

const getParsedFunctionCode = (parsed: ParsedFunctionInvokeError): string | undefined =>
  parsed.code ?? parsed.responsePayload?.code;

const getParsedFunctionRequestId = (parsed: ParsedFunctionInvokeError): string | undefined =>
  parsed.requestId ?? parsed.responsePayload?.requestId;

const getParsedFunctionStage = (parsed: ParsedFunctionInvokeError): AccountDeletionStage | undefined =>
  getAccountDeletionStage(parsed.responsePayload?.stage);

const normalizeWarnings = (raw: unknown): AccountDeletionWarning[] => {
  if (!Array.isArray(raw)) return [];

  const normalized: AccountDeletionWarning[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const warning = entry as Record<string, unknown>;
    const message = typeof warning.message === "string" ? warning.message : null;
    if (!message) {
      continue;
    }

    normalized.push({
      ...(typeof warning.code === "string" ? { code: warning.code } : {}),
      message,
      ...(warning.details !== undefined ? { details: warning.details } : {}),
    });
  }

  return normalized;
};

export const isAccountDeletionAuthError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const code =
    error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : undefined;
  if (code && ACCOUNT_DELETION_AUTH_CODES.has(code)) {
    return true;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("unauthorized") ||
    message.includes("jwt") ||
    message.includes("token") ||
    message.includes("session expired")
  );
};

const createAccountDeletionError = (
  message: string,
  metadata: AccountDeletionErrorMetadata = {},
  cause?: unknown,
): AccountDeletionErrorWithMetadata => {
  const error = new Error(message) as AccountDeletionErrorWithMetadata;
  error.name = "AccountDeletionError";
  error.code = metadata.code;
  error.status = metadata.status;
  error.requestId = metadata.requestId;
  error.stage = metadata.stage;
  if (cause !== undefined) {
    error.cause = cause;
  }
  return error;
};

const mapAccountDeletionCodeToMessage = (code?: string): string | null => {
  if (!code) return null;
  if (ACCOUNT_DELETION_AUTH_CODES.has(code)) {
    return "Session expired. Please sign in again.";
  }
  if (ACCOUNT_DELETION_NOT_FOUND_CODES.has(code)) {
    return ACCOUNT_DELETION_NOT_FOUND_MESSAGE;
  }
  if (ACCOUNT_DELETION_TEMPORARY_CODES.has(code)) {
    return ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_MESSAGE;
  }
  return null;
};

const toAccountDeletionErrorMessage = (parsed: ParsedFunctionInvokeError): string => {
  const mappedFromCode = mapAccountDeletionCodeToMessage(getParsedFunctionCode(parsed));
  if (mappedFromCode) {
    return mappedFromCode;
  }

  if (parsed.status === 404) {
    return ACCOUNT_DELETION_NOT_FOUND_MESSAGE;
  }

  return toUserFacingFunctionError(parsed, { action: "delete your account" });
};

export const getAccountDeletionErrorMetadata = (error: unknown): AccountDeletionErrorMetadata => {
  if (!error || typeof error !== "object") {
    return {};
  }

  const candidate = error as AccountDeletionErrorMetadata;
  return {
    ...(typeof candidate.code === "string" ? { code: candidate.code } : {}),
    ...(typeof candidate.status === "number" ? { status: candidate.status } : {}),
    ...(typeof candidate.requestId === "string" ? { requestId: candidate.requestId } : {}),
    ...(isAccountDeletionStage(candidate.stage) ? { stage: candidate.stage } : {}),
  };
};

export const getAccountDeletionFailureMessage = (error: unknown): string => {
  const { stage } = getAccountDeletionErrorMetadata(error);
  if (stage) {
    return ACCOUNT_DELETION_STAGE_MESSAGES[stage];
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Failed to delete account. Please try again.";
};

export const deleteCurrentAccount = async ({ queryClient, userId, signOut }: DeleteAccountOptions) => {
  // Attempt to refresh the session first to avoid sending a stale/expired token
  // to the edge function. If refreshSession fails (e.g. no refresh token), fall
  // back to the cached session — the edge function will reject it with 401 if
  // truly expired, and the caller already handles auth errors.
  let accessToken: string | undefined;

  try {
    const { data: refreshedData } = await supabase.auth.refreshSession();
    accessToken = refreshedData?.session?.access_token;
  } catch {
    // refresh failed — will try cached session below
  }

  if (!accessToken) {
    const { data: cachedData, error: sessionError } = await supabase.auth.getSession();
    accessToken = cachedData?.session?.access_token;

    if (sessionError || !accessToken) {
      throw new Error("Session expired. Please sign in again.");
    }
  }

  const { data, error } = await supabase.functions.invoke<DeleteUserFunctionResponse>("delete-user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    const parsedError = await parseFunctionInvokeError(error);
    throw createAccountDeletionError(
      toAccountDeletionErrorMessage(parsedError),
      {
        code: getParsedFunctionCode(parsedError),
        status: parsedError.status,
        requestId: getParsedFunctionRequestId(parsedError),
        stage: getParsedFunctionStage(parsedError),
      },
      error,
    );
  }

  if (!data?.success) {
    const mappedMessage = mapAccountDeletionCodeToMessage(data?.code);
    throw createAccountDeletionError(
      mappedMessage ?? data?.error ?? "Unable to delete account",
      {
        code: data?.code,
        status: data?.status,
        requestId: data?.requestId,
        stage: getAccountDeletionStage(data?.stage),
      },
      data,
    );
  }

  await clearAuthScopedClientState(queryClient, { previousUserId: userId, clearLegacyLocalState: true });

  try {
    await signOut();
  } catch (signOutError) {
    console.warn("Sign out after deletion reported an error:", signOutError);
  }

  return {
    warnings: normalizeWarnings(data.warnings),
    requestId: data.requestId,
  };
};
