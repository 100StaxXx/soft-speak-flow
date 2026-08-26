import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  cleanupExpiredPrivateCinemaAssets,
  handleProcessCompanionCinemaEvent,
  isCosmiqCinemaProductMode,
} from "./index.ts";

const workerSource = await Deno.readTextFile(
  new URL("./index.ts", import.meta.url),
);

Deno.test("cinema worker accepts only the Cosmiq companion product mode", () => {
  assertEquals(isCosmiqCinemaProductMode("cosmiq"), true);
  assertEquals(isCosmiqCinemaProductMode("graceward"), false);
  assertEquals(isCosmiqCinemaProductMode("christian"), false);
  assertEquals(isCosmiqCinemaProductMode(null), false);
});

Deno.test("cinema worker checks product mode before cost or provider work", () => {
  const handlerSource = workerSource.slice(
    workerSource.indexOf("export const handleProcessCompanionCinemaEvent"),
  );
  const productCheckIndex = handlerSource.indexOf("ensureCosmiqEventCompanion");
  const guardrailIndex = handlerSource.indexOf("createCostGuardrailSession");
  assertEquals(productCheckIndex >= 0, true);
  assertEquals(guardrailIndex >= 0, true);
  assertEquals(productCheckIndex < guardrailIndex, true);
});

Deno.test("cinema worker lease claim uses the event revision as its compare-and-swap guard", () => {
  const claimSource = workerSource.slice(
    workerSource.indexOf("const claimEvent"),
    workerSource.indexOf("const renewEventLease"),
  );
  assertEquals(
    claimSource.includes('.eq("updated_at", event.updated_at)'),
    true,
  );
  assertEquals(claimSource.includes('.eq("status", event.status)'), true);
  assertEquals(claimSource.includes("lease_expires_at.is.null"), false);
});

Deno.test("cinema worker serves CORS preflight without claiming a job", async () => {
  const response = await handleProcessCompanionCinemaEvent(
    new Request("https://example.test", { method: "OPTIONS" }),
  );
  assertEquals(response.status, 200);
});

Deno.test("private cleanup is a no-op when retention finds no terminal events or stale renders", async () => {
  const terminalQuery = {
    select() {
      return this;
    },
    in() {
      return this;
    },
    lt() {
      return this;
    },
    limit() {
      return Promise.resolve({ data: [], error: null });
    },
  };
  const result = await cleanupExpiredPrivateCinemaAssets({
    supabase: {
      from(table: string) {
        if (
          table !== "companion_cinema_events" &&
          table !== "companion_cinema_renders"
        ) {
          throw new Error(`Unexpected table ${table}`);
        }
        return terminalQuery;
      },
    },
  });
  assertEquals(result, { eventsScanned: 0, assetsRemoved: 0 });
});

Deno.test("cinema worker keeps enqueue short and cron-owned", () => {
  const enqueueStart = workerSource.indexOf('if (action === "enqueue")');
  const guardrailStart = workerSource.indexOf(
    "const costGuardrails = createCostGuardrailSession",
  );
  const enqueueSource = workerSource.slice(enqueueStart, guardrailStart);
  assertStringIncludes(enqueueSource, 'status: "queued"');
  assertStringIncludes(enqueueSource, "status: 202");
  assertEquals(enqueueSource.includes("renderPortrait({"), false);
});

Deno.test("cinema worker cannot resurrect cancellation or orphan a submitted provider job", () => {
  const leasedUpdateSource = workerSource.slice(
    workerSource.indexOf("const updateLeasedEvent"),
    workerSource.indexOf("const updateRender"),
  );
  assertStringIncludes(leasedUpdateSource, '.eq("lease_token", leaseToken)');
  assertStringIncludes(
    workerSource,
    "Failed to cancel lease-lost cinema render",
  );
  assertStringIncludes(
    workerSource,
    "Failed to cancel persisted lease-lost cinema render",
  );
  assertStringIncludes(
    workerSource,
    "The cinema event was cancelled after provider submission",
  );
  assertStringIncludes(workerSource, "cancelFalKlingRequest({");
});

Deno.test("cinema worker resets provider identities when render rows are reused", () => {
  assertStringIncludes(workerSource, "provider_task_id: null");
  assertStringIncludes(workerSource, "provider_status: null");
  assertStringIncludes(workerSource, "retry_count: 0");
  assertStringIncludes(workerSource, "selected: false");
});
