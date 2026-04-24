import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runPlannerStageWithTimeout } from "./latencyBudget.ts";

Deno.test("runPlannerStageWithTimeout returns work result before deadline", async () => {
  const result = await runPlannerStageWithTimeout({
    work: async () => "ok",
    timeoutMs: 50,
    operation: "planner test",
    timeoutCode: "PLANNER_TEST_TIMEOUT",
    fallbackValue: "fallback",
  });

  assertEquals(result, "ok");
});

Deno.test("runPlannerStageWithTimeout returns fallback and notifies on timeout", async () => {
  let timeoutCalled = false;
  let slowTimer: ReturnType<typeof setTimeout> | undefined;

  const result = await runPlannerStageWithTimeout({
    work: () =>
      new Promise<string>((resolve) => {
        slowTimer = setTimeout(() => resolve("slow"), 40);
      }),
    timeoutMs: 5,
    operation: "planner test",
    timeoutCode: "PLANNER_TEST_TIMEOUT",
    fallbackValue: () => "fallback",
    onTimeout: () => {
      timeoutCalled = true;
    },
  });

  assertEquals(result, "fallback");
  assertEquals(timeoutCalled, true);
  if (slowTimer) {
    clearTimeout(slowTimer);
  }
});

Deno.test("runPlannerStageWithTimeout rethrows non-timeout errors", async () => {
  await assertRejects(
    () =>
      runPlannerStageWithTimeout({
        work: async () => {
          throw new Error("boom");
        },
        timeoutMs: 50,
        operation: "planner test",
        timeoutCode: "PLANNER_TEST_TIMEOUT",
        fallbackValue: "fallback",
      }),
    Error,
    "boom",
  );
});
