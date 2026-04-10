// Edge function for account deletion - v5.0
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface ErrorWithOptionalFields {
  message?: unknown;
  code?: unknown;
  name?: unknown;
  status?: unknown;
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
const STORAGE_CLEANUP_DEADLINE_MS = 8_000; // Leave headroom before edge function timeout
const LEGACY_USER_STORAGE_PREFIX_TARGETS = [
  { bucket: "quest-attachments", prefix: (userId: string) => userId },
  { bucket: "mentors-avatars", prefix: (userId: string) => userId },
  { bucket: "journey-paths", prefix: (userId: string) => userId },
  { bucket: "evolution-cards", prefix: (userId: string) => `postcards/${userId}` },
] as const;
const LEGACY_USER_STORAGE_FILTER_TARGETS = [
  {
    bucket: "journey-paths",
    prefix: "campaign-welcome",
    matchesFileName: (fileName: string, userId: string) => fileName.startsWith(`welcome-${userId}-`),
  },
] as const;

type AccountDeletionErrorCode =
  (typeof ACCOUNT_DELETION_ERROR_CODES)[keyof typeof ACCOUNT_DELETION_ERROR_CODES];
type AccountDeletionStage = "storage_cleanup" | "relational_cleanup" | "auth_delete";

interface SanitizedDeleteUserError {
  code: AccountDeletionErrorCode;
  message: string;
  status: number;
  stage?: AccountDeletionStage;
}

class AccountDeletionError extends Error {
  status: number;
  code: AccountDeletionErrorCode;
  stage?: AccountDeletionStage;

  constructor(message: string, options: {
    status: number;
    code: AccountDeletionErrorCode;
    cause?: unknown;
    stage?: AccountDeletionStage;
  }) {
    super(message);
    this.name = "AccountDeletionError";
    this.status = options.status;
    this.code = options.code;
    this.stage = options.stage;
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

interface StorageObjectOwnershipEntry {
  bucket_id?: unknown;
  name?: unknown;
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
) =>
  new AccountDeletionError(ACCOUNT_DELETION_TEMPORARILY_UNAVAILABLE_MESSAGE, {
    status: 500,
    code,
    cause,
    stage,
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

const buildRequestHeaders = (corsHeaders: HeadersInit, requestId: string): HeadersInit => ({
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

  return status === 404 || normalizedText.includes("not found") || normalizedText.includes("no rows");
};

const isAlreadyDeletedAuthUserError = (error: unknown): boolean => {
  const normalizedText = getNormalizedErrorText(error);

  return isNotFoundStyleError(error) || normalizedText.includes("user not found");
};

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
      ...(error.stage ? { stage: error.stage } : {}),
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

  for (let offset = 0; ; offset += STORAGE_LIST_PAGE_SIZE) {
    let pageEntries: StorageListEntry[] = [];

    await runDeleteStepWithRetry(
      `storage list ${bucket}/${prefix || "."}`,
      async () => {
        const { data, error } = await supabase.storage.from(bucket).list(prefix, {
          limit: STORAGE_LIST_PAGE_SIZE,
          offset,
          sortBy: { column: "name", order: "asc" },
        });

        if (error) {
          if (isNotFoundStyleError(error)) {
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
  const entries = await listStorageDirectoryEntries(supabase, bucket, prefix, waitForRetry);
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
    filePaths.push(...await collectStoragePathsUnderPrefix(supabase, bucket, folderPath, waitForRetry));
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
  const entries = await listStorageDirectoryEntries(supabase, bucket, prefix, waitForRetry);
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

  for (let index = 0; index < uniquePaths.length; index += STORAGE_REMOVE_BATCH_SIZE) {
    const batch = uniquePaths.slice(index, index + STORAGE_REMOVE_BATCH_SIZE);

    await runDeleteStepWithRetry(
      `storage remove ${bucket}`,
      async () => {
        const { error } = await supabase.storage.from(bucket).remove(batch);
        if (error && !isNotFoundStyleError(error)) {
          throw error;
        }
      },
      ACCOUNT_DELETION_ERROR_CODES.BACKEND_UNAVAILABLE,
      waitForRetry,
    );
  }
};

const getStorageObjectBucketId = (entry: StorageObjectOwnershipEntry): string | undefined =>
  asString(entry?.bucket_id);

const listOwnedStorageObjectsForColumn = async (
  supabase: SupabaseAdminClient,
  userId: string,
  ownershipColumn: "owner" | "owner_id",
  waitForRetry: (ms: number) => Promise<void>,
): Promise<Array<{ bucket: string; path: string }>> => {
  const entries: Array<{ bucket: string; path: string }> = [];

  for (let offset = 0; ; offset += STORAGE_LIST_PAGE_SIZE) {
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
          throw error;
        }

        pageEntries = Array.isArray(data) ? data as StorageObjectOwnershipEntry[] : [];
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
    const entries = await listOwnedStorageObjectsForColumn(supabase, userId, ownershipColumn, waitForRetry);

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

const checkStorageDeadline = (startTime: number, phase: string): void => {
  const elapsed = Date.now() - startTime;
  if (elapsed > STORAGE_CLEANUP_DEADLINE_MS) {
    throw createStageFailureError(
      "storage_cleanup",
      ACCOUNT_DELETION_ERROR_CODES.STORAGE_CLEANUP_FAILED,
      { message: `Storage cleanup timed out during ${phase} after ${elapsed}ms` },
    );
  }
};

const deleteUserStorageAssets = async (
  supabase: SupabaseAdminClient,
  userId: string,
  waitForRetry: (ms: number) => Promise<void>,
): Promise<void> => {
  const storageStartTime = Date.now();
  const legacyStoragePathsByBucket = await collectLegacyUserStoragePaths(supabase, userId, waitForRetry);
  await removeStoragePathsByBucket(supabase, legacyStoragePathsByBucket, waitForRetry);

  // Validate legacy storage was actually removed by re-collecting and checking
  if (legacyStoragePathsByBucket.size > 0) {
    const remainingLegacyPaths = await collectLegacyUserStoragePaths(supabase, userId, waitForRetry);
    const remainingLegacyCount = Array.from(remainingLegacyPaths.values()).reduce(
      (sum, paths) => sum + paths.length,
      0,
    );

    if (remainingLegacyCount > 0) {
      const remainingSummary: Record<string, number> = {};
      for (const [bucket, paths] of remainingLegacyPaths.entries()) {
        remainingSummary[bucket] = paths.length;
      }
      console.error("[delete-user] legacy storage paths remain after cleanup", {
        userId,
        buckets: remainingSummary,
      });
      throw createStageFailureError(
        "storage_cleanup",
        ACCOUNT_DELETION_ERROR_CODES.STORAGE_CLEANUP_FAILED,
        {
          message: "Legacy storage paths remain after cleanup",
          remainingBuckets: remainingSummary,
        },
      );
    }
  }

  const ownedStorageObjects = await listOwnedStorageObjects(supabase, userId, waitForRetry);
  const ownedStoragePathsByBucket = groupStoragePathsByBucket(ownedStorageObjects);

  if (ownedStorageObjects.length > 0) {
    console.log("[delete-user] removing owned storage objects", {
      userId,
      buckets: summarizeOwnedStorageObjects(ownedStorageObjects),
    });
  }

  await removeStoragePathsByBucket(supabase, ownedStoragePathsByBucket, waitForRetry);

  const remainingOwnedObjects = await listOwnedStorageObjects(supabase, userId, waitForRetry);
  if (remainingOwnedObjects.length > 0) {
    console.error("[delete-user] owned storage objects remain after cleanup", {
      userId,
      buckets: summarizeOwnedStorageObjects(remainingOwnedObjects),
      samplePaths: remainingOwnedObjects.slice(0, 10),
    });
    throw createStageFailureError(
      "storage_cleanup",
      ACCOUNT_DELETION_ERROR_CODES.STORAGE_CLEANUP_FAILED,
      {
        message: "Owned storage objects remain after cleanup",
        remainingBuckets: summarizeOwnedStorageObjects(remainingOwnedObjects),
      },
    );
  }
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
    const adminClientFactory = dependencies.createAdminClient ?? createAdminClient;
    const waitForRetry = dependencies.sleep ?? sleep;

    const supabaseUrl = env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[delete-user] missing required env", {
        requestId,
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      });
      throw createTemporaryUnavailableError(ACCOUNT_DELETION_ERROR_CODES.CONFIG_ERROR);
    }

    const supabase = adminClientFactory(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse(corsHeaders, requestId, sanitizeError(createUnauthorizedError()));
    }

    const token = authHeader.replace("Bearer", "").trim();
    if (!token) {
      return createErrorResponse(corsHeaders, requestId, sanitizeError(createUnauthorizedError()));
    }

    const { data: userResult, error: userError } = await supabase.auth.getUser(token);
    if (userError) {
      console.error("[delete-user] auth.getUser failed", { requestId, ...describeError(userError) });
      throw createUnauthorizedError(userError);
    }

    const user = userResult?.user;
    if (!user) {
      return createErrorResponse(corsHeaders, requestId, sanitizeError(createUnauthorizedError()));
    }

    try {
      await deleteUserStorageAssets(supabase, user.id, waitForRetry);
    } catch (error) {
      console.error("[delete-user] storage cleanup failed", {
        requestId,
        userId: user.id,
        stage: "storage_cleanup",
        ...describeError(error),
      });
      throw createStageFailureError("storage_cleanup", ACCOUNT_DELETION_ERROR_CODES.STORAGE_CLEANUP_FAILED, error);
    }

    try {
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
    } catch (error) {
      console.error("[delete-user] relational cleanup failed", {
        requestId,
        userId: user.id,
        stage: "relational_cleanup",
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
    const warnings: Array<{ code: string; message: string; details?: unknown }> = [];

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
      console.error("[delete-user] auth deletion failed after profile removal — returning degraded success", {
        requestId,
        userId: user.id,
        stage: "auth_delete",
        ...describeError(error),
      });
      warnings.push({
        code: "AUTH_DELETE_DEFERRED",
        message: "Your data was deleted but sign-in record removal was delayed. It will be cleaned up automatically.",
        details: describeError(error),
      });
    }

    return new Response(JSON.stringify({ success: true, requestId, warnings }), {
      status: 200,
      headers: buildRequestHeaders(corsHeaders, requestId),
    });
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
