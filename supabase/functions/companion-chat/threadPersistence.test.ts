import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildCompanionChatThreadPreview,
  buildCompanionChatThreadTitle,
  persistCompanionChatTurn,
} from "./threadPersistence.ts";

const createSupabaseMock = (options?: { existingThread?: boolean }) => {
  const companionChatInserts: unknown[] = [];
  const threadUpdates: Array<{ sessionId: string; payload: Record<string, unknown> }> = [];
  const threadInserts: unknown[] = [];

  const supabase = {
    from(table: string) {
      if (table === "companion_chats") {
        return {
          insert: async (payload: unknown) => {
            companionChatInserts.push(payload);
            return { error: null };
          },
        };
      }

      if (table === "companion_chat_threads") {
        return {
          update: (payload: Record<string, unknown>) => ({
            eq: (_column: string, sessionId: string) => ({
              select: (_selection: string) => ({
                maybeSingle: async () => {
                  threadUpdates.push({ sessionId, payload });
                  return {
                    data: options?.existingThread ? { session_id: sessionId } : null,
                    error: null,
                  };
                },
              }),
            }),
          }),
          insert: async (payload: unknown) => {
            threadInserts.push(payload);
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  return {
    supabase,
    companionChatInserts,
    threadUpdates,
    threadInserts,
  };
};

Deno.test("persistCompanionChatTurn writes journeys chat rows and inserts thread metadata when missing", async () => {
  const mock = createSupabaseMock();

  await persistCompanionChatTurn({
    supabase: mock.supabase,
    userId: "user-1",
    companionId: "companion-1",
    sessionId: "session-1",
    surface: "journeys",
    message: "Help me sort out today.",
    reply: "Let's take it one step at a time.",
    inputMode: "text",
    createdAt: "2026-04-19T08:30:00.000Z",
  });

  assertEquals(mock.companionChatInserts.length, 1);
  assertEquals(mock.companionChatInserts[0], [
    {
      user_id: "user-1",
      companion_id: "companion-1",
      role: "user",
      content: "Help me sort out today.",
      input_mode: "text",
      session_id: "session-1",
      surface: "journeys",
      source: "chat",
      created_at: "2026-04-19T08:30:00.000Z",
    },
    {
      user_id: "user-1",
      companion_id: "companion-1",
      role: "assistant",
      content: "Let's take it one step at a time.",
      input_mode: null,
      session_id: "session-1",
      surface: "journeys",
      source: "chat",
      created_at: "2026-04-19T08:30:00.000Z",
    },
  ]);

  assertEquals(mock.threadUpdates, [
    {
      sessionId: "session-1",
      payload: {
        preview_text: "Let's take it one step at a time.",
        last_message_at: "2026-04-19T08:30:00.000Z",
        archived_at: null,
      },
    },
  ]);

  assertEquals(mock.threadInserts, [
    {
      session_id: "session-1",
      user_id: "user-1",
      companion_id: "companion-1",
      surface: "journeys",
      title: "Help me sort out today.",
      preview_text: "Let's take it one step at a time.",
      created_at: "2026-04-19T08:30:00.000Z",
      last_message_at: "2026-04-19T08:30:00.000Z",
      archived_at: null,
    },
  ]);
});

Deno.test("persistCompanionChatTurn updates an existing thread without replacing its title", async () => {
  const mock = createSupabaseMock({ existingThread: true });

  await persistCompanionChatTurn({
    supabase: mock.supabase,
    userId: "user-1",
    companionId: "companion-1",
    sessionId: "session-1",
    surface: "companion",
    message: "Still here?",
    reply: "I'm right here.",
    inputMode: "voice",
    createdAt: "2026-04-19T08:35:00.000Z",
  });

  assertEquals(mock.threadInserts.length, 0);
  assertEquals(mock.threadUpdates, [
    {
      sessionId: "session-1",
      payload: {
        preview_text: "I'm right here.",
        last_message_at: "2026-04-19T08:35:00.000Z",
        archived_at: null,
      },
    },
  ]);
});

Deno.test("thread title and preview helpers normalize long text", () => {
  assertEquals(
    buildCompanionChatThreadTitle("  Help   me map   out   a really long thread title that should trim down cleanly for the picker UI  "),
    "Help me map out a really long thread title that should trim down clea...",
  );
  assertEquals(
    buildCompanionChatThreadPreview("  The preview keeps the latest message readable without weird   spacing.  "),
    "The preview keeps the latest message readable without weird spacing.",
  );
});
