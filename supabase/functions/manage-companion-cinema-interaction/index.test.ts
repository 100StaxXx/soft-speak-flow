import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildHuntReward,
  handleManageCompanionCinemaInteraction,
  mapCinemaError,
  resolveInteractionTransition,
} from "./index.ts";

const managerSource = await Deno.readTextFile(
  new URL("./index.ts", import.meta.url),
);

Deno.test("manager scopes every read and mutation path to Cosmiq companions", () => {
  const relationshipFilters = managerSource.match(
    /\.eq\("user_companion\.product_mode", "cosmiq"\)/g,
  ) ?? [];
  assertEquals(relationshipFilters.length, 4);
  assertStringIncludes(managerSource, '.eq("product_mode", "cosmiq")');
  assert(
    !managerSource.includes('.eq("product_mode", "graceward")'),
    "cinema manager must never select a Graceward companion",
  );
});

Deno.test("manager rejects unauthenticated interaction writes", async () => {
  const response = await handleManageCompanionCinemaInteraction(
    new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ action: "start", interactionType: "hunt" }),
    }),
  );
  assertEquals(response.status, 401);
  assertEquals((await response.json()).error, "Unauthorized");
});

Deno.test("manager serves CORS preflight without touching providers", async () => {
  const response = await handleManageCompanionCinemaInteraction(
    new Request("https://example.test", { method: "OPTIONS" }),
  );
  assertEquals(response.status, 200);
});

Deno.test("hunt rewards are deterministic for the companion element", () => {
  const reward = buildHuntReward({ core_element: "fire", current_stage: 13 });
  assertEquals(reward.title, "Emberbound Fragment");
  assertEquals(reward.level, 13);
});

Deno.test("quota failures map to a safe rate-limit response", () => {
  const mapped = mapCinemaError("rpc: cinema_daily_limit_reached");
  assertEquals(mapped.status, 429);
  assertStringIncludes(mapped.message, "daily limit");
});

Deno.test("interaction terminal transitions are idempotent and never reverse", () => {
  assertEquals(resolveInteractionTransition("active", "complete"), "apply");
  assertEquals(
    resolveInteractionTransition("completed", "complete"),
    "idempotent",
  );
  assertEquals(
    resolveInteractionTransition("cancelled", "cancel"),
    "idempotent",
  );
  assertEquals(
    resolveInteractionTransition("completed", "cancel"),
    "conflict",
  );
  assertEquals(
    resolveInteractionTransition("cancelled", "complete"),
    "conflict",
  );
  assertStringIncludes(
    managerSource,
    '.in("status", ["preparing", "active", "returning"])',
  );
  assertStringIncludes(managerSource, "const insertCinemaEventOnce");
  assertStringIncludes(managerSource, 'error?.code !== "23505"');
  assertStringIncludes(
    managerSource,
    "without resetting a ready/revealed render back to queued",
  );
});
