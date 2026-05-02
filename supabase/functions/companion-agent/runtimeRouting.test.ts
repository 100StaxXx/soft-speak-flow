import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import type { CompanionAgentRequest } from "./types.ts";
import {
  getScheduleReadStarterIntent,
  isDeterministicScheduleReadRequest,
  shouldUseCostGuardrailPreflight,
} from "./runtimeRouting.ts";

const baseRequest = (
  overrides: Partial<CompanionAgentRequest> = {},
): CompanionAgentRequest => ({
  surface: "journeys",
  sessionId: "session-1",
  message: "What do I have coming up?",
  inputMode: "text",
  currentDateTime: "2026-05-01T17:10:00-07:00",
  ...overrides,
});

Deno.test("upcoming schedule reads skip the OpenAI cost preflight", () => {
  const typed = baseRequest();
  const launcher = baseRequest({
    turnOrigin: "launcher",
    starterIntent: "upcoming_start",
  });

  assert(isDeterministicScheduleReadRequest(typed));
  assert(isDeterministicScheduleReadRequest(launcher));
  assertEquals(getScheduleReadStarterIntent(typed), "upcoming_start");
  assertEquals(getScheduleReadStarterIntent(launcher), "upcoming_start");
  assertEquals(shouldUseCostGuardrailPreflight(typed), false);
  assertEquals(shouldUseCostGuardrailPreflight(launcher), false);
});

Deno.test("drafting from an upcoming suggestion still uses the cost preflight", () => {
  const request = baseRequest({
    starterIntent: "upcoming_start",
    selectedProposalId: "proposal-1",
  });

  assertEquals(isDeterministicScheduleReadRequest(request), false);
  assertEquals(shouldUseCostGuardrailPreflight(request), true);
});

Deno.test("general companion turns keep the OpenAI cost preflight", () => {
  const request = baseRequest({
    message: "Can you help me think through my priorities?",
    starterIntent: undefined,
  });

  assertEquals(isDeterministicScheduleReadRequest(request), false);
  assertEquals(getScheduleReadStarterIntent(request), null);
  assertEquals(shouldUseCostGuardrailPreflight(request), true);
});
