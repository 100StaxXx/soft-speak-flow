import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { runCompanionAgent } from "./agent.ts";

type QueryResult = {
  data?: unknown;
  error?: unknown;
  count?: number | null;
};

function createQueryResult(table: string, operation: string, maybeSingle: boolean): QueryResult {
  if (table === "user_companion" && maybeSingle) {
    return {
      data: {
        id: "companion-1",
        companion_name: "Cosmiq",
        spirit_animal: "fox",
        current_stage: 2,
        current_mood: "steady",
      },
      error: null,
    };
  }

  if (table === "companion_chat_threads" && maybeSingle) {
    return { data: null, error: null };
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

function createMockSupabase() {
  const inserts: Array<{ table: string; value: unknown }> = [];

  const createBuilder = (table: string) => {
    let operation = "select";
    let maybeSingle = false;

    const builder = {
      select: (_columns?: string, _options?: unknown) => {
        operation = "select";
        return builder;
      },
      update: (_value: unknown) => {
        operation = "update";
        return builder;
      },
      insert: (value: unknown) => {
        operation = "insert";
        inserts.push({ table, value });
        return builder;
      },
      eq: () => builder,
      gte: () => builder,
      lte: () => builder,
      lt: () => builder,
      is: () => builder,
      not: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => {
        maybeSingle = true;
        return Promise.resolve(createQueryResult(table, operation, maybeSingle));
      },
      then: (
        resolve: (value: QueryResult) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve(createQueryResult(table, operation, maybeSingle)).then(
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

Deno.test("runCompanionAgent falls back to deterministic planner when OpenAI is not configured", async () => {
  const supabase = createMockSupabase();
  let guardedFetchCalled = false;

  const result = await runCompanionAgent({
    guardedFetch: (async () => {
      guardedFetchCalled = true;
      throw new Error("guardedFetch should not be called without OpenAI config");
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
      planningMode: "balanced",
    },
  });

  assertEquals(guardedFetchCalled, false);
  assertEquals(result.companionId, "companion-1");
  assertEquals(result.confidence, 0.55);
  assertEquals(result.threadState.sessionId, "session-1");
  assert(result.reply.length > 0);
  assert(
    supabase.inserts.some((entry) => entry.table === "companion_chats"),
    "expected fallback turn to be persisted",
  );
});
