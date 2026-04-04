function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message = "Expected values to match"): void {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nReceived: ${JSON.stringify(actual)}`);
  }
}

function assertArrayEquals<T>(actual: T[], expected: T[], message = "Expected arrays to match"): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}\nExpected: ${expectedJson}\nReceived: ${actualJson}`);
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
    headers: authorization ? new Headers({ Authorization: authorization }) : undefined,
  });

type DeleteStepResult = { error: unknown | null };

const createDeleteStepResult = (error: unknown | null = null): DeleteStepResult => ({ error });

const createHandleDeleteUserHarness = ({
  rpcResults = [createDeleteStepResult()],
  authDeleteResults = [createDeleteStepResult()],
  getUserResult,
}: {
  rpcResults?: DeleteStepResult[];
  authDeleteResults?: DeleteStepResult[];
  getUserResult?: { data: { user: { id: string } | null } | null; error: unknown | null };
} = {}) => {
  let rpcCallCount = 0;
  let authDeleteCallCount = 0;
  const sleepCalls: number[] = [];

  const client = {
    auth: {
      getUser: async () =>
        getUserResult ?? {
          data: { user: { id: USER_ID } },
          error: null,
        },
      admin: {
        deleteUser: async () =>
          authDeleteResults[Math.min(authDeleteCallCount++, authDeleteResults.length - 1)],
      },
    },
    rpc: async () => rpcResults[Math.min(rpcCallCount++, rpcResults.length - 1)],
  };

  const dependencies = {
    env: createEnv(),
    createAdminClient: () => client as never,
    collectStorageTargets: async () => new Map<string, Set<string>>(),
    cleanupStorage: async () => {},
    sleep: async (ms: number) => {
      sleepCalls.push(ms);
    },
  };

  return {
    dependencies,
    getRpcCallCount: () => rpcCallCount,
    getAuthDeleteCallCount: () => authDeleteCallCount,
    sleepCalls,
  };
};

Deno.test("delete-user treats already-deleted auth users as non-fatal", () => {
  const cases = [
    new Error("User not found"),
    { message: "Auth api error: user not found" },
    { code: "USER_NOT_FOUND" },
    { name: "UserNotFoundError" },
  ];

  for (const candidate of cases) {
    assert(
      module.isAuthUserAlreadyDeletedError(candidate),
      `Expected ${JSON.stringify(candidate)} to be treated as an already-deleted auth user`,
    );
  }
});

Deno.test("delete-user keeps unrelated auth deletion failures fatal", () => {
  const cases = [
    new Error("permission denied"),
    { message: "rate limit exceeded" },
    { code: "unexpected_failure" },
    null,
  ];

  for (const candidate of cases) {
    assert(
      !module.isAuthUserAlreadyDeletedError(candidate),
      `Expected ${JSON.stringify(candidate)} to remain a fatal auth deletion error`,
    );
  }
});

Deno.test("delete-user retries transient rpc failures and succeeds", async () => {
  const harness = createHandleDeleteUserHarness({
    rpcResults: [
      createDeleteStepResult({ status: 503, message: "Service unavailable" }),
      createDeleteStepResult({ message: "network connection reset by peer" }),
      createDeleteStepResult(),
    ],
  });

  const response = await module.handleDeleteUser(createRequest(), harness.dependencies);
  const body = await response.json();

  assertEquals(response.status, 200, "Expected delete-user to succeed after retrying rpc failures");
  assertEquals(body.success, true, "Expected success response body");
  assertEquals(harness.getRpcCallCount(), 3, "Expected rpc step to be attempted three times");
  assertEquals(harness.getAuthDeleteCallCount(), 1, "Expected auth delete to run once after rpc recovery");
  assertArrayEquals(harness.sleepCalls, [500, 1500], "Expected rpc retries to use the configured backoff");
});

Deno.test("delete-user retries transient auth deletion failures and succeeds", async () => {
  const harness = createHandleDeleteUserHarness({
    authDeleteResults: [
      createDeleteStepResult({ status: 503, message: "Service unavailable" }),
      createDeleteStepResult(),
    ],
  });

  const response = await module.handleDeleteUser(createRequest(), harness.dependencies);
  const body = await response.json();

  assertEquals(response.status, 200, "Expected delete-user to succeed after retrying auth deletion");
  assertEquals(body.success, true, "Expected success response body");
  assertEquals(harness.getRpcCallCount(), 1, "Expected rpc step to run once");
  assertEquals(harness.getAuthDeleteCallCount(), 2, "Expected auth delete step to retry once");
  assertArrayEquals(harness.sleepCalls, [500], "Expected auth delete retry to use the first backoff delay");
});

Deno.test("delete-user treats already-deleted auth users as a successful delete flow", async () => {
  const harness = createHandleDeleteUserHarness({
    authDeleteResults: [createDeleteStepResult(new Error("User not found"))],
  });

  const response = await module.handleDeleteUser(createRequest(), harness.dependencies);
  const body = await response.json();

  assertEquals(response.status, 200, "Expected already-deleted auth users to remain non-fatal");
  assertEquals(body.success, true, "Expected success response body");
  assertEquals(harness.getAuthDeleteCallCount(), 1, "Expected auth delete to stop after the non-fatal result");
  assertArrayEquals(harness.sleepCalls, [], "Expected no retry delay for already-deleted auth users");
});

Deno.test("delete-user does not retry non-transient rpc authorization failures", async () => {
  const harness = createHandleDeleteUserHarness({
    rpcResults: [createDeleteStepResult({ status: 401, message: "Unauthorized" })],
  });

  const response = await module.handleDeleteUser(createRequest(), harness.dependencies);
  const body = await response.json();

  assertEquals(response.status, 401, "Expected unauthorized rpc failures to stay terminal");
  assertEquals(body.success, false, "Expected failure response body");
  assertEquals(body.code, "ACCOUNT_DELETION_AUTH_REQUIRED", "Expected auth-required error code");
  assertEquals(harness.getRpcCallCount(), 1, "Expected no retry for non-transient rpc auth failures");
  assertArrayEquals(harness.sleepCalls, [], "Expected no retry delay for terminal auth failures");
});
