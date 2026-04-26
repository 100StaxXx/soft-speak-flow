import {
  assert,
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  CampaignLifecycleStatusSchema,
  CompanionAgentRequestSchema,
  isCompanionCampaignLifecycleStatus,
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
      blocksDrafting: true,
    },
    assumptions: ["Calendar blocks are fixed."],
    evidence_ids: ["task-1", "event-1"],
  });

  assertEquals(parsed.understanding_state, "needs_followup");
  assertEquals(parsed.follow_up?.expectedAnswerType, "choice");
  assertEquals(parsed.follow_up?.blocksDrafting, true);
});

Deno.test("companion agent request accepts active follow-up context", () => {
  const parsed = CompanionAgentRequestSchema.parse({
    surface: "journeys",
    sessionId: "session-1",
    message: "Progress",
    inputMode: "text",
    currentDateTime: "2026-04-18T08:05:00-07:00",
    activeFollowUp: {
      question: "Do you want today to lean progress or recovery?",
      reason: "The calendar has room for either shape.",
      expectedAnswerType: "choice",
      options: ["Progress", "Recovery"],
      blocksDrafting: true,
    },
    selectedProposedAction: {
      type: "quest.create",
      title: "Draft launch email",
      normalizedPayload: {
        title: "Draft launch email",
        date: "2026-04-18",
      },
    },
    selectedProposedActionIntent: "draft",
    activeProposedActions: [
      {
        type: "quest.create",
        title: "Draft launch email",
      },
      {
        type: "calendar.event.update",
        title: "Move dentist appointment",
      },
    ],
  });

  assertEquals(
    parsed.activeFollowUp?.question,
    "Do you want today to lean progress or recovery?",
  );
  assertEquals(parsed.activeFollowUp?.options, ["Progress", "Recovery"]);
  assertEquals(parsed.selectedProposedAction?.type, "quest.create");
  assertEquals(parsed.selectedProposedActionIntent, "draft");
  assertEquals(
    parsed.activeProposedActions?.[1]?.type,
    "calendar.event.update",
  );
});
