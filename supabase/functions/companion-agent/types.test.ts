import {
  assert,
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  CampaignLifecycleStatusSchema,
  CompanionAgentRequestSchema,
  isCompanionCampaignLifecycleStatus,
  PendingActionTypeSchema,
  SubmitCompanionResultSchema,
} from "./types.ts";

Deno.test("campaign lifecycle status guard only accepts supported statuses", () => {
  for (const status of ["active", "completed", "abandoned"] as const) {
    assertEquals(CampaignLifecycleStatusSchema.parse(status), status);
    assert(isCompanionCampaignLifecycleStatus(status));
  }

  assertThrows(() => CampaignLifecycleStatusSchema.parse("needs_adjustment"));
  assert(!isCompanionCampaignLifecycleStatus("needs_adjustment"));
});

Deno.test("pending action schema accepts conversational planner writes", () => {
  assertEquals(PendingActionTypeSchema.parse("task_create"), "task_create");
  assertEquals(
    PendingActionTypeSchema.parse("campaign_create"),
    "campaign_create",
  );
  assertEquals(
    PendingActionTypeSchema.parse("day_plan_apply"),
    "day_plan_apply",
  );
});

Deno.test("submit companion result accepts agent-led follow-up decisions", () => {
  const parsed = SubmitCompanionResultSchema.parse({
    reply:
      "Before I place the heavier block, do you want progress or recovery today?",
    mode: "clarify",
    intent: "plan_day",
    confidence: 0.82,
    understanding_state: "needs_followup",
    follow_up: {
      question: "Do you want today to lean progress or recovery?",
      reason: "The calendar has room for either shape.",
      expectedAnswerType: "choice",
      options: ["Progress", "Recovery"],
    },
    assumptions: ["Calendar blocks are fixed."],
    evidence_ids: ["task-1", "event-1"],
  });

  assertEquals(parsed.understanding_state, "needs_followup");
  assertEquals(parsed.follow_up?.expectedAnswerType, "choice");
});

Deno.test("companion agent request accepts active follow-up context", () => {
  const parsed = CompanionAgentRequestSchema.parse({
    surface: "journeys",
    sessionId: "session-1",
    message: "Progress",
    inputMode: "text",
    currentDateTime: "2026-04-18T08:05:00-07:00",
    turnOrigin: "follow_up_option",
    activeFollowUp: {
      question: "Do you want today to lean progress or recovery?",
      reason: "The calendar has room for either shape.",
      expectedAnswerType: "choice",
      options: ["Progress", "Recovery"],
    },
  });

  assertEquals(
    parsed.activeFollowUp?.question,
    "Do you want today to lean progress or recovery?",
  );
  assertEquals(parsed.turnOrigin, "follow_up_option");
  assertEquals(parsed.activeFollowUp?.options, ["Progress", "Recovery"]);
});
