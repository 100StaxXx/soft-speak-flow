import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthScopedClientState } from "@/services/authScopedClientState";
import { parseFunctionInvokeError } from "@/utils/supabaseFunctionErrors";

export interface AccountDeletionWarning {
  code?: string;
  message: string;
  details?: unknown;
}

interface DeleteAccountOptions {
  queryClient: QueryClient;
  userId: string;
  signOut: () => Promise<void>;
}

interface DeleteUserFunctionResponse {
  success?: boolean;
  warnings?: AccountDeletionWarning[];
}

const ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_MESSAGE =
  "Account deletion is temporarily unavailable. Please try again later.";
const ACCOUNT_DELETION_NOT_FOUND_MESSAGE =
  "We couldn't find this account anymore. Please sign in again.";

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

const toAccountDeletionFunctionErrorMessage = async (error: unknown): Promise<string> => {
  const parsed = await parseFunctionInvokeError(error);
  const combinedMessage = [
    parsed.message,
    parsed.backendMessage,
    parsed.code,
    parsed.responsePayload?.code,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

  if (parsed.category === "auth" || combinedMessage.includes("unauthorized") || combinedMessage.includes("jwt")) {
    return "Session expired. Please sign in again.";
  }

  if (parsed.status === 404 || combinedMessage.includes("not found") || combinedMessage.includes("no rows")) {
    return ACCOUNT_DELETION_NOT_FOUND_MESSAGE;
  }

  return ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_MESSAGE;
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
    throw createAccountDeletionError(await toAccountDeletionFunctionErrorMessage(error), error);
  }

  await clearAuthScopedClientState(queryClient, { previousUserId: userId, clearLegacyLocalState: true });

  try {
    await signOut();
  } catch (signOutError) {
    console.warn("Sign out after deletion reported an error:", signOutError);
  }

  return {
    warnings: Array.isArray(data?.warnings) ? data.warnings : [],
  };
};
