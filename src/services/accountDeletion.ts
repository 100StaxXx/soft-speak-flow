import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthScopedClientState } from "@/services/authScopedClientState";

export interface AccountDeletionWarning {
  code?: string;
  message: string;
  details?: unknown;
}

interface DeleteUserFunctionResponse {
  success?: boolean;
  error?: string;
  warnings?: unknown;
}

interface DeleteAccountOptions {
  queryClient: QueryClient;
  userId: string;
  signOut: () => Promise<void>;
}

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
    throw new Error(error.message || "Unable to delete account");
  }

  if (!data?.success) {
    throw new Error(data?.error || "Unable to delete account");
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
