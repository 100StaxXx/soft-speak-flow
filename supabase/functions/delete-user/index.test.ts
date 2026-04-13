function assertEquals<T>(
  actual: T,
  expected: T,
  message = "Expected values to match",
): void {
  if (actual !== expected) {
    throw new Error(
      `${message}\nExpected: ${JSON.stringify(expected)}\nReceived: ${
        JSON.stringify(actual)
      }`,
    );
  }
}

function assertArrayEquals<T>(
  actual: T[],
  expected: T[],
  message = "Expected arrays to match",
): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(
      `${message}\nExpected: ${expectedJson}\nReceived: ${actualJson}`,
    );
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const module = await import("./index.ts");

const SUPABASE_URL = "https://example.supabase.co";
const SERVICE_ROLE_KEY = "service-role-key";
const USER_ID = "user-1";

const createEnv = () => ({
  get(key: string): string | undefined {
    if (key === "SUPABASE_URL") return SUPABASE_URL;
    if (key === "SUPABASE_SERVICE_ROLE_KEY") return SERVICE_ROLE_KEY;
    return undefined;
  },
});

const createRequest = (authorization = "Bearer test-token") =>
  new Request(`${SUPABASE_URL}/functions/v1/delete-user`, {
    method: "POST",
    headers: authorization
      ? new Headers({ Authorization: authorization })
      : undefined,
  });

type RpcResult = { error: unknown | null };
type AuthDeleteResult = { error: unknown | null };
type StorageListEntry = { name: string; id: string | null };
type StorageListResult = { data: StorageListEntry[]; error: unknown | null };
type StorageRemoveResult = { error: unknown | null };
type OwnedStorageObject = {
  bucket: string;
  path: string;
  owner?: string | null;
  owner_id?: string | null;
};

const createRpcResult = (error: unknown | null = null): RpcResult => ({
  error,
});
const createAuthDeleteResult = (
  error: unknown | null = null,
): AuthDeleteResult => ({ error });
const createStorageListResult = (
  data: StorageListEntry[] = [],
  error: unknown | null = null,
): StorageListResult => ({
  data,
  error,
});
const createStorageRemoveResult = (
  error: unknown | null = null,
): StorageRemoveResult => ({ error });

const createHandleDeleteUserHarness = ({
  rpcResults = [createRpcResult()],
  authDeleteResults = [createAuthDeleteResult()],
  getUserResult,
  listResultsByKey = {},
  removeResults = [createStorageRemoveResult()],
  ownedStorageObjects = [],
  persistOwnedStorageObjectsAfterRemove = false,
}: {
  rpcResults?: RpcResult[];
  authDeleteResults?: AuthDeleteResult[];
  getUserResult?: {
    data: { user: { id: string } | null } | null;
    error: unknown | null;
  };
  listResultsByKey?: Record<string, StorageListResult[]>;
  removeResults?: StorageRemoveResult[];
  ownedStorageObjects?: OwnedStorageObject[];
  persistOwnedStorageObjectsAfterRemove?: boolean;
} = {}) => {
  let rpcCallCount = 0;
  let authDeleteCallCount = 0;
  let removeCallCount = 0;
  const listCallCountByKey = new Map<string, number>();
  const sleepCalls: number[] = [];
  const operations: string[] = [];
  const removeCalls: Array<{ bucket: string; paths: string[] }> = [];
  let remainingOwnedStorageObjects = [...ownedStorageObjects];

  const getListResult = (
    bucket: string,
    prefix: string,
    offset: number,
  ): StorageListResult => {
    const key = `${bucket}:${prefix}:${offset}`;
    const results = listResultsByKey[key] ?? [createStorageListResult()];
    const currentCallCount = listCallCountByKey.get(key) ?? 0;
    listCallCountByKey.set(key, currentCallCount + 1);
    return results[Math.min(currentCallCount, results.length - 1)];
  };

  const createStorageObjectsQueryBuilder = () => {
    let ownershipColumn: "owner" | "owner_id" | null = null;
    let ownershipValue: string | null = null;

    const builder = {
      select: (_columns: string) => builder,
      eq: (column: "owner" | "owner_id", value: string) => {
        ownershipColumn = column;
        ownershipValue = value;
        return builder;
      },
      order: (_column: string, _options?: { ascending?: boolean }) => builder,
      range: async (from: number, to: number) => {
        operations.push(
          `storage.objects.select:${ownershipColumn ?? "none"}:${
            ownershipValue ?? "none"
          }:${from}-${to}`,
        );

        const matchingObjects = remainingOwnedStorageObjects
          .filter((entry) => {
            if (!ownershipColumn || !ownershipValue) return false;
            return entry[ownershipColumn] === ownershipValue;
          })
          .sort((left, right) => {
            if (left.bucket === right.bucket) {
              return left.path.localeCompare(right.path);
            }
            return left.bucket.localeCompare(right.bucket);
          })
          .slice(from, to + 1)
          .map((entry) => ({
            bucket_id: entry.bucket,
            name: entry.path,
          }));

        return { data: matchingObjects, error: null };
      },
    };

    return builder;
  };

  const client = {
    auth: {
      getUser: async () => {
        operations.push("auth.getUser");
        return getUserResult ?? {
          data: { user: { id: USER_ID } },
          error: null,
        };
      },
      admin: {
        deleteUser: async () => {
          operations.push("auth.admin.deleteUser");
          return authDeleteResults[
            Math.min(authDeleteCallCount++, authDeleteResults.length - 1)
          ];
        },
      },
    },
    storage: {
      from: (bucket: string) => ({
        list: async (prefix = "", options?: { offset?: number }) => {
          const offset = options?.offset ?? 0;
          operations.push(`storage.list:${bucket}:${prefix}:${offset}`);
          return getListResult(bucket, prefix, offset);
        },
        remove: async (paths: string[]) => {
          operations.push(`storage.remove:${bucket}:${paths.join(",")}`);
          removeCalls.push({ bucket, paths });
          const result = removeResults[
            Math.min(removeCallCount++, removeResults.length - 1)
          ];
          if (!result.error && !persistOwnedStorageObjectsAfterRemove) {
            remainingOwnedStorageObjects = remainingOwnedStorageObjects.filter((
              entry,
            ) => !(entry.bucket === bucket && paths.includes(entry.path)));
          }
          return result;
        },
      }),
    },
    schema: (schemaName: string) => ({
      from: (tableName: string) => {
        if (schemaName !== "storage" || tableName !== "objects") {
          throw new Error(
            `Unexpected schema/table query: ${schemaName}.${tableName}`,
          );
        }

        return createStorageObjectsQueryBuilder();
      },
    }),
    rpc: async () => {
      operations.push("rpc.delete_user_account");
      return rpcResults[Math.min(rpcCallCount++, rpcResults.length - 1)];
    },
  };

  const dependencies = {
    env: createEnv(),
    createAdminClient: () => client as never,
    sleep: async (ms: number) => {
      sleepCalls.push(ms);
    },
  };

  return {
    dependencies,
    getRpcCallCount: () => rpcCallCount,
    getAuthDeleteCallCount: () => authDeleteCallCount,
    getRemoveCallCount: () => removeCallCount,
    sleepCalls,
    operations,
    removeCalls,
    getRemainingOwnedStorageObjects: () => remainingOwnedStorageObjects,
  };
};

Deno.test("delete-user removes legacy storage assets before rpc and auth delete", async () => {
  const harness = createHandleDeleteUserHarness({
    listResultsByKey: {
      "journey-paths:user-1:0": [
        createStorageListResult([{ name: "epic-1", id: null }]),
      ],
      "journey-paths:user-1/epic-1:0": [
        createStorageListResult([{ name: "0.png", id: "file-1" }]),
      ],
      "journey-paths:campaign-welcome:0": [
        createStorageListResult([
          { name: "welcome-user-1-123.png", id: "file-2" },
          { name: "welcome-other-user-456.png", id: "file-3" },
        ]),
      ],
      "evolution-cards:postcards/user-1:0": [
        createStorageListResult([{ name: "card.png", id: "file-4" }]),
      ],
      "quest-attachments:user-1:0": [
        createStorageListResult([{ name: "attachment.png", id: "file-5" }]),
      ],
    },
  });

  const response = await module.handleDeleteUser(
    createRequest(),
    harness.dependencies,
  );
  const body = await response.json();

  assertEquals(response.status, 200, "Expected delete-user to succeed");
  assertEquals(body.success, true, "Expected success response body");
  assert(
    typeof body.requestId === "string" && body.requestId.length > 0,
    "Expected a requestId on success",
  );
  assertEquals(
    harness.getRpcCallCount(),
    1,
    "Expected rpc deletion to run once",
  );
  assertEquals(
    harness.getAuthDeleteCallCount(),
    1,
    "Expected auth deletion to run once",
  );
  assertArrayEquals(
    harness.removeCalls,
    [
      { bucket: "quest-attachments", paths: ["user-1/attachment.png"] },
      {
        bucket: "journey-paths",
        paths: [
          "user-1/epic-1/0.png",
          "campaign-welcome/welcome-user-1-123.png",
        ],
      },
      { bucket: "evolution-cards", paths: ["postcards/user-1/card.png"] },
    ],
    "Expected matching storage assets to be removed before deletion",
  );

  const firstRemoveIndex = harness.operations.findIndex((entry) =>
    entry.startsWith("storage.remove:")
  );
  const rpcIndex = harness.operations.indexOf("rpc.delete_user_account");
  const authDeleteIndex = harness.operations.indexOf("auth.admin.deleteUser");
  assert(firstRemoveIndex !== -1, "Expected storage removal to occur");
  assert(rpcIndex !== -1, "Expected rpc deletion to occur");
  assert(authDeleteIndex !== -1, "Expected auth deletion to occur");
  assert(
    firstRemoveIndex < rpcIndex,
    "Expected storage cleanup before rpc deletion",
  );
  assert(
    rpcIndex < authDeleteIndex,
    "Expected rpc deletion before auth deletion",
  );
});

Deno.test("delete-user removes owned storage objects across multiple buckets even when prefix discovery misses them", async () => {
  const harness = createHandleDeleteUserHarness({
    ownedStorageObjects: [
      {
        bucket: "quest-attachments",
        path: "user-1/owned-upload.png",
        owner: USER_ID,
      },
      {
        bucket: "quest-attachments",
        path: "user-1/owned-upload-2.png",
        owner_id: USER_ID,
      },
      {
        bucket: "evolution-cards",
        path: "postcards/user-1/fallback-card.png",
        owner_id: USER_ID,
      },
    ],
  });

  const response = await module.handleDeleteUser(
    createRequest(),
    harness.dependencies,
  );
  const body = await response.json();

  assertEquals(
    response.status,
    200,
    "Expected delete-user to succeed after ownership sweep cleanup",
  );
  assertEquals(body.success, true, "Expected success response body");
  assertEquals(
    harness.getRpcCallCount(),
    1,
    "Expected rpc deletion to run once",
  );
  assertEquals(
    harness.getAuthDeleteCallCount(),
    1,
    "Expected auth deletion to run once",
  );
  assertEquals(
    harness.getRemainingOwnedStorageObjects().length,
    0,
    "Expected ownership sweep to clear all owned objects",
  );
  assert(
    harness.removeCalls.some((call) =>
      call.bucket === "quest-attachments" &&
      call.paths.includes("user-1/owned-upload.png") &&
      call.paths.includes("user-1/owned-upload-2.png")
    ),
    "Expected quest-attachments owned objects to be removed from the ownership sweep",
  );
  assert(
    harness.removeCalls.some((call) =>
      call.bucket === "evolution-cards" &&
      call.paths.includes("postcards/user-1/fallback-card.png")
    ),
    "Expected multi-bucket owned objects to be removed from the ownership sweep",
  );
});

Deno.test("delete-user retries transient storage removal failures and succeeds", async () => {
  const harness = createHandleDeleteUserHarness({
    listResultsByKey: {
      "quest-attachments:user-1:0": [
        createStorageListResult([{ name: "attachment.png", id: "file-1" }]),
      ],
    },
    removeResults: [
      createStorageRemoveResult({
        status: 503,
        message: "Service unavailable",
      }),
      createStorageRemoveResult(),
    ],
  });

  const response = await module.handleDeleteUser(
    createRequest(),
    harness.dependencies,
  );
  const body = await response.json();

  assertEquals(
    response.status,
    200,
    "Expected delete-user to succeed after retrying storage removal",
  );
  assertEquals(body.success, true, "Expected success response body");
  assertEquals(
    harness.getRemoveCallCount(),
    2,
    "Expected storage removal to retry once",
  );
  assertArrayEquals(
    harness.sleepCalls,
    [500],
    "Expected retry backoff after transient storage failure",
  );
});

Deno.test("delete-user returns a storage_cleanup stage failure when owned objects remain after cleanup", async () => {
  const harness = createHandleDeleteUserHarness({
    ownedStorageObjects: [
      {
        bucket: "quest-attachments",
        path: "user-1/stuck-upload.png",
        owner: USER_ID,
      },
    ],
    persistOwnedStorageObjectsAfterRemove: true,
  });

  const response = await module.handleDeleteUser(
    createRequest(),
    harness.dependencies,
  );
  const body = await response.json();

  assertEquals(
    response.status,
    500,
    "Expected lingering owned objects to fail account deletion",
  );
  assertEquals(body.success, false, "Expected failure response body");
  assertEquals(
    body.code,
    "ACCOUNT_DELETION_STORAGE_CLEANUP_FAILED",
    "Expected storage cleanup error code",
  );
  assertEquals(body.stage, "storage_cleanup", "Expected storage cleanup stage");
  assert(
    typeof body.requestId === "string" && body.requestId.length > 0,
    "Expected a requestId on failure",
  );
  assertEquals(
    harness.getRpcCallCount(),
    0,
    "Expected rpc deletion not to run when storage cleanup fails",
  );
  assertEquals(
    harness.getAuthDeleteCallCount(),
    0,
    "Expected auth deletion not to run when storage cleanup fails",
  );
});

Deno.test("delete-user retries transient rpc failures and succeeds", async () => {
  const harness = createHandleDeleteUserHarness({
    rpcResults: [
      createRpcResult({ status: 503, message: "Service unavailable" }),
      createRpcResult({ message: "network connection reset by peer" }),
      createRpcResult(),
    ],
  });

  const response = await module.handleDeleteUser(
    createRequest(),
    harness.dependencies,
  );
  const body = await response.json();

  assertEquals(
    response.status,
    200,
    "Expected delete-user to succeed after retrying rpc failures",
  );
  assertEquals(body.success, true, "Expected success response body");
  assertEquals(
    harness.getRpcCallCount(),
    3,
    "Expected rpc step to be attempted three times",
  );
  assertArrayEquals(
    harness.sleepCalls,
    [500, 1500],
    "Expected rpc retries to use the configured backoff",
  );
});

Deno.test("delete-user retries transient auth delete failures and succeeds", async () => {
  const harness = createHandleDeleteUserHarness({
    authDeleteResults: [
      createAuthDeleteResult({ status: 503, message: "Service unavailable" }),
      createAuthDeleteResult(),
    ],
  });

  const response = await module.handleDeleteUser(
    createRequest(),
    harness.dependencies,
  );
  const body = await response.json();

  assertEquals(
    response.status,
    200,
    "Expected delete-user to succeed after retrying auth deletion",
  );
  assertEquals(body.success, true, "Expected success response body");
  assertEquals(
    harness.getAuthDeleteCallCount(),
    2,
    "Expected auth deletion to retry once",
  );
  assertArrayEquals(
    harness.sleepCalls,
    [500],
    "Expected retry backoff after transient auth deletion failure",
  );
});

Deno.test("delete-user treats an already deleted auth user as a success", async () => {
  const harness = createHandleDeleteUserHarness({
    authDeleteResults: [
      createAuthDeleteResult({ status: 404, message: "User not found" }),
    ],
  });

  const response = await module.handleDeleteUser(
    createRequest(),
    harness.dependencies,
  );
  const body = await response.json();

  assertEquals(
    response.status,
    200,
    "Expected missing auth users to be treated as already deleted",
  );
  assertEquals(body.success, true, "Expected success response body");
  assertEquals(
    harness.getAuthDeleteCallCount(),
    1,
    "Expected auth deletion to run once",
  );
  assertArrayEquals(
    harness.sleepCalls,
    [],
    "Expected no retry delay for already-deleted auth users",
  );
});

Deno.test("delete-user returns a relational_cleanup stage failure for rpc errors", async () => {
  const harness = createHandleDeleteUserHarness({
    rpcResults: [
      createRpcResult({
        status: 400,
        message: "violates foreign key constraint",
      }),
    ],
  });

  const response = await module.handleDeleteUser(
    createRequest(),
    harness.dependencies,
  );
  const body = await response.json();

  assertEquals(
    response.status,
    500,
    "Expected rpc failures to become relational cleanup errors",
  );
  assertEquals(body.success, false, "Expected failure response body");
  assertEquals(
    body.code,
    "ACCOUNT_DELETION_RELATIONAL_CLEANUP_FAILED",
    "Expected relational cleanup error code",
  );
  assertEquals(
    body.stage,
    "relational_cleanup",
    "Expected relational cleanup stage",
  );
  assertEquals(
    harness.getRpcCallCount(),
    1,
    "Expected no retry for terminal rpc failures",
  );
  assertArrayEquals(
    harness.sleepCalls,
    [],
    "Expected no retry delay for terminal rpc failures",
  );
});

Deno.test("delete-user logs rpc message details and hint for relational cleanup failures", async () => {
  const harness = createHandleDeleteUserHarness({
    rpcResults: [
      createRpcResult({
        status: 400,
        code: "23503",
        message:
          'update or delete on table "profiles" violates foreign key constraint "fk_profiles_blocker"',
        details:
          'Key (id)=(user-1) is still referenced from table "blocking_table".',
        hint: "Delete the dependent row first.",
      }),
    ],
  });

  const originalConsoleError = console.error;
  const errorCalls: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    errorCalls.push(args);
  };

  try {
    const response = await module.handleDeleteUser(
      createRequest(),
      harness.dependencies,
    );
    const body = await response.json();

    assertEquals(
      response.status,
      500,
      "Expected rpc failure to surface as relational cleanup failure",
    );
    assertEquals(
      body.stage,
      "relational_cleanup",
      "Expected relational cleanup stage",
    );
  } finally {
    console.error = originalConsoleError;
  }

  const relationalCleanupCall = errorCalls.find((call) =>
    call[0] === "[delete-user] relational cleanup failed"
  );
  assert(
    relationalCleanupCall,
    "Expected a relational cleanup failure log entry",
  );

  const payload = relationalCleanupCall[1] as Record<string, unknown>;
  const rpcError = payload.rpcError as Record<string, unknown>;
  assert(
    rpcError,
    "Expected the log payload to include extracted rpcError details",
  );
  assertEquals(
    rpcError.message,
    'update or delete on table "profiles" violates foreign key constraint "fk_profiles_blocker"',
  );
  assertEquals(
    rpcError.details,
    'Key (id)=(user-1) is still referenced from table "blocking_table".',
  );
  assertEquals(rpcError.hint, "Delete the dependent row first.");
  assertEquals(rpcError.code, "23503");
});

Deno.test("delete-user returns degraded success with warning when auth admin deletion fails after profile removal", async () => {
  const harness = createHandleDeleteUserHarness({
    authDeleteResults: [
      createAuthDeleteResult({ status: 400, message: "delete blocked" }),
    ],
  });

  const response = await module.handleDeleteUser(
    createRequest(),
    harness.dependencies,
  );
  const body = await response.json();

  assertEquals(
    response.status,
    200,
    "Expected degraded success when auth delete fails after profile is gone",
  );
  assertEquals(
    body.success,
    true,
    "Expected success response since profile data was deleted",
  );
  assert(Array.isArray(body.warnings), "Expected warnings array in response");
  assert(
    body.warnings.length > 0,
    "Expected at least one warning about deferred auth deletion",
  );
  assertEquals(
    body.warnings[0].code,
    "AUTH_DELETE_DEFERRED",
    "Expected AUTH_DELETE_DEFERRED warning code",
  );
  assertEquals(
    harness.getRpcCallCount(),
    1,
    "Expected relational cleanup to run before auth deletion",
  );
  assertEquals(
    harness.getAuthDeleteCallCount(),
    1,
    "Expected auth deletion to be attempted once",
  );
});

Deno.test("delete-user returns unauthorized when auth lookup fails", async () => {
  const harness = createHandleDeleteUserHarness({
    getUserResult: {
      data: null,
      error: { status: 401, message: "JWT expired" },
    },
  });

  const response = await module.handleDeleteUser(
    createRequest(),
    harness.dependencies,
  );
  const body = await response.json();

  assertEquals(
    response.status,
    401,
    "Expected auth lookup failures to remain terminal",
  );
  assertEquals(body.success, false, "Expected failure response body");
  assertEquals(
    body.code,
    "ACCOUNT_DELETION_AUTH_REQUIRED",
    "Expected auth-required error code",
  );
  assertEquals(
    harness.getRpcCallCount(),
    0,
    "Expected rpc deletion not to run when auth lookup fails",
  );
  assertEquals(
    harness.getAuthDeleteCallCount(),
    0,
    "Expected auth deletion not to run when auth lookup fails",
  );
});

Deno.test("delete-user classifies transient infrastructure failures conservatively", () => {
  assertEquals(
    module.isTransientDeleteUserInfrastructureError({
      status: 503,
      message: "Service unavailable",
    }),
    true,
    "Expected 503 infrastructure failures to be retriable",
  );
  assertEquals(
    module.isTransientDeleteUserInfrastructureError({
      message: "network connection reset by peer",
    }),
    true,
    "Expected network failures to be retriable",
  );
  assertEquals(
    module.isTransientDeleteUserInfrastructureError({
      status: 401,
      message: "Unauthorized",
    }),
    false,
    "Expected auth failures not to be retriable",
  );
  assertEquals(
    module.isTransientDeleteUserInfrastructureError({
      status: 404,
      message: "User not found",
    }),
    false,
    "Expected not-found failures not to be retriable",
  );
});
