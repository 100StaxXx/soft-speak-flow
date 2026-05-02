function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const module = await import("./index.ts");

type MockOperation = [string, ...unknown[]];
type MockResponse = { data: unknown; error: unknown };
type MockResponseInput = MockResponse | ((operations: MockOperation[]) => MockResponse);

function createMockSupabase(responses: MockResponseInput[]) {
  const queue = [...responses];
  const operations: MockOperation[] = [];
  const nextResponse = () => {
    const response = queue.shift() ?? { data: null, error: null };
    return typeof response === "function" ? response(operations) : response;
  };

  return {
    operations,
    from(table: string) {
      assertEquals(table, "companion_cosmiq_title_cards", "Expected shared title-card table lookup");
      const builder = {
        select(columns: string) {
          operations.push(["select", columns]);
          return builder;
        },
        eq(column: string, value: unknown) {
          operations.push(["eq", column, value]);
          return builder;
        },
        not(column: string, operator: string, value: unknown) {
          operations.push(["not", column, operator, value]);
          return builder;
        },
        limit(value: number) {
          operations.push(["limit", value]);
          return Promise.resolve(nextResponse());
        },
        in(column: string, values: unknown[]) {
          operations.push(["in", column, values]);
          return Promise.resolve(nextResponse());
        },
      };
      return builder;
    },
  };
}

Deno.test("seed-cosmiq-title-card-library returns early when the shared library is ready", async () => {
  const supabase = createMockSupabase([
    { data: Array.from({ length: 10 }, (_, index) => ({ profile_key: `ready-${index}` })), error: null },
  ]);
  let resolverCalled = false;

  const response = await module.handleSeedCosmiqTitleCardLibrary(
    new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ targetReadyCount: 10 }),
    }),
    {
      authenticate: async () => ({ userId: "user-1", isServiceRole: false }),
      createSupabaseClient: () => supabase,
      fetchImpl: fetch,
      resolveCosmiqTitleCard: async () => {
        resolverCalled = true;
        throw new Error("resolver should not run");
      },
    },
  );

  assertEquals(response.status, 200, "Expected ready response");
  const payload = await response.json();
  assertEquals(payload.action, "already_ready", "Expected early ready action");
  assertEquals(payload.readyCount, 10, "Expected existing ready count");
  assertEquals(resolverCalled, false, "Expected no seed generation");
});

Deno.test("seed-cosmiq-title-card-library generates a missing starter card into the shared library", async () => {
  const supabase = createMockSupabase([
    { data: [{ profile_key: "ready-1" }, { profile_key: "ready-2" }], error: null },
    { data: [], error: null },
  ]);
  let resolvedUserId = "";
  let resolvedVisualPersona = "";
  let resolvedTitle = "";

  const response = await module.handleSeedCosmiqTitleCardLibrary(
    new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ targetReadyCount: 10 }),
    }),
    {
      authenticate: async () => ({ userId: "user-1", isServiceRole: false }),
      createSupabaseClient: () => supabase,
      fetchImpl: fetch,
      resolveCosmiqTitleCard: async ({ userId, visualPersona, analysis }) => {
        resolvedUserId = userId;
        resolvedVisualPersona = visualPersona ?? "";
        resolvedTitle = analysis.cosmiqTitle.title;
        return {
          profileKey: "seed-profile-1",
          imageUrl: "https://cdn.example.com/cosmiq-title-cards/seed-profile-1.png",
          status: "ready",
          cached: false,
          promptVersion: 1,
        };
      },
    },
  );

  assertEquals(response.status, 200, "Expected generation response");
  const payload = await response.json();
  assertEquals(payload.action, "generated", "Expected generated action");
  assertEquals(payload.readyCount, 3, "Expected ready count to advance by one");
  assertEquals(resolvedUserId, "user-1", "Expected authenticated user id for cost accounting");
  assertEquals(resolvedVisualPersona, "neutral", "Expected neutral starter visual persona");
  assertEquals(resolvedTitle, "The Oathbound Pathfinder", "Expected first starter title");
  assert(
    supabase.operations.some(([operation, column]) => operation === "in" && column === "profile_key"),
    "Expected existing seed profile lookup",
  );
});

Deno.test("seed-cosmiq-title-card-library tries missing starter cards before unavailable ones", async () => {
  const supabase = createMockSupabase([
    { data: [], error: null },
    (operations) => {
      const seedLookup = operations.find(([operation]) => operation === "in");
      const seedProfileKeys = seedLookup?.[2];
      assert(Array.isArray(seedProfileKeys), "Expected seed profile lookup values");
      const seedProfileKeyList = seedProfileKeys as string[];
      return {
        data: [{ profile_key: seedProfileKeyList[0], status: "unavailable", image_url: null }],
        error: null,
      };
    },
  ]);
  let resolvedTitle = "";

  const response = await module.handleSeedCosmiqTitleCardLibrary(
    new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ targetReadyCount: 10 }),
    }),
    {
      authenticate: async () => ({ userId: "user-1", isServiceRole: false }),
      createSupabaseClient: () => supabase,
      fetchImpl: fetch,
      resolveCosmiqTitleCard: async ({ analysis }) => {
        resolvedTitle = analysis.cosmiqTitle.title;
        return {
          profileKey: "seed-profile-2",
          imageUrl: "https://cdn.example.com/cosmiq-title-cards/seed-profile-2.png",
          status: "ready",
          cached: false,
          promptVersion: 1,
        };
      },
    },
  );

  assertEquals(response.status, 200, "Expected generation response");
  const payload = await response.json();
  assertEquals(payload.action, "generated", "Expected generated action");
  assertEquals(payload.readyCount, 1, "Expected ready count to advance by one");
  assertEquals(resolvedTitle, "The Reality Weaver", "Expected next missing starter title");
});

Deno.test("seed-cosmiq-title-card-library rejects service-role calls", async () => {
  const supabase = createMockSupabase([]);
  let resolverCalled = false;

  const response = await module.handleSeedCosmiqTitleCardLibrary(
    new Request("http://localhost", { method: "POST", body: JSON.stringify({}) }),
    {
      authenticate: async () => ({ userId: "service-role", isServiceRole: true }),
      createSupabaseClient: () => supabase,
      fetchImpl: fetch,
      resolveCosmiqTitleCard: async () => {
        resolverCalled = true;
        throw new Error("resolver should not run");
      },
    },
  );

  assertEquals(response.status, 403, "Expected user-auth-only response");
  assertEquals(resolverCalled, false, "Expected no resolver call");
});
