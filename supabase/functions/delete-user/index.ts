// Edge function for account deletion - v5.0
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface ErrorWithOptionalFields {
  message?: unknown;
  code?: unknown;
  name?: unknown;
  status?: unknown;
  details?: unknown;
  hint?: unknown;
  cause?: unknown;
  failureReason?: unknown;
}

interface StorageListEntry {
  name?: unknown;
  id?: unknown;
}

const ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_MESSAGE =
  "Account deletion is temporarily unavailable. Please try again later.";

const ACCOUNT_DELETION_ERROR_CODES = {
  AUTH_REQUIRED: "ACCOUNT_DELETION_AUTH_REQUIRED",
  AUTH_DELETE_FAILED: "ACCOUNT_DELETION_AUTH_DELETE_FAILED",
  BACKEND_UNAVAILABLE: "ACCOUNT_DELETION_BACKEND_UNAVAILABLE",
  CONFIG_ERROR: "ACCOUNT_DELETION_CONFIG_ERROR",
  NOT_FOUND: "ACCOUNT_DELETION_NOT_FOUND",
  RELATIONAL_CLEANUP_FAILED: "ACCOUNT_DELETION_RELATIONAL_CLEANUP_FAILED",
  STORAGE_CLEANUP_FAILED: "ACCOUNT_DELETION_STORAGE_CLEANUP_FAILED",
  UNKNOWN: "ACCOUNT_DELETION_UNKNOWN",
} as const;

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
const STORAGE_LIST_PAGE_SIZE = 100;
const STORAGE_REMOVE_BATCH_SIZE = 500;
const STORAGE_CLEANUP_DEADLINE_MS = 14_000; // Leave headroom before edge function timeout
const LEGACY_USER_STORAGE_PREFIX_TARGETS = [
  { bucket: "quest-attachments", prefix: (userId: string) => userId },
  { bucket: "mentors-avatars", prefix: (userId: string) => userId },
  { bucket: "journey-paths", prefix: (userId: string) => userId },
  { bucket: "companion-images", prefix: (userId: string) => userId },
  { bucket: "companion-animation-videos", prefix: (userId: string) => userId },
  {
    bucket: "evolution-cards",
    prefix: (userId: string) => `postcards/${userId}`,
  },
] as const;
const LEGACY_USER_STORAGE_FILTER_TARGETS = [
  {
    bucket: "journey-paths",
    prefix: "campaign-welcome",
    matchesFileName: (fileName: string, userId: string) =>
      fileName.startsWith(`welcome-${userId}-`),
  },
] as const;

type AccountDeletionErrorCode = (typeof ACCOUNT_DELETION_ERROR_CODES)[
  keyof typeof ACCOUNT_DELETION_ERROR_CODES
];
type AccountDeletionStage =
  | "storage_cleanup"
  | "relational_cleanup"
  | "auth_delete";
type AccountDeletionFailureReason =
  | "timeout"
  | "permission"
  | "storage_api"
  | "unknown";

interface SanitizedDeleteUserError {
  code: AccountDeletionErrorCode;
  message: string;
  status: number;
  stage?: AccountDeletionStage;
  failureReason?: AccountDeletionFailureReason;
}

class AccountDeletionError extends Error {
  status: number;
  code: AccountDeletionErrorCode;
  stage?: AccountDeletionStage;
  failureReason?: AccountDeletionFailureReason;

  constructor(message: string, options: {
    status: number;
    code: AccountDeletionErrorCode;
    cause?: unknown;
    stage?: AccountDeletionStage;
    failureReason?: AccountDeletionFailureReason;
  }) {
    super(message);
    this.name = "AccountDeletionError";
    this.status = options.status;
    this.code = options.code;
    this.stage = options.stage;
    this.failureReason = options.failureReason;
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

type SupabaseAdminClient = ReturnType<typeof createClient<any>>;

interface HandleDeleteUserDependencies {
  env?: Pick<typeof Deno.env, "get">;
  createAdminClient?: (
    supabaseUrl: string,
    serviceRoleKey: string,
  ) => SupabaseAdminClient;
  sleep?: (ms: number) => Promise<void>;
}

interface StorageObjectOwnershipEntry {
  bucket_id?: unknown;
  name?: unknown;
}

interface RegisteredStorageAssetEntry {
  bucket_id?: unknown;
  storage_path?: unknown;
}

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

const createStageFailureError = (
  stage: AccountDeletionStage,
  code:
    | typeof ACCOUNT_DELETION_ERROR_CODES.STORAGE_CLEANUP_FAILED
    | typeof ACCOUNT_DELETION_ERROR_CODES.RELATIONAL_CLEANUP_FAILED
    | typeof ACCOUNT_DELETION_ERROR_CODES.AUTH_DELETE_FAILED,
  cause?: unknown,
  failureReason?: AccountDeletionFailureReason,
) => {
  const resolvedFailureReason = failureReason ??
    getAccountDeletionFailureReason(cause);

  return new AccountDeletionError(
    ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_MESSAGE,
    {
      status: 500,
      code,
      cause,
      stage,
      ...(resolvedFailureReason
        ? { failureReason: resolvedFailureReason }
        : {}),
    },
  );
};

const createAdminClient = (
  supabaseUrl: string,
  serviceRoleKey: string,
): SupabaseAdminClient =>
  createClient<any>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const getErrorFieldRecord = (error: unknown): ErrorWithOptionalFields | null =>
  error && typeof error === "object"
    ? (error as ErrorWithOptionalFields)
    : null;

const isAccountDeletionFailureReason = (
  value: unknown,
): value is AccountDeletionFailureReason =>
  value === "timeout" ||
  value === "permission" ||
  value === "storage_api" ||
  value === "unknown";

const getAccountDeletionFailureReason = (
  error: unknown,
): AccountDeletionFailureReason | undefined => {
  const failureReason = getErrorFieldRecord(error)?.failureReason;
  return isAccountDeletionFailureReason(failureReason)
    ? failureReason
    : undefined;
};

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

const getErrorDetails = (error: unknown): string | undefined =>
  asString(getErrorFieldRecord(error)?.details);

const getErrorHint = (error: unknown): string | undefined =>
  asString(getErrorFieldRecord(error)?.hint);

const getErrorCause = (error: unknown): unknown => {
  if (error instanceof Error) {
    return (error as Error & { cause?: unknown }).cause;
  }

  return getErrorFieldRecord(error)?.cause;
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
      .filter((value): value is string =>
        typeof value === "string" && value.trim().length > 0
      )
      .join(" "),
  );

const describeSingleError = (error: unknown): Record<string, unknown> => ({
  name: getErrorName(error) ?? null,
  code: getErrorCode(error) ?? null,
  status: getErrorStatus(error) ?? null,
  message: getErrorMessage(error) ?? String(error),
  details: getErrorDetails(error) ?? null,
  hint: getErrorHint(error) ?? null,
});

const getInnermostError = (error: unknown): unknown => {
  const seen = new Set<unknown>();
  let current = error;

  while (current !== undefined && current !== null && !seen.has(current)) {
    seen.add(current);
    const cause = getErrorCause(current);
    if (cause === undefined || cause === null || cause === current) {
      return current;
    }
    current = cause;
  }

  return error;
};

const classifyStorageCleanupFailureReason = (
  error: unknown,
): AccountDeletionFailureReason => {
  const explicitReason = getAccountDeletionFailureReason(error);
  if (explicitReason) {
    return explicitReason;
  }

  const innermostError = getInnermostError(error);
  const normalizedText = normalizeErrorText(
    `${getNormalizedErrorText(error)} ${
      getNormalizedErrorText(innermostError)
    }`,
  );
  const status = getErrorStatus(innermostError) ?? getErrorStatus(error);

  if (
    normalizedText.includes("storage cleanup timed out") ||
    normalizedText.includes("timed out during")
  ) {
    return "timeout";
  }

  if (
    status === 403 ||
    normalizedText.includes("permission denied") ||
    normalizedText.includes("rls") ||
    normalizedText.includes("policy")
  ) {
    return "permission";
  }

  if (
    typeof status === "number" ||
    getErrorCode(error) ||
    getErrorCode(innermostError)
  ) {
    return "storage_api";
  }

  return "unknown";
};

const shouldContinueAfterStorageCleanupFailure = (error: unknown): boolean => {
  const failureReason = classifyStorageCleanupFailureReason(error);
  return failureReason === "storage_api" ||
    failureReason === "timeout" ||
    failureReason === "permission";
};

const buildStorageCleanupFailureWarning = (error: unknown): string => {
  const failureReason = classifyStorageCleanupFailureReason(error);
  const innermostError = getInnermostError(error);
  const status = getErrorStatus(innermostError) ?? getErrorStatus(error);
  const statusText = typeof status === "number" ? ` (status ${status})` : "";

  if (failureReason === "timeout") {
    return "Storage cleanup timed out before account deletion finished. Database cleanup fallback continued.";
  }

  if (failureReason === "permission") {
    return "Storage metadata permission check failed; account deletion continued with database cleanup fallback.";
  }

  return `Storage API cleanup failed${statusText}; account deletion continued with database cleanup fallback.`;
};

const describeError = (error: unknown): Record<string, unknown> => {
  const seen = new Set<unknown>();

  const buildDescription = (
    current: unknown,
    depth: number,
  ): Record<string, unknown> => {
    const description = describeSingleError(current);
    if (depth <= 0) {
      return description;
    }

    const cause = getErrorCause(current);
    if (
      cause === undefined || cause === null || cause === current ||
      seen.has(cause)
    ) {
      return description;
    }

    seen.add(cause);
    return {
      ...description,
      cause: buildDescription(cause, depth - 1),
    };
  };

  return buildDescription(error, 3);
};

const buildRequestHeaders = (
  corsHeaders: HeadersInit,
  requestId: string,
): HeadersInit => ({
  ...corsHeaders,
  "Content-Type": "application/json",
  "X-Request-Id": requestId,
});

const buildStoragePath = (prefix: string, name: string): string =>
  prefix ? `${prefix}/${name}` : name;

const getStorageEntryName = (entry: StorageListEntry): string | undefined =>
  asString(entry?.name);

const isStorageFolderEntry = (entry: StorageListEntry): boolean =>
  !asString(entry?.id);

const isNotFoundStyleError = (error: unknown): boolean => {
  const status = getErrorStatus(error);
  const normalizedText = getNormalizedErrorText(error);

  return status === 404 || normalizedText.includes("not found") ||
    normalizedText.includes("no rows");
};

const isStorageMissingObjectError = (error: unknown): boolean => {
  const normalizedText = getNormalizedErrorText(error);

  return isNotFoundStyleError(error) ||
    normalizedText.includes("no such") ||
    normalizedText.includes("does not exist");
};

const isMissingStorageOwnershipColumnError = (
  error: unknown,
  ownershipColumn: "owner" | "owner_id",
): boolean => {
  const normalizedText = getNormalizedErrorText(error);
  const normalizedColumn = normalizeErrorText(ownershipColumn);

  return normalizedText.includes(normalizedColumn) &&
    (
      normalizedText.includes("does not exist") ||
      normalizedText.includes("schema cache") ||
      normalizedText.includes("could not find")
    );
};

const isAlreadyDeletedAuthUserError = (error: unknown): boolean => {
  const normalizedText = getNormalizedErrorText(error);

  return isNotFoundStyleError(error) ||
    normalizedText.includes("user not found");
};

export const isTransientDeleteUserInfrastructureError = (
  error: unknown,
): boolean => {
  if (
    error instanceof AccountDeletionError &&
    error.failureReason === "permission"
  ) {
    return false;
  }

  const status = getErrorStatus(error);
  const normalizedText = getNormalizedErrorText(error);

  if (status === 401 || status === 403 || status === 404) {
    return false;
  }

  if (
    normalizedText.includes("unauthorized") ||
    normalizedText.includes("invalid token") ||
    normalizedText.includes("jwt") ||
    normalizedText.includes("user not found") ||
    normalizedText.includes("no rows")
  ) {
    return false;
  }

  if (status === 408 || status === 429) {
    return true;
  }

  if (typeof status === "number" && status >= 500) {
    return true;
  }

  return RETRYABLE_ERROR_PATTERNS.some((pattern) =>
    normalizedText.includes(pattern)
  );
};

function sanitizeError(error: unknown): SanitizedDeleteUserError {
  console.error("[delete-user] full error details", error);

  if (error instanceof AccountDeletionError) {
    return {
      message: error.message,
      status: error.status,
      code: error.code,
      ...(error.stage ? { stage: error.stage } : {}),
      ...(error.failureReason ? { failureReason: error.failureReason } : {}),
    };
  }

  const status = getErrorStatus(error);
  const normalizedMessage = getNormalizedErrorText(error);

  if (
    status === 401 ||
    status === 403 ||
    normalizedMessage.includes("unauthorized") ||
    normalizedMessage.includes("invalid token") ||
    normalizedMessage.includes("jwt")
  ) {
    return {
      message: "Unauthorized",
      status: 401,
      code: ACCOUNT_DELETION_ERROR_CODES.AUTH_REQUIRED,
    };
  }

  if (
    status === 404 ||
    normalizedMessage.includes("not found") ||
    normalizedMessage.includes("no rows")
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
  requestId: string,
  details: SanitizedDeleteUserError,
): Response =>
  new Response(
    JSON.stringify({
      success: false,
      error: details.message,
      code: details.code,
      status: details.status,
      ...(details.stage ? { stage: details.stage } : {}),
      ...(details.failureReason
        ? { failureReason: details.failureReason }
        : {}),
      requestId,
    }),
    {
      status: details.status,
      headers: buildRequestHeaders(corsHeaders, requestId),
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

const listStorageDirectoryEntries = async (
  supabase: SupabaseAdminClient,
  bucket: string,
  prefix: string,
  waitForRetry: (ms: number) => Promise<void>,
): Promise<StorageListEntry[]> => {
  const entries: StorageListEntry[] = [];

  for (let offset = 0;; offset += STORAGE_LIST_PAGE_SIZE) {
    let pageEntries: StorageListEntry[] = [];

    await runDeleteStepWithRetry(
      `storage list ${bucket}/${prefix || "."}`,
      async () => {
        const { data, error } = await supabase.storage.from(bucket).list(
          prefix,
          {
            limit: STORAGE_LIST_PAGE_SIZE,
            offset,
            sortBy: { column: "name", order: "asc" },
          },
        );

        if (error) {
          if (isStorageMissingObjectError(error)) {
            pageEntries = [];
            return;
          }

          throw error;
        }

        pageEntries = Array.isArray(data) ? data as StorageListEntry[] : [];
      },
      ACCOUNT_DELETION_ERROR_CODES.BACKEND_UNAVAILABLE,
      waitForRetry,
    );

    entries.push(...pageEntries);

    if (pageEntries.length < STORAGE_LIST_PAGE_SIZE) {
      break;
    }
  }

  return entries;
};

const collectStoragePathsUnderPrefix = async (
  supabase: SupabaseAdminClient,
  bucket: string,
  prefix: string,
  waitForRetry: (ms: number) => Promise<void>,
): Promise<string[]> => {
  const entries = await listStorageDirectoryEntries(
    supabase,
    bucket,
    prefix,
    waitForRetry,
  );
  const filePaths: string[] = [];
  const folderPaths: string[] = [];

  for (const entry of entries) {
    const entryName = getStorageEntryName(entry);
    if (!entryName) {
      continue;
    }

    const fullPath = buildStoragePath(prefix, entryName);
    if (isStorageFolderEntry(entry)) {
      folderPaths.push(fullPath);
      continue;
    }

    filePaths.push(fullPath);
  }

  for (const folderPath of folderPaths) {
    filePaths.push(
      ...await collectStoragePathsUnderPrefix(
        supabase,
        bucket,
        folderPath,
        waitForRetry,
      ),
    );
  }

  return filePaths;
};

const collectStoragePathsByFileName = async (
  supabase: SupabaseAdminClient,
  bucket: string,
  prefix: string,
  userId: string,
  matchesFileName: (fileName: string, userId: string) => boolean,
  waitForRetry: (ms: number) => Promise<void>,
): Promise<string[]> => {
  const entries = await listStorageDirectoryEntries(
    supabase,
    bucket,
    prefix,
    waitForRetry,
  );
  const filePaths: string[] = [];

  for (const entry of entries) {
    if (isStorageFolderEntry(entry)) {
      continue;
    }

    const entryName = getStorageEntryName(entry);
    if (!entryName || !matchesFileName(entryName, userId)) {
      continue;
    }

    filePaths.push(buildStoragePath(prefix, entryName));
  }

  return filePaths;
};

const removeStoragePaths = async (
  supabase: SupabaseAdminClient,
  bucket: string,
  paths: string[],
  waitForRetry: (ms: number) => Promise<void>,
): Promise<void> => {
  const uniquePaths = Array.from(new Set(paths));

  for (
    let index = 0;
    index < uniquePaths.length;
    index += STORAGE_REMOVE_BATCH_SIZE
  ) {
    const batch = uniquePaths.slice(index, index + STORAGE_REMOVE_BATCH_SIZE);

    await runDeleteStepWithRetry(
      `storage remove ${bucket}`,
      async () => {
        const { error } = await supabase.storage.from(bucket).remove(batch);
        if (error && !isStorageMissingObjectError(error)) {
          throw error;
        }
      },
      ACCOUNT_DELETION_ERROR_CODES.BACKEND_UNAVAILABLE,
      waitForRetry,
    );
  }
};

const getStorageObjectBucketId = (
  entry: StorageObjectOwnershipEntry,
): string | undefined => asString(entry?.bucket_id);

const getRegisteredStorageAssetPath = (
  entry: RegisteredStorageAssetEntry,
): string | undefined => asString(entry?.storage_path);

const getStorageEntryKey = (entry: { bucket: string; path: string }): string =>
  `${entry.bucket}:${entry.path}`;

const listRegisteredStorageAssets = async (
  supabase: SupabaseAdminClient,
  userId: string,
  waitForRetry: (ms: number) => Promise<void>,
): Promise<Array<{ bucket: string; path: string }>> => {
  const entries: Array<{ bucket: string; path: string }> = [];

  for (let offset = 0;; offset += STORAGE_LIST_PAGE_SIZE) {
    let pageEntries: RegisteredStorageAssetEntry[] = [];

    await runDeleteStepWithRetry(
      "user_storage_assets query",
      async () => {
        const { data, error } = await supabase
          .from("user_storage_assets")
          .select("bucket_id,storage_path")
          .eq("user_id", userId)
          .order("bucket_id", { ascending: true })
          .order("storage_path", { ascending: true })
          .range(offset, offset + STORAGE_LIST_PAGE_SIZE - 1);

        if (error) {
          const errorText = getNormalizedErrorText(error);
          if (
            errorText.includes("user storage assets") &&
            (
              errorText.includes("does not exist") ||
              errorText.includes("schema cache")
            )
          ) {
            pageEntries = [];
            return;
          }
          throw error;
        }

        pageEntries = Array.isArray(data)
          ? data as RegisteredStorageAssetEntry[]
          : [];
      },
      ACCOUNT_DELETION_ERROR_CODES.BACKEND_UNAVAILABLE,
      waitForRetry,
    );

    for (const entry of pageEntries) {
      const bucket = getStorageObjectBucketId(entry);
      const path = getRegisteredStorageAssetPath(entry);

      if (!bucket || !path) {
        continue;
      }

      entries.push({ bucket, path });
    }

    if (pageEntries.length < STORAGE_LIST_PAGE_SIZE) {
      break;
    }
  }

  return entries;
};

const listOwnedStorageObjectsForColumn = async (
  supabase: SupabaseAdminClient,
  userId: string,
  ownershipColumn: "owner" | "owner_id",
  waitForRetry: (ms: number) => Promise<void>,
): Promise<Array<{ bucket: string; path: string }>> => {
  const entries: Array<{ bucket: string; path: string }> = [];

  for (let offset = 0;; offset += STORAGE_LIST_PAGE_SIZE) {
    let pageEntries: StorageObjectOwnershipEntry[] = [];

    await runDeleteStepWithRetry(
      `storage ownership query ${ownershipColumn}`,
      async () => {
        const { data, error } = await supabase
          .schema("storage")
          .from("objects")
          .select("bucket_id,name")
          .eq(ownershipColumn, userId)
          .order("bucket_id", { ascending: true })
          .order("name", { ascending: true })
          .range(offset, offset + STORAGE_LIST_PAGE_SIZE - 1);

        if (error) {
          if (isMissingStorageOwnershipColumnError(error, ownershipColumn)) {
            console.warn(
              `[delete-user] storage ownership query (${ownershipColumn}) skipped because the column is unavailable`,
              {
                ...describeError(error),
              },
            );
            pageEntries = [];
            return;
          }

          // Classify RLS / permission errors without retrying. The top-level
          // deletion flow degrades storage cleanup to a warning and continues
          // into the database fallback so users are not blocked from deleting
          // their own account.
          const errorText = getNormalizedErrorText(error);
          if (
            getErrorStatus(error) === 403 ||
            errorText.includes("permission denied") ||
            errorText.includes("rls") ||
            errorText.includes("policy")
          ) {
            console.error(
              `[delete-user] storage ownership query (${ownershipColumn}) blocked by permissions`,
              {
                ...describeError(error),
              },
            );
            throw createStageFailureError(
              "storage_cleanup",
              ACCOUNT_DELETION_ERROR_CODES.STORAGE_CLEANUP_FAILED,
              error,
              "permission",
            );
          }

          throw error;
        }

        pageEntries = Array.isArray(data)
          ? data as StorageObjectOwnershipEntry[]
          : [];
      },
      ACCOUNT_DELETION_ERROR_CODES.BACKEND_UNAVAILABLE,
      waitForRetry,
    );

    for (const entry of pageEntries) {
      const bucket = getStorageObjectBucketId(entry);
      const path = getStorageEntryName(entry);

      if (!bucket || !path) {
        continue;
      }

      entries.push({ bucket, path });
    }

    if (pageEntries.length < STORAGE_LIST_PAGE_SIZE) {
      break;
    }
  }

  return entries;
};

const listOwnedStorageObjects = async (
  supabase: SupabaseAdminClient,
  userId: string,
  waitForRetry: (ms: number) => Promise<void>,
): Promise<Array<{ bucket: string; path: string }>> => {
  const dedupedEntries = new Map<string, { bucket: string; path: string }>();

  for (const ownershipColumn of ["owner", "owner_id"] as const) {
    const entries = await listOwnedStorageObjectsForColumn(
      supabase,
      userId,
      ownershipColumn,
      waitForRetry,
    );

    for (const entry of entries) {
      dedupedEntries.set(`${entry.bucket}:${entry.path}`, entry);
    }
  }

  return Array.from(dedupedEntries.values());
};

const groupStoragePathsByBucket = (
  entries: Array<{ bucket: string; path: string }>,
): Map<string, string[]> => {
  const storagePathsByBucket = new Map<string, string[]>();

  for (const entry of entries) {
    const existingPaths = storagePathsByBucket.get(entry.bucket) ?? [];
    storagePathsByBucket.set(entry.bucket, [...existingPaths, entry.path]);
  }

  return storagePathsByBucket;
};

const collectLegacyUserStoragePaths = async (
  supabase: SupabaseAdminClient,
  userId: string,
  waitForRetry: (ms: number) => Promise<void>,
): Promise<Map<string, string[]>> => {
  const storagePathsByBucket = new Map<string, string[]>();

  for (const target of LEGACY_USER_STORAGE_PREFIX_TARGETS) {
    const paths = await collectStoragePathsUnderPrefix(
      supabase,
      target.bucket,
      target.prefix(userId),
      waitForRetry,
    );

    if (paths.length === 0) {
      continue;
    }

    const existing = storagePathsByBucket.get(target.bucket) ?? [];
    storagePathsByBucket.set(target.bucket, [...existing, ...paths]);
  }

  for (const target of LEGACY_USER_STORAGE_FILTER_TARGETS) {
    const paths = await collectStoragePathsByFileName(
      supabase,
      target.bucket,
      target.prefix,
      userId,
      target.matchesFileName,
      waitForRetry,
    );

    if (paths.length === 0) {
      continue;
    }

    const existing = storagePathsByBucket.get(target.bucket) ?? [];
    storagePathsByBucket.set(target.bucket, [...existing, ...paths]);
  }

  return storagePathsByBucket;
};

const removeStoragePathsByBucket = async (
  supabase: SupabaseAdminClient,
  storagePathsByBucket: Map<string, string[]>,
  waitForRetry: (ms: number) => Promise<void>,
): Promise<void> => {
  for (const [bucket, paths] of storagePathsByBucket.entries()) {
    console.log("[delete-user] removing storage assets", {
      bucket,
      count: paths.length,
    });
    await removeStoragePaths(supabase, bucket, paths, waitForRetry);
  }
};

const summarizeOwnedStorageObjects = (
  entries: Array<{ bucket: string; path: string }>,
): Record<string, number> =>
  entries.reduce<Record<string, number>>((summary, entry) => {
    summary[entry.bucket] = (summary[entry.bucket] ?? 0) + 1;
    return summary;
  }, {});

const getStorageDeadlineOverrun = (
  startTime: number,
  phase: string,
): { elapsed: number; message: string; phase: string } | null => {
  const elapsed = Date.now() - startTime;
  if (elapsed <= STORAGE_CLEANUP_DEADLINE_MS) {
    return null;
  }

  return {
    elapsed,
    phase,
    message: `Storage cleanup timed out during ${phase} after ${elapsed}ms`,
  };
};

const deleteOwnedStorageObjectsDirectly = async (
  supabase: SupabaseAdminClient,
  userId: string,
  waitForRetry: (ms: number) => Promise<void>,
): Promise<void> => {
  for (const ownershipColumn of ["owner", "owner_id"] as const) {
    await runDeleteStepWithRetry(
      `storage.objects direct delete (${ownershipColumn})`,
      async () => {
        const { error } = await supabase
          .schema("storage")
          .from("objects")
          .delete()
          .eq(ownershipColumn, userId);

        if (error) {
          throw error;
        }
      },
      ACCOUNT_DELETION_ERROR_CODES.BACKEND_UNAVAILABLE,
      waitForRetry,
    );
  }
};

const deleteUserStorageAssets = async (
  supabase: SupabaseAdminClient,
  userId: string,
  waitForRetry: (ms: number) => Promise<void>,
): Promise<string[]> => {
  const storageWarnings: string[] = [];
  const storageStartTime = Date.now();
  const stopForStorageDeadline = (phase: string): boolean => {
    const deadlineOverrun = getStorageDeadlineOverrun(storageStartTime, phase);
    if (!deadlineOverrun) {
      return false;
    }

    console.warn(
      "[delete-user] storage cleanup deadline reached — continuing with account deletion",
      {
        userId,
        phase: deadlineOverrun.phase,
        elapsed: deadlineOverrun.elapsed,
        deadlineMs: STORAGE_CLEANUP_DEADLINE_MS,
      },
    );
    storageWarnings.push(deadlineOverrun.message);
    return true;
  };

  const registeredStorageAssets = await listRegisteredStorageAssets(
    supabase,
    userId,
    waitForRetry,
  );
  if (stopForStorageDeadline("registry query")) {
    return storageWarnings;
  }

  const registeredStoragePathsByBucket = groupStoragePathsByBucket(
    registeredStorageAssets,
  );
  const registeredAssetKeys = new Set(
    registeredStorageAssets.map(getStorageEntryKey),
  );

  if (registeredStorageAssets.length > 0) {
    console.log("[delete-user] removing registered storage assets", {
      userId,
      count: registeredStorageAssets.length,
      buckets: summarizeOwnedStorageObjects(registeredStorageAssets),
    });
  }

  await removeStoragePathsByBucket(
    supabase,
    registeredStoragePathsByBucket,
    waitForRetry,
  );
  if (stopForStorageDeadline("registry removal")) {
    return storageWarnings;
  }

  const legacyStoragePathsByBucket = await collectLegacyUserStoragePaths(
    supabase,
    userId,
    waitForRetry,
  );
  if (stopForStorageDeadline("legacy collection")) {
    return storageWarnings;
  }

  const legacyEntries = Array.from(legacyStoragePathsByBucket.entries())
    .flatMap(([bucket, paths]) => paths.map((path) => ({ bucket, path })));
  const unregisteredLegacyEntries = legacyEntries.filter((entry) =>
    !registeredAssetKeys.has(getStorageEntryKey(entry))
  );

  if (unregisteredLegacyEntries.length > 0) {
    console.warn(
      "[delete-user] legacy fallback discovered unregistered storage assets",
      {
        userId,
        count: unregisteredLegacyEntries.length,
        buckets: summarizeOwnedStorageObjects(unregisteredLegacyEntries),
      },
    );
  }

  await removeStoragePathsByBucket(
    supabase,
    legacyStoragePathsByBucket,
    waitForRetry,
  );
  if (stopForStorageDeadline("legacy removal")) {
    return storageWarnings;
  }

  // Validate legacy storage was actually removed by re-collecting and checking
  if (legacyStoragePathsByBucket.size > 0) {
    const remainingLegacyPaths = await collectLegacyUserStoragePaths(
      supabase,
      userId,
      waitForRetry,
    );
    const remainingLegacyCount = Array.from(remainingLegacyPaths.values())
      .reduce(
        (sum, paths) => sum + paths.length,
        0,
      );

    if (remainingLegacyCount > 0) {
      const remainingSummary: Record<string, number> = {};
      for (const [bucket, paths] of remainingLegacyPaths.entries()) {
        remainingSummary[bucket] = paths.length;
      }
      // Demoted from fatal error to warning — the ownership sweep that follows
      // will catch any stragglers, and orphaned files should not block deletion.
      console.warn(
        "[delete-user] legacy storage paths remain after cleanup — continuing",
        {
          userId,
          buckets: remainingSummary,
        },
      );
      storageWarnings.push(
        `Legacy storage paths remain after cleanup: ${
          JSON.stringify(remainingSummary)
        }`,
      );
    }
  }

  if (stopForStorageDeadline("legacy validation")) {
    return storageWarnings;
  }

  const ownedStorageObjects = await listOwnedStorageObjects(
    supabase,
    userId,
    waitForRetry,
  );
  if (stopForStorageDeadline("ownership query")) {
    return storageWarnings;
  }

  const ownedStoragePathsByBucket = groupStoragePathsByBucket(
    ownedStorageObjects,
  );
  const unregisteredOwnedObjects = ownedStorageObjects.filter((entry) =>
    !registeredAssetKeys.has(getStorageEntryKey(entry))
  );

  if (ownedStorageObjects.length > 0) {
    console.log("[delete-user] removing owned storage objects", {
      userId,
      count: ownedStorageObjects.length,
      buckets: summarizeOwnedStorageObjects(ownedStorageObjects),
    });
  }

  if (unregisteredOwnedObjects.length > 0) {
    console.warn(
      "[delete-user] ownership fallback discovered unregistered storage assets",
      {
        userId,
        count: unregisteredOwnedObjects.length,
        buckets: summarizeOwnedStorageObjects(unregisteredOwnedObjects),
        samplePaths: unregisteredOwnedObjects.slice(0, 10),
      },
    );
  }

  await removeStoragePathsByBucket(
    supabase,
    ownedStoragePathsByBucket,
    waitForRetry,
  );
  if (stopForStorageDeadline("ownership removal")) {
    return storageWarnings;
  }

  let remainingOwnedObjects = await listOwnedStorageObjects(
    supabase,
    userId,
    waitForRetry,
  );
  if (remainingOwnedObjects.length > 0) {
    console.warn(
      "[delete-user] owned storage objects remain after Storage API remove — attempting direct delete",
      {
        userId,
        buckets: summarizeOwnedStorageObjects(remainingOwnedObjects),
        samplePaths: remainingOwnedObjects.slice(0, 10),
      },
    );

    try {
      await deleteOwnedStorageObjectsDirectly(supabase, userId, waitForRetry);
      if (stopForStorageDeadline("direct delete")) {
        return storageWarnings;
      }

      remainingOwnedObjects = await listOwnedStorageObjects(
        supabase,
        userId,
        waitForRetry,
      );
    } catch (directDeleteError) {
      console.warn(
        "[delete-user] direct storage.objects delete failed — continuing",
        {
          userId,
          ...describeError(directDeleteError),
        },
      );
    }

    if (remainingOwnedObjects.length > 0) {
      const remainingSummary = summarizeOwnedStorageObjects(
        remainingOwnedObjects,
      );
      console.warn(
        "[delete-user] owned storage objects still remain after fallback — continuing",
        {
          userId,
          buckets: remainingSummary,
          samplePaths: remainingOwnedObjects.slice(0, 10),
        },
      );
      storageWarnings.push(
        `Owned storage objects remain after cleanup: ${
          JSON.stringify(remainingSummary)
        }`,
      );
    }
  }

  return storageWarnings;
};

export const handleDeleteUser = async (
  req: Request,
  dependencies: HandleDeleteUserDependencies = {},
): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const requestId = crypto.randomUUID();
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: buildRequestHeaders(corsHeaders, requestId),
    });
  }

  try {
    const env = dependencies.env ?? Deno.env;
    const adminClientFactory = dependencies.createAdminClient ??
      createAdminClient;
    const waitForRetry = dependencies.sleep ?? sleep;

    const supabaseUrl = env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[delete-user] missing required env", {
        requestId,
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      });
      throw createTemporaryUnavailableError(
        ACCOUNT_DELETION_ERROR_CODES.CONFIG_ERROR,
      );
    }

    const supabase = adminClientFactory(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse(
        corsHeaders,
        requestId,
        sanitizeError(createUnauthorizedError()),
      );
    }

    const token = authHeader.replace("Bearer", "").trim();
    if (!token) {
      return createErrorResponse(
        corsHeaders,
        requestId,
        sanitizeError(createUnauthorizedError()),
      );
    }

    const { data: userResult, error: userError } = await supabase.auth.getUser(
      token,
    );
    if (userError) {
      console.error("[delete-user] auth.getUser failed", {
        requestId,
        ...describeError(userError),
      });
      throw createUnauthorizedError(userError);
    }

    const user = userResult?.user;
    if (!user) {
      return createErrorResponse(
        corsHeaders,
        requestId,
        sanitizeError(createUnauthorizedError()),
      );
    }

    let storageWarnings: string[] = [];
    try {
      storageWarnings = await deleteUserStorageAssets(
        supabase,
        user.id,
        waitForRetry,
      );
    } catch (error) {
      if (shouldContinueAfterStorageCleanupFailure(error)) {
        console.warn(
          "[delete-user] storage cleanup failed — continuing with database cleanup fallback",
          {
            requestId,
            userId: user.id,
            stage: "storage_cleanup",
            failureReason: classifyStorageCleanupFailureReason(error),
            ...describeError(error),
          },
        );
        storageWarnings.push(buildStorageCleanupFailureWarning(error));
      } else {
        console.error("[delete-user] storage cleanup failed", {
          requestId,
          userId: user.id,
          stage: "storage_cleanup",
          ...describeError(error),
        });
        throw createStageFailureError(
          "storage_cleanup",
          ACCOUNT_DELETION_ERROR_CODES.STORAGE_CLEANUP_FAILED,
          error,
          classifyStorageCleanupFailureReason(error),
        );
      }
    }

    try {
      await runDeleteStepWithRetry(
        "delete_user_account rpc",
        async () => {
          const { error } = await supabase.rpc("delete_user_account", {
            p_user_id: user.id,
          });
          if (error) {
            throw error;
          }
        },
        ACCOUNT_DELETION_ERROR_CODES.BACKEND_UNAVAILABLE,
        waitForRetry,
      );
    } catch (error) {
      const rpcError = getInnermostError(error);
      console.error("[delete-user] relational cleanup failed", {
        requestId,
        userId: user.id,
        stage: "relational_cleanup",
        rpcError: describeSingleError(rpcError),
        ...describeError(error),
      });
      throw createStageFailureError(
        "relational_cleanup",
        ACCOUNT_DELETION_ERROR_CODES.RELATIONAL_CLEANUP_FAILED,
        error,
      );
    }

    // Auth deletion happens after the profile and relational data are already gone.
    // If this step fails, the user's data is removed but their auth record lingers.
    // Rather than throwing (which tells the client nothing was deleted), we treat
    // auth deletion failure as a degraded success with a warning so the client can
    // navigate the user away and the orphaned auth record can be cleaned up later.
    const warnings: Array<
      { code: string; message: string; details?: unknown }
    > = [];

    for (const storageWarning of storageWarnings) {
      warnings.push({
        code: "STORAGE_CLEANUP_INCOMPLETE",
        message: storageWarning,
      });
    }

    try {
      await runDeleteStepWithRetry(
        "auth.admin.deleteUser",
        async () => {
          const { error } = await supabase.auth.admin.deleteUser(user.id);
          if (error && !isAlreadyDeletedAuthUserError(error)) {
            throw error;
          }
        },
        ACCOUNT_DELETION_ERROR_CODES.BACKEND_UNAVAILABLE,
        waitForRetry,
      );
    } catch (error) {
      console.error(
        "[delete-user] auth deletion failed after profile removal — returning degraded success",
        {
          requestId,
          userId: user.id,
          stage: "auth_delete",
          ...describeError(error),
        },
      );
      warnings.push({
        code: "AUTH_DELETE_DEFERRED",
        message:
          "Your data was deleted but sign-in record removal was delayed. It will be cleaned up automatically.",
        details: describeError(error),
      });
    }

    return new Response(
      JSON.stringify({ success: true, requestId, warnings }),
      {
        status: 200,
        headers: buildRequestHeaders(corsHeaders, requestId),
      },
    );
  } catch (error) {
    console.error("[delete-user] request failed", {
      requestId,
      ...describeError(error),
      rawError: error,
    });
    return createErrorResponse(corsHeaders, requestId, sanitizeError(error));
  }
};

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleDeleteUser(req));
}
