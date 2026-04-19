import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { shouldHandoffToPlanner } from "./handoff.ts";

Deno.test("hands bare scheduled journeys phrases off to planner", () => {
  assertEquals(shouldHandoffToPlanner("gym at 5pm tomorrow", "journeys"), true);
});

Deno.test("hands question-form scheduling journeys phrases off to planner", () => {
  assertEquals(
    shouldHandoffToPlanner("can you put gym at 5pm tomorrow?", "journeys"),
    true,
  );
});

Deno.test("hands question-form rescheduling journeys phrases off to planner", () => {
  assertEquals(
    shouldHandoffToPlanner("can you move workout to 6?", "journeys"),
    true,
  );
});

Deno.test("keeps read-only schedule questions in journeys chat", () => {
  assertEquals(
    shouldHandoffToPlanner("How does tomorrow look?", "journeys"),
    false,
  );
});

Deno.test("keeps broad day-planning prompts in journeys chat", () => {
  assertEquals(
    shouldHandoffToPlanner("Help me plan today", "journeys"),
    false,
  );
});
