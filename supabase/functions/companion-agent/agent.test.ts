import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { buildToolDefinitions, runCompanionAgent } from "./agent.ts";

type QueryResult = {
  data?: unknown;
  error?: unknown;
  count?: number | null;
};

type MockCompanionRow = {
  id: string;
  companion_name: string | null;
  cached_creature_name: string | null;
  preset_id: string | null;
  spirit_animal: string | null;
  core_element: string | null;
  current_stage: number;
  current_mood: string | null;
};

type MockSupabaseOptions = {
  companion?: Partial<MockCompanionRow>;
};

const defaultCompanionRow: MockCompanionRow = {
  id: "companion-1",
  companion_name: "Cosmiq",
  cached_creature_name: null,
  preset_id: "fox",
  spirit_animal: "fox",
  core_element: "storm",
  current_stage: 2,
  current_mood: "steady",
};

function createQueryResult(
  table: string,
  operation: string,
  maybeSingle: boolean,
  value?: unknown,
  options: MockSupabaseOptions = {},
): QueryResult {
  if (table === "user_companion" && maybeSingle) {
    return {
      data: {
        ...defaultCompanionRow,
        ...options.companion,
      },
      error: null,
    };
  }

  if (table === "companion_chat_threads" && maybeSingle) {
    return { data: null, error: null };
  }

  if (table === "companion_pending_actions" && operation === "insert") {
    const row = value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
    return {
      data: {
        ...row,
        affected_entities: row.affected_entities ?? {},
        confirmed_at: null,
        cancelled_at: null,
        executed_at: null,
        execution_result: null,
        execution_error: null,
        replaced_by_action_id: null,
      },
      error: null,
    };
  }

  if (table === "companion_pending_actions" && maybeSingle) {
    return { data: null, error: null };
  }

  if (table === "companion_chats" && operation === "select") {
    return { data: [], error: null, count: 0 };
  }

  if (
    table === "user_ai_learning" ||
    table === "daily_planning_preferences" ||
    table === "profiles" ||
    table === "user_ai_preferences"
  ) {
    return { data: null, error: null };
  }

  return { data: [], error: null, count: 0 };
}

function createMockSupabase(options: MockSupabaseOptions = {}) {
  const inserts: Array<{ table: string; value: unknown }> = [];

  const createBuilder = (table: string) => {
    let operation = "select";
    let maybeSingle = false;
    let value: unknown;

    const builder = {
      select: (_columns?: string, _options?: unknown) => {
        if (operation !== "insert" && operation !== "update") {
          operation = "select";
        }
        return builder;
      },
      update: (_value: unknown) => {
        operation = "update";
        value = _value;
        return builder;
      },
      insert: (_value: unknown) => {
        operation = "insert";
        value = _value;
        inserts.push({ table, value: _value });
        return builder;
      },
      eq: () => builder,
      in: () => builder,
      gte: () => builder,
      lte: () => builder,
      lt: () => builder,
      is: () => builder,
      not: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => {
        maybeSingle = true;
        return Promise.resolve(
          createQueryResult(table, operation, maybeSingle, value, options),
        );
      },
      single: () =>
        Promise.resolve(
          createQueryResult(table, operation, true, value, options),
        ),
      then: (
        resolve: (value: QueryResult) => unknown,
        reject?: (reason: unknown) => unknown,
      ) =>
        Promise.resolve(
          createQueryResult(table, operation, maybeSingle, value, options),
        )
          .then(
            resolve,
            reject,
          ),
    };

    return builder;
  };

  return {
    inserts,
    client: {
      from: (table: string) => createBuilder(table),
    },
  };
}

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

function createInstructionCaptureFetch(reply = "I’m here.") {
  const responseBodies: Array<Record<string, unknown>> = [];
  const guardedFetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(input);
    if (url.endsWith("/conversations")) {
      return jsonResponse({ id: `conv_${responseBodies.length + 1}` });
    }

    if (url.endsWith("/responses")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<
        string,
        unknown
      >;
      responseBodies.push(body);
      return jsonResponse({
        id: `resp_${responseBodies.length}`,
        conversation: { id: `conv_${responseBodies.length}` },
        output: [
          {
            type: "function_call",
            call_id: "call_submit",
            name: "submit_companion_result",
            arguments: JSON.stringify({
              reply,
              mode: "conversation",
              intent: "unknown",
              confidence: 0.9,
              understanding_state: "enough_to_discuss",
            }),
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;

  return { guardedFetch, responseBodies };
}

Deno.test("companion agent tools explicitly opt out of strict Responses schemas", () => {
  const tools = buildToolDefinitions();

  assert(tools.length > 0);
  for (const tool of tools) {
    assertEquals(tool.type, "function");
    assertEquals(tool.strict, false);
  }
});

Deno.test("runCompanionAgent falls back to deterministic planner when OpenAI is not configured", async () => {
  const supabase = createMockSupabase();
  let guardedFetchCalled = false;

  const result = await runCompanionAgent({
    guardedFetch: (async () => {
      guardedFetchCalled = true;
      throw new Error(
        "guardedFetch should not be called without OpenAI config",
      );
    }) as typeof fetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    request: {
      surface: "journeys",
      sessionId: "session-1",
      message: "Plan my day",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      starterIntent: "plan_day",
    },
  });

  assertEquals(guardedFetchCalled, false);
  assertEquals(result.companionId, "companion-1");
  assertEquals(result.confidence, 0.55);
  assertEquals(result.mode, "clarify");
  assertEquals(result.intent, "plan_day");
  assertEquals(result.threadState.sessionId, "session-1");
  assert(result.reply.length > 0);
  assert(result.reply.toLowerCase().includes("what kind of day"));
  assert(
    supabase.inserts.some((entry) => entry.table === "companion_chats"),
    "expected fallback turn to be persisted",
  );
});

Deno.test("runCompanionAgent asks a follow-up instead of proposing quests for bare Plan my day", async () => {
  const supabase = createMockSupabase();
  const guardedFetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/conversations")) {
      return jsonResponse({ id: "conv_bare_plan_day" });
    }

    if (url.endsWith("/responses")) {
      return jsonResponse({
        id: "resp_bare_plan_day",
        conversation: { id: "conv_bare_plan_day" },
        output: [
          {
            type: "function_call",
            call_id: "call_submit",
            name: "submit_companion_result",
            arguments: JSON.stringify({
              reply: "I drafted a focused day with one launch quest.",
              mode: "schedule_read",
              intent: "plan_day",
              confidence: 0.94,
              understanding_state: "ready_to_draft",
              proposed_actions: [
                {
                  type: "quest.create",
                  title: "Draft launch email",
                  reason: "Best fit before the afternoon calendar blocks.",
                  normalizedPayload: {
                    title: "Draft launch email",
                    date: "2026-04-18",
                    startTime: "10:00",
                    durationMinutes: 45,
                  },
                  confidence: 0.88,
                },
              ],
              structured_response: {
                intent: {
                  intentType: "quest",
                  timeHorizon: "today",
                  isRecurring: false,
                  shouldCreateQuest: true,
                  shouldPromptCampaign: false,
                },
                planDay: {
                  message: "I drafted a focused day.",
                  dayAssessment: "balanced",
                  suggestedQuests: [
                    {
                      suggestionId: "quest-1",
                      proposalId: "proposal-1",
                      title: "Draft launch email",
                      type: "must",
                      estimatedDuration: "45 min",
                      estimatedDurationMinutes: 45,
                      source: "optimization",
                      reason: "Best fit before the afternoon calendar blocks.",
                    },
                  ],
                },
              },
            }),
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-bare-plan-day",
      message: "Plan my day",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      starterIntent: "plan_day",
    },
  });

  assertEquals(result.mode, "clarify");
  assertEquals(result.intent, "plan_day");
  assertEquals(result.understandingState, "needs_followup");
  assertEquals(result.proposedActions, []);
  assertEquals(result.structuredResponse, null);
  assertEquals(result.pendingAction, undefined);
  assertEquals(result.threadState.hasPendingAction, false);
  assert(result.followUp?.question.includes("focus"));
  assert(result.reply.includes("focus, recovery, or catching up"));
  assert(
    supabase.inserts.every((entry) =>
      entry.table !== "companion_pending_actions"
    ),
    "bare launcher prompt should not create a pending action",
  );
});

Deno.test("runCompanionAgent uses custom companion name before generated cache in model instructions", async () => {
  const supabase = createMockSupabase({
    companion: {
      companion_name: "Lyra",
      cached_creature_name: "Nova",
      preset_id: "phoenix",
      spirit_animal: "Phoenix",
      core_element: "fire",
    },
  });
  const { guardedFetch, responseBodies } = createInstructionCaptureFetch();

  await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "companion",
      sessionId: "session-name-custom",
      message: "Hello",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
    },
  });

  const instructions = String(responseBodies[0]?.instructions ?? "");
  assert(
    instructions.includes("You are Lyra, Cosmiq's conversational companion."),
    "expected custom companion name in instructions",
  );
  assert(
    !instructions.includes("You are Nova,"),
    "custom name should override generated cache",
  );
});

Deno.test("runCompanionAgent uses generated cached companion name when no custom name exists", async () => {
  const supabase = createMockSupabase({
    companion: {
      companion_name: null,
      cached_creature_name: "Nova",
      preset_id: "phoenix",
      spirit_animal: "Phoenix",
      core_element: "fire",
    },
  });
  const { guardedFetch, responseBodies } = createInstructionCaptureFetch();

  await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "companion",
      sessionId: "session-name-cache",
      message: "Hello",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
    },
  });

  const instructions = String(responseBodies[0]?.instructions ?? "");
  assert(
    instructions.includes("You are Nova, Cosmiq's conversational companion."),
    "expected generated cached companion name in instructions",
  );
});

Deno.test("runCompanionAgent synthesizes a proper companion name instead of species or reserved labels", async () => {
  const cases = [
    {
      label: "dragon",
      companion: {
        cached_creature_name: "Dragon",
        preset_id: "dragon",
        spirit_animal: "Dragon",
        core_element: "fire",
      },
      rejectedNames: ["Dragon", "Companion", "Cosmiq"],
    },
    {
      label: "kitsune",
      companion: {
        cached_creature_name: "Kitsune",
        preset_id: "fox",
        spirit_animal: "Fox",
        core_element: "storm",
      },
      rejectedNames: ["Kitsune", "Fox", "Companion", "Cosmiq"],
    },
    {
      label: "reserved",
      companion: {
        cached_creature_name: "Companion",
        preset_id: "phoenix",
        spirit_animal: "Phoenix",
        core_element: "light",
      },
      rejectedNames: ["Companion", "Phoenix", "Cosmiq"],
    },
  ];

  for (const testCase of cases) {
    const supabase = createMockSupabase({
      companion: {
        companion_name: null,
        ...testCase.companion,
      },
    });
    const { guardedFetch, responseBodies } = createInstructionCaptureFetch();

    await runCompanionAgent({
      guardedFetch,
      supabase: supabase.client,
      userId: "00000000-0000-4000-8000-000000000001",
      openAIApiKey: "test-openai-key",
      request: {
        surface: "companion",
        sessionId: `session-name-synthesized-${testCase.label}`,
        message: "Hello",
        inputMode: "text",
        currentDateTime: "2026-04-18T08:00:00-07:00",
      },
    });

    const instructions = String(responseBodies[0]?.instructions ?? "");
    const firstLine = instructions.split("\n")[0] ?? "";
    assert(
      firstLine.startsWith("You are "),
      "expected companion identity line in instructions",
    );
    for (const rejectedName of testCase.rejectedNames) {
      assert(
        !firstLine.includes(`You are ${rejectedName},`),
        `${rejectedName} should not be used as companion name`,
      );
    }
  }
});

Deno.test({
  name:
    "runCompanionAgent drafts a pending action from a model-authored proposed action",
  fn: async () => {
    const supabase = createMockSupabase();
    const responseBodies: unknown[] = [];
    const guardedFetch =
      (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/conversations")) {
          return jsonResponse({ id: "conv_1" });
        }

        if (url.endsWith("/responses")) {
          responseBodies.push(JSON.parse(String(init?.body ?? "{}")));
          return jsonResponse({
            id: "resp_1",
            conversation: { id: "conv_1" },
            output: [
              {
                type: "function_call",
                call_id: "call_submit",
                name: "submit_companion_result",
                arguments: JSON.stringify({
                  reply: "I’d protect one launch block this morning.",
                  mode: "schedule_read",
                  intent: "plan_day",
                  confidence: 0.91,
                  understanding_state: "ready_to_draft",
                  proposed_actions: [
                    {
                      type: "quest.create",
                      title: "Draft launch email",
                      reason: "Best fit before the afternoon calendar blocks.",
                      normalizedPayload: {
                        title: "Draft launch email",
                        date: "2026-04-18",
                        startTime: "10:00",
                        durationMinutes: 45,
                        priority: "high",
                      },
                      confidence: 0.88,
                    },
                  ],
                }),
              },
            ],
          });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      }) as typeof fetch;

    const result = await runCompanionAgent({
      guardedFetch,
      supabase: supabase.client,
      userId: "00000000-0000-4000-8000-000000000001",
      openAIApiKey: "test-openai-key",
      request: {
        surface: "journeys",
        sessionId: "session-2",
        message: "Plan my day",
        inputMode: "text",
        currentDateTime: "2026-04-18T08:00:00-07:00",
        starterIntent: "plan_day",
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
          reason: "Best fit before the afternoon calendar blocks.",
          normalizedPayload: {
            title: "Draft launch email",
            date: "2026-04-18",
            startTime: "10:00",
            durationMinutes: 45,
          },
        },
        activeProposedActions: [
          {
            type: "quest.create",
            title: "Draft launch email",
            reason: "Best fit before the afternoon calendar blocks.",
            normalizedPayload: {
              title: "Draft launch email",
              date: "2026-04-18",
              startTime: "10:00",
              durationMinutes: 45,
            },
          },
          {
            type: "calendar.event.update",
            title: "Move dentist appointment",
            reason: "External calendar events are read-only.",
          },
        ],
      },
    });

    assertEquals(result.mode, "pending_confirmation");
    assertEquals(result.intent, "schedule_task");
    assertEquals(result.understandingState, "ready_to_draft");
    assertEquals(result.pendingAction?.actionType, "task_create");
    assertEquals(
      result.pendingAction?.normalizedPayload.title,
      "Draft launch email",
    );
    assertEquals(
      result.pendingAction?.normalizedPayload.task_date,
      "2026-04-18",
    );
    assertEquals(
      result.pendingAction?.normalizedPayload.scheduled_time,
      "10:00",
    );
    assertEquals(
      result.pendingAction?.normalizedPayload.estimated_duration,
      45,
    );
    assertEquals(result.pendingAction?.normalizedPayload.priority, "high");
    assert(
      supabase.inserts.some((entry) =>
        entry.table === "companion_pending_actions"
      ),
      "expected model-authored action to become a pending action",
    );
    assert(
      JSON.stringify(responseBodies[0]).includes("APP_CONTEXT_PACKET"),
      "expected model call to receive app context packet",
    );
    const contextInput =
      (responseBodies[0] as { input: Array<{ content?: string }> })
        .input.find((entry) => entry.content?.startsWith("APP_CONTEXT_PACKET"));
    assert(contextInput?.content, "expected context packet input");
    const contextPacket = JSON.parse(
      contextInput.content.replace("APP_CONTEXT_PACKET\n", ""),
    );
    assertEquals(
      contextPacket.activeFollowUp.question,
      "Do you want today to lean progress or recovery?",
    );
    assertEquals(contextPacket.latestUserMessageAnswersFollowUp, true);
    assertEquals(
      contextPacket.selectedProposedAction.title,
      "Draft launch email",
    );
    assertEquals(contextPacket.selectedProposedActionIntent, "draft");
    assertEquals(
      contextPacket.latestUserMessageSelectedProposedActionForDraft,
      true,
    );
    assertEquals(
      contextPacket.latestUserMessageSelectedProposedActionForDiscussion,
      false,
    );
    assertEquals(contextPacket.activeProposedActions.length, 2);
    assertEquals(
      contextPacket.activeProposedActions[1].title,
      "Move dentist appointment",
    );
    assertEquals(contextPacket.latestUserMessageSelectedProposedAction, true);
  },
});

Deno.test({
  name:
    "runCompanionAgent downgrades ready_to_draft when a model-authored proposal is not draftable",
  fn: async () => {
    const supabase = createMockSupabase();
    const guardedFetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/conversations")) {
        return jsonResponse({ id: "conv_1_unsupported" });
      }

      if (url.endsWith("/responses")) {
        return jsonResponse({
          id: "resp_1_unsupported",
          conversation: { id: "conv_1_unsupported" },
          output: [
            {
              type: "function_call",
              call_id: "call_submit",
              name: "submit_companion_result",
              arguments: JSON.stringify({
                reply:
                  "I can walk through the calendar move, but I can’t directly edit that external event here.",
                mode: "schedule_read",
                intent: "check_calendar",
                confidence: 0.91,
                understanding_state: "ready_to_draft",
                proposed_actions: [
                  {
                    type: "calendar.event.update",
                    title: "Move dentist appointment",
                    reason: "External calendar events are read-only.",
                    normalizedPayload: {
                      eventId: "event-1",
                      date: "2026-04-23",
                      startTime: "15:00",
                    },
                  },
                ],
              }),
            },
          ],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const result = await runCompanionAgent({
      guardedFetch,
      supabase: supabase.client,
      userId: "00000000-0000-4000-8000-000000000001",
      openAIApiKey: "test-openai-key",
      request: {
        surface: "journeys",
        sessionId: "session-2-unsupported",
        message: "Move my dentist appointment",
        inputMode: "text",
        currentDateTime: "2026-04-18T08:00:00-07:00",
      },
    });

    assertEquals(result.mode, "schedule_read");
    assertEquals(result.intent, "check_calendar");
    assertEquals(result.understandingState, "ready_to_propose");
    assertEquals(result.pendingAction, undefined);
    assertEquals(result.threadState.hasPendingAction, false);
    assert(
      supabase.inserts.every((entry) =>
        entry.table !== "companion_pending_actions"
      ),
      "unsupported model-authored proposal should stay conversational",
    );
  },
});

Deno.test({
  name:
    "runCompanionAgent drafts from the selected proposed action when the model approves it",
  fn: async () => {
    const supabase = createMockSupabase();
    const guardedFetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/conversations")) {
        return jsonResponse({ id: "conv_2" });
      }

      if (url.endsWith("/responses")) {
        return jsonResponse({
          id: "resp_2",
          conversation: { id: "conv_2" },
          output: [
            {
              type: "function_call",
              call_id: "call_submit",
              name: "submit_companion_result",
              arguments: JSON.stringify({
                reply: "Yes, that launch block is ready to draft.",
                mode: "schedule_read",
                intent: "plan_day",
                confidence: 0.9,
                understanding_state: "ready_to_draft",
              }),
            },
          ],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const result = await runCompanionAgent({
      guardedFetch,
      supabase: supabase.client,
      userId: "00000000-0000-4000-8000-000000000001",
      openAIApiKey: "test-openai-key",
      request: {
        surface: "journeys",
        sessionId: "session-3",
        message: "Draft this: Draft launch email",
        inputMode: "text",
        currentDateTime: "2026-04-18T08:00:00-07:00",
        selectedProposedAction: {
          type: "quest.create",
          title: "Draft launch email",
          summary: "Protect one launch block before the afternoon fills.",
          reason: "It fits the cleanest open window.",
          normalizedPayload: {
            title: "Draft launch email",
            date: "2026-04-18",
            startTime: "10:00",
            durationMinutes: 45,
            priority: "high",
          },
        },
        selectedProposedActionIntent: "draft",
      },
    });

    assertEquals(result.mode, "pending_confirmation");
    assertEquals(result.intent, "schedule_task");
    assertEquals(result.pendingAction?.actionType, "task_create");
    assertEquals(
      result.pendingAction?.normalizedPayload.title,
      "Draft launch email",
    );
    assertEquals(
      result.pendingAction?.normalizedPayload.task_date,
      "2026-04-18",
    );
    assertEquals(
      result.pendingAction?.normalizedPayload.scheduled_time,
      "10:00",
    );
    assertEquals(
      result.pendingAction?.normalizedPayload.estimated_duration,
      45,
    );

    const pendingActionInsert = supabase.inserts.find((entry) =>
      entry.table === "companion_pending_actions"
    );
    assert(pendingActionInsert, "expected selected proposal to become pending");
    assertEquals(
      (pendingActionInsert.value as Record<string, unknown>).metadata,
      {
        source: "companion-agent-selected-proposed-action",
        visibleDateStart: "2026-04-18",
        visibleDateEnd: "2026-04-24",
      },
    );
  },
});

Deno.test({
  name:
    "runCompanionAgent keeps draftable selected proposed actions conversational when selected for discussion",
  fn: async () => {
    const supabase = createMockSupabase();
    const guardedFetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/conversations")) {
        return jsonResponse({ id: "conv_3_discuss" });
      }

      if (url.endsWith("/responses")) {
        return jsonResponse({
          id: "resp_3_discuss",
          conversation: { id: "conv_3_discuss" },
          output: [
            {
              type: "function_call",
              call_id: "call_submit",
              name: "submit_companion_result",
              arguments: JSON.stringify({
                reply:
                  "The cleanest version is a 45-minute launch block before lunch.",
                mode: "schedule_read",
                intent: "schedule_task",
                confidence: 0.88,
                understanding_state: "ready_to_draft",
              }),
            },
          ],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const result = await runCompanionAgent({
      guardedFetch,
      supabase: supabase.client,
      userId: "00000000-0000-4000-8000-000000000001",
      openAIApiKey: "test-openai-key",
      request: {
        surface: "journeys",
        sessionId: "session-3-discuss",
        message: "Tell me more about: Draft launch email",
        inputMode: "text",
        currentDateTime: "2026-04-18T08:00:00-07:00",
        selectedProposedAction: {
          type: "quest.create",
          title: "Draft launch email",
          summary: "Protect one launch block before the afternoon fills.",
          reason: "It fits the cleanest open window.",
          normalizedPayload: {
            title: "Draft launch email",
            date: "2026-04-18",
            startTime: "10:00",
            durationMinutes: 45,
            priority: "high",
          },
        },
        selectedProposedActionIntent: "discuss",
      },
    });

    assertEquals(result.mode, "schedule_read");
    assertEquals(result.intent, "schedule_task");
    assertEquals(result.understandingState, "ready_to_propose");
    assertEquals(result.pendingAction, undefined);
    assertEquals(result.threadState.hasPendingAction, false);
    assert(
      supabase.inserts.every((entry) =>
        entry.table !== "companion_pending_actions"
      ),
      "discussion-selected proposal should not become pending",
    );
  },
});

Deno.test({
  name:
    "runCompanionAgent ignores unsupported selected proposed actions even when the model approves drafting",
  fn: async () => {
    const supabase = createMockSupabase();
    const guardedFetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/conversations")) {
        return jsonResponse({ id: "conv_3" });
      }

      if (url.endsWith("/responses")) {
        return jsonResponse({
          id: "resp_3",
          conversation: { id: "conv_3" },
          output: [
            {
              type: "function_call",
              call_id: "call_submit",
              name: "submit_companion_result",
              arguments: JSON.stringify({
                reply: "I can talk through that calendar change first.",
                mode: "schedule_read",
                intent: "check_calendar",
                confidence: 0.87,
                understanding_state: "ready_to_draft",
              }),
            },
          ],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    const result = await runCompanionAgent({
      guardedFetch,
      supabase: supabase.client,
      userId: "00000000-0000-4000-8000-000000000001",
      openAIApiKey: "test-openai-key",
      request: {
        surface: "journeys",
        sessionId: "session-4",
        message: "Draft this: Move my dentist appointment",
        inputMode: "text",
        currentDateTime: "2026-04-18T08:00:00-07:00",
        selectedProposedAction: {
          type: "calendar.event.update",
          title: "Move my dentist appointment",
          summary: "Reschedule the appointment to Thursday afternoon.",
          reason:
            "The app cannot safely draft direct calendar event edits yet.",
          normalizedPayload: {
            eventId: "event-1",
            startTime: "15:00",
            date: "2026-04-23",
          },
        },
      },
    });

    assertEquals(result.mode, "schedule_read");
    assertEquals(result.intent, "check_calendar");
    assertEquals(result.understandingState, "ready_to_propose");
    assertEquals(result.pendingAction, undefined);
    assertEquals(result.threadState.hasPendingAction, false);
    assert(
      supabase.inserts.every((entry) =>
        entry.table !== "companion_pending_actions"
      ),
      "unsupported selected proposal should stay conversational",
    );
  },
});
