import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  buildToolDefinitions,
  DEFAULT_COMPANION_AGENT_MODEL,
  isCompanionScheduleReadFastPathRequest,
  resolveCompanionAgentModel,
  runCompanionAgent,
  runCompanionDraftOpportunity,
} from "./agent.ts";

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
  messages?: unknown[];
  tableData?: Record<string, unknown[]>;
  tableErrors?: Record<string, unknown>;
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
  selectedColumns?: string,
  options: MockSupabaseOptions = {},
): QueryResult {
  const configuredError =
    (selectedColumns
      ? options.tableErrors?.[`${table}:${operation}:${selectedColumns}`]
      : undefined) ??
      options.tableErrors?.[`${table}:${operation}`] ??
      options.tableErrors?.[table];
  if (configuredError) {
    return { data: null, error: configuredError };
  }

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
    return { data: options.messages ?? [], error: null, count: 0 };
  }

  if (operation === "select" && options.tableData?.[table]) {
    const rows = options.tableData[table] ?? [];
    return {
      data: maybeSingle ? rows[0] ?? null : rows,
      error: null,
      count: rows.length,
    };
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
    let selectedColumns: string | undefined;

    const builder = {
      select: (columns?: string, _options?: unknown) => {
        selectedColumns = columns;
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
          createQueryResult(
            table,
            operation,
            maybeSingle,
            value,
            selectedColumns,
            options,
          ),
        );
      },
      single: () =>
        Promise.resolve(
          createQueryResult(
            table,
            operation,
            true,
            value,
            selectedColumns,
            options,
          ),
        ),
      then: (
        resolve: (value: QueryResult) => unknown,
        reject?: (reason: unknown) => unknown,
      ) =>
        Promise.resolve(
          createQueryResult(
            table,
            operation,
            maybeSingle,
            value,
            selectedColumns,
            options,
          ),
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

function createModelQuestDraftAttemptFetch(params: {
  reply?: string;
  mode?: string;
  intent?: string;
  understandingState?: string;
  confidence?: number;
  proposedActions?: unknown[];
} = {}) {
  const responseBodies: Array<Record<string, unknown>> = [];
  const proposedActions = params.proposedActions ?? [
    {
      type: "quest.create",
      title: "Think About The Future",
      summary: "Add Think About The Future for tomorrow.",
      normalizedPayload: {
        title: "Think About The Future",
        date: "2026-04-19",
        durationMinutes: 30,
      },
      confidence: 0.86,
    },
  ];
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
              reply: params.reply ??
                "I drafted this as a quest. Review it and confirm if it fits.",
              mode: params.mode ?? "pending_confirmation",
              intent: params.intent ?? "schedule_task",
              confidence: params.confidence ?? 0.9,
              understanding_state: params.understandingState ??
                "ready_to_draft",
              proposed_actions: proposedActions,
            }),
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;

  return { guardedFetch, responseBodies };
}

function createInstructionAndDraftOpportunityFetch(params: {
  reply: string;
  decision: Record<string, unknown>;
}) {
  const responseBodies: Array<Record<string, unknown>> = [];
  const draftOpportunityBodies: Array<Record<string, unknown>> = [];
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
              reply: params.reply,
              mode: "conversation",
              intent: "unknown",
              confidence: 0.9,
              understanding_state: "enough_to_discuss",
            }),
          },
        ],
      });
    }

    if (url.endsWith("/chat/completions")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<
        string,
        unknown
      >;
      draftOpportunityBodies.push(body);
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify(params.decision),
            },
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;

  return { guardedFetch, responseBodies, draftOpportunityBodies };
}

function createOutputTextCaptureFetch(outputText = "I’m here.") {
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
        output_text: outputText,
        output: [],
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;

  return { guardedFetch, responseBodies };
}

function createRawMessageTextCaptureFetch(outputText = "I’m here.") {
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
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: outputText }],
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;

  return { guardedFetch, responseBodies };
}

function createResponseFailureFetch(params: {
  status: number;
  body: unknown;
  requestId?: string;
}) {
  const responseBodies: Array<Record<string, unknown>> = [];
  const guardedFetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(input);
    if (url.endsWith("/conversations")) {
      return jsonResponse({ id: "conv_provider_failure" });
    }

    if (url.endsWith("/responses")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<
        string,
        unknown
      >;
      responseBodies.push(body);
      return new Response(JSON.stringify(params.body), {
        status: params.status,
        headers: {
          "Content-Type": "application/json",
          ...(params.requestId ? { "x-request-id": params.requestId } : {}),
        },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;

  return { guardedFetch, responseBodies };
}

function getLatestAssistantAgentDecision(
  inserts: Array<{ table: string; value: unknown }>,
) {
  const chatInsert = inserts.find((entry) => entry.table === "companion_chats");
  const rows = Array.isArray(chatInsert?.value) ? chatInsert.value : [];
  const assistantRow = rows.find((row) =>
    row && typeof row === "object" &&
    (row as Record<string, unknown>).role === "assistant"
  ) as Record<string, unknown> | undefined;
  const metadata = assistantRow?.metadata as
    | Record<string, unknown>
    | undefined;
  return metadata?.agentDecision as Record<string, unknown> | undefined;
}

Deno.test("companion agent tools explicitly opt out of strict Responses schemas", () => {
  const tools = buildToolDefinitions();

  assert(tools.length > 0);
  for (const tool of tools) {
    assertEquals(tool.type, "function");
    assertEquals(tool.strict, false);
  }
});

Deno.test("resolveCompanionAgentModel uses default and env precedence", () => {
  assertEquals(
    resolveCompanionAgentModel(() => null),
    DEFAULT_COMPANION_AGENT_MODEL,
  );
  assertEquals(
    resolveCompanionAgentModel((name) =>
      name === "OPENAI_TEXT_MODEL" ? "gpt-4.1-mini" : null
    ),
    "gpt-4.1-mini",
  );
  assertEquals(
    resolveCompanionAgentModel((name) =>
      name === "OPENAI_COMPANION_AGENT_MODEL"
        ? "gpt-4.1"
        : name === "OPENAI_TEXT_MODEL"
        ? "gpt-4.1-mini"
        : null
    ),
    "gpt-4.1",
  );
});

Deno.test("runCompanionAgent keeps composer conversation chat-only when model does not draft", async () => {
  const supabase = createMockSupabase();
  const { guardedFetch, responseBodies } = createInstructionCaptureFetch(
    "Yeah, talk to me. What are you trying to untangle?",
  );

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-composer-chat-only",
      message: "I feel scattered today",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      turnOrigin: "composer",
    },
  });

  assertEquals(responseBodies[0]?.reasoning, { effort: "none" });
  assertEquals(result.mode, "conversation");
  assertEquals(result.understandingState, "enough_to_discuss");
  assertEquals(result.pendingAction, undefined);
  assertEquals(result.threadState.hasPendingAction, false);
  assertEquals(
    supabase.inserts.some((entry) =>
      entry.table === "companion_pending_actions"
    ),
    false,
  );
});

Deno.test("runCompanionAgent blocks non-explicit Companion reflections from quest drafts", async () => {
  const supabase = createMockSupabase();
  const { guardedFetch, responseBodies } = createModelQuestDraftAttemptFetch();

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "companion",
      sessionId: "session-companion-reflection-no-draft",
      message: "Just vibing. Thinking about the future",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      turnOrigin: "composer",
    },
  });

  const instructions = String(responseBodies[0]?.instructions ?? "");
  assert(
    instructions.includes(
      "This Companion tab turn has no explicit write request. Reply as direct natural chat only.",
    ),
    "expected Companion chat-only instruction for non-explicit turns",
  );
  assertEquals(result.mode, "conversation");
  assertEquals(result.intent, "unknown");
  assertEquals(result.understandingState, "enough_to_discuss");
  assert(
    result.reply.includes("without turning it into a quest"),
    "expected draft wording to be replaced with conversational fallback",
  );
  assertEquals(result.proposedActions, []);
  assertEquals(result.pendingAction, undefined);
  assertEquals(result.threadState.hasPendingAction, false);
  assertEquals(
    supabase.inserts.some((entry) =>
      entry.table === "companion_pending_actions"
    ),
    false,
  );
});

Deno.test("runCompanionAgent keeps conversational write verbs chat-only without planner targets", async () => {
  const cases = [
    {
      sessionId: "session-companion-create-future-no-draft",
      message: "I want to create a calmer future",
    },
    {
      sessionId: "session-companion-add-joy-no-draft",
      message: "Trying to add more joy to my life",
    },
    {
      sessionId: "session-companion-can-we-create-no-draft",
      message: "Can we create a calmer future together?",
    },
  ];

  for (const testCase of cases) {
    const supabase = createMockSupabase();
    const { guardedFetch, responseBodies } =
      createModelQuestDraftAttemptFetch();

    const result = await runCompanionAgent({
      guardedFetch,
      supabase: supabase.client,
      userId: "00000000-0000-4000-8000-000000000001",
      openAIApiKey: "test-openai-key",
      request: {
        surface: "companion",
        sessionId: testCase.sessionId,
        message: testCase.message,
        inputMode: "text",
        currentDateTime: "2026-04-18T08:00:00-07:00",
        turnOrigin: "composer",
      },
    });

    const instructions = String(responseBodies[0]?.instructions ?? "");
    assert(
      instructions.includes(
        "This Companion tab turn has no explicit write request. Reply as direct natural chat only.",
      ),
      `expected chat-only instruction for ${testCase.message}`,
    );
    assertEquals(result.mode, "conversation");
    assertEquals(result.intent, "unknown");
    assertEquals(result.understandingState, "enough_to_discuss");
    assertEquals(result.pendingAction, undefined);
    assertEquals(result.threadState.hasPendingAction, false);
    assertEquals(
      supabase.inserts.some((entry) =>
        entry.table === "companion_pending_actions"
      ),
      false,
    );
  }
});

Deno.test("runCompanionAgent allows explicit Companion quest creation requests to draft", async () => {
  const supabase = createMockSupabase();
  const { guardedFetch, responseBodies } = createModelQuestDraftAttemptFetch({
    reply:
      "I drafted this quest for tomorrow. Review it and confirm if it fits.",
  });

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "companion",
      sessionId: "session-companion-explicit-draft",
      message: "Create a quest to think about my future tomorrow",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      turnOrigin: "composer",
    },
  });

  const instructions = String(responseBodies[0]?.instructions ?? "");
  assert(
    !instructions.includes(
      "This Companion tab turn has no explicit write request.",
    ),
    "explicit Companion write requests should not use chat-only instructions",
  );
  assertEquals(result.mode, "pending_confirmation");
  assertEquals(result.intent, "schedule_task");
  assertEquals(result.understandingState, "ready_to_draft");
  assertEquals(result.pendingAction?.actionType, "task_create");
  assertEquals(
    result.pendingAction?.normalizedPayload.title,
    "Think About The Future",
  );
  assertEquals(result.threadState.hasPendingAction, true);
});

Deno.test("runCompanionAgent allows targeted Companion create requests to draft", async () => {
  const supabase = createMockSupabase();
  const { guardedFetch, responseBodies } = createModelQuestDraftAttemptFetch({
    reply:
      "I drafted this quest for tomorrow. Review it and confirm if it fits.",
  });

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "companion",
      sessionId: "session-companion-targeted-create-draft",
      message: "Can you create a quest to think about my future tomorrow?",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      turnOrigin: "composer",
    },
  });

  const instructions = String(responseBodies[0]?.instructions ?? "");
  assert(
    !instructions.includes(
      "This Companion tab turn has no explicit write request.",
    ),
    "targeted create requests should not use chat-only instructions",
  );
  assertEquals(result.mode, "pending_confirmation");
  assertEquals(result.intent, "schedule_task");
  assertEquals(result.pendingAction?.actionType, "task_create");
});

Deno.test("runCompanionAgent allows explicit Companion schedule requests without time anchors", async () => {
  const supabase = createMockSupabase();
  const { guardedFetch, responseBodies } = createModelQuestDraftAttemptFetch({
    reply: "I drafted this quest. Review it and confirm if it fits.",
    proposedActions: [
      {
        type: "quest.create",
        title: "Dentist Appointment",
        summary: "Add Dentist Appointment.",
        normalizedPayload: {
          title: "Dentist Appointment",
        },
        confidence: 0.86,
      },
    ],
  });

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "companion",
      sessionId: "session-companion-explicit-schedule-no-anchor",
      message: "Schedule a dentist appointment",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      turnOrigin: "composer",
    },
  });

  const instructions = String(responseBodies[0]?.instructions ?? "");
  assert(
    !instructions.includes(
      "This Companion tab turn has no explicit write request.",
    ),
    "schedule commands should not use chat-only instructions",
  );
  assertEquals(result.mode, "pending_confirmation");
  assertEquals(result.intent, "schedule_task");
  assertEquals(result.pendingAction?.actionType, "task_create");
  assertEquals(
    result.pendingAction?.normalizedPayload.title,
    "Dentist Appointment",
  );
});

Deno.test("runCompanionAgent allows explicit Companion move requests to draft updates", async () => {
  const supabase = createMockSupabase();
  const { guardedFetch, responseBodies } = createModelQuestDraftAttemptFetch({
    reply: "I prepared this move. Review it and confirm if it fits.",
    intent: "update_existing_plan",
    proposedActions: [
      {
        type: "task.update",
        title: "Move Gym",
        summary: "Move Gym to tomorrow at 3:00 PM.",
        normalizedPayload: {
          task_id: "11111111-1111-4111-8111-111111111111",
          title: "Gym",
          date: "2026-04-19",
          startTime: "15:00",
        },
        confidence: 0.86,
      },
    ],
  });

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "companion",
      sessionId: "session-companion-explicit-move",
      message: "Move Gym to tomorrow at 3",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      turnOrigin: "composer",
    },
  });

  const instructions = String(responseBodies[0]?.instructions ?? "");
  assert(
    !instructions.includes(
      "This Companion tab turn has no explicit write request.",
    ),
    "move commands should not use chat-only instructions",
  );
  assertEquals(result.mode, "pending_confirmation");
  assertEquals(result.intent, "update_existing_plan");
  assertEquals(result.pendingAction?.actionType, "task_update");
  assertEquals(
    result.pendingAction?.normalizedPayload.task_id,
    "11111111-1111-4111-8111-111111111111",
  );
});

Deno.test("runCompanionAgent allows explicit Companion extended update verbs to draft", async () => {
  const supabase = createMockSupabase();
  const { guardedFetch, responseBodies } = createModelQuestDraftAttemptFetch({
    reply: "I prepared this shift. Review it and confirm if it fits.",
    intent: "update_existing_plan",
    proposedActions: [
      {
        type: "task.update",
        title: "Shift Gym",
        summary: "Shift Gym to tomorrow at 3:00 PM.",
        normalizedPayload: {
          task_id: "11111111-1111-4111-8111-111111111111",
          title: "Gym",
          date: "2026-04-19",
          startTime: "15:00",
        },
        confidence: 0.86,
      },
    ],
  });

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "companion",
      sessionId: "session-companion-explicit-shift",
      message: "Shift Gym to tomorrow at 3",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      turnOrigin: "composer",
    },
  });

  const instructions = String(responseBodies[0]?.instructions ?? "");
  assert(
    !instructions.includes(
      "This Companion tab turn has no explicit write request.",
    ),
    "shift commands should not use chat-only instructions",
  );
  assertEquals(result.mode, "pending_confirmation");
  assertEquals(result.intent, "update_existing_plan");
  assertEquals(result.pendingAction?.actionType, "task_update");
});

Deno.test("runCompanionAgent downgrades non-explicit Companion ready-to-propose states", async () => {
  const supabase = createMockSupabase();
  const { guardedFetch } = createModelQuestDraftAttemptFetch({
    reply: "That sounds like a tender thing to think through.",
    mode: "conversation",
    intent: "plan_day",
    understandingState: "ready_to_propose",
    proposedActions: [],
  });

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "companion",
      sessionId: "session-companion-ready-to-propose-no-draft",
      message: "Just thinking about what kind of future I want",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      turnOrigin: "composer",
    },
  });

  assertEquals(result.mode, "conversation");
  assertEquals(result.intent, "unknown");
  assertEquals(result.understandingState, "enough_to_discuss");
  assertEquals(result.pendingAction, undefined);
  assertEquals(result.threadState.hasPendingAction, false);
});

Deno.test("runCompanionAgent allows selected Companion proposed actions to draft", async () => {
  const supabase = createMockSupabase();
  const { guardedFetch } = createModelQuestDraftAttemptFetch({
    reply: "I pulled that suggestion into a quest draft.",
    proposedActions: [],
  });

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "companion",
      sessionId: "session-companion-selected-draft",
      message: "Draft it",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      turnOrigin: "proposed_action",
      selectedProposedActionIntent: "draft",
      selectedProposedAction: {
        type: "quest.create",
        title: "Think About The Future",
        summary: "Add Think About The Future for tomorrow.",
        normalizedPayload: {
          title: "Think About The Future",
          date: "2026-04-19",
          durationMinutes: 30,
        },
      },
    },
  });

  assertEquals(result.mode, "pending_confirmation");
  assertEquals(result.intent, "schedule_task");
  assertEquals(result.pendingAction?.actionType, "task_create");
  assertEquals(
    result.pendingAction?.normalizedPayload.title,
    "Think About The Future",
  );
});

Deno.test("runCompanionDraftOpportunity surfaces a concrete quest sidecar draft as a suggestion card", async () => {
  const supabase = createMockSupabase();
  const { guardedFetch, draftOpportunityBodies } =
    createInstructionAndDraftOpportunityFetch({
      reply: "That sounds like a clean thing to put on the board.",
      decision: {
        decision: "prepare_action",
        action_type: "task_create",
        title: "Review launch notes",
        summary: "Add Review launch notes for tomorrow morning.",
        reason: "The user gave a concrete quest and time.",
        normalized_payload: {
          title: "Review launch notes",
          task_date: "2026-04-19",
          scheduled_time: "09:00",
          estimated_duration: 30,
        },
        confidence: 0.87,
      },
    });

  const result = await runCompanionDraftOpportunity({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-draft-sidecar-task",
      message: "Review launch notes tomorrow at 9",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      turnOrigin: "composer",
      assistantReply: "That sounds like a clean thing to put on the board.",
      assistantMode: "conversation",
      assistantIntent: "unknown",
      assistantConfidence: 0.9,
      assistantUnderstandingState: "enough_to_discuss",
    },
  });

  assertEquals(draftOpportunityBodies.length, 1);
  assertEquals(draftOpportunityBodies[0]?.reasoning_effort, "none");
  assertEquals(
    (draftOpportunityBodies[0]?.messages as Array<{ role?: string }>)[0]?.role,
    "developer",
  );
  assertEquals(result.understandingState, "ready_to_propose");
  assertEquals(result.proposedActions[0]?.type, "task_create");
  assertEquals(
    result.proposedActions[0]?.normalizedPayload?.title,
    "Review launch notes",
  );
  assertEquals(
    supabase.inserts.some((entry) =>
      entry.table === "companion_pending_actions"
    ),
    false,
  );

  assertEquals(result.draftOpportunity?.source, "draft_opportunity");
});

Deno.test("runCompanionDraftOpportunity surfaces sidecar campaign starts as builder suggestions", async () => {
  const supabase = createMockSupabase();
  const { guardedFetch, draftOpportunityBodies } =
    createInstructionAndDraftOpportunityFetch({
      reply: "That sounds bigger than a single quest.",
      decision: {
        decision: "open_campaign_builder",
        action_type: "campaign_start",
        title: "Launch the course",
        summary: "Open the campaign builder with this goal.",
        reason: "The user described a broad goal.",
        normalized_payload: {
          initialGoal: "Launch the course",
        },
        confidence: 0.82,
      },
    });

  const result = await runCompanionDraftOpportunity({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-draft-sidecar-campaign-start",
      message: "I want to launch my course by the end of next month",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      turnOrigin: "composer",
      assistantReply: "That sounds bigger than a single quest.",
      assistantMode: "conversation",
      assistantIntent: "unknown",
      assistantConfidence: 0.9,
      assistantUnderstandingState: "enough_to_discuss",
    },
  });

  assertEquals(draftOpportunityBodies.length, 1);
  assertEquals(result.intent, "goal_setting");
  assertEquals(result.understandingState, "ready_to_propose");
  assertEquals(result.proposedActions[0]?.type, "campaign_start");
  assertEquals(
    result.proposedActions[0]?.normalizedPayload?.initialGoal,
    "Launch the course",
  );
  assertEquals(
    supabase.inserts.some((entry) =>
      entry.table === "companion_pending_actions"
    ),
    false,
  );
});

Deno.test("runCompanionDraftOpportunity ignores sidecar follow-up decisions", async () => {
  const supabase = createMockSupabase();
  const { guardedFetch, draftOpportunityBodies } =
    createInstructionAndDraftOpportunityFetch({
      reply: "We can shape that together.",
      decision: {
        decision: "ask_user",
        action_type: "task_create",
        question: "Should I draft a quest?",
        options: ["Yes", "No"],
        confidence: 0.77,
      },
    });

  const result = await runCompanionDraftOpportunity({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-draft-sidecar-ask-user",
      message: "Maybe I should call my parents",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      turnOrigin: "composer",
      assistantReply: "We can shape that together.",
      assistantMode: "conversation",
      assistantIntent: "unknown",
      assistantConfidence: 0.9,
      assistantUnderstandingState: "enough_to_discuss",
    },
  });

  assertEquals(draftOpportunityBodies.length, 1);
  assertEquals(result.followUp, null);
  assertEquals(result.proposedActions, []);
  assertEquals(result.draftOpportunity, null);
});

Deno.test("runCompanionAgent uses bare starter follow-up when OpenAI is not configured", async () => {
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
  assertEquals(result.confidence, 0.8);
  assertEquals(result.mode, "clarify");
  assertEquals(result.intent, "plan_day");
  assertEquals(result.threadState.sessionId, "session-1");
  assert(result.reply.length > 0);
  assert(result.reply.toLowerCase().includes("focus"));
  assert(
    supabase.inserts.some((entry) => entry.table === "companion_chats"),
    "expected bare starter turn to be persisted",
  );
});

Deno.test("runCompanionAgent asks a follow-up instead of proposing quests for bare Plan my day", async () => {
  const supabase = createMockSupabase();
  let guardedFetchCalled = false;
  const guardedFetch = (async (input: string | URL | Request) => {
    guardedFetchCalled = true;
    throw new Error(
      `Bare Plan my day should not call OpenAI: ${String(input)}`,
    );
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

  assertEquals(guardedFetchCalled, false);
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

Deno.test("runCompanionAgent triages contextual Plan my day without OpenAI", async () => {
  const supabase = createMockSupabase({
    tableData: {
      daily_tasks: [
        {
          id: "missed-task",
          task_text: "Missed admin",
          task_date: "2026-04-18",
          scheduled_time: "08:00",
          estimated_duration: 20,
          completed: false,
        },
        {
          id: "ritual-task",
          task_text: "Campaign focus ritual",
          task_date: "2026-04-18",
          scheduled_time: "09:00",
          estimated_duration: 20,
          completed: false,
          epic_id: "epic-launch",
          habit_source_id: "ritual-focus",
        },
        {
          id: "campaign-task",
          task_text: "Draft launch notes",
          task_date: "2026-04-18",
          scheduled_time: null,
          estimated_duration: 45,
          completed: false,
          epic_id: "epic-launch",
          priority: "high",
        },
      ],
      epics: [
        {
          id: "epic-launch",
          title: "Launch campaign",
          status: "active",
          completed_at: null,
          end_date: "2026-05-01",
          progress_percentage: 30,
        },
      ],
      epic_habits: [
        {
          epic_id: "epic-launch",
          habit_id: "ritual-focus",
          habits: {
            id: "ritual-focus",
            title: "Campaign focus ritual",
            frequency: "daily",
            preferred_time: "09:00",
            estimated_minutes: 20,
            custom_days: null,
            custom_month_days: null,
            is_active: true,
          },
        },
      ],
    },
  });
  let guardedFetchCalled = false;
  const guardedFetch = (async (input: string | URL | Request) => {
    guardedFetchCalled = true;
    throw new Error(
      `Contextual Plan my day should not call OpenAI: ${String(input)}`,
    );
  }) as typeof fetch;

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-contextual-plan-day",
      message: "Plan my day",
      inputMode: "text",
      currentDateTime: "2026-04-18T10:30:00-07:00",
      starterIntent: "plan_day",
      turnOrigin: "launcher",
      selectedDate: "2026-04-18",
      briefingContext: {
        content:
          "Planning snapshot for Saturday, April 18: 3 open quests, 1 rituals, 1 active campaigns",
        dataSnapshot: {
          selectedDate: "2026-04-18",
          ritualQuestCount: 1,
          activeCampaignTitles: ["Launch campaign"],
        },
      },
    },
  });

  assertEquals(guardedFetchCalled, false);
  assertEquals(result.mode, "conversation");
  assertEquals(result.intent, "plan_day");
  assertEquals(result.followUp, null);
  assertEquals(result.reply.includes("focus, recovery, or catching up"), false);
  assert(result.reply.includes("Missed or slipped quests"));
  assert(result.reply.includes("Campaign work to protect"));
  assert(result.reply.includes("Rituals due or linked today"));
  assert(result.reply.includes("Protected priorities"));
  assertEquals(result.structuredResponse?.planDay?.campaignFocus?.campaignTitle, "Launch campaign");
});

Deno.test("runCompanionAgent answers typed upcoming schedule reads without OpenAI", async () => {
  for (
    const message of [
      "What do I have coming up?",
      "What do I hgave coming up?",
    ]
  ) {
    const supabase = createMockSupabase();
    let guardedFetchCalled = false;
    const guardedFetch = (async (input: string | URL | Request) => {
      guardedFetchCalled = true;
      throw new Error(
        `Upcoming schedule reads should not call OpenAI: ${String(input)}`,
      );
    }) as typeof fetch;

    const result = await runCompanionAgent({
      guardedFetch,
      supabase: supabase.client,
      userId: "00000000-0000-4000-8000-000000000001",
      openAIApiKey: "test-openai-key",
      request: {
        surface: "journeys",
        sessionId: `session-upcoming-${
          message.includes("hgave") ? "typo" : "exact"
        }`,
        message,
        inputMode: "text",
        currentDateTime: "2026-04-18T20:32:00-07:00",
        turnOrigin: "composer",
      },
    });

    assertEquals(guardedFetchCalled, false);
    assertEquals(result.mode, "schedule_read");
    assertEquals(result.intent, "check_calendar");
    assertEquals(result.understandingState, "ready_to_propose");
    assertEquals(
      result.reply,
      "Today: nothing scheduled.\nTomorrow: nothing scheduled.",
    );
    assertEquals(result.structuredResponse?.comingUp?.tomorrowSummary, "open");
    assertEquals(result.followUp, null);
    assertEquals(result.pendingAction, undefined);
  }
});

Deno.test("runCompanionAgent includes active campaign rituals in upcoming reads without OpenAI", async () => {
  const supabase = createMockSupabase({
    tableData: {
      epics: [
        {
          id: "epic-launch",
          title: "Launch campaign",
          status: "active",
          completed_at: null,
          end_date: "2026-05-01",
          progress_percentage: 25,
        },
      ],
      epic_habits: [
        {
          epic_id: "epic-launch",
          habit_id: "ritual-focus",
          habits: {
            id: "ritual-focus",
            title: "Campaign focus ritual",
            frequency: "daily",
            preferred_time: "12:00",
            estimated_minutes: 20,
            custom_days: null,
            custom_month_days: null,
            is_active: true,
          },
        },
      ],
    },
  });
  let guardedFetchCalled = false;
  const guardedFetch = (async (input: string | URL | Request) => {
    guardedFetchCalled = true;
    throw new Error(
      `Upcoming schedule reads should not call OpenAI: ${String(input)}`,
    );
  }) as typeof fetch;

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-upcoming-campaign-ritual",
      message: "What do I have coming up?",
      inputMode: "text",
      currentDateTime: "2026-04-18T10:30:00-07:00",
      turnOrigin: "composer",
    },
  });

  assertEquals(guardedFetchCalled, false);
  assertEquals(result.mode, "schedule_read");
  assertEquals(result.reply.includes("Campaign focus ritual"), true);
  assertEquals(
    result.structuredResponse?.comingUp?.remainingToday.some((item) =>
      item.title === "Campaign focus ritual" && item.source === "ritual"
    ),
    true,
  );
});

Deno.test("runCompanionAgent includes active standalone rituals due tomorrow in upcoming reads without OpenAI", async () => {
  const supabase = createMockSupabase({
    tableData: {
      habits: [
        {
          id: "ritual-standalone",
          title: "Morning standalone ritual",
          frequency: "daily",
          preferred_time: "08:00",
          estimated_minutes: 20,
          custom_days: null,
          custom_month_days: null,
          is_active: true,
        },
      ],
    },
  });
  let guardedFetchCalled = false;
  const guardedFetch = (async (input: string | URL | Request) => {
    guardedFetchCalled = true;
    throw new Error(
      `Upcoming schedule reads should not call OpenAI: ${String(input)}`,
    );
  }) as typeof fetch;

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-upcoming-standalone-ritual",
      message: "What do I have coming up?",
      inputMode: "text",
      currentDateTime: "2026-04-18T20:32:00-07:00",
      turnOrigin: "composer",
    },
  });

  assertEquals(guardedFetchCalled, false);
  assertEquals(result.mode, "schedule_read");
  assertEquals(result.reply.includes("Tomorrow: nothing scheduled."), false);
  assertEquals(result.reply.includes("Morning standalone ritual"), true);
  assertEquals(
    result.structuredResponse?.comingUp?.tomorrowSchedule?.some((item) =>
      item.title === "Morning standalone ritual" && item.source === "ritual"
    ),
    true,
  );
});

Deno.test("runCompanionAgent uses selected date for upcoming campaign ritual reads", async () => {
  const supabase = createMockSupabase({
    tableData: {
      epics: [
        {
          id: "epic-launch",
          title: "Launch campaign",
          status: "active",
          completed_at: null,
          end_date: "2026-05-01",
          progress_percentage: 25,
        },
      ],
      epic_habits: [
        {
          epic_id: "epic-launch",
          habit_id: "ritual-tuesday",
          habits: {
            id: "ritual-tuesday",
            title: "Tuesday campaign ritual",
            frequency: "weekly",
            preferred_time: "09:00",
            estimated_minutes: 20,
            custom_days: [1],
            custom_month_days: null,
            is_active: true,
          },
        },
      ],
    },
  });
  let guardedFetchCalled = false;
  const guardedFetch = (async (input: string | URL | Request) => {
    guardedFetchCalled = true;
    throw new Error(
      `Upcoming schedule reads should not call OpenAI: ${String(input)}`,
    );
  }) as typeof fetch;

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-upcoming-selected-campaign-ritual",
      message: "What do I have coming up?",
      inputMode: "text",
      currentDateTime: "2026-04-18T10:30:00-07:00",
      selectedDate: "2026-04-21",
      turnOrigin: "composer",
    },
  });

  assertEquals(guardedFetchCalled, false);
  assertEquals(result.mode, "schedule_read");
  assertEquals(result.reply.includes("Tuesday campaign ritual"), true);
});

Deno.test("runCompanionAgent answers upcoming reads even with stale UI follow-up context", async () => {
  const supabase = createMockSupabase();
  let guardedFetchCalled = false;
  const guardedFetch = (async (input: string | URL | Request) => {
    guardedFetchCalled = true;
    throw new Error(
      `Upcoming schedule reads should not call OpenAI: ${String(input)}`,
    );
  }) as typeof fetch;

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-upcoming-stale-follow-up",
      message: "What do I have coming up?",
      inputMode: "text",
      currentDateTime: "2026-04-18T20:32:00-07:00",
      turnOrigin: "composer",
      activeFollowUp: {
        question: "Should today lean focus, recovery, or catching up?",
        reason:
          "That choice changes whether I protect deep work, lighten the load, or triage overdue items.",
        expectedAnswerType: "choice",
        options: ["Focus", "Recovery", "Catch up"],
        blocksDrafting: true,
      },
      activeProposedActions: [
        {
          type: "task_create",
          summary: "Stale previous suggestion",
          normalizedPayload: { title: "Stale previous suggestion" },
        },
      ],
    },
  });

  assertEquals(guardedFetchCalled, false);
  assertEquals(result.mode, "schedule_read");
  assertEquals(result.intent, "check_calendar");
  assertEquals(
    result.reply,
    "Today: nothing scheduled.\nTomorrow: nothing scheduled.",
  );
  assertEquals(result.followUp, null);
  assertEquals(result.proposedActions, []);
  assertEquals(result.pendingAction, undefined);
});

Deno.test("runCompanionAgent answers launcher upcoming schedule reads without OpenAI", async () => {
  const supabase = createMockSupabase();
  let guardedFetchCalled = false;
  const guardedFetch = (async (input: string | URL | Request) => {
    guardedFetchCalled = true;
    throw new Error(
      `Upcoming launcher schedule reads should not call OpenAI: ${
        String(input)
      }`,
    );
  }) as typeof fetch;

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-upcoming-launcher",
      message: "What do I have coming up?",
      inputMode: "text",
      currentDateTime: "2026-04-18T20:32:00-07:00",
      turnOrigin: "launcher",
      starterIntent: "upcoming_start",
    },
  });

  assertEquals(guardedFetchCalled, false);
  assertEquals(result.mode, "schedule_read");
  assertEquals(result.intent, "check_calendar");
  assertEquals(
    result.reply,
    "Today: nothing scheduled.\nTomorrow: nothing scheduled.",
  );
  assertEquals(result.structuredResponse?.comingUp?.tomorrowSummary, "open");
  assertEquals(result.followUp, null);
  assertEquals(result.proposedActions, []);
  assertEquals(result.pendingAction, undefined);
});

Deno.test("runCompanionAgent answers upcoming reads when optional companion identity columns are missing", async () => {
  const supabase = createMockSupabase({
    tableErrors: {
      "user_companion:select:id, companion_name, cached_creature_name, preset_id, spirit_animal, core_element, current_stage, current_mood":
        {
          message: "column user_companion.cached_creature_name does not exist",
          code: "42703",
        },
    },
  });
  let guardedFetchCalled = false;
  const guardedFetch = (async (input: string | URL | Request) => {
    guardedFetchCalled = true;
    throw new Error(
      `Upcoming launcher schedule reads should not call OpenAI: ${
        String(input)
      }`,
    );
  }) as typeof fetch;

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    requestId: "request-companion-identity-fallback",
    request: {
      surface: "journeys",
      sessionId: "session-upcoming-companion-identity-fallback",
      message: "What do I have coming up?",
      inputMode: "text",
      currentDateTime: "2026-04-18T20:32:00-07:00",
      turnOrigin: "launcher",
      starterIntent: "upcoming_start",
    },
  });

  assertEquals(guardedFetchCalled, false);
  assertEquals(result.mode, "schedule_read");
  assertEquals(result.intent, "check_calendar");
  assertEquals(
    result.reply,
    "Today: nothing scheduled.\nTomorrow: nothing scheduled.",
  );
});

Deno.test("isCompanionScheduleReadFastPathRequest excludes proposal action turns", () => {
  assertEquals(
    isCompanionScheduleReadFastPathRequest({
      surface: "journeys",
      sessionId: "session-fast-path",
      message: "What do I have coming up?",
      inputMode: "text",
      currentDateTime: "2026-04-18T20:32:00-07:00",
      starterIntent: "upcoming_start",
    }),
    true,
  );
  assertEquals(
    isCompanionScheduleReadFastPathRequest({
      surface: "journeys",
      sessionId: "session-selected-action",
      message: "What do I have coming up?",
      inputMode: "text",
      currentDateTime: "2026-04-18T20:32:00-07:00",
      starterIntent: "upcoming_start",
      selectedProposedAction: {
        type: "task_create",
        title: "Draft launch email",
        normalizedPayload: { title: "Draft launch email" },
      },
    }),
    false,
  );
});

Deno.test("runCompanionAgent answers upcoming reads when optional context fails", async () => {
  const supabase = createMockSupabase({
    tableErrors: {
      "profiles:select": {
        message: "profiles optional context unavailable",
        code: "PGRST000",
      },
      "user_ai_preferences:select": {
        message: "user_ai_preferences optional context unavailable",
        code: "PGRST000",
      },
      "companion_memories:select": {
        message: "companion_memories optional context unavailable",
        code: "PGRST000",
      },
      "user_reflections:select": {
        message: "user_reflections optional context unavailable",
        code: "PGRST000",
      },
      "daily_check_ins:select": {
        message: "daily_check_ins optional context unavailable",
        code: "PGRST000",
      },
    },
  });
  let guardedFetchCalled = false;
  const guardedFetch = (async (input: string | URL | Request) => {
    guardedFetchCalled = true;
    throw new Error(
      `Optional context failures should not call OpenAI: ${String(input)}`,
    );
  }) as typeof fetch;

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-upcoming-optional-context-failure",
      message: "What do I have coming up?",
      inputMode: "text",
      currentDateTime: "2026-04-18T20:32:00-07:00",
      turnOrigin: "launcher",
      starterIntent: "upcoming_start",
    },
  });

  assertEquals(guardedFetchCalled, false);
  assertEquals(result.mode, "schedule_read");
  assertEquals(result.intent, "check_calendar");
  assertEquals(
    result.reply,
    "Today: nothing scheduled.\nTomorrow: nothing scheduled.",
  );
  assertEquals(result.structuredResponse?.comingUp?.tomorrowSummary, "open");
});

Deno.test("runCompanionAgent returns upcoming digest when chat persistence fails", async () => {
  const supabase = createMockSupabase({
    tableErrors: {
      "companion_chats:insert": {
        message: "companion_chats insert failed",
        code: "23514",
      },
    },
  });
  let guardedFetchCalled = false;
  const guardedFetch = (async (input: string | URL | Request) => {
    guardedFetchCalled = true;
    throw new Error(
      `Persistence failures should not call OpenAI: ${String(input)}`,
    );
  }) as typeof fetch;

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    requestId: "request-persistence-failure",
    request: {
      surface: "journeys",
      sessionId: "session-upcoming-persistence-failure",
      message: "What do I have coming up?",
      inputMode: "text",
      currentDateTime: "2026-04-18T20:32:00-07:00",
      turnOrigin: "launcher",
      starterIntent: "upcoming_start",
    },
  });

  assertEquals(guardedFetchCalled, false);
  assertEquals(result.mode, "schedule_read");
  assertEquals(result.intent, "check_calendar");
  assertEquals(
    result.reply,
    "Today: nothing scheduled.\nTomorrow: nothing scheduled.",
  );
});

Deno.test("runCompanionAgent still reaches OpenAI when optional context fails", async () => {
  const supabase = createMockSupabase({
    tableErrors: {
      "profiles:select": {
        message: "profiles optional context unavailable",
        code: "PGRST000",
      },
      "user_ai_preferences:select": {
        message: "user_ai_preferences optional context unavailable",
        code: "PGRST000",
      },
      "companion_memories:select": {
        message: "companion_memories optional context unavailable",
        code: "PGRST000",
      },
      "user_reflections:select": {
        message: "user_reflections optional context unavailable",
        code: "PGRST000",
      },
      "daily_check_ins:select": {
        message: "daily_check_ins optional context unavailable",
        code: "PGRST000",
      },
    },
  });
  const { guardedFetch, responseBodies } = createInstructionCaptureFetch(
    "We can talk that through without turning it into a planner action yet.",
  );

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    requestId: "request-optional-context-chat",
    request: {
      surface: "journeys",
      sessionId: "session-optional-context-chat",
      message: "Can you help me think through the weekend?",
      inputMode: "text",
      currentDateTime: "2026-04-18T20:32:00-07:00",
      turnOrigin: "composer",
    },
  });

  assertEquals(responseBodies.length, 1);
  assertEquals(result.mode, "conversation");
  assertEquals(result.intent, "unknown");
  assertEquals(
    result.reply,
    "We can talk that through without turning it into a planner action yet.",
  );
});

Deno.test("runCompanionAgent returns AI replies when chat persistence fails", async () => {
  const supabase = createMockSupabase({
    tableErrors: {
      "companion_chats:insert": {
        message: "companion_chats insert failed",
        code: "23514",
      },
    },
  });
  const { guardedFetch, responseBodies } = createInstructionCaptureFetch(
    "Absolutely. Let's sort the pieces first.",
  );

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    requestId: "request-ai-persistence-failure",
    request: {
      surface: "journeys",
      sessionId: "session-ai-persistence-failure",
      message: "I need help organizing my thoughts.",
      inputMode: "text",
      currentDateTime: "2026-04-18T20:32:00-07:00",
      turnOrigin: "composer",
    },
  });

  assertEquals(responseBodies.length, 1);
  assertEquals(result.mode, "conversation");
  assertEquals(result.intent, "unknown");
  assertEquals(result.reply, "Absolutely. Let's sort the pieces first.");
});

Deno.test("runCompanionAgent returns in-chat failure when core upcoming context fails", async () => {
  const supabase = createMockSupabase({
    tableErrors: {
      "daily_tasks:select": {
        message: "daily_tasks core context unavailable",
        code: "PGRST000",
      },
      "habits:select": {
        message: "habits core context unavailable",
        code: "PGRST000",
      },
      "epics:select": {
        message: "epics core context unavailable",
        code: "PGRST000",
      },
      "external_calendar_events:select": {
        message: "external_calendar_events core context unavailable",
        code: "PGRST000",
      },
    },
  });
  let guardedFetchCalled = false;
  const guardedFetch = (async (input: string | URL | Request) => {
    guardedFetchCalled = true;
    throw new Error(
      `Core context failures should not call OpenAI: ${String(input)}`,
    );
  }) as typeof fetch;

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    requestId: "request-core-context-failure",
    request: {
      surface: "journeys",
      sessionId: "session-upcoming-core-context-failure",
      message: "What do I have coming up?",
      inputMode: "text",
      currentDateTime: "2026-04-18T20:32:00-07:00",
      turnOrigin: "launcher",
      starterIntent: "upcoming_start",
    },
  });

  assertEquals(guardedFetchCalled, false);
  assertEquals(result.mode, "schedule_read");
  assertEquals(result.intent, "check_calendar");
  assert(
    result.reply.includes("couldn’t load your planner"),
    "expected an in-chat load failure instead of a thrown error",
  );
  assertEquals(result.structuredResponse, null);
});

Deno.test("runCompanionAgent routes plan-day follow-up answers through the planner", async () => {
  const supabase = createMockSupabase();
  let guardedFetchCalled = false;
  const guardedFetch = (async (input: string | URL | Request) => {
    guardedFetchCalled = true;
    throw new Error(
      `Plan-day follow-up should not call OpenAI: ${String(input)}`,
    );
  }) as typeof fetch;

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-plan-day-follow-up",
      message: "Recovery",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      turnOrigin: "follow_up_option",
      activeFollowUp: {
        question: "Should today lean focus, recovery, or catching up?",
        reason:
          "That choice changes whether I protect deep work, lighten the load, or triage overdue items.",
        expectedAnswerType: "choice",
        options: ["Focus", "Recovery", "Catch up"],
        blocksDrafting: true,
      },
      activeProposedActions: [
        {
          type: "quest.create",
          title: "Stale previous suggestion",
          normalizedPayload: { title: "Stale previous suggestion" },
        },
      ],
    },
  });

  assertEquals(guardedFetchCalled, false);
  assertEquals(result.mode, "conversation");
  assertEquals(result.intent, "plan_day");
  assertEquals(result.understandingState, "enough_to_discuss");
  assertEquals(result.followUp, null);
  assertEquals(result.proposedActions, []);
  assertEquals(result.structuredResponse?.planDay?.suggestedQuests.length, 0);
  assertEquals(result.pendingAction, undefined);
  assert(result.reply !== "I'm here.");
  assert(result.reply.length > 10);
});

Deno.test("runCompanionAgent lets composer text pivot from a plan-day follow-up through OpenAI", async () => {
  const supabase = createMockSupabase();
  const { guardedFetch, responseBodies } = createInstructionCaptureFetch(
    "Totally. We can talk through the essay without turning it into a quest yet.",
  );

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-plan-day-composer-pivot",
      message: "Finish my essay",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      turnOrigin: "composer",
      activeFollowUp: {
        question: "Should today lean focus, recovery, or catching up?",
        reason:
          "That choice changes whether I protect deep work, lighten the load, or triage overdue items.",
        expectedAnswerType: "choice",
        options: ["Focus", "Recovery", "Catch up"],
        blocksDrafting: true,
      },
    },
  });

  assertEquals(responseBodies.length, 1);
  assertEquals(result.mode, "conversation");
  assertEquals(result.intent, "unknown");
  assertEquals(result.followUp, null);
  assertEquals(result.pendingAction, undefined);
  assert(
    !result.reply.includes("Would you like to form a quest?"),
    "composer text should not be forced into the quest-consent follow-up",
  );

  const contextInput =
    (responseBodies[0] as { input: Array<{ content?: string }> })
      .input.find((entry) => entry.content?.startsWith("APP_CONTEXT_PACKET"));
  assert(contextInput?.content, "expected context packet input");
  const contextPacket = JSON.parse(
    contextInput.content.replace("APP_CONTEXT_PACKET\n", ""),
  );
  assertEquals(contextPacket.turnOrigin, "composer");
  assertEquals(contextPacket.latestUserMessageAnswersFollowUp, false);
});

Deno.test("runCompanionAgent asks consent before turning a concrete plan-day reply into a quest", async () => {
  const supabase = createMockSupabase();
  let guardedFetchCalled = false;
  const guardedFetch = (async (input: string | URL | Request) => {
    guardedFetchCalled = true;
    throw new Error(
      `Concrete plan-day follow-up should not call OpenAI: ${String(input)}`,
    );
  }) as typeof fetch;

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-plan-day-concrete-consent",
      message: "Finish my essay",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      activeFollowUp: {
        question: "Should today lean focus, recovery, or catching up?",
        reason:
          "That choice changes whether I protect deep work, lighten the load, or triage overdue items.",
        expectedAnswerType: "choice",
        options: ["Focus", "Recovery", "Catch up"],
        blocksDrafting: true,
      },
    },
  });

  assertEquals(guardedFetchCalled, false);
  assertEquals(result.mode, "clarify");
  assertEquals(result.intent, "plan_day");
  assertEquals(result.understandingState, "needs_followup");
  assertEquals(result.proposedActions, []);
  assertEquals(result.pendingAction, undefined);
  assertEquals(result.followUp?.expectedAnswerType, "confirmation");
  assertEquals(result.followUp?.options, ["Yes", "No"]);
  assertEquals(result.followUp?.question, "Would you like to form a quest?");
  assert(result.reply.includes("I won't turn that into a quest automatically"));
});

Deno.test("runCompanionAgent keeps plan-day energy answers out of the generic agent path", async () => {
  const supabase = createMockSupabase();
  let guardedFetchCalled = false;
  const guardedFetch = (async (input: string | URL | Request) => {
    guardedFetchCalled = true;
    throw new Error(
      `Plan-day energy answer should not call OpenAI: ${String(input)}`,
    );
  }) as typeof fetch;

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-plan-day-energy",
      message: "Low — keep it light",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      activeFollowUp: {
        question: "Quick check — what kind of energy are we working with?",
        reason: "Energy shapes how heavy I make the plan.",
        expectedAnswerType: "choice",
        options: [
          "Low — keep it light",
          "Medium — balanced",
          "High — bring it on",
        ],
        blocksDrafting: true,
      },
    },
  });

  assertEquals(guardedFetchCalled, false);
  assertEquals(result.intent, "plan_day");
  assert(result.reply !== "I'm here.");
  assert(result.reply.length > 10);
});

Deno.test("runCompanionAgent keeps typed quest text conversational for the sidecar card flow", async () => {
  const launchSupabase = createMockSupabase();
  let launchFetchCalled = false;

  const launchResult = await runCompanionAgent({
    guardedFetch: (async () => {
      launchFetchCalled = true;
      throw new Error("Quest launcher should use the deterministic opener");
    }) as typeof fetch,
    supabase: launchSupabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-quest-chat",
      message: "Quest?",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      starterIntent: "quest_capture",
      turnOrigin: "launcher",
    },
  });

  assertEquals(launchFetchCalled, false);
  assertEquals(launchResult.mode, "clarify");
  assertEquals(launchResult.intent, "schedule_task");
  assertEquals(
    launchResult.followUp?.question,
    "What quest do you want to capture?",
  );

  const supabase = createMockSupabase();
  const responseBodies: unknown[] = [];
  const guardedFetch =
    (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/conversations")) {
        return jsonResponse({ id: "conv_quest_chat" });
      }

      if (url.endsWith("/responses")) {
        responseBodies.push(JSON.parse(String(init?.body ?? "{}")));
        return jsonResponse({
          id: "resp_quest_chat",
          conversation: { id: "conv_quest_chat" },
          output: [
            {
              type: "function_call",
              call_id: "call_submit",
              name: "submit_companion_result",
              arguments: JSON.stringify({
                reply: "I can draft that as a quest for tomorrow morning.",
                mode: "pending_confirmation",
                intent: "schedule_task",
                confidence: 0.9,
                understanding_state: "ready_to_draft",
                proposed_actions: [
                  {
                    type: "quest.create",
                    title: "Pilates",
                    summary: "Add Pilates tomorrow at 8am.",
                    normalizedPayload: {
                      title: "Pilates",
                      date: "2026-04-19",
                      startTime: "08:00",
                      durationMinutes: 30,
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
      sessionId: "session-quest-chat",
      message: "Pilates tomorrow at 8am",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      turnOrigin: "composer",
      activeFollowUp: launchResult.followUp,
    },
  });

  assertEquals(responseBodies.length, 1);
  assertEquals(result.mode, "conversation");
  assertEquals(result.understandingState, "enough_to_discuss");
  assertEquals(result.pendingAction, undefined);
  assertEquals(result.proposedActions, []);
  assertEquals(
    supabase.inserts.some((entry) =>
      entry.table === "companion_pending_actions"
    ),
    false,
  );
});

Deno.test("runCompanionAgent does not create a composer draft from deterministic fallback", async () => {
  const supabase = createMockSupabase();
  let guardedFetchCalled = false;
  const guardedFetch = (async (input: string | URL | Request) => {
    guardedFetchCalled = true;
    throw new Error(`Fallback test should not call OpenAI: ${String(input)}`);
  }) as typeof fetch;

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "",
    request: {
      surface: "journeys",
      sessionId: "session-composer-fallback-no-draft",
      message: "Pilates tomorrow at 8am",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      turnOrigin: "composer",
    },
  });

  assertEquals(guardedFetchCalled, false);
  assertEquals(result.pendingAction, undefined);
  assertEquals(result.threadState.hasPendingAction, false);
  assert(
    supabase.inserts.every((entry) =>
      entry.table !== "companion_pending_actions"
    ),
    "deterministic fallback should not prepare a pending draft",
  );
});

Deno.test("runCompanionAgent keeps Quest? parser fallback conversational for the sidecar", async () => {
  const supabase = createMockSupabase();
  const { guardedFetch } = createRawMessageTextCaptureFetch("");

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-quest-gym-no-tools",
      message: "Gym at 6",
      inputMode: "text",
      currentDateTime: "2026-05-03T21:08:00-07:00",
      starterIntent: "quest_capture",
      turnOrigin: "composer",
    },
  });

  assertEquals(result.mode, "conversation");
  assertEquals(result.understandingState, "enough_to_discuss");
  assertEquals(result.pendingAction, undefined);
  assertEquals(result.proposedActions, []);
  assertEquals(
    supabase.inserts.some((entry) =>
      entry.table === "companion_pending_actions"
    ),
    false,
  );
});

Deno.test("runCompanionAgent keeps concrete quest-capture fallback conversational", async () => {
  const supabase = createMockSupabase();
  let fetchCalled = false;

  const result = await runCompanionAgent({
    guardedFetch: (async () => {
      fetchCalled = true;
      throw new Error("server error");
    }) as typeof fetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-quest-fallback",
      message: "Pilates tomorrow at 8am",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      starterIntent: "quest_capture",
      turnOrigin: "composer",
    },
  });

  assertEquals(fetchCalled, true);
  assertEquals(result.mode, "conversation");
  assertEquals(result.pendingAction, undefined);
  assertEquals(result.reply.includes("Quest?"), false);
  assertEquals(result.proposedActions, []);
  const pendingActionInsert = supabase.inserts.find((entry) =>
    entry.table === "companion_pending_actions"
  );
  assertEquals(pendingActionInsert, undefined);
});

Deno.test("runCompanionAgent carries selected date on quest-capture follow-ups", async () => {
  const supabase = createMockSupabase();

  const result = await runCompanionAgent({
    guardedFetch: (async () => {
      throw new Error("server error");
    }) as typeof fetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-quest-selected-date-follow-up",
      message: "tomorrow at 8am",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      selectedDate: "2026-04-21",
      starterIntent: "quest_capture",
      turnOrigin: "composer",
    },
  });

  assertEquals(result.mode, "clarify");
  assertEquals(result.followUp?.metadata?.selectedDate, "2026-04-21");
  assertEquals(
    result.followUp?.metadata?.sourceStarterIntent,
    "quest_capture",
  );
});

Deno.test("runCompanionAgent recovers persisted plan-day follow-up context when request state is stale", async () => {
  const followUp = {
    question: "Should today lean focus, recovery, or catching up?",
    reason:
      "That choice changes whether I protect deep work, lighten the load, or triage overdue items.",
    expectedAnswerType: "choice",
    options: ["Focus", "Recovery", "Catch up"],
    blocksDrafting: true,
  };
  const supabase = createMockSupabase({
    messages: [
      {
        id: "msg-2",
        role: "assistant",
        content:
          "Absolutely. Before I shape today, should it lean focus, recovery, or catching up?",
        created_at: "2026-04-18T15:00:01.000Z",
        input_mode: null,
        source: "agent",
        surface: "journeys",
        session_id: "session-plan-day-stale-state",
        metadata: { agentDecision: { followUp } },
      },
      {
        id: "msg-1",
        role: "user",
        content: "Plan my day",
        created_at: "2026-04-18T15:00:00.000Z",
        input_mode: "text",
        source: "agent",
        surface: "journeys",
        session_id: "session-plan-day-stale-state",
        metadata: null,
      },
    ],
  });
  let guardedFetchCalled = false;
  const guardedFetch = (async (input: string | URL | Request) => {
    guardedFetchCalled = true;
    throw new Error(
      `Persisted plan-day follow-up should not call OpenAI: ${String(input)}`,
    );
  }) as typeof fetch;

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-plan-day-stale-state",
      message: "Recovery",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
    },
  });

  assertEquals(guardedFetchCalled, false);
  assertEquals(result.intent, "plan_day");
  assertEquals(result.mode, "conversation");
  assertEquals(result.followUp, null);
  assertEquals(result.proposedActions, []);
  assert(result.reply !== "I'm here.");
  assert(result.reply.length > 10);
});

Deno.test("runCompanionAgent does not resurrect cleared persisted follow-ups", async () => {
  const oldFollowUp = {
    question: "Should today lean focus, recovery, or catching up?",
    reason:
      "That choice changes whether I protect deep work, lighten the load, or triage overdue items.",
    expectedAnswerType: "choice",
    options: ["Focus", "Recovery", "Catch up"],
    blocksDrafting: true,
  };
  const supabase = createMockSupabase({
    messages: [
      {
        id: "msg-4",
        role: "assistant",
        content:
          "No problem. We'll keep this as planning context, not a quest.",
        created_at: "2026-04-18T15:00:03.000Z",
        input_mode: null,
        source: "agent",
        surface: "journeys",
        session_id: "session-plan-day-cleared-follow-up",
        metadata: { agentDecision: { followUp: null } },
      },
      {
        id: "msg-3",
        role: "user",
        content: "No thanks",
        created_at: "2026-04-18T15:00:02.000Z",
        input_mode: "text",
        source: "agent",
        surface: "journeys",
        session_id: "session-plan-day-cleared-follow-up",
        metadata: null,
      },
      {
        id: "msg-2",
        role: "assistant",
        content:
          "Absolutely. Before I shape today, should it lean focus, recovery, or catching up?",
        created_at: "2026-04-18T15:00:01.000Z",
        input_mode: null,
        source: "agent",
        surface: "journeys",
        session_id: "session-plan-day-cleared-follow-up",
        metadata: { agentDecision: { followUp: oldFollowUp } },
      },
      {
        id: "msg-1",
        role: "user",
        content: "Plan my day",
        created_at: "2026-04-18T15:00:00.000Z",
        input_mode: "text",
        source: "agent",
        surface: "journeys",
        session_id: "session-plan-day-cleared-follow-up",
        metadata: null,
      },
    ],
  });
  const { guardedFetch, responseBodies } = createOutputTextCaptureFetch(
    "All clear.",
  );

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-plan-day-cleared-follow-up",
      message: "What else can we talk about?",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
    },
  });

  assert(responseBodies.length > 0);
  assertEquals(result.mode, "conversation");
  assertEquals(result.followUp, null);
  assertEquals(result.reply, "All clear.");
});

Deno.test("runCompanionAgent reads raw Responses message text for free-talk replies", async () => {
  const supabase = createMockSupabase({
    messages: [
      {
        id: "msg-free-talk-opener",
        role: "assistant",
        content: "What's good, champ?",
        created_at: "2026-05-03T16:12:00.000Z",
        input_mode: null,
        source: "agent",
        surface: "journeys",
        session_id: "session-free-talk-raw-output",
        metadata: { agentDecision: { followUp: null } },
      },
    ],
  });
  const { guardedFetch } = createRawMessageTextCaptureFetch(
    "Living pretty well. What are we getting into?",
  );

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-free-talk-raw-output",
      message: "Vibing how are you living?",
      inputMode: "text",
      currentDateTime: "2026-05-03T21:12:00-07:00",
      turnOrigin: "composer",
    },
  });

  assertEquals(result.mode, "conversation");
  assertEquals(result.followUp, null);
  assertEquals(
    result.reply,
    "Living pretty well. What are we getting into?",
  );
  assertEquals(result.pendingAction, undefined);
});

Deno.test("runCompanionAgent records provider diagnostics for model access failures", async () => {
  const supabase = createMockSupabase({
    messages: [
      {
        id: "msg-free-talk-opener",
        role: "assistant",
        content: "What's good, champ?",
        created_at: "2026-05-03T16:12:00.000Z",
        input_mode: null,
        source: "agent",
        surface: "journeys",
        session_id: "session-provider-model-access",
        metadata: { agentDecision: { followUp: null } },
      },
    ],
  });
  const { guardedFetch, responseBodies } = createResponseFailureFetch({
    status: 404,
    requestId: "req_model_missing",
    body: {
      error: {
        message:
          `The model \`${DEFAULT_COMPANION_AGENT_MODEL}\` does not exist or you do not have access to it.`,
        type: "invalid_request_error",
        code: "model_not_found",
      },
    },
  });

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-provider-model-access",
      message: "Chilling. How are you?",
      inputMode: "text",
      currentDateTime: "2026-05-03T21:12:00-07:00",
      turnOrigin: "composer",
    },
  });

  assertEquals(responseBodies[0].model, DEFAULT_COMPANION_AGENT_MODEL);
  assertEquals(responseBodies[0].reasoning, { effort: "none" });
  assertEquals(result.mode, "conversation");
  assert(result.reply.includes("having trouble reaching my AI brain"));

  const diagnostics = (result as Record<string, unknown>)
    .providerDiagnostics as Record<string, unknown>;
  assertEquals(diagnostics.reason, "model_access");
  assertEquals(diagnostics.model, DEFAULT_COMPANION_AGENT_MODEL);
  assertEquals(diagnostics.requestId, "req_model_missing");

  const agentDecision = getLatestAssistantAgentDecision(supabase.inserts);
  const metadataDiagnostics = agentDecision
    ?.providerDiagnostics as Record<string, unknown>;
  assertEquals(metadataDiagnostics.reason, "model_access");
  assertEquals(metadataDiagnostics.requestId, "req_model_missing");
});

Deno.test("runCompanionAgent records provider diagnostics for invalid API keys", async () => {
  const supabase = createMockSupabase({
    messages: [
      {
        id: "msg-free-talk-opener",
        role: "assistant",
        content: "What's good, champ?",
        created_at: "2026-05-03T16:12:00.000Z",
        input_mode: null,
        source: "agent",
        surface: "journeys",
        session_id: "session-provider-invalid-key",
        metadata: { agentDecision: { followUp: null } },
      },
    ],
  });
  const { guardedFetch } = createResponseFailureFetch({
    status: 401,
    requestId: "req_invalid_key",
    body: {
      error: {
        message: "Incorrect API key provided.",
        type: "invalid_request_error",
        code: "invalid_api_key",
      },
    },
  });

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-provider-invalid-key",
      message: "Chilling. How are you?",
      inputMode: "text",
      currentDateTime: "2026-05-03T21:12:00-07:00",
      turnOrigin: "composer",
    },
  });

  assertEquals(result.mode, "conversation");
  assert(result.reply.includes("having trouble reaching my AI brain"));

  const diagnostics = (result as Record<string, unknown>)
    .providerDiagnostics as Record<string, unknown>;
  assertEquals(diagnostics.reason, "auth");
  assertEquals(diagnostics.status, 401);
  assertEquals(diagnostics.requestId, "req_invalid_key");
});

Deno.test("runCompanionAgent records provider diagnostics for empty model output", async () => {
  const supabase = createMockSupabase({
    messages: [
      {
        id: "msg-free-talk-opener",
        role: "assistant",
        content: "What's good, champ?",
        created_at: "2026-05-03T16:12:00.000Z",
        input_mode: null,
        source: "agent",
        surface: "journeys",
        session_id: "session-empty-model-output",
        metadata: { agentDecision: { followUp: null } },
      },
    ],
  });
  const { guardedFetch } = createRawMessageTextCaptureFetch("");

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-empty-model-output",
      message: "Chilling. How are you?",
      inputMode: "text",
      currentDateTime: "2026-05-03T21:12:00-07:00",
      turnOrigin: "composer",
    },
  });

  assertEquals(result.mode, "conversation");
  assert(result.reply.includes("came back blank"));
  const diagnostics = (result as Record<string, unknown>)
    .providerDiagnostics as Record<string, unknown>;
  assertEquals(diagnostics.reason, "empty_output");
  assertEquals(diagnostics.responseId, "resp_1");
});

Deno.test("runCompanionAgent asks a follow-up for bare plan-day variants without OpenAI", async () => {
  const supabase = createMockSupabase();
  let guardedFetchCalled = false;
  const guardedFetch = (async (input: string | URL | Request) => {
    guardedFetchCalled = true;
    throw new Error(
      `Bare plan-day variant should not call OpenAI: ${String(input)}`,
    );
  }) as typeof fetch;

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-plan-day-variant",
      message: "Show me today",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      starterIntent: "plan_day",
    },
  });

  assertEquals(guardedFetchCalled, false);
  assertEquals(result.mode, "clarify");
  assertEquals(result.intent, "plan_day");
  assertEquals(result.understandingState, "needs_followup");
  assert(result.followUp?.question.includes("focus"));
  assertEquals(result.proposedActions, []);
  assertEquals(result.structuredResponse, null);
});

Deno.test("runCompanionAgent preserves active follow-up when the model submits a thin reply", async () => {
  const followUp = {
    question:
      "What are we making room for: focus work, recovery, or a specific commitment?",
    reason: "The next step depends on what should move.",
    expectedAnswerType: "choice" as const,
    options: ["Focus work", "Recovery", "Specific commitment"],
    blocksDrafting: true,
  };
  const supabase = createMockSupabase();
  const { guardedFetch } = createInstructionCaptureFetch("I'm here.");

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-active-follow-up-thin-submit",
      message: "Recovery",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      activeFollowUp: followUp,
    },
  });

  assertEquals(result.mode, "clarify");
  assertEquals(result.understandingState, "needs_followup");
  assertEquals(result.followUp?.question, followUp.question);
  assert(result.reply !== "I'm here.");
  assert(result.reply.includes(followUp.question));
  assertEquals(result.proposedActions, []);
  assertEquals(result.structuredResponse, null);
  assertEquals(result.pendingAction, undefined);
});

Deno.test("runCompanionAgent preserves active follow-up when OpenAI returns only thin output text", async () => {
  const followUp = {
    question:
      "What are we making room for: focus work, recovery, or a specific commitment?",
    reason: "The next step depends on what should move.",
    expectedAnswerType: "choice" as const,
    options: ["Focus work", "Recovery", "Specific commitment"],
    blocksDrafting: true,
  };
  const supabase = createMockSupabase();
  const { guardedFetch } = createOutputTextCaptureFetch("I'm here.");

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-active-follow-up-thin-output",
      message: "Recovery",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      activeFollowUp: followUp,
    },
  });

  assertEquals(result.mode, "clarify");
  assertEquals(result.understandingState, "needs_followup");
  assertEquals(result.followUp?.question, followUp.question);
  assert(result.reply !== "I'm here.");
  assert(result.reply.includes(followUp.question));
  assertEquals(result.proposedActions, []);
  assertEquals(result.structuredResponse, null);
  assertEquals(result.pendingAction, undefined);
});

Deno.test("runCompanionAgent treats the need-more fallback as a thin reply", async () => {
  const followUp = {
    question:
      "What are we making room for: focus work, recovery, or a specific commitment?",
    reason: "The next step depends on what should move.",
    expectedAnswerType: "choice" as const,
    options: ["Focus work", "Recovery", "Specific commitment"],
    blocksDrafting: true,
  };
  const supabase = createMockSupabase();
  const { guardedFetch } = createOutputTextCaptureFetch(
    "I need a little more to help. Tell me what you want to do next.",
  );

  const result = await runCompanionAgent({
    guardedFetch,
    supabase: supabase.client,
    userId: "00000000-0000-4000-8000-000000000001",
    openAIApiKey: "test-openai-key",
    request: {
      surface: "journeys",
      sessionId: "session-active-follow-up-need-more-output",
      message: "Recovery",
      inputMode: "text",
      currentDateTime: "2026-04-18T08:00:00-07:00",
      activeFollowUp: followUp,
    },
  });

  assertEquals(result.mode, "clarify");
  assertEquals(result.understandingState, "needs_followup");
  assertEquals(result.followUp?.question, followUp.question);
  assert(result.reply.includes(followUp.question));
  assertEquals(result.proposedActions, []);
  assertEquals(result.structuredResponse, null);
  assertEquals(result.pendingAction, undefined);
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

    assertEquals(result.mode, "conversation");
    assertEquals(result.intent, "check_calendar");
    assertEquals(result.understandingState, "enough_to_discuss");
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

    assertEquals(result.mode, "conversation");
    assertEquals(result.intent, "schedule_task");
    assertEquals(result.understandingState, "enough_to_discuss");
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
