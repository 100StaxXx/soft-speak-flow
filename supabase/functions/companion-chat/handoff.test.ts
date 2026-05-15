import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { shouldHandoffToPlanner } from "./handoff.ts";

Deno.test("keeps bare scheduled journeys phrases in chat", () => {
  assertEquals(shouldHandoffToPlanner("gym at 5pm tomorrow", "journeys"), false);
});

Deno.test("keeps question-form scheduling journeys phrases in chat", () => {
  assertEquals(
    shouldHandoffToPlanner("can you put gym at 5pm tomorrow?", "journeys"),
    false,
  );
});

Deno.test("keeps question-form rescheduling journeys phrases in chat", () => {
  assertEquals(
    shouldHandoffToPlanner("can you move workout to 6?", "journeys"),
    false,
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
