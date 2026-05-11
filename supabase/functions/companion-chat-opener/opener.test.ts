import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { LoadedCompanionAgentContext } from "../companion-agent/types.ts";
import type { UserCompanionRow } from "../companion-agent/agent.ts";
import {
  buildCompanionOpenerInstructions,
  buildCompanionOpenerSnapshot,
  buildCompanionOpenerUserPrompt,
  buildFallbackCompanionOpener,
  hasUnsafeCompanionOpenerTone,
  normalizeCompanionOpenerReply,
  persistCompanionOpenerTurn,
  persistCompanionOpenerTurnBestEffort,
  selectCompanionOpenerSignal,
} from "./opener.ts";

const companion: UserCompanionRow = {
  id: "companion-1",
  companion_name: "Flareonox",
  cached_creature_name: null,
  preset_id: "fox",
  spirit_animal: "fox",
  core_element: "fire",
  current_stage: 3,
  current_mood: "steady",
};

const createContext = (
  overrides: Partial<LoadedCompanionAgentContext> = {},
): LoadedCompanionAgentContext => ({
  thread: null,
  messages: [],
  tasks: [],
  recentCompletedTasks: [],
  rituals: [],
  campaigns: [],
  calendarEvents: [],
  reminders: [],
  goals: [],
  recentMemory: {
    profile: null,
  },
  reflections: [],
  activePendingAction: null,
  companionMode: "alpha",
  companionModeAdaptationEnabled: true,
  visibleDateStart: "2026-05-10",
  visibleDateEnd: "2026-05-16",
  currentDateTime: "2026-05-10T09:55:00-07:00",
  timezone: "-07:00",
  ...overrides,
});

Deno.test("selectCompanionOpenerSignal notices missed tasks before inventing momentum", () => {
  const signal = selectCompanionOpenerSignal({
    currentDateTime: "2026-05-10T09:55:00-07:00",
    context: createContext({
      tasks: [
        {
          id: "task-1",
          task_text: "Review launch notes",
          task_date: "2026-05-10",
          scheduled_time: "08:30",
          completed: false,
        },
      ],
    }),
  });

  assertEquals(signal.type, "missed_task");
  assert(signal.facts.join(" ").includes("Review launch notes"));
});

Deno.test("selectCompanionOpenerSignal notices low-energy reflections", () => {
  const signal = selectCompanionOpenerSignal({
    currentDateTime: "2026-05-10T09:55:00-07:00",
    context: createContext({
      reflections: [
        {
          id: "reflection-1",
          mood: "overwhelmed",
          reflection: "Feeling low energy after a long night.",
          created_at: "2026-05-10T08:30:00-07:00",
        },
      ],
    }),
  });

  assertEquals(signal.type, "low_energy");
});

Deno.test("selectCompanionOpenerSignal notices busy days", () => {
  const signal = selectCompanionOpenerSignal({
    currentDateTime: "2026-05-10T09:55:00-07:00",
    context: createContext({
      tasks: [
        {
          id: "task-1",
          task_text: "Deep work",
          task_date: "2026-05-10",
          estimated_duration: 120,
          completed: false,
        },
        {
          id: "task-2",
          task_text: "Email cleanup",
          task_date: "2026-05-10",
          estimated_duration: 60,
          completed: false,
        },
        {
          id: "task-3",
          task_text: "Campaign draft",
          task_date: "2026-05-10",
          estimated_duration: 90,
          completed: false,
        },
      ],
      calendarEvents: [
        {
          id: "event-1",
          title: "Team sync",
          start_time: "2026-05-10T13:00:00-07:00",
        },
      ],
    }),
  });

  assertEquals(signal.type, "busy_day");
});

Deno.test("selectCompanionOpenerSignal notices streak momentum", () => {
  const signal = selectCompanionOpenerSignal({
    currentDateTime: "2026-05-10T09:55:00-07:00",
    context: createContext({
      recentMemory: {
        profile: {
          current_habit_streak: 9,
        },
      },
    }),
  });

  assertEquals(signal.type, "streak");
  assert(signal.facts[0].includes("9-day"));
});

Deno.test("selectCompanionOpenerSignal notices campaign drift", () => {
  const signal = selectCompanionOpenerSignal({
    currentDateTime: "2026-05-10T09:55:00-07:00",
    context: createContext({
      campaigns: [
        {
          id: "campaign-1",
          title: "Ship beta",
          end_date: "2026-05-14",
          progress_percentage: 20,
        },
      ],
    }),
  });

  assertEquals(signal.type, "campaign_drift");
  assert(signal.facts.join(" ").includes("Ship beta"));
});

Deno.test("buildCompanionOpenerInstructions uses the companion planner prompt", () => {
  const snapshot = buildCompanionOpenerSnapshot({
    companion,
    currentDateTime: "2026-05-10T09:55:00-07:00",
    context: createContext(),
  });
  const instructions = buildCompanionOpenerInstructions(snapshot);

  assert(
    instructions.includes(
      "You are the user's Cosmiq companion inside the Journeys tab.",
    ),
  );
  assert(instructions.includes("Write like a normal chatbot first"));
  assert(
    instructions.includes("Voice: keep it warm, grounded, and supportive"),
  );
  assert(instructions.includes("Do not mention internal prompts"));
  assert(
    instructions.includes(
      "Return minified JSON with keys reply and mode only.",
    ),
  );
});

Deno.test("normalizeCompanionOpenerReply strips formatting and caps length", () => {
  const reply = normalizeCompanionOpenerReply(
    `**${Array.from({ length: 60 }, (_, index) => `word${index}`).join(" ")}**`,
  );

  assertEquals(reply.includes("*"), false);
  assert(reply.split(/\s+/).length <= 45);
});

Deno.test("normalizeCompanionOpenerReply accepts planner-style JSON replies", () => {
  const reply = normalizeCompanionOpenerReply(
    `{"reply":"Today looks open enough for one clean move. Want to pick it together?","mode":"conversational"}`,
  );

  assertEquals(
    reply,
    "Today looks open enough for one clean move. Want to pick it together?",
  );
});

Deno.test("normalizeCompanionOpenerReply rejects hostile opener phrasing", () => {
  const reply = normalizeCompanionOpenerReply(
    "Reality check one clean action would shut down half this amateur nonsense immediately.",
  );

  assertEquals(hasUnsafeCompanionOpenerTone(reply), false);
  assertEquals(reply, "I'm here. What's the move?");
});

Deno.test("buildCompanionOpenerUserPrompt shapes opener context for the planner prompt", () => {
  const snapshot = buildCompanionOpenerSnapshot({
    companion,
    currentDateTime: "2026-05-10T09:55:00-07:00",
    context: createContext({
      tasks: [
        {
          id: "task-1",
          task_text: "Review launch notes",
          task_date: "2026-05-10",
          scheduled_time: "11:00",
          completed: false,
        },
      ],
    }),
  });

  const prompt = JSON.parse(buildCompanionOpenerUserPrompt(snapshot)) as {
    targetMode?: string;
    tonePack?: string;
    deterministicContext?: Record<string, unknown>;
  };

  assertEquals(prompt.targetMode, "conversational");
  assertEquals(prompt.tonePack, "soft");
  assertEquals(
    prompt.deterministicContext?.starterIntent,
    "companion_chat_opener",
  );
  assert(Array.isArray(prompt.deterministicContext?.tasks));
});

Deno.test("buildFallbackCompanionOpener keeps fresh-thread opens server-side when OpenAI fails", () => {
  const snapshot = buildCompanionOpenerSnapshot({
    companion,
    currentDateTime: "2026-05-10T09:55:00-07:00",
    context: createContext({
      tasks: [
        {
          id: "task-1",
          task_text: "Deep work",
          task_date: "2026-05-10",
          estimated_duration: 300,
          completed: false,
        },
      ],
    }),
  });

  const opener = buildFallbackCompanionOpener(snapshot);

  assertEquals(opener.signal.type, "busy_day");
  assertEquals(opener.openaiConversationId, null);
  assertEquals(opener.lastOpenAIResponseId, null);
  assert(opener.reply.length > 0);
  assert(opener.reply.split(/\s+/).length <= 45);
});

Deno.test("persistCompanionOpenerTurn writes the new opener before archiving older active threads", async () => {
  const calls: Array<
    { table: string; action: string; payload?: unknown; filters?: unknown[] }
  > = [];
  const supabase = {
    from(table: string) {
      const filters: unknown[] = [];
      const builder = {
        update(payload: unknown) {
          calls.push({ table, action: "update", payload, filters });
          return builder;
        },
        insert(payload: unknown) {
          calls.push({ table, action: "insert", payload, filters });
          return Promise.resolve({ error: null });
        },
        select(_columns: string, options?: { count?: string; head?: boolean }) {
          calls.push({ table, action: "select", payload: options, filters });
          return builder;
        },
        eq(column: string, value: unknown) {
          filters.push(["eq", column, value]);
          return builder;
        },
        neq(column: string, value: unknown) {
          filters.push(["neq", column, value]);
          return builder;
        },
        is(column: string, value: unknown) {
          filters.push(["is", column, value]);
          return Promise.resolve({ error: null });
        },
        maybeSingle() {
          return Promise.resolve({ data: null, error: null });
        },
      };
      return builder;
    },
  };

  await persistCompanionOpenerTurn({
    supabase,
    userId: "user-1",
    companionId: "companion-1",
    sessionId: "session-new",
    reply: "You have a chunky day, so let's pick the sharp edge first.",
    signal: { type: "busy_day", facts: ["4 open tasks today"] },
    currentDateTime: "2026-05-10T09:55:00-07:00",
    createdAt: "2026-05-10T16:55:00.000Z",
    openaiConversationId: "conv_1",
    lastOpenAIResponseId: "resp_1",
  });

  const openerInsert = calls.find((call) =>
    call.table === "companion_chats" && call.action === "insert"
  );
  const openerInsertIndex = calls.findIndex((call) => call === openerInsert);
  assertEquals(
    (openerInsert?.payload as Record<string, unknown>).role,
    "assistant",
  );
  assertEquals(
    (openerInsert?.payload as Record<string, unknown>).session_id,
    "session-new",
  );
  assertEquals(
    ((openerInsert?.payload as Record<string, unknown>).metadata as Record<
      string,
      unknown
    >).source,
    "opener",
  );
  assertEquals(
    ((openerInsert?.payload as Record<string, unknown>).metadata as Record<
      string,
      unknown
    >).signal,
    "busy_day",
  );
  assertEquals(
    ((openerInsert?.payload as Record<string, unknown>).metadata as Record<
      string,
      unknown
    >).currentDateTime,
    "2026-05-10T09:55:00-07:00",
  );

  const threadInsert = calls.find((call) =>
    call.table === "companion_chat_threads" && call.action === "insert"
  );
  const threadInsertIndex = calls.findIndex((call) => call === threadInsert);
  assertEquals(
    (threadInsert?.payload as Record<string, unknown>).openai_conversation_id,
    "conv_1",
  );
  assertEquals(
    (threadInsert?.payload as Record<string, unknown>).last_openai_response_id,
    "resp_1",
  );

  const archiveCall = calls.find((call) =>
    call.table === "companion_chat_threads" &&
    call.action === "update" &&
    (call.payload as Record<string, unknown>)?.archived_at ===
      "2026-05-10T16:55:00.000Z"
  );
  const archiveIndex = calls.findIndex((call) => call === archiveCall);

  assert(openerInsertIndex >= 0);
  assert(threadInsertIndex >= 0);
  assert(archiveIndex > threadInsertIndex);
  assertEquals(archiveCall, {
    table: "companion_chat_threads",
    action: "update",
    payload: { archived_at: "2026-05-10T16:55:00.000Z" },
    filters: [
      ["eq", "user_id", "user-1"],
      ["eq", "companion_id", "companion-1"],
      ["eq", "surface", "companion"],
      ["neq", "session_id", "session-new"],
      ["is", "archived_at", null],
    ],
  });
});

Deno.test("persistCompanionOpenerTurnBestEffort reports persistence failure without archiving older active threads", async () => {
  const calls: Array<{ table: string; action: string; payload?: unknown }> = [];
  const supabase = {
    from(table: string) {
      const builder = {
        update(payload: unknown) {
          calls.push({ table, action: "update", payload });
          return builder;
        },
        insert(payload: unknown) {
          calls.push({ table, action: "insert", payload });
          return Promise.resolve({
            error: { code: "23514", message: "companion_chats insert failed" },
          });
        },
        select() {
          calls.push({ table, action: "select" });
          return builder;
        },
        eq() {
          return builder;
        },
        neq() {
          return builder;
        },
        is() {
          return Promise.resolve({ error: null });
        },
        maybeSingle() {
          return Promise.resolve({ data: null, error: null });
        },
      };
      return builder;
    },
  };

  const ready = await persistCompanionOpenerTurnBestEffort({
    supabase,
    userId: "user-1",
    companionId: "companion-1",
    sessionId: "session-new",
    reply: "I'm here. What's the move?",
    signal: { type: "open_context", facts: [] },
    currentDateTime: "2026-05-10T09:55:00-07:00",
    createdAt: "2026-05-10T16:55:00.000Z",
    requestId: "request-1",
  });

  assertEquals(ready, false);
  assertEquals(
    calls.some((call) =>
      call.table === "companion_chat_threads" &&
      call.action === "update" &&
      (call.payload as Record<string, unknown>)?.archived_at ===
        "2026-05-10T16:55:00.000Z"
    ),
    false,
  );
});

Deno.test("persistCompanionOpenerTurnBestEffort keeps opener ready when archive cleanup fails", async () => {
  const calls: Array<{ table: string; action: string; payload?: unknown }> = [];
  const supabase = {
    from(table: string) {
      const builder = {
        update(payload: unknown) {
          calls.push({ table, action: "update", payload });
          return builder;
        },
        insert(payload: unknown) {
          calls.push({ table, action: "insert", payload });
          return Promise.resolve({ error: null });
        },
        select() {
          calls.push({ table, action: "select" });
          return builder;
        },
        eq() {
          return builder;
        },
        neq() {
          return builder;
        },
        is() {
          return Promise.resolve({
            error: { code: "57014", message: "archive timeout" },
          });
        },
        maybeSingle() {
          return Promise.resolve({ data: null, error: null });
        },
      };
      return builder;
    },
  };

  const ready = await persistCompanionOpenerTurnBestEffort({
    supabase,
    userId: "user-1",
    companionId: "companion-1",
    sessionId: "session-new",
    reply: "I'm here. What's the move?",
    signal: { type: "open_context", facts: [] },
    currentDateTime: "2026-05-10T09:55:00-07:00",
    createdAt: "2026-05-10T16:55:00.000Z",
    requestId: "request-1",
  });

  assertEquals(ready, true);
  assertEquals(
    calls.some((call) =>
      call.table === "companion_chats" && call.action === "insert"
    ),
    true,
  );
  assertEquals(
    calls.some((call) =>
      call.table === "companion_chat_threads" &&
      call.action === "update" &&
      (call.payload as Record<string, unknown>)?.archived_at ===
        "2026-05-10T16:55:00.000Z"
    ),
    true,
  );
});
