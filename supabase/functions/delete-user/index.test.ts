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

type RpcResult = { error: unknown | null };

const createRpcResult = (error: unknown | null = null): RpcResult => ({ error });

const createHandleDeleteUserHarness = ({
  rpcResults = [createRpcResult()],
  getUserResult,
}: {
  rpcResults?: RpcResult[];
  getUserResult?: { data: { user: { id: string } | null } | null; error: unknown | null };
} = {}) => {
  let rpcCallCount = 0;
  const sleepCalls: number[] = [];

  const client = {
    auth: {
      getUser: async () =>
        getUserResult ?? {
          data: { user: { id: USER_ID } },
          error: null,
        },
    },
    rpc: async () => rpcResults[Math.min(rpcCallCount++, rpcResults.length - 1)],
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
    sleepCalls,
  };
};

Deno.test("delete-user retries transient rpc failures and succeeds", async () => {
  const harness = createHandleDeleteUserHarness({
    rpcResults: [
      createRpcResult({ status: 503, message: "Service unavailable" }),
      createRpcResult({ message: "network connection reset by peer" }),
      createRpcResult(),
    ],
  });

  const response = await module.handleDeleteUser(createRequest(), harness.dependencies);
  const body = await response.json();

  assertEquals(response.status, 200, "Expected delete-user to succeed after retrying rpc failures");
  assertEquals(body.success, true, "Expected success response body");
  assertEquals(harness.getRpcCallCount(), 3, "Expected rpc step to be attempted three times");
  assertArrayEquals(harness.sleepCalls, [500, 1500], "Expected rpc retries to use the configured backoff");
});

Deno.test("delete-user does not retry non-transient rpc authorization failures", async () => {
  const harness = createHandleDeleteUserHarness({
    rpcResults: [createRpcResult({ status: 401, message: "Unauthorized" })],
  });

  const response = await module.handleDeleteUser(createRequest(), harness.dependencies);
  const body = await response.json();

  assertEquals(response.status, 401, "Expected unauthorized rpc failures to stay terminal");
  assertEquals(body.success, false, "Expected failure response body");
  assertEquals(body.code, "ACCOUNT_DELETION_AUTH_REQUIRED", "Expected auth-required error code");
  assertEquals(harness.getRpcCallCount(), 1, "Expected no retry for non-transient rpc auth failures");
  assertArrayEquals(harness.sleepCalls, [], "Expected no retry delay for terminal auth failures");
});

Deno.test("delete-user returns unauthorized when auth lookup fails", async () => {
  const harness = createHandleDeleteUserHarness({
    getUserResult: {
      data: null,
      error: { status: 401, message: "JWT expired" },
    },
  });

  const response = await module.handleDeleteUser(createRequest(), harness.dependencies);
  const body = await response.json();

  assertEquals(response.status, 401, "Expected auth lookup failures to remain terminal");
  assertEquals(body.success, false, "Expected failure response body");
  assertEquals(body.code, "ACCOUNT_DELETION_AUTH_REQUIRED", "Expected auth-required error code");
  assertEquals(harness.getRpcCallCount(), 0, "Expected rpc deletion not to run when auth lookup fails");
});

Deno.test("delete-user classifies transient infrastructure failures conservatively", () => {
  assertEquals(
    module.isTransientDeleteUserInfrastructureError({ status: 503, message: "Service unavailable" }),
    true,
    "Expected 503 infrastructure failures to be retriable",
  );
  assertEquals(
    module.isTransientDeleteUserInfrastructureError({ message: "network connection reset by peer" }),
    true,
    "Expected network failures to be retriable",
  );
  assertEquals(
    module.isTransientDeleteUserInfrastructureError({ status: 401, message: "Unauthorized" }),
    false,
    "Expected auth failures not to be retriable",
  );
  assertEquals(
    module.isTransientDeleteUserInfrastructureError({ status: 404, message: "User not found" }),
    false,
    "Expected not-found failures not to be retriable",
  );
});
