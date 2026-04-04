// Edge function for account deletion - v4.0
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface ErrorWithOptionalFields {
  message?: unknown;
  code?: unknown;
  name?: unknown;
  status?: unknown;
}

const ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_MESSAGE =
  "Account deletion is temporarily unavailable. Please try again later.";

const ACCOUNT_DELETION_ERROR_CODES = {
  AUTH_REQUIRED: "ACCOUNT_DELETION_AUTH_REQUIRED",
  BACKEND_UNAVAILABLE: "ACCOUNT_DELETION_BACKEND_UNAVAILABLE",
  CONFIG_ERROR: "ACCOUNT_DELETION_CONFIG_ERROR",
  NOT_FOUND: "ACCOUNT_DELETION_NOT_FOUND",
  UNKNOWN: "ACCOUNT_DELETION_UNKNOWN",
} as const;

type AccountDeletionErrorCode =
  (typeof ACCOUNT_DELETION_ERROR_CODES)[keyof typeof ACCOUNT_DELETION_ERROR_CODES];

interface SanitizedDeleteUserError {
  code: AccountDeletionErrorCode;
  message: string;
  status: number;
}

class AccountDeletionError extends Error {
  status: number;
  code: AccountDeletionErrorCode;

  constructor(message: string, options: { status: number; code: AccountDeletionErrorCode; cause?: unknown }) {
    super(message);
    this.name = "AccountDeletionError";
    this.status = options.status;
    this.code = options.code;
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

type SupabaseAdminClient = ReturnType<typeof createClient<any>>;

interface HandleDeleteUserDependencies {
  env?: Pick<typeof Deno.env, "get">;
  createAdminClient?: (supabaseUrl: string, serviceRoleKey: string) => SupabaseAdminClient;
  sleep?: (ms: number) => Promise<void>;
}

const DELETE_USER_RETRY_DELAYS_MS = [500, 1500] as const;
const RETRYABLE_ERROR_PATTERNS = [
  "timeout",
  "timed out",
  "network",
  "connection",
  "econnreset",
  "ecconnrefused",
  "failed to fetch",
  "fetch failed",
  "service unavailable",
  "temporarily unavailable",
  "rate limit",
  "too many requests",
];

const createUnauthorizedError = (cause?: unknown) =>
  new AccountDeletionError("Unauthorized", {
    status: 401,
    code: ACCOUNT_DELETION_ERROR_CODES.AUTH_REQUIRED,
    cause,
  });

const createTemporaryUnavailableError = (
  code:
    | typeof ACCOUNT_DELETION_ERROR_CODES.BACKEND_UNAVAILABLE
    | typeof ACCOUNT_DELETION_ERROR_CODES.CONFIG_ERROR
    | typeof ACCOUNT_DELETION_ERROR_CODES.UNKNOWN,
  cause?: unknown,
) =>
  new AccountDeletionError(ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_MESSAGE, {
    status: 500,
    code,
    cause,
  });

const createAdminClient = (supabaseUrl: string, serviceRoleKey: string): SupabaseAdminClient =>
  createClient<any>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const getErrorFieldRecord = (error: unknown): ErrorWithOptionalFields | null =>
  error && typeof error === "object" ? (error as ErrorWithOptionalFields) : null;

const getErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return asString(getErrorFieldRecord(error)?.message);
};

const getErrorCode = (error: unknown): string | undefined =>
  asString(getErrorFieldRecord(error)?.code);

const getErrorName = (error: unknown): string | undefined => {
  if (error instanceof Error && error.name.trim().length > 0) {
    return error.name;
  }

  return asString(getErrorFieldRecord(error)?.name);
};

const getErrorStatus = (error: unknown): number | undefined => {
  if (error instanceof AccountDeletionError) {
    return error.status;
  }

  return asNumber(getErrorFieldRecord(error)?.status);
};

const normalizeErrorText = (value: string): string =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();

const getNormalizedErrorText = (error: unknown): string =>
  normalizeErrorText(
    [getErrorName(error), getErrorCode(error), getErrorMessage(error)]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" "),
  );

const describeError = (error: unknown): Record<string, unknown> => ({
  name: getErrorName(error) ?? null,
  code: getErrorCode(error) ?? null,
  status: getErrorStatus(error) ?? null,
  message: getErrorMessage(error) ?? String(error),
});

export const isTransientDeleteUserInfrastructureError = (error: unknown): boolean => {
  const status = getErrorStatus(error);
  const normalizedText = getNormalizedErrorText(error);

  if (status === 401 || status === 403 || status === 404) {
    return false;
  }

  if (
    normalizedText.includes("unauthorized")
    || normalizedText.includes("invalid token")
    || normalizedText.includes("jwt")
    || normalizedText.includes("user not found")
    || normalizedText.includes("no rows")
  ) {
    return false;
  }

  if (status === 408 || status === 429) {
    return true;
  }

  if (typeof status === "number" && status >= 500) {
    return true;
  }

  return RETRYABLE_ERROR_PATTERNS.some((pattern) => normalizedText.includes(pattern));
};

function sanitizeError(error: unknown): SanitizedDeleteUserError {
  console.error("[delete-user] full error details", error);

  if (error instanceof AccountDeletionError) {
    return {
      message: error.message,
      status: error.status,
      code: error.code,
    };
  }

  const status = getErrorStatus(error);
  const normalizedMessage = getNormalizedErrorText(error);

  if (
    status === 401
    || status === 403
    || normalizedMessage.includes("unauthorized")
    || normalizedMessage.includes("invalid token")
    || normalizedMessage.includes("jwt")
  ) {
    return {
      message: "Unauthorized",
      status: 401,
      code: ACCOUNT_DELETION_ERROR_CODES.AUTH_REQUIRED,
    };
  }

  if (
    status === 404
    || normalizedMessage.includes("not found")
    || normalizedMessage.includes("no rows")
  ) {
    return {
      message: "User not found",
      status: 404,
      code: ACCOUNT_DELETION_ERROR_CODES.NOT_FOUND,
    };
  }

  return {
    message: ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_MESSAGE,
    status: 500,
    code: ACCOUNT_DELETION_ERROR_CODES.UNKNOWN,
  };
}

const createErrorResponse = (
  corsHeaders: HeadersInit,
  details: SanitizedDeleteUserError,
): Response =>
  new Response(
    JSON.stringify({
      success: false,
      error: details.message,
      code: details.code,
      status: details.status,
    }),
    {
      status: details.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );

const runDeleteStepWithRetry = async (
  operationName: string,
  perform: () => Promise<void>,
  temporaryFailureCode: typeof ACCOUNT_DELETION_ERROR_CODES.BACKEND_UNAVAILABLE,
  waitForRetry: (ms: number) => Promise<void>,
): Promise<void> => {
  const totalAttempts = DELETE_USER_RETRY_DELAYS_MS.length + 1;

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      await perform();
      return;
    } catch (error) {
      const retryable = isTransientDeleteUserInfrastructureError(error);

      if (!retryable) {
        throw error;
      }

      if (attempt === totalAttempts) {
        console.error(`[delete-user] ${operationName} failed after retries`, {
          attempt,
          maxAttempts: totalAttempts,
          ...describeError(error),
        });
        throw createTemporaryUnavailableError(temporaryFailureCode, error);
      }

      const delayMs = DELETE_USER_RETRY_DELAYS_MS[attempt - 1];
      console.warn(`[delete-user] ${operationName} failed; retrying`, {
        attempt,
        nextAttempt: attempt + 1,
        delayMs,
        ...describeError(error),
      });
      await waitForRetry(delayMs);
    }
  }
};

export const handleDeleteUser = async (
  req: Request,
  dependencies: HandleDeleteUserDependencies = {},
): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const env = dependencies.env ?? Deno.env;
    const adminClientFactory = dependencies.createAdminClient ?? createAdminClient;
    const waitForRetry = dependencies.sleep ?? sleep;

    const supabaseUrl = env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[delete-user] missing required env", {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      });
      throw createTemporaryUnavailableError(ACCOUNT_DELETION_ERROR_CODES.CONFIG_ERROR);
    }

    const supabase = adminClientFactory(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse(corsHeaders, sanitizeError(createUnauthorizedError()));
    }

    const token = authHeader.replace("Bearer", "").trim();
    if (!token) {
      return createErrorResponse(corsHeaders, sanitizeError(createUnauthorizedError()));
    }

    const { data: userResult, error: userError } = await supabase.auth.getUser(token);
    if (userError) {
      console.error("[delete-user] auth.getUser failed", userError);
      throw createUnauthorizedError(userError);
    }

    const user = userResult?.user;
    if (!user) {
      return createErrorResponse(corsHeaders, sanitizeError(createUnauthorizedError()));
    }

    await runDeleteStepWithRetry(
      "delete_user_account rpc",
      async () => {
        const { error } = await supabase.rpc("delete_user_account", { p_user_id: user.id });
        if (error) {
          throw error;
        }
      },
      ACCOUNT_DELETION_ERROR_CODES.BACKEND_UNAVAILABLE,
      waitForRetry,
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[delete-user] request failed", error);
    return createErrorResponse(corsHeaders, sanitizeError(error));
  }
};

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleDeleteUser(req));
}
