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

interface DeleteUserFunctionResponse {
  success?: boolean;
  error?: string;
  code?: string;
  status?: number;
  warnings?: unknown;
}

interface DeleteAccountOptions {
  queryClient: QueryClient;
  userId: string;
  signOut: () => Promise<void>;
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
]);

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
  const message = error.message.toLowerCase();
  return (
    message.includes("unauthorized") ||
    message.includes("jwt") ||
    message.includes("token") ||
    message.includes("session expired")
  );
};

const createAccountDeletionError = (message: string, cause?: unknown): Error => {
  const error = new Error(message);
  if (cause !== undefined) {
    (error as Error & { cause?: unknown }).cause = cause;
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
  const mappedFromCode = mapAccountDeletionCodeToMessage(parsed.code ?? parsed.responsePayload?.code);
  if (mappedFromCode) {
    return mappedFromCode;
  }

  if (parsed.status === 404) {
    return ACCOUNT_DELETION_NOT_FOUND_MESSAGE;
  }

  return toUserFacingFunctionError(parsed, { action: "delete your account" });
};

export const deleteCurrentAccount = async ({ queryClient, userId, signOut }: DeleteAccountOptions) => {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error("Session expired. Please sign in again.");
  }

  const { data, error } = await supabase.functions.invoke<DeleteUserFunctionResponse>("delete-user", {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    const parsedError = await parseFunctionInvokeError(error);
    throw createAccountDeletionError(toAccountDeletionErrorMessage(parsedError), error);
  }

  if (!data?.success) {
    const mappedMessage = mapAccountDeletionCodeToMessage(data?.code);
    throw createAccountDeletionError(mappedMessage ?? data?.error ?? "Unable to delete account", data);
  }

  await clearAuthScopedClientState(queryClient, { previousUserId: userId, clearLegacyLocalState: true });

  try {
    await signOut();
  } catch (signOutError) {
    console.warn("Sign out after deletion reported an error:", signOutError);
  }

  return {
    warnings: normalizeWarnings(data.warnings),
  };
};
